import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { encoding_for_model, TiktokenModel } from 'tiktoken';
import { BaseAIProvider } from './base.provider';
import {
  AICompletionRequest,
  AICompletionResponse,
  StreamChunk,
  TokenUsage,
  calculateCost,
} from '../types';

@Injectable()
export class OpenAIProvider extends BaseAIProvider {
  readonly name = 'openai';
  readonly defaultModel = 'gpt-4o-mini'; // Cost-effective default
  private readonly logger = new Logger(OpenAIProvider.name);
  private client: OpenAI | null = null;
  private tokenizers = new Map<string, ReturnType<typeof encoding_for_model>>();

  constructor(private readonly configService: ConfigService) {
    super();
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (apiKey) {
      this.client = new OpenAI({ apiKey });
    }
  }

  isAvailable(): boolean {
    return this.client !== null;
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    if (!this.client) {
      throw new Error('OpenAI provider not configured');
    }

    const model = request.model ?? this.defaultModel;
    const startTime = Date.now();

    try {
      const response = await this.client.chat.completions.create({
        model,
        messages: request.messages,
        max_tokens: request.maxTokens ?? 4096,
        temperature: request.temperature ?? 0.7,
        response_format: request.responseFormat === 'json' 
          ? { type: 'json_object' } 
          : undefined,
      });

      const choice = response.choices[0];
      const usage: TokenUsage = {
        promptTokens: response.usage?.prompt_tokens ?? 0,
        completionTokens: response.usage?.completion_tokens ?? 0,
        totalTokens: response.usage?.total_tokens ?? 0,
        estimatedCost: calculateCost(
          model,
          response.usage?.prompt_tokens ?? 0,
          response.usage?.completion_tokens ?? 0,
        ),
      };

      this.logger.debug(
        `OpenAI completion: ${usage.totalTokens} tokens, $${usage.estimatedCost.toFixed(6)}, ${Date.now() - startTime}ms`,
      );

      return {
        content: choice.message.content ?? '',
        finishReason: this.mapFinishReason(choice.finish_reason),
        usage,
        model,
      };
    } catch (error: any) {
      this.logger.error(`OpenAI error: ${error.message}`);
      throw error;
    }
  }

  async *stream(request: AICompletionRequest): AsyncGenerator<StreamChunk> {
    if (!this.client) {
      throw new Error('OpenAI provider not configured');
    }

    const model = request.model ?? this.defaultModel;

    try {
      const stream = await this.client.chat.completions.create({
        model,
        messages: request.messages,
        max_tokens: request.maxTokens ?? 4096,
        temperature: request.temperature ?? 0.7,
        stream: true,
      });

      let fullContent = '';
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content ?? '';
        fullContent += content;

        const done = chunk.choices[0]?.finish_reason !== null;

        yield {
          content,
          done,
          usage: done
            ? {
                promptTokens: this.countTokens(
                  request.messages.map((m) => m.content).join('\n'),
                  model,
                ),
                completionTokens: this.countTokens(fullContent, model),
                totalTokens: 0, // Will be calculated
                estimatedCost: 0, // Will be calculated
              }
            : undefined,
        };
      }
    } catch (error: any) {
      this.logger.error(`OpenAI stream error: ${error.message}`);
      throw error;
    }
  }

  countTokens(text: string, model?: string): number {
    const modelName = model ?? this.defaultModel;

    try {
      // Map model to tiktoken encoding
      let tiktokenModel: TiktokenModel = 'gpt-4o';
      if (modelName.includes('gpt-3.5')) {
        tiktokenModel = 'gpt-3.5-turbo';
      } else if (modelName.includes('gpt-4')) {
        tiktokenModel = 'gpt-4o';
      }

      if (!this.tokenizers.has(tiktokenModel)) {
        this.tokenizers.set(tiktokenModel, encoding_for_model(tiktokenModel));
      }

      const tokenizer = this.tokenizers.get(tiktokenModel)!;
      return tokenizer.encode(text).length;
    } catch {
      // Fallback: rough estimate (4 chars per token)
      return Math.ceil(text.length / 4);
    }
  }

  private mapFinishReason(
    reason: string | null,
  ): 'stop' | 'length' | 'content_filter' | 'error' {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'length':
        return 'length';
      case 'content_filter':
        return 'content_filter';
      default:
        return 'stop';
    }
  }
}
