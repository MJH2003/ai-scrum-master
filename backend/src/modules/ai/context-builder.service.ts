import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AIService } from './ai.service';
import { ChatMessage, getContextLimit } from './types';

interface ProjectContext {
  project: {
    id: string;
    name: string;
    description?: string;
  };
  epics?: Array<{
    id: string;
    title: string;
    status: string;
    storyCount: number;
  }>;
  stories?: Array<{
    id: string;
    title: string;
    status: string;
    estimate?: number;
    epicTitle?: string;
  }>;
  sprints?: Array<{
    id: string;
    name: string;
    status: string;
    totalStories: number;
    completedStories: number;
  }>;
  recentActivity?: Array<{
    action: string;
    entityType: string;
    entityTitle: string;
    timestamp: Date;
  }>;
}

interface ContextOptions {
  maxTokens?: number;
  includeEpics?: boolean;
  includeStories?: boolean;
  includeSprints?: boolean;
  includeRecentActivity?: boolean;
  storyLimit?: number;
  epicLimit?: number;
}

/**
 * Service for building efficient context for AI prompts
 * Minimizes tokens while maximizing relevant information
 */
@Injectable()
export class ContextBuilderService {
  private readonly logger = new Logger(ContextBuilderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AIService,
  ) {}

  /**
   * Build project context from project ID (fetches data from DB)
   */
  async buildProjectContext(
    projectId: string,
    options: ContextOptions = {},
  ): Promise<string> {
    const [project, epics, stories, sprints] = await Promise.all([
      this.prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, name: true, description: true },
      }),
      options.includeEpics !== false
        ? this.prisma.epic.findMany({
            where: { projectId },
            select: {
              id: true,
              title: true,
              status: true,
              _count: { select: { stories: true } },
            },
            take: options.epicLimit ?? 10,
          })
        : [],
      options.includeStories !== false
        ? this.prisma.story.findMany({
            where: { projectId },
            select: {
              id: true,
              title: true,
              status: true,
              estimate: true,
              epic: { select: { title: true } },
            },
            orderBy: { priority: 'desc' },
            take: options.storyLimit ?? 20,
          })
        : [],
      options.includeSprints !== false
        ? this.prisma.sprint.findMany({
            where: { projectId },
            select: {
              id: true,
              name: true,
              status: true,
              _count: { select: { items: true } },
            },
            orderBy: { startDate: 'desc' },
            take: 5,
          })
        : [],
    ]);

    if (!project) {
      return 'Project not found.';
    }

    const context: ProjectContext = {
      project: {
        id: project.id,
        name: project.name,
        description: project.description ?? undefined,
      },
      epics: epics.map((e: any) => ({
        id: e.id,
        title: e.title,
        status: e.status,
        storyCount: e._count?.stories ?? 0,
      })),
      stories: stories.map((s: any) => ({
        id: s.id,
        title: s.title,
        status: s.status,
        estimate: s.estimate ?? undefined,
        epicTitle: s.epic?.title ?? undefined,
      })),
      sprints: sprints.map((sp: any) => ({
        id: sp.id,
        name: sp.name,
        status: sp.status,
        totalStories: sp._count?.items ?? 0,
        completedStories: 0, // Would need additional query
      })),
    };

    return this.formatProjectContext(context, options);
  }

  /**
   * Build optimized context string from project data
   * Uses compact formatting to minimize tokens
   */
  formatProjectContext(
    context: ProjectContext,
    options: ContextOptions = {},
  ): string {
    const parts: string[] = [];

    // Project header (always included)
    parts.push(`# Project: ${context.project.name}`);
    if (context.project.description) {
      parts.push(`Description: ${context.project.description}`);
    }

    // Epics summary (compact format)
    if (options.includeEpics !== false && context.epics?.length) {
      const epics = context.epics.slice(0, options.epicLimit ?? 10);
      parts.push('\n## Epics');
      parts.push(
        epics
          .map((e) => `- [${e.status}] ${e.title} (${e.storyCount} stories)`)
          .join('\n'),
      );
    }

    // Stories summary (compact format)
    if (options.includeStories !== false && context.stories?.length) {
      const stories = context.stories.slice(0, options.storyLimit ?? 20);
      parts.push('\n## Stories');
      parts.push(
        stories
          .map((s) => {
            const pts = s.estimate ? ` [${s.estimate}pts]` : '';
            const epic = s.epicTitle ? ` (${s.epicTitle})` : '';
            return `- [${s.status}] ${s.title}${pts}${epic}`;
          })
          .join('\n'),
      );
    }

    // Sprints summary
    if (options.includeSprints !== false && context.sprints?.length) {
      parts.push('\n## Sprints');
      parts.push(
        context.sprints
          .map((s) => `- [${s.status}] ${s.name}: ${s.completedStories}/${s.totalStories} done`)
          .join('\n'),
      );
    }

    // Recent activity (very compact)
    if (options.includeRecentActivity && context.recentActivity?.length) {
      const recent = context.recentActivity.slice(0, 10);
      parts.push('\n## Recent Activity');
      parts.push(
        recent
          .map((a) => `- ${a.action} ${a.entityType}: ${a.entityTitle}`)
          .join('\n'),
      );
    }

    return parts.join('\n');
  }

  /**
   * Build messages array with system prompt and context
   */
  buildMessages(
    systemPrompt: string,
    userMessage: string,
    context?: string,
    conversationHistory?: ChatMessage[],
  ): ChatMessage[] {
    const messages: ChatMessage[] = [];

    // System prompt with context
    let fullSystemPrompt = systemPrompt;
    if (context) {
      fullSystemPrompt += `\n\n---\n\nProject Context:\n${context}`;
    }
    messages.push({ role: 'system', content: fullSystemPrompt });

    // Add conversation history (limited to prevent context overflow)
    if (conversationHistory?.length) {
      // Keep last N messages to stay within context limits
      const recentHistory = conversationHistory.slice(-10);
      messages.push(...recentHistory);
    }

    // Current user message
    messages.push({ role: 'user', content: userMessage });

    return messages;
  }

  /**
   * Truncate context to fit within token limits
   */
  truncateToFit(
    messages: ChatMessage[],
    model: string,
    reserveOutputTokens: number = 4096,
  ): ChatMessage[] {
    const contextLimit = getContextLimit(model);
    const maxInputTokens = contextLimit - reserveOutputTokens;

    // Estimate current tokens
    let currentTokens = this.estimateTokens(messages);

    if (currentTokens <= maxInputTokens) {
      return messages;
    }

    this.logger.warn(
      `Context exceeds limit (${currentTokens}/${maxInputTokens}), truncating...`,
    );

    // Strategy: Keep system message, truncate middle of conversation
    const [systemMessage, ...rest] = messages;
    const truncated: ChatMessage[] = [systemMessage];

    // Always keep the last user message
    const lastMessage = rest[rest.length - 1];
    const middleMessages = rest.slice(0, -1);

    // Add messages from the end until we hit the limit
    for (let i = middleMessages.length - 1; i >= 0; i--) {
      const testMessages = [systemMessage, ...truncated.slice(1), middleMessages[i], lastMessage];
      if (this.estimateTokens(testMessages) <= maxInputTokens) {
        truncated.splice(1, 0, middleMessages[i]);
      } else {
        break;
      }
    }

    truncated.push(lastMessage);

    this.logger.debug(
      `Truncated from ${messages.length} to ${truncated.length} messages`,
    );

    return truncated;
  }

  /**
   * Estimate tokens for messages array
   */
  private estimateTokens(messages: ChatMessage[]): number {
    const text = messages.map((m) => m.content).join('\n');
    return this.aiService.countTokens(text);
  }
}
