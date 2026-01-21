import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Severity, InsightType } from '@prisma/client';
import {
  InsightDto,
  CreateInsightDto,
  RiskDto,
  InsightFilterDto,
  InsightSummaryDto,
} from './dto';

@Injectable()
export class InsightsService {
  private readonly logger = new Logger(InsightsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new insight
   */
  async createInsight(
    projectId: string,
    dto: CreateInsightDto,
  ): Promise<InsightDto> {
    // Map the type string to InsightType enum if needed
    const insightType = this.mapToInsightType(dto.type);

    const insight = await this.prisma.projectInsight.create({
      data: {
        projectId,
        sprintId: dto.sprintId,
        severity: dto.severity,
        insightType,
        title: dto.title,
        description: dto.description,
        aiExplanation: dto.recommendation,
        linkedEntities: dto.dataSnapshot
          ? JSON.parse(JSON.stringify(dto.dataSnapshot))
          : [],
      },
    });

    this.logger.log(
      `Created insight: ${insightType} (${dto.severity}) for project ${projectId}`,
    );

    return this.mapToDto(insight);
  }

  /**
   * Get all insights for a project with optional filters
   */
  async getProjectInsights(
    projectId: string,
    filters?: InsightFilterDto,
  ): Promise<InsightDto[]> {
    const where: Record<string, unknown> = { projectId };

    if (filters?.severity) where.severity = filters.severity;
    if (filters?.type) where.insightType = this.mapToInsightType(filters.type);
    if (filters?.acknowledged !== undefined)
      where.acknowledged = filters.acknowledged;
    if (filters?.sprintId) where.sprintId = filters.sprintId;

    const insights = await this.prisma.projectInsight.findMany({
      where,
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
    });

    return insights.map((i) => this.mapToDto(i));
  }

  /**
   * Get insight summary counts
   */
  async getInsightSummary(projectId: string): Promise<InsightSummaryDto> {
    const insights = await this.prisma.projectInsight.findMany({
      where: { projectId },
      select: { severity: true, acknowledged: true },
    });

    return {
      total: insights.length,
      critical: insights.filter((i) => i.severity === Severity.CRITICAL).length,
      high: insights.filter((i) => i.severity === Severity.WARNING).length,
      medium: 0, // Schema only has INFO, WARNING, CRITICAL
      low: insights.filter((i) => i.severity === Severity.INFO).length,
      unacknowledged: insights.filter((i) => !i.acknowledged).length,
    };
  }

  /**
   * Get risks (critical/warning unacknowledged insights)
   */
  async getProjectRisks(projectId: string): Promise<RiskDto[]> {
    const insights = await this.prisma.projectInsight.findMany({
      where: {
        projectId,
        acknowledged: false,
        severity: { in: [Severity.CRITICAL, Severity.WARNING] },
      },
      include: {
        sprint: { select: { name: true } },
      },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
    });

    return insights.map((insight) => ({
      id: insight.id,
      severity: insight.severity,
      type: insight.insightType,
      title: insight.title,
      description: insight.description || '',
      recommendation: insight.aiExplanation,
      impact: this.getImpactDescription(insight.severity, insight.insightType),
      affectedSprint: insight.sprint?.name || null,
      mitigated: insight.acknowledged,
      createdAt: insight.createdAt,
    }));
  }

  /**
   * Acknowledge an insight
   */
  async acknowledgeInsight(
    projectId: string,
    insightId: string,
    _userId: string,
  ): Promise<InsightDto> {
    const insight = await this.prisma.projectInsight.findFirst({
      where: { id: insightId, projectId },
    });

    if (!insight) {
      throw new NotFoundException('Insight not found');
    }

    const updated = await this.prisma.projectInsight.update({
      where: { id: insightId },
      data: {
        acknowledged: true,
      },
    });

    this.logger.log(`Insight ${insightId} acknowledged`);

    return this.mapToDto(updated);
  }

  /**
   * Analyze project and generate insights
   */
  async analyzeProject(projectId: string): Promise<InsightDto[]> {
    const insights: CreateInsightDto[] = [];

    // Check for velocity issues
    const velocityInsights = await this.analyzeVelocity(projectId);
    insights.push(...velocityInsights);

    // Check for sprint issues
    const sprintInsights = await this.analyzeActiveSprint(projectId);
    insights.push(...sprintInsights);

    // Check for backlog health
    const backlogInsights = await this.analyzeBacklog(projectId);
    insights.push(...backlogInsights);

    // Create insights in database
    const created: InsightDto[] = [];
    for (const dto of insights) {
      const insightType = this.mapToInsightType(dto.type);
      // Avoid duplicates: check if similar insight exists recently
      const existing = await this.prisma.projectInsight.findFirst({
        where: {
          projectId,
          insightType,
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      });

      if (!existing) {
        const insight = await this.createInsight(projectId, dto);
        created.push(insight);
      }
    }

    this.logger.log(
      `Project analysis complete: ${created.length} new insights for project ${projectId}`,
    );

    return created;
  }

  private async analyzeVelocity(projectId: string): Promise<CreateInsightDto[]> {
    const insights: CreateInsightDto[] = [];

    const sprints = await this.prisma.sprint.findMany({
      where: { projectId, status: 'COMPLETED' },
      include: {
        items: { include: { story: true } },
      },
      orderBy: { endDate: 'desc' },
      take: 5,
    });

    if (sprints.length < 3) return insights;

    const velocities = sprints.map((sprint) =>
      sprint.items
        .filter((i) => i.story.status === 'DONE')
        .reduce((sum, i) => sum + (i.originalEstimate || 0), 0),
    );

    const avgVelocity = velocities.reduce((a, b) => a + b, 0) / velocities.length;
    const latestVelocity = velocities[0];

    // Check for significant velocity drop
    if (latestVelocity < avgVelocity * 0.7) {
      insights.push({
        severity: Severity.WARNING,
        type: InsightType.VELOCITY,
        title: 'Significant velocity drop detected',
        description: `Last sprint velocity (${latestVelocity} points) is ${Math.round((1 - latestVelocity / avgVelocity) * 100)}% below the average (${Math.round(avgVelocity)} points).`,
        recommendation:
          'Review blockers and team capacity. Consider conducting a retrospective to identify issues.',
        dataSnapshot: { latestVelocity, avgVelocity, velocities },
      });
    }

    // Check for velocity improvement
    if (latestVelocity > avgVelocity * 1.3 && sprints.length >= 3) {
      insights.push({
        severity: Severity.INFO,
        type: InsightType.VELOCITY,
        title: 'Velocity improvement trend',
        description: `Great job! Last sprint velocity (${latestVelocity} points) is ${Math.round((latestVelocity / avgVelocity - 1) * 100)}% above the average.`,
        recommendation:
          'Document what worked well and continue these practices.',
        dataSnapshot: { latestVelocity, avgVelocity },
      });
    }

    return insights;
  }

  private async analyzeActiveSprint(
    projectId: string,
  ): Promise<CreateInsightDto[]> {
    const insights: CreateInsightDto[] = [];

    const activeSprint = await this.prisma.sprint.findFirst({
      where: { projectId, status: 'ACTIVE' },
      include: {
        items: { include: { story: true } },
        burndownData: { orderBy: { date: 'desc' }, take: 2 },
      },
    });

    if (!activeSprint || !activeSprint.startDate || !activeSprint.endDate) {
      return insights;
    }

    const totalPoints = activeSprint.items.reduce(
      (sum, i) => sum + (i.originalEstimate || 0),
      0,
    );
    const completedPoints = activeSprint.items
      .filter((i) => i.story.status === 'DONE')
      .reduce((sum, i) => sum + (i.originalEstimate || 0), 0);

    const now = new Date();
    const sprintDuration =
      activeSprint.endDate.getTime() - activeSprint.startDate.getTime();
    const elapsed = now.getTime() - activeSprint.startDate.getTime();
    const progressPercent = Math.min(1, elapsed / sprintDuration);
    const expectedCompletion = totalPoints * progressPercent;

    // Sprint at risk
    if (progressPercent > 0.5 && completedPoints < expectedCompletion * 0.6 && totalPoints > 0) {
      const daysLeft = Math.ceil(
        (activeSprint.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      insights.push({
        severity: Severity.WARNING,
        type: InsightType.RISK,
        title: 'Sprint is at risk of not completing',
        description: `Sprint is ${Math.round(progressPercent * 100)}% through but only ${Math.round((completedPoints / totalPoints) * 100)}% of work is done. ${daysLeft} days remaining.`,
        recommendation:
          'Consider reducing scope or addressing blockers immediately.',
        sprintId: activeSprint.id,
        dataSnapshot: { completedPoints, totalPoints, daysLeft },
      });
    }

    // Check for scope creep
    if (activeSprint.burndownData.length >= 2) {
      const latest = activeSprint.burndownData[0];
      const previous = activeSprint.burndownData[1];
      if (latest.addedPoints > 0 && latest.addedPoints > previous.addedPoints) {
        insights.push({
          severity: Severity.WARNING,
          type: InsightType.SCOPE_CREEP,
          title: 'Scope creep detected',
          description: `${latest.addedPoints} points were added to the sprint after it started.`,
          recommendation:
            'Review the added items. Consider moving lower priority items to backlog.',
          sprintId: activeSprint.id,
          dataSnapshot: { addedPoints: latest.addedPoints },
        });
      }
    }

    // Check for items not progressing
    const notProgressingCount = activeSprint.items.filter(
      (i) => i.story.status === 'BACKLOG' || i.story.status === 'READY',
    ).length;
    if (notProgressingCount > activeSprint.items.length * 0.7 && activeSprint.items.length > 0) {
      insights.push({
        severity: Severity.WARNING,
        type: InsightType.BLOCKER,
        title: `${notProgressingCount} items not progressing`,
        description: `${notProgressingCount} stories in the current sprint haven't moved from backlog/ready status.`,
        recommendation: 'Review why these items are not being picked up.',
        sprintId: activeSprint.id,
        dataSnapshot: { notProgressingCount },
      });
    }

    return insights;
  }

  private async analyzeBacklog(projectId: string): Promise<CreateInsightDto[]> {
    const insights: CreateInsightDto[] = [];

    // Check for stories without estimates
    const unestimatedCount = await this.prisma.story.count({
      where: {
        projectId,
        estimate: null,
        status: { not: 'DONE' },
      },
    });

    if (unestimatedCount >= 5) {
      insights.push({
        severity: Severity.INFO,
        type: InsightType.CAPACITY_WARNING,
        title: `${unestimatedCount} stories have no estimates`,
        description: `${unestimatedCount} active stories are missing story point estimates, which affects planning accuracy.`,
        recommendation:
          'Schedule a backlog grooming session to estimate these stories.',
        dataSnapshot: { unestimatedCount },
      });
    }

    return insights;
  }

  private mapToInsightType(type: string): InsightType {
    // Map custom type strings to schema InsightType enum
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

  private mapToDto(insight: {
    id: string;
    projectId: string;
    sprintId: string | null;
    severity: Severity;
    insightType: InsightType;
    title: string;
    description: string | null;
    aiExplanation: string | null;
    linkedEntities: unknown;
    acknowledged: boolean;
    createdAt: Date;
  }): InsightDto {
    return {
      id: insight.id,
      projectId: insight.projectId,
      sprintId: insight.sprintId,
      severity: insight.severity,
      type: insight.insightType,
      title: insight.title,
      description: insight.description || '',
      recommendation: insight.aiExplanation,
      dataSnapshot: insight.linkedEntities as Record<string, unknown> | null,
      acknowledged: insight.acknowledged,
      acknowledgedBy: null,
      acknowledgedAt: null,
      createdAt: insight.createdAt,
    };
  }

  private getImpactDescription(severity: Severity, type: InsightType): string {
    const impacts: Record<string, string> = {
      RISK: 'May cause sprint failure and missed commitments',
      BLOCKER: 'Blocking team progress and sprint completion',
      VELOCITY: 'Indicates team productivity issues',
      SCOPE_CREEP: 'Threatens sprint goals and team morale',
      DEPENDENCY_ISSUE: 'External dependency affecting progress',
      CAPACITY_WARNING: 'Team capacity concerns',
    };

    return (
      impacts[type] ||
      (severity === Severity.CRITICAL
        ? 'Critical impact on project delivery'
        : 'May affect project timeline')
    );
  }
}
