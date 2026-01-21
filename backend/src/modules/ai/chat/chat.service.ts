import { Injectable, Logger } from '@nestjs/common';
import { ChatRole, AIAgentType } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { AIService } from '../ai.service';
import { ContextBuilderService } from '../context-builder.service';
import {
  CreateChatMessageDto,
  ChatMessageDto,
  ChatResponseDto,
  ChatHistoryDto,
} from './dto';

const CHAT_SYSTEM_PROMPT = `You are an AI Scrum Master assistant helping manage an agile software project. You have access to the project's backlog, sprints, and team data.

CAPABILITIES:
- Answer questions about project status, backlog items, sprints
- Provide insights about velocity, blockers, and risks
- Suggest best practices for agile/scrum processes
- Help with sprint planning and backlog refinement
- Explain agile concepts and terminology

RESPONSE GUIDELINES:
1. Be concise and actionable
2. Reference specific entities (epics, stories, sprints) when relevant
3. Format responses for readability
4. Suggest follow-up actions when appropriate
5. Use data from the project context to support your answers

When referencing entities, use format: [Entity Type: Title](id)
Example: [Story: User login](story-123)

Keep responses focused and avoid unnecessary verbosity.`;

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AIService,
    private readonly contextBuilder: ContextBuilderService,
  ) {}

  async chat(
    projectId: string,
    userId: string,
    dto: CreateChatMessageDto,
  ): Promise<ChatResponseDto> {
    this.logger.log(`Processing chat for project ${projectId}`);

    // Save user message
    const userMessage = await this.prisma.chatMessage.create({
      data: {
        projectId,
        userId,
        role: ChatRole.USER,
        content: dto.content,
        context: dto.context || {},
      },
    });

    // Build conversation history
    const history = await this.getRecentHistory(projectId, 10);
    
    // Build project context (optimized for cost)
    const projectContext = await this.contextBuilder.buildProjectContext(projectId, {
      includeEpics: true,
      includeStories: true,
      includeSprints: true,
      maxTokens: 3000, // Limit context size for efficiency
    });

    // Build messages for AI
    const messages = this.buildConversationMessages(history, dto.content, projectContext);

    // Call AI
    const response = await this.aiService.simpleComplete({
      systemPrompt: CHAT_SYSTEM_PROMPT,
      userPrompt: messages[messages.length - 1].content,
      conversationHistory: messages.slice(0, -1),
      maxTokens: 1500,
      temperature: 0.7,
    });

    // Extract citations and actions from response
    const { citations, actions, cleanContent } = this.parseResponse(response.content, projectId);

    // Save assistant message
    const assistantMessage = await this.prisma.chatMessage.create({
      data: {
        projectId,
        role: ChatRole.ASSISTANT,
        content: cleanContent,
        context: { model: response.model },
        citations,
        actions,
      },
    });

    return {
      messageId: assistantMessage.id,
      content: cleanContent,
      citations,
      actions,
      tokenUsage: response.usage,
    };
  }

  async *streamChat(
    projectId: string,
    userId: string,
    dto: CreateChatMessageDto,
  ): AsyncGenerator<{ type: 'token' | 'done'; content?: string; data?: ChatResponseDto }> {
    // Save user message
    await this.prisma.chatMessage.create({
      data: {
        projectId,
        userId,
        role: ChatRole.USER,
        content: dto.content,
        context: dto.context || {},
      },
    });

    // Build context
    const history = await this.getRecentHistory(projectId, 10);
    const projectContext = await this.contextBuilder.buildProjectContext(projectId, {
      includeEpics: true,
      includeStories: true,
      includeSprints: true,
      maxTokens: 3000,
    });

    const messages = this.buildConversationMessages(history, dto.content, projectContext);

    let fullContent = '';
    let totalTokens = { input: 0, output: 0, total: 0 };

    // Stream response
    for await (const chunk of this.aiService.simpleStream({
      systemPrompt: CHAT_SYSTEM_PROMPT,
      userPrompt: messages[messages.length - 1].content,
      conversationHistory: messages.slice(0, -1),
      maxTokens: 1500,
      temperature: 0.7,
    })) {
      if (chunk.type === 'token' && chunk.content) {
        fullContent += chunk.content;
        yield { type: 'token', content: chunk.content };
      } else if (chunk.type === 'done' && chunk.usage) {
        totalTokens = chunk.usage;
      }
    }

    // Parse and save final response
    const { citations, actions, cleanContent } = this.parseResponse(fullContent, projectId);

    const assistantMessage = await this.prisma.chatMessage.create({
      data: {
        projectId,
        role: ChatRole.ASSISTANT,
        content: cleanContent,
        context: {},
        citations,
        actions,
      },
    });

    yield {
      type: 'done',
      data: {
        messageId: assistantMessage.id,
        content: cleanContent,
        citations,
        actions,
        tokenUsage: totalTokens,
      },
    };
  }

  async getHistory(
    projectId: string,
    limit: number = 50,
    before?: string,
  ): Promise<ChatHistoryDto> {
    const messages = await this.prisma.chatMessage.findMany({
      where: {
        projectId,
        ...(before && { createdAt: { lt: new Date(before) } }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1, // Fetch one extra to check hasMore
    });

    const hasMore = messages.length > limit;
    const resultMessages = hasMore ? messages.slice(0, -1) : messages;

    return {
      messages: resultMessages.reverse().map(this.mapToDto),
      hasMore,
    };
  }

  async clearHistory(projectId: string): Promise<void> {
    await this.prisma.chatMessage.deleteMany({
      where: { projectId },
    });
  }

  private async getRecentHistory(projectId: string, limit: number): Promise<any[]> {
    const messages = await this.prisma.chatMessage.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return messages.reverse();
  }

  private buildConversationMessages(
    history: any[],
    currentMessage: string,
    projectContext: string,
  ): Array<{ role: 'user' | 'assistant'; content: string }> {
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    // Add history
    for (const msg of history) {
      messages.push({
        role: msg.role === ChatRole.USER ? 'user' : 'assistant',
        content: msg.content,
      });
    }

    // Add current message with context
    const contextualMessage = `PROJECT CONTEXT:
${projectContext}

USER QUESTION:
${currentMessage}`;

    messages.push({ role: 'user', content: contextualMessage });

    return messages;
  }

  private parseResponse(
    content: string,
    projectId: string,
  ): {
    citations: any[];
    actions: any[];
    cleanContent: string;
  } {
    const citations: any[] = [];
    const actions: any[] = [];
    let cleanContent = content;

    // Extract citations: [Story: Title](id)
    const citationRegex = /\[(Epic|Story|Task|Sprint): ([^\]]+)\]\(([^)]+)\)/g;
    let match;
    while ((match = citationRegex.exec(content)) !== null) {
      citations.push({
        type: match[1].toLowerCase(),
        title: match[2],
        id: match[3],
      });
    }

    // Clean citation syntax from content for better readability
    cleanContent = cleanContent.replace(citationRegex, '**$2**');

    // Suggest common actions based on content
    if (content.toLowerCase().includes('sprint') && content.toLowerCase().includes('plan')) {
      actions.push({
        type: 'create',
        entity: 'sprint-plan',
        label: 'Plan Sprint with AI',
      });
    }

    if (content.toLowerCase().includes('backlog') && content.toLowerCase().includes('create')) {
      actions.push({
        type: 'create',
        entity: 'backlog',
        label: 'Generate Backlog with AI',
      });
    }

    return { citations, actions, cleanContent };
  }

  private mapToDto(message: any): ChatMessageDto {
    return {
      id: message.id,
      projectId: message.projectId,
      userId: message.userId,
      role: message.role,
      content: message.content,
      context: message.context,
      citations: message.citations || [],
      actions: message.actions || [],
      createdAt: message.createdAt,
    };
  }
}
