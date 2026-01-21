import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { OpenAIProvider } from './providers/openai.provider';
import { AnthropicProvider } from './providers/anthropic.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { BaseAIProvider } from './providers/base.provider';
import {
  CircuitBreakerFactory,
  CircuitBreakerOpenError,
} from '../../common/utils/circuit-breaker';
import {
  AIProvider,
  AICompletionRequest,
  AICompletionResponse,
  StreamChunk,
  TokenUsage,
  ChatMessage,
  getContextLimit,
} from './types';

interface UsageRecord {
  projectId: string;
  userId?: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  cost: number;
  operation: string;
}

@Injectable()
export class AIService implements OnModuleInit {
  private readonly logger = new Logger(AIService.name);
  private providers = new Map<AIProvider, BaseAIProvider>();
  private defaultProvider: AIProvider = AIProvider.OPENAI;

  // Simple in-memory cache for repeated prompts (clear on restart)
  private responseCache = new Map<string, { response: AICompletionResponse; timestamp: number }>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly openaiProvider: OpenAIProvider,
    private readonly anthropicProvider: AnthropicProvider,
    private readonly geminiProvider: GeminiProvider,
  ) {}

  onModuleInit() {
    // Register available providers
    if (this.openaiProvider.isAvailable()) {
      this.providers.set(AIProvider.OPENAI, this.openaiProvider);
      this.logger.log('OpenAI provider initialized');
    }

    if (this.anthropicProvider.isAvailable()) {
      this.providers.set(AIProvider.ANTHROPIC, this.anthropicProvider);
      this.logger.log('Anthropic provider initialized');
    }

    if (this.geminiProvider.isAvailable()) {
      this.providers.set(AIProvider.GEMINI, this.geminiProvider);
      this.logger.log('Gemini provider initialized');
    }

    // Set default provider based on availability (prefer Gemini for cost-effective testing)
    if (!this.providers.has(this.defaultProvider)) {
      // Priority: Gemini (cheapest) > OpenAI > Anthropic
      const priorityOrder = [AIProvider.GEMINI, AIProvider.OPENAI, AIProvider.ANTHROPIC];
      for (const provider of priorityOrder) {
        if (this.providers.has(provider)) {
          this.defaultProvider = provider;
          this.logger.warn(`Default provider not available, using ${this.defaultProvider}`);
          break;
        }
      }
      if (this.providers.size === 0) {
        this.logger.warn('No AI providers configured!');
      }
    }

    // Clean cache periodically
    setInterval(() => this.cleanCache(), this.CACHE_TTL_MS);
  }

  /**
   * Get a completion with automatic retry and caching
   */
  async complete(
    request: AICompletionRequest,
    options?: {
      provider?: AIProvider;
      projectId?: string;
      userId?: string;
      operation?: string;
      useCache?: boolean;
      maxRetries?: number;
    },
  ): Promise<AICompletionResponse> {
    const provider = this.getProvider(options?.provider);
    const useCache = options?.useCache ?? true;
    const maxRetries = options?.maxRetries ?? 3;

    // Check cache for identical requests
    if (useCache && !request.stream) {
      const cacheKey = this.getCacheKey(request);
      const cached = this.responseCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
        this.logger.debug('Returning cached response');
        return { ...cached.response, cached: true };
      }
    }

    // Validate context size
    const model = request.model ?? provider.defaultModel;
    const totalTokens = this.estimateRequestTokens(request, provider);
    const contextLimit = getContextLimit(model);

    if (totalTokens > contextLimit * 0.9) {
      this.logger.warn(
        `Request may exceed context limit: ${totalTokens} / ${contextLimit} tokens`,
      );
    }

    // Execute with retry and circuit breaker
    const circuitBreaker = CircuitBreakerFactory.getOrCreate(`ai-${options?.provider || this.defaultProvider}`, {
      failureThreshold: 5,
      successThreshold: 2,
      resetTimeout: 60000, // 1 minute
    });

    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await circuitBreaker.execute(() => provider.complete(request));

        // Cache successful response
        if (useCache && !request.stream) {
          const cacheKey = this.getCacheKey(request);
          this.responseCache.set(cacheKey, {
            response,
            timestamp: Date.now(),
          });
        }

        // Track usage
        if (options?.projectId) {
          await this.trackUsage({
            projectId: options.projectId,
            userId: options.userId,
            model: response.model,
            promptTokens: response.usage.promptTokens,
            completionTokens: response.usage.completionTokens,
            cost: response.usage.estimatedCost,
            operation: options.operation ?? 'completion',
          });
        }

        return response;
      } catch (error: unknown) {
        const err = error as Error;
        lastError = err;
        this.logger.warn(
          `AI completion attempt ${attempt}/${maxRetries} failed: ${err.message}`,
        );

        // Don't retry on circuit breaker open or non-retryable errors
        if (error instanceof CircuitBreakerOpenError || this.isNonRetryableError(err)) {
          throw error;
        }

        // Exponential backoff
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          await this.sleep(delay);
        }
      }
    }

    throw lastError ?? new Error('AI completion failed after retries');
  }

  /**
   * Stream a completion with automatic tracking
   */
  async *stream(
    request: AICompletionRequest,
    options?: {
      provider?: AIProvider;
      projectId?: string;
      userId?: string;
      operation?: string;
    },
  ): AsyncGenerator<StreamChunk> {
    const provider = this.getProvider(options?.provider);
    let totalUsage: TokenUsage | undefined;

    try {
      for await (const chunk of provider.stream(request)) {
        if (chunk.usage) {
          totalUsage = chunk.usage;
        }
        yield chunk;
      }
    } finally {
      // Track usage after stream completes
      if (options?.projectId && totalUsage) {
        await this.trackUsage({
          projectId: options.projectId,
          userId: options.userId,
          model: request.model ?? provider.defaultModel,
          promptTokens: totalUsage.promptTokens,
          completionTokens: totalUsage.completionTokens,
          cost: totalUsage.estimatedCost,
          operation: options.operation ?? 'stream',
        });
      }
    }
  }

  /**
   * Count tokens for text
   */
  countTokens(text: string, provider?: AIProvider, model?: string): number {
    const p = this.getProvider(provider);
    return p.countTokens(text, model);
  }

  /**
   * Get estimated tokens for a request
   */
  estimateRequestTokens(request: AICompletionRequest, provider?: BaseAIProvider): number {
    const p = provider ?? this.getProvider();
    const messagesText = request.messages.map((m) => m.content).join('\n');
    return p.countTokens(messagesText);
  }

  /**
   * Get available providers
   */
  getAvailableProviders(): AIProvider[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Check if any AI provider is available
   */
  isAvailable(): boolean {
    return this.providers.size > 0;
  }

  /**
   * Get usage statistics for a project
   */
  async getProjectUsage(
    projectId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    totalTokens: number;
    totalCost: number;
    byModel: Record<string, { tokens: number; cost: number }>;
    byOperation: Record<string, { tokens: number; cost: number }>;
  }> {
    // In a real implementation, this would query from a usage tracking table
    // For now, return a placeholder that can be expanded
    return {
      totalTokens: 0,
      totalCost: 0,
      byModel: {},
      byOperation: {},
    };
  }

  /**
   * Simplified completion interface with system prompt + user prompt
   */
  async simpleComplete(params: {
    systemPrompt: string;
    userPrompt: string;
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
    maxTokens?: number;
    temperature?: number;
    provider?: AIProvider;
    projectId?: string;
    userId?: string;
  }): Promise<{
    content: string;
    model: string;
    usage: { input: number; output: number; total: number };
  }> {
    const messages: ChatMessage[] = [
      { role: 'system', content: params.systemPrompt },
    ];

    // Add conversation history
    if (params.conversationHistory) {
      for (const msg of params.conversationHistory) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    // Add user prompt
    messages.push({ role: 'user', content: params.userPrompt });

    const response = await this.complete(
      {
        messages,
        maxTokens: params.maxTokens,
        temperature: params.temperature,
      },
      {
        provider: params.provider,
        projectId: params.projectId,
        userId: params.userId,
      },
    );

    return {
      content: response.content,
      model: response.model,
      usage: {
        input: response.usage.promptTokens,
        output: response.usage.completionTokens,
        total: response.usage.totalTokens,
      },
    };
  }

  /**
   * Simplified streaming interface
   */
  async *simpleStream(params: {
    systemPrompt: string;
    userPrompt: string;
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
    maxTokens?: number;
    temperature?: number;
    provider?: AIProvider;
  }): AsyncGenerator<{ type: 'token' | 'done'; content?: string; usage?: { input: number; output: number; total: number } }> {
    const messages: ChatMessage[] = [
      { role: 'system', content: params.systemPrompt },
    ];

    if (params.conversationHistory) {
      for (const msg of params.conversationHistory) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    messages.push({ role: 'user', content: params.userPrompt });

    for await (const chunk of this.stream({
      messages,
      maxTokens: params.maxTokens,
      temperature: params.temperature,
      stream: true,
    })) {
      if (chunk.done) {
        yield {
          type: 'done',
          usage: chunk.usage ? {
            input: chunk.usage.promptTokens,
            output: chunk.usage.completionTokens,
            total: chunk.usage.totalTokens,
          } : undefined,
        };
      } else {
        yield { type: 'token', content: chunk.content };
      }
    }
  }

  private getProvider(preferred?: AIProvider): BaseAIProvider {
    const providerKey = preferred ?? this.defaultProvider;
    const provider = this.providers.get(providerKey);

    if (!provider) {
      // Fallback to any available provider
      const available = Array.from(this.providers.values())[0];
      if (!available) {
        throw new Error('No AI provider available');
      }
      return available;
    }

    return provider;
  }

  private async trackUsage(record: UsageRecord): Promise<void> {
    try {
      // Log for now - in production, store in database
      this.logger.log(
        `AI Usage: project=${record.projectId}, model=${record.model}, ` +
          `tokens=${record.promptTokens + record.completionTokens}, cost=$${record.cost.toFixed(6)}, ` +
          `operation=${record.operation}`,
      );
      // TODO: Store in ai_usage table for billing/analytics
    } catch (error) {
      this.logger.error('Failed to track AI usage', error);
    }
  }

  private getCacheKey(request: AICompletionRequest): string {
    const data = {
      messages: request.messages,
      model: request.model,
      maxTokens: request.maxTokens,
      temperature: request.temperature,
      responseFormat: request.responseFormat,
    };
    return JSON.stringify(data);
  }

  private cleanCache(): void {
    const now = Date.now();
    for (const [key, value] of this.responseCache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL_MS) {
        this.responseCache.delete(key);
      }
    }
  }

  private isNonRetryableError(error: any): boolean {
    // Don't retry auth errors, invalid requests, etc.
    const nonRetryableCodes = [400, 401, 403, 404];
    return nonRetryableCodes.includes(error.status);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
