import { Module, Global } from '@nestjs/common';
import { AIService } from './ai.service';
import { ContextBuilderService } from './context-builder.service';
import { OpenAIProvider } from './providers/openai.provider';
import { AnthropicProvider } from './providers/anthropic.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { ProposalsService, ProposalsController } from './proposals';
import { AgentsService, AgentsController } from './agents';
import { ChatService, ChatController } from './chat';

@Global()
@Module({
  controllers: [ProposalsController, AgentsController, ChatController],
  providers: [
    AIService,
    ContextBuilderService,
    OpenAIProvider,
    AnthropicProvider,
    GeminiProvider,
    ProposalsService,
    AgentsService,
    ChatService,
  ],
  exports: [AIService, ContextBuilderService, ProposalsService, AgentsService, ChatService],
})
export class AIModule {}
