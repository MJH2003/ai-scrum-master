import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  BurndownDto,
  BurndownPointDto,
  SprintMetricsDto,
  VelocityDto,
  VelocityPointDto,
  ProjectSummaryDto,
} from './dto';

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get burndown chart data for a sprint
   */
  async getSprintBurndown(projectId: string, sprintId: string): Promise<BurndownDto> {
    const sprint = await this.prisma.sprint.findFirst({
      where: { id: sprintId, projectId },
      include: {
        burndownData: {
          orderBy: { date: 'asc' },
        },
        items: {
          include: { story: true },
        },
      },
    });

    if (!sprint) {
      throw new Error('Sprint not found');
    }

    if (!sprint.startDate || !sprint.endDate) {
      throw new Error('Sprint dates not set');
    }

    const totalPoints = sprint.items.reduce(
      (sum, item) => sum + (item.originalEstimate || 0),
      0,
    );

    // Calculate ideal burndown line
    const startDate = sprint.startDate;
    const endDate = sprint.endDate;
    const totalDays = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    const pointsPerDay = totalDays > 0 ? totalPoints / totalDays : 0;

    const data: BurndownPointDto[] = sprint.burndownData.map((snapshot) => {
      const dayNumber = Math.ceil(
        (snapshot.date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      const idealRemaining = Math.max(0, totalPoints - pointsPerDay * dayNumber);

      return {
        date: snapshot.date.toISOString().split('T')[0],
        totalPoints: snapshot.totalPoints,
        remainingPoints: snapshot.remainingPoints,
        completedPoints: snapshot.completedPoints,
        addedPoints: snapshot.addedPoints,
        removedPoints: snapshot.removedPoints,
        idealRemaining: Math.round(idealRemaining * 10) / 10,
      };
    });

    return {
      sprintId: sprint.id,
      sprintName: sprint.name,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      totalPoints,
      data,
    };
  }

  /**
   * Get metrics for a specific sprint
   */
  async getSprintMetrics(projectId: string, sprintId: string): Promise<SprintMetricsDto> {
    const sprint = await this.prisma.sprint.findFirst({
      where: { id: sprintId, projectId },
      include: {
        items: {
          include: {
            story: true,
          },
        },
      },
    });

    if (!sprint) {
      throw new Error('Sprint not found');
    }

    if (!sprint.startDate || !sprint.endDate) {
      throw new Error('Sprint dates not set');
    }

    const committedPoints = sprint.items.reduce(
      (sum, item) => sum + (item.originalEstimate || 0),
      0,
    );

    const completedItems = sprint.items.filter(
      (item) => item.story.status === 'DONE',
    );
    const completedPoints = completedItems.reduce(
      (sum, item) => sum + (item.originalEstimate || 0),
      0,
    );

    // Calculate scope change (difference between final and original estimates)
    const scopeChange = sprint.items.reduce((sum, item) => {
      const original = item.originalEstimate || 0;
      const final = item.finalEstimate || item.originalEstimate || 0;
      return sum + (final - original);
    }, 0);

    // Calculate average cycle time for completed stories
    let avgCycleTime: number | null = null;
    const completedWithTime = completedItems.filter(
      (item) => item.completedAt && item.addedAt,
    );
    if (completedWithTime.length > 0) {
      const totalCycleTime = completedWithTime.reduce((sum, item) => {
        const hours =
          (item.completedAt!.getTime() - item.addedAt.getTime()) /
          (1000 * 60 * 60);
        return sum + hours;
      }, 0);
      avgCycleTime = Math.round((totalCycleTime / completedWithTime.length) * 10) / 10;
    }

    const durationDays = Math.ceil(
      (sprint.endDate.getTime() - sprint.startDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    return {
      sprintId: sprint.id,
      sprintName: sprint.name,
      committedPoints,
      completedPoints,
      completionRate:
        committedPoints > 0
          ? Math.round((completedPoints / committedPoints) * 100)
          : 0,
      storiesCompleted: completedItems.length,
      totalStories: sprint.items.length,
      scopeChange,
      avgCycleTime,
      durationDays,
    };
  }

  /**
   * Get velocity trend for a project
   */
  async getVelocityTrend(
    projectId: string,
    sprintCount: number = 10,
  ): Promise<VelocityDto> {
    const sprints = await this.prisma.sprint.findMany({
      where: {
        projectId,
        status: 'COMPLETED',
      },
      include: {
        items: {
          include: { story: true },
        },
      },
      orderBy: { endDate: 'desc' },
      take: sprintCount,
    });

    const sprintData: VelocityPointDto[] = sprints
      .filter((sprint) => sprint.endDate !== null)
      .reverse()
      .map((sprint) => {
        const committedPoints = sprint.items.reduce(
          (sum, item) => sum + (item.originalEstimate || 0),
          0,
        );
        const completedPoints = sprint.items
          .filter((item) => item.story.status === 'DONE')
          .reduce((sum, item) => sum + (item.originalEstimate || 0), 0);

        return {
          sprintId: sprint.id,
          sprintName: sprint.name,
          completedPoints,
          committedPoints,
          endDate: sprint.endDate!.toISOString().split('T')[0],
        };
      });

    const velocities = sprintData.map((s) => s.completedPoints);
    const averageVelocity =
      velocities.length > 0
        ? Math.round(velocities.reduce((a, b) => a + b, 0) / velocities.length)
        : 0;

    // Calculate trend (simple linear regression slope)
    const trend = this.calculateTrend(velocities);

    // Calculate standard deviation
    const standardDeviation = this.calculateStdDev(velocities, averageVelocity);

    // Predict next velocity using weighted average (recent sprints weighted more)
    const predictedVelocity = this.predictVelocity(velocities);

    return {
      sprints: sprintData,
      averageVelocity,
      trend: Math.round(trend * 100) / 100,
      standardDeviation: Math.round(standardDeviation * 100) / 100,
      predictedVelocity,
    };
  }

  /**
   * Get project summary with key metrics
   */
  async getProjectSummary(projectId: string): Promise<ProjectSummaryDto> {
    const [project, epicCount, stories, tasks, sprints] = await Promise.all([
      this.prisma.project.findUnique({ where: { id: projectId } }),
      this.prisma.epic.count({ where: { projectId } }),
      this.prisma.story.findMany({
        where: { projectId },
        select: { status: true, estimate: true },
      }),
      this.prisma.task.count({ where: { projectId } }),
      this.prisma.sprint.findMany({
        where: { projectId },
        include: {
          items: { include: { story: true } },
        },
        orderBy: { startDate: 'desc' },
      }),
    ]);

    if (!project) {
      throw new Error('Project not found');
    }

    // Count stories by status (using schema-defined statuses)
    const statusCounts = stories.reduce(
      (acc, story) => {
        if (story.status === 'DONE') acc.completed++;
        else if (story.status === 'IN_PROGRESS') acc.inProgress++;
        else acc.backlog++;
        return acc;
      },
      { completed: 0, inProgress: 0, backlog: 0 },
    );

    // Calculate story points
    const totalStoryPoints = stories.reduce((sum, s) => sum + (s.estimate || 0), 0);
    const completedStoryPoints = stories
      .filter((s) => s.status === 'DONE')
      .reduce((sum, s) => sum + (s.estimate || 0), 0);

    // Get active sprint
    const activeSprint = sprints.find((s) => s.status === 'ACTIVE');
    let activeSprintInfo = null;
    if (activeSprint && activeSprint.endDate) {
      const totalItems = activeSprint.items.length;
      const completedItems = activeSprint.items.filter(
        (i) => i.story.status === 'DONE',
      ).length;
      const now = new Date();
      const daysRemaining = Math.max(
        0,
        Math.ceil(
          (activeSprint.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        ),
      );

      activeSprintInfo = {
        id: activeSprint.id,
        name: activeSprint.name,
        progress: totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0,
        daysRemaining,
      };
    }

    // Calculate average velocity from completed sprints
    const completedSprints = sprints.filter((s) => s.status === 'COMPLETED');
    let averageVelocity = 0;
    if (completedSprints.length > 0) {
      const totalVelocity = completedSprints.reduce((sum, sprint) => {
        const sprintPoints = sprint.items
          .filter((i) => i.story.status === 'DONE')
          .reduce((s, i) => s + (i.originalEstimate || 0), 0);
        return sum + sprintPoints;
      }, 0);
      averageVelocity = Math.round(totalVelocity / completedSprints.length);
    }

    // Calculate health score
    const healthScore = this.calculateHealthScore({
      completionRate: stories.length > 0 ? statusCounts.completed / stories.length : 0,
      hasActiveSprint: !!activeSprint,
      velocityStability: completedSprints.length >= 3,
      backlogHealth: statusCounts.backlog > 0,
    });

    return {
      projectId: project.id,
      projectName: project.name,
      totalEpics: epicCount,
      totalStories: stories.length,
      totalTasks: tasks,
      completedStories: statusCounts.completed,
      inProgressStories: statusCounts.inProgress,
      backlogStories: statusCounts.backlog,
      totalSprints: sprints.length,
      activeSprint: activeSprintInfo,
      averageVelocity,
      totalStoryPoints,
      completedStoryPoints,
      healthScore,
    };
  }

  /**
   * Create a burndown snapshot for a sprint
   */
  async createBurndownSnapshot(sprintId: string): Promise<void> {
    const sprint = await this.prisma.sprint.findUnique({
      where: { id: sprintId },
      include: {
        items: { include: { story: true } },
        burndownData: {
          orderBy: { date: 'desc' },
          take: 1,
        },
      },
    });

    if (!sprint || sprint.status !== 'ACTIVE') {
      return;
    }

    const totalPoints = sprint.items.reduce(
      (sum, item) => sum + (item.originalEstimate || 0),
      0,
    );

    const completedPoints = sprint.items
      .filter((item) => item.story.status === 'DONE')
      .reduce((sum, item) => sum + (item.originalEstimate || 0), 0);

    const remainingPoints = totalPoints - completedPoints;

    // Calculate added/removed points since last snapshot
    const lastSnapshot = sprint.burndownData[0];
    const addedPoints = lastSnapshot
      ? Math.max(0, totalPoints - lastSnapshot.totalPoints)
      : 0;
    const removedPoints = lastSnapshot
      ? Math.max(0, lastSnapshot.totalPoints - totalPoints)
      : 0;

    await this.prisma.burndownSnapshot.create({
      data: {
        sprintId,
        totalPoints,
        remainingPoints,
        completedPoints,
        addedPoints,
        removedPoints,
      },
    });

    this.logger.debug(
      `Created burndown snapshot for sprint ${sprintId}: ${completedPoints}/${totalPoints} points`,
    );
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;

    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, y, x) => sum + x * y, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope;
  }

  private calculateStdDev(values: number[], mean: number): number {
    if (values.length < 2) return 0;

    const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
    const avgSquaredDiff =
      squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(avgSquaredDiff);
  }

  private predictVelocity(velocities: number[]): number {
    if (velocities.length === 0) return 0;
    if (velocities.length === 1) return velocities[0];

    // Weighted average: more recent sprints have higher weight
    const weights = velocities.map((_, i) => i + 1);
    const totalWeight = weights.reduce((a, b) => a + b, 0);

    const weightedSum = velocities.reduce(
      (sum, v, i) => sum + v * weights[i],
      0,
    );

    return Math.round(weightedSum / totalWeight);
  }

  private calculateHealthScore(factors: {
    completionRate: number;
    hasActiveSprint: boolean;
    velocityStability: boolean;
    backlogHealth: boolean;
  }): number {
    let score = 50; // Base score

    // Completion rate contributes up to 30 points
    score += factors.completionRate * 30;

    // Active sprint contributes 10 points
    if (factors.hasActiveSprint) score += 10;

    // Velocity stability contributes 5 points
    if (factors.velocityStability) score += 5;

    // Having backlog items contributes 5 points
    if (factors.backlogHealth) score += 5;

    return Math.min(100, Math.round(score));
  }
}
