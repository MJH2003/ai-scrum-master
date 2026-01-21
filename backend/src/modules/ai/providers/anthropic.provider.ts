import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { BaseAIProvider } from './base.provider';
import {
  AICompletionRequest,
  AICompletionResponse,
  StreamChunk,
  TokenUsage,
  calculateCost,
} from '../types';

@Injectable()
export class AnthropicProvider extends BaseAIProvider {
  readonly name = 'anthropic';
  readonly defaultModel = 'claude-3-5-haiku-20241022'; // Cost-effective default
  private readonly logger = new Logger(AnthropicProvider.name);
  private client: Anthropic | null = null;

  constructor(private readonly configService: ConfigService) {
    super();
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
    }
  }

  isAvailable(): boolean {
    return this.client !== null;
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    if (!this.client) {
      throw new Error('Anthropic provider not configured');
    }

    const model = request.model ?? this.defaultModel;
    const startTime = Date.now();

    // Extract system message
    const systemMessage = request.messages.find((m) => m.role === 'system');
    const userMessages = request.messages.filter((m) => m.role !== 'system');

    try {
      const response = await this.client.messages.create({
        model,
        max_tokens: request.maxTokens ?? 4096,
        system: systemMessage?.content,
        messages: userMessages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      });

      const content =
        response.content[0].type === 'text' ? response.content[0].text : '';

      const usage: TokenUsage = {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        estimatedCost: calculateCost(
          model,
          response.usage.input_tokens,
          response.usage.output_tokens,
        ),
      };

      this.logger.debug(
        `Anthropic completion: ${usage.totalTokens} tokens, $${usage.estimatedCost.toFixed(6)}, ${Date.now() - startTime}ms`,
      );

      return {
        content,
        finishReason: this.mapStopReason(response.stop_reason),
        usage,
        model,
      };
    } catch (error: any) {
      this.logger.error(`Anthropic error: ${error.message}`);
      throw error;
    }
  }

  async *stream(request: AICompletionRequest): AsyncGenerator<StreamChunk> {
    if (!this.client) {
      throw new Error('Anthropic provider not configured');
    }

    const model = request.model ?? this.defaultModel;

    const systemMessage = request.messages.find((m) => m.role === 'system');
    const userMessages = request.messages.filter((m) => m.role !== 'system');

    try {
      const stream = this.client.messages.stream({
        model,
        max_tokens: request.maxTokens ?? 4096,
        system: systemMessage?.content,
        messages: userMessages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      });

      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          yield {
            content: event.delta.text,
            done: false,
          };
        }

        if (event.type === 'message_stop') {
          const finalMessage = await stream.finalMessage();
          yield {
            content: '',
            done: true,
            usage: {
              promptTokens: finalMessage.usage.input_tokens,
              completionTokens: finalMessage.usage.output_tokens,
              totalTokens:
                finalMessage.usage.input_tokens +
                finalMessage.usage.output_tokens,
              estimatedCost: calculateCost(
                model,
                finalMessage.usage.input_tokens,
                finalMessage.usage.output_tokens,
              ),
            },
          };
        }
      }
    } catch (error: any) {
      this.logger.error(`Anthropic stream error: ${error.message}`);
      throw error;
    }
  }

  countTokens(text: string, _model?: string): number {
    // Anthropic doesn't provide a public tokenizer
    // Use approximation: ~4 characters per token for English
    // This is conservative; actual usage may be lower
    return Math.ceil(text.length / 4);
  }

  private mapStopReason(
    reason: string | null,
  ): 'stop' | 'length' | 'content_filter' | 'error' {
    switch (reason) {
      case 'end_turn':
        return 'stop';
      case 'max_tokens':
        return 'length';
      default:
        return 'stop';
    }
  }
}
