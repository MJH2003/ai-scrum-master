import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, Content, Part } from '@google/generative-ai';
import { BaseAIProvider } from './base.provider';
import {
  AICompletionRequest,
  AICompletionResponse,
  StreamChunk,
  TokenUsage,
  ChatMessage,
  calculateCost,
} from '../types';

@Injectable()
export class GeminiProvider extends BaseAIProvider {
  readonly name = 'gemini';
  readonly defaultModel = 'gemini-1.5-flash'; // Cost-effective default for testing
  private readonly logger = new Logger(GeminiProvider.name);
  private client: GoogleGenerativeAI | null = null;

  constructor(private readonly configService: ConfigService) {
    super();
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (apiKey) {
      this.client = new GoogleGenerativeAI(apiKey);
    }
  }

  isAvailable(): boolean {
    return this.client !== null;
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    if (!this.client) {
      throw new Error('Gemini provider not configured');
    }

    const modelName = request.model ?? this.defaultModel;
    const startTime = Date.now();

    try {
      const model = this.client.getGenerativeModel({
        model: modelName,
        generationConfig: {
          maxOutputTokens: request.maxTokens ?? 4096,
          temperature: request.temperature ?? 0.7,
          responseMimeType: request.responseFormat === 'json' ? 'application/json' : 'text/plain',
        },
      });

      // Convert messages to Gemini format
      const { systemInstruction, contents } = this.convertMessages(request.messages);

      // Start chat with system instruction
      const chat = model.startChat({
        history: contents.slice(0, -1),
        systemInstruction: systemInstruction || undefined,
      });

      // Send the last message
      const lastMessage = contents[contents.length - 1];
      const result = await chat.sendMessage(lastMessage?.parts.map((p: Part) => (p as { text: string }).text).join('') || '');
      const response = result.response;

      // Get usage metadata
      const usageMetadata = response.usageMetadata;
      const usage: TokenUsage = {
        promptTokens: usageMetadata?.promptTokenCount ?? 0,
        completionTokens: usageMetadata?.candidatesTokenCount ?? 0,
        totalTokens: usageMetadata?.totalTokenCount ?? 0,
        estimatedCost: calculateCost(
          modelName,
          usageMetadata?.promptTokenCount ?? 0,
          usageMetadata?.candidatesTokenCount ?? 0,
        ),
      };

      this.logger.debug(
        `Gemini completion: ${usage.totalTokens} tokens, $${usage.estimatedCost.toFixed(6)}, ${Date.now() - startTime}ms`,
      );

      const text = response.text();
      const finishReason = response.candidates?.[0]?.finishReason;

      return {
        content: text,
        finishReason: this.mapFinishReason(finishReason),
        usage,
        model: modelName,
      };
    } catch (error: any) {
      this.logger.error(`Gemini error: ${error.message}`);
      throw error;
    }
  }

  async *stream(request: AICompletionRequest): AsyncGenerator<StreamChunk> {
    if (!this.client) {
      throw new Error('Gemini provider not configured');
    }

    const modelName = request.model ?? this.defaultModel;

    try {
      const model = this.client.getGenerativeModel({
        model: modelName,
        generationConfig: {
          maxOutputTokens: request.maxTokens ?? 4096,
          temperature: request.temperature ?? 0.7,
        },
      });

      const { systemInstruction, contents } = this.convertMessages(request.messages);

      const chat = model.startChat({
        history: contents.slice(0, -1),
        systemInstruction: systemInstruction || undefined,
      });

      const lastMessage = contents[contents.length - 1];
      const result = await chat.sendMessageStream(lastMessage?.parts.map((p: Part) => (p as { text: string }).text).join('') || '');

      let fullContent = '';
      for await (const chunk of result.stream) {
        const text = chunk.text();
        fullContent += text;

        yield {
          content: text,
          done: false,
        };
      }

      // Get final usage from the aggregated response
      const response = await result.response;
      const usageMetadata = response.usageMetadata;

      yield {
        content: '',
        done: true,
        usage: {
          promptTokens: usageMetadata?.promptTokenCount ?? 0,
          completionTokens: usageMetadata?.candidatesTokenCount ?? 0,
          totalTokens: usageMetadata?.totalTokenCount ?? 0,
          estimatedCost: calculateCost(
            modelName,
            usageMetadata?.promptTokenCount ?? 0,
            usageMetadata?.candidatesTokenCount ?? 0,
          ),
        },
      };
    } catch (error: any) {
      this.logger.error(`Gemini stream error: ${error.message}`);
      throw error;
    }
  }

  countTokens(text: string, model?: string): number {
    // Gemini uses roughly similar tokenization to GPT models
    // Approximate: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }

  /**
   * Convert ChatMessage array to Gemini's Content format
   */
  private convertMessages(messages: ChatMessage[]): {
    systemInstruction: string | null;
    contents: Content[];
  } {
    let systemInstruction: string | null = null;
    const contents: Content[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        // Gemini uses systemInstruction separately
        systemInstruction = msg.content;
      } else {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        });
      }
    }

    // Ensure there's at least one user message
    if (contents.length === 0) {
      contents.push({
        role: 'user',
        parts: [{ text: '' }],
      });
    }

    return { systemInstruction, contents };
  }

  private mapFinishReason(reason?: string): AICompletionResponse['finishReason'] {
    switch (reason) {
      case 'STOP':
        return 'stop';
      case 'MAX_TOKENS':
        return 'length';
      case 'SAFETY':
      case 'RECITATION':
        return 'content_filter';
      default:
        return 'stop';
    }
  }
}
