import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { AIAgentType, Priority, Severity, InsightType } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { AIService } from '../ai.service';
import { ContextBuilderService } from '../context-builder.service';
import { ProposalsService } from '../proposals/proposals.service';
import {
  GenerateBacklogDto,
  PlanSprintDto,
  AnalyzeProjectDto,
  AgentResponseDto,
} from './dto';
import {
  BACKLOG_GENERATOR_PROMPT,
  SPRINT_PLANNER_PROMPT,
  PROJECT_ANALYST_PROMPT,
} from './prompts';

@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AIService,
    private readonly contextBuilder: ContextBuilderService,
    private readonly proposalsService: ProposalsService,
  ) {}

  async generateBacklog(
    projectId: string,
    dto: GenerateBacklogDto,
    userId: string,
  ): Promise<AgentResponseDto> {
    this.logger.log(`Generating backlog for project ${projectId}`);

    // Get project context for better generation
    const projectContext = await this.contextBuilder.buildProjectContext(projectId, {
      includeEpics: true,
      includeStories: false,
      maxTokens: 2000,
    });

    // Build the prompt
    const userPrompt = this.buildBacklogPrompt(dto, projectContext);

    // Call AI service
    const response = await this.aiService.simpleComplete({
      systemPrompt: BACKLOG_GENERATOR_PROMPT,
      userPrompt,
      maxTokens: 4000,
      temperature: 0.7,
    });

    // Parse response
    const payload = this.parseJsonResponse(response.content);
    if (!payload || (!payload.epics && !payload.stories)) {
      throw new BadRequestException('AI failed to generate valid backlog structure');
    }

    // Calculate estimated changes
    const estimatedChanges = this.countBacklogItems(payload, dto.includeTasks ?? false);

    // Create proposal
    const proposal = await this.proposalsService.create(
      projectId,
      {
        agentType: AIAgentType.BACKLOG_GENERATOR,
        proposalType: 'create_backlog',
        payload,
        explanation: `Generated ${estimatedChanges.epics || 0} epics, ${estimatedChanges.stories || 0} stories${dto.includeTasks ? `, ${estimatedChanges.tasks || 0} tasks` : ''} from specification`,
        evidence: [{ type: 'specification', preview: dto.specification.slice(0, 200) }],
      },
      userId,
    );

    return {
      proposalId: proposal.id,
      summary: `Generated backlog with ${estimatedChanges.epics || 0} epics and ${estimatedChanges.stories || 0} stories`,
      estimatedChanges,
      tokenUsage: response.usage,
    };
  }

  async planSprint(
    projectId: string,
    dto: PlanSprintDto,
    userId: string,
  ): Promise<AgentResponseDto> {
    this.logger.log(`Planning sprint ${dto.sprintId} for project ${projectId}`);

    // Verify sprint exists
    const sprint = await this.prisma.sprint.findFirst({
      where: { id: dto.sprintId, projectId },
    });
    if (!sprint) {
      throw new BadRequestException('Sprint not found');
    }

    // Get backlog items not in any sprint
    const availableStories = await this.prisma.story.findMany({
      where: {
        projectId,
        sprintItems: { none: {} },
        status: { in: ['BACKLOG', 'READY'] },
      },
      include: {
        epic: { select: { id: true, title: true } },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });

    if (availableStories.length === 0) {
      throw new BadRequestException('No available stories in backlog');
    }

    // Calculate velocity if not provided
    const velocity = dto.velocity || (await this.calculateHistoricalVelocity(projectId));

    // Build context
    const storiesContext = availableStories.map((s) => ({
      id: s.id,
      title: s.title,
      estimate: s.estimate,
      priority: s.priority,
      epic: s.epic?.title,
    }));

    const userPrompt = this.buildSprintPlannerPrompt(dto, velocity, storiesContext, sprint.name);

    // Call AI service
    const response = await this.aiService.simpleComplete({
      systemPrompt: SPRINT_PLANNER_PROMPT,
      userPrompt,
      maxTokens: 2000,
      temperature: 0.5,
    });

    // Parse response
    const payload = this.parseJsonResponse(response.content);
    if (!payload || !payload.storyIds) {
      throw new BadRequestException('AI failed to generate valid sprint plan');
    }

    // Validate story IDs exist
    const validStoryIds = availableStories.map((s) => s.id);
    payload.storyIds = payload.storyIds.filter((id: string) => validStoryIds.includes(id));
    payload.sprintId = dto.sprintId;
    payload.sprintName = sprint.name;

    // Create proposal
    const proposal = await this.proposalsService.create(
      projectId,
      {
        agentType: AIAgentType.SPRINT_PLANNER,
        proposalType: 'plan_sprint',
        payload,
        explanation: `Planned ${payload.storyIds.length} stories for sprint "${sprint.name}" (${payload.totalEstimate || '?'} points)`,
        evidence: [
          { type: 'velocity', value: velocity },
          { type: 'available_stories', count: availableStories.length },
        ],
      },
      userId,
    );

    return {
      proposalId: proposal.id,
      summary: `Sprint plan with ${payload.storyIds.length} stories (${payload.totalEstimate || '?'} points)`,
      estimatedChanges: { stories: payload.storyIds.length },
      tokenUsage: response.usage,
    };
  }

  async analyzeProject(
    projectId: string,
    dto: AnalyzeProjectDto,
    userId: string,
  ): Promise<AgentResponseDto & { insights: any[] }> {
    this.logger.log(`Analyzing project ${projectId}`);

    // Gather comprehensive project data
    const projectData = await this.gatherProjectAnalytics(projectId, dto.sprintId);

    const userPrompt = this.buildAnalystPrompt(dto, projectData);

    // Call AI service
    const response = await this.aiService.simpleComplete({
      systemPrompt: PROJECT_ANALYST_PROMPT,
      userPrompt,
      maxTokens: 3000,
      temperature: 0.3,
    });

    // Parse response
    const analysis = this.parseJsonResponse(response.content);
    if (!analysis || !analysis.insights) {
      throw new BadRequestException('AI failed to generate valid analysis');
    }

    // Store insights in database
    const createdInsights = await this.storeInsights(projectId, dto.sprintId, analysis.insights);

    return {
      proposalId: '', // No proposal for analysis - direct insights
      summary: analysis.summary || 'Project analysis complete',
      estimatedChanges: { insights: createdInsights.length },
      tokenUsage: response.usage,
      insights: createdInsights,
    };
  }

  private buildBacklogPrompt(dto: GenerateBacklogDto, projectContext: string): string {
    return `SPECIFICATION:
${dto.specification}

${dto.context ? `ADDITIONAL CONTEXT:\n${dto.context}\n` : ''}
EXISTING PROJECT CONTEXT:
${projectContext}

REQUIREMENTS:
- Generate approximately ${dto.targetEpics || 3} epics
- ${dto.includeTasks ? 'Include tasks within stories' : 'Do not include tasks'}
- Focus on deliverable, testable user stories

Generate the backlog structure:`;
  }

  private buildSprintPlannerPrompt(
    dto: PlanSprintDto,
    velocity: number,
    stories: any[],
    sprintName: string,
  ): string {
    return `SPRINT: ${sprintName}
TEAM VELOCITY: ${velocity} story points

AVAILABLE STORIES:
${JSON.stringify(stories, null, 2)}

${dto.focusAreas?.length ? `FOCUS AREAS: ${dto.focusAreas.join(', ')}\n` : ''}
${dto.constraints ? `CONSTRAINTS: ${dto.constraints}\n` : ''}

Select stories for the sprint that fit within velocity and align with priorities:`;
  }

  private buildAnalystPrompt(dto: AnalyzeProjectDto, projectData: any): string {
    return `PROJECT DATA:
${JSON.stringify(projectData, null, 2)}

ANALYSIS FOCUS: ${dto.focus || 'all'}
${dto.includeHistory !== false ? 'Include historical comparison in analysis.' : ''}

Analyze the project and provide actionable insights:`;
  }

  private async gatherProjectAnalytics(projectId: string, sprintId?: string): Promise<any> {
    const [
      project,
      sprints,
      stories,
      epics,
    ] = await Promise.all([
      this.prisma.project.findUnique({ where: { id: projectId } }),
      this.prisma.sprint.findMany({
        where: { projectId },
        include: {
          items: { include: { story: true } },
        },
        orderBy: { startDate: 'desc' },
        take: 5,
      }),
      this.prisma.story.findMany({
        where: { projectId },
        select: {
          id: true,
          status: true,
          estimate: true,
          priority: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.epic.findMany({
        where: { projectId },
        select: { id: true, title: true, status: true },
      }),
    ]);

    // Calculate metrics
    const completedStories = stories.filter((s) => s.status === 'DONE');
    const inProgressStories = stories.filter((s) => s.status === 'IN_PROGRESS');

    const sprintMetrics = sprints.map((sprint) => {
      const items = sprint.items || [];
      const totalPlanned = items.reduce((sum, i) => sum + (i.originalEstimate || 0), 0);
      const completed = items.filter((i) => i.story?.status === 'DONE');
      const completedPoints = completed.reduce((sum, i) => sum + (i.originalEstimate || 0), 0);

      return {
        name: sprint.name,
        status: sprint.status,
        plannedPoints: totalPlanned,
        completedPoints,
        velocity: sprint.status === 'COMPLETED' ? completedPoints : null,
        storyCount: items.length,
      };
    });

    return {
      projectName: project?.name,
      epics: epics.length,
      totalStories: stories.length,
      completedStories: completedStories.length,
      inProgressStories: inProgressStories.length,
      backlogStories: stories.filter((s) => s.status === 'BACKLOG').length,
      sprintMetrics,
      averageVelocity: this.calculateAverageVelocity(sprintMetrics),
    };
  }

  private calculateAverageVelocity(sprintMetrics: any[]): number {
    const completedSprints = sprintMetrics.filter((s) => s.velocity !== null);
    if (completedSprints.length === 0) return 20; // Default
    return Math.round(
      completedSprints.reduce((sum, s) => sum + s.velocity, 0) / completedSprints.length,
    );
  }

  private async calculateHistoricalVelocity(projectId: string): Promise<number> {
    const completedSprints = await this.prisma.sprint.findMany({
      where: { projectId, status: 'COMPLETED' },
      include: { items: true },
      take: 3,
    });

    if (completedSprints.length === 0) return 20; // Default velocity

    const totalVelocity = completedSprints.reduce((sum, sprint) => {
      const sprintPoints = sprint.items.reduce((s, i) => s + (i.originalEstimate || 0), 0);
      return sum + sprintPoints;
    }, 0);

    return Math.round(totalVelocity / completedSprints.length);
  }

  private async storeInsights(
    projectId: string,
    sprintId: string | undefined,
    insights: any[],
  ): Promise<any[]> {
    const created = [];

    for (const insight of insights) {
      // Store recommendations in aiExplanation field as JSON
      const aiExplanation = insight.recommendations?.length
        ? JSON.stringify({ recommendations: insight.recommendations })
        : null;

      const dbInsight = await this.prisma.projectInsight.create({
        data: {
          projectId,
          sprintId: sprintId || null,
          insightType: this.mapInsightType(insight.type),
          severity: this.mapSeverity(insight.severity),
          title: insight.title,
          description: insight.description,
          linkedEntities: insight.linkedEntities || [],
          aiExplanation,
        },
      });
      created.push(dbInsight);
    }

    return created;
  }

  private mapInsightType(type: string): InsightType {
    const mapping: Record<string, InsightType> = {
      VELOCITY: InsightType.VELOCITY,
      RISK: InsightType.RISK,
      BLOCKER: InsightType.BLOCKER,
      SCOPE_CREEP: InsightType.SCOPE_CREEP,
      DEPENDENCY_ISSUE: InsightType.DEPENDENCY_ISSUE,
      CAPACITY_WARNING: InsightType.CAPACITY_WARNING,
    };
    return mapping[type] || InsightType.RISK;
  }

  private mapSeverity(severity: string): Severity {
    const mapping: Record<string, Severity> = {
      INFO: Severity.INFO,
      WARNING: Severity.WARNING,
      CRITICAL: Severity.CRITICAL,
    };
    return mapping[severity] || Severity.INFO;
  }

  private parseJsonResponse(content: string): any {
    try {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1].trim());
      }
      // Try direct parse
      return JSON.parse(content);
    } catch (error) {
      this.logger.error('Failed to parse AI response as JSON', content);
      return null;
    }
  }

  private countBacklogItems(
    payload: any,
    includeTasks: boolean,
  ): { epics: number; stories: number; tasks: number } {
    let epics = 0;
    let stories = 0;
    let tasks = 0;

    if (payload.epics) {
      epics = payload.epics.length;
      for (const epic of payload.epics) {
        if (epic.stories) {
          stories += epic.stories.length;
          if (includeTasks) {
            for (const story of epic.stories) {
              if (story.tasks) tasks += story.tasks.length;
            }
          }
        }
      }
    }

    if (payload.stories) {
      stories += payload.stories.length;
    }

    return { epics, stories, tasks };
  }
}
