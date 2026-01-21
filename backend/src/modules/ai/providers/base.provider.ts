import { AICompletionRequest, AICompletionResponse, StreamChunk } from '../types';

/**
 * Abstract base class for AI providers
 * Implement this for each provider (OpenAI, Anthropic, etc.)
 */
export abstract class BaseAIProvider {
  abstract readonly name: string;
  abstract readonly defaultModel: string;

  /**
   * Generate a completion (non-streaming)
   */
  abstract complete(request: AICompletionRequest): Promise<AICompletionResponse>;

  /**
   * Generate a streaming completion
   */
  abstract stream(request: AICompletionRequest): AsyncGenerator<StreamChunk>;

  /**
   * Count tokens for a given text
   */
  abstract countTokens(text: string, model?: string): number;

  /**
   * Check if the provider is configured and available
   */
  abstract isAvailable(): boolean;
}
