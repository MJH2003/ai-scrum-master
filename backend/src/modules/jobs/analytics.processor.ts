import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../database/prisma.service';
import { MetricsService } from '../analytics/metrics.service';
import { InsightsService } from '../insights/insights.service';

export const ANALYTICS_QUEUE = 'analytics';

export interface BurndownSnapshotJob {
  type: 'burndown-snapshot';
  sprintId?: string; // If provided, only this sprint; otherwise all active sprints
}

export interface ProjectAnalysisJob {
  type: 'project-analysis';
  projectId: string;
}

export interface StaleProposalCleanupJob {
  type: 'stale-proposal-cleanup';
  olderThanDays: number;
}

export interface SprintAutoCompleteJob {
  type: 'sprint-auto-complete';
}

export type AnalyticsJobData =
  | BurndownSnapshotJob
  | ProjectAnalysisJob
  | StaleProposalCleanupJob
  | SprintAutoCompleteJob;

@Processor(ANALYTICS_QUEUE)
export class AnalyticsProcessor extends WorkerHost {
  private readonly logger = new Logger(AnalyticsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly metricsService: MetricsService,
    private readonly insightsService: InsightsService,
  ) {
    super();
  }

  async process(job: Job<AnalyticsJobData>): Promise<unknown> {
    this.logger.debug(`Processing job ${job.id}: ${job.data.type}`);

    switch (job.data.type) {
      case 'burndown-snapshot':
        return this.handleBurndownSnapshot(job.data);
      case 'project-analysis':
        return this.handleProjectAnalysis(job.data);
      case 'stale-proposal-cleanup':
        return this.handleStaleProposalCleanup(job.data);
      case 'sprint-auto-complete':
        return this.handleSprintAutoComplete();
      default:
        this.logger.warn(`Unknown job type: ${(job.data as { type: string }).type}`);
        return null;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<AnalyticsJobData>) {
    this.logger.debug(`Job ${job.id} completed: ${job.data.type}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<AnalyticsJobData>, error: Error) {
    this.logger.error(`Job ${job.id} failed: ${error.message}`, error.stack);
  }

  private async handleBurndownSnapshot(
    data: BurndownSnapshotJob,
  ): Promise<{ processed: number }> {
    if (data.sprintId) {
      await this.metricsService.createBurndownSnapshot(data.sprintId);
      return { processed: 1 };
    }

    // Process all active sprints
    const activeSprints = await this.prisma.sprint.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });

    for (const sprint of activeSprints) {
      await this.metricsService.createBurndownSnapshot(sprint.id);
    }

    this.logger.log(`Created burndown snapshots for ${activeSprints.length} sprints`);
    return { processed: activeSprints.length };
  }

  private async handleProjectAnalysis(
    data: ProjectAnalysisJob,
  ): Promise<{ insightsCreated: number }> {
    const insights = await this.insightsService.analyzeProject(data.projectId);
    return { insightsCreated: insights.length };
  }

  private async handleStaleProposalCleanup(
    data: StaleProposalCleanupJob,
  ): Promise<{ deleted: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - data.olderThanDays);

    const result = await this.prisma.aIProposal.deleteMany({
      where: {
        status: 'PENDING',
        createdAt: { lt: cutoffDate },
      },
    });

    this.logger.log(
      `Cleaned up ${result.count} stale proposals older than ${data.olderThanDays} days`,
    );
    return { deleted: result.count };
  }

  private async handleSprintAutoComplete(): Promise<{
    completed: string[];
  }> {
    const now = new Date();
    
    // Find sprints that have ended but are still active
    const expiredSprints = await this.prisma.sprint.findMany({
      where: {
        status: 'ACTIVE',
        endDate: { lt: now },
      },
      select: { id: true, name: true, projectId: true },
    });

    const completed: string[] = [];
    for (const sprint of expiredSprints) {
      await this.prisma.sprint.update({
        where: { id: sprint.id },
        data: { status: 'COMPLETED' },
      });
      completed.push(sprint.id);
      this.logger.log(`Auto-completed sprint "${sprint.name}" (${sprint.id})`);
    }

    return { completed };
  }
}
