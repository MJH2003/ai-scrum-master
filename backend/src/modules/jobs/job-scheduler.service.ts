import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ANALYTICS_QUEUE, AnalyticsJobData } from './analytics.processor';

@Injectable()
export class JobSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(JobSchedulerService.name);

  constructor(
    @InjectQueue(ANALYTICS_QUEUE) private readonly analyticsQueue: Queue<AnalyticsJobData>,
  ) {}

  async onModuleInit() {
    await this.setupRecurringJobs();
  }

  private async setupRecurringJobs() {
    // Remove existing repeatable jobs before adding new ones
    const repeatableJobs = await this.analyticsQueue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      await this.analyticsQueue.removeRepeatableByKey(job.key);
    }

    // Daily burndown snapshot at 11:59 PM
    await this.analyticsQueue.add(
      'daily-burndown',
      { type: 'burndown-snapshot' },
      {
        repeat: {
          pattern: '59 23 * * *', // Every day at 11:59 PM
        },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    );

    // Stale proposal cleanup - weekly on Sunday at 3 AM
    await this.analyticsQueue.add(
      'stale-proposal-cleanup',
      { type: 'stale-proposal-cleanup', olderThanDays: 7 },
      {
        repeat: {
          pattern: '0 3 * * 0', // Every Sunday at 3 AM
        },
        removeOnComplete: 10,
        removeOnFail: 10,
      },
    );

    // Sprint auto-complete check - every hour
    await this.analyticsQueue.add(
      'sprint-auto-complete',
      { type: 'sprint-auto-complete' },
      {
        repeat: {
          pattern: '0 * * * *', // Every hour
        },
        removeOnComplete: 24,
        removeOnFail: 10,
      },
    );

    this.logger.log('Recurring jobs scheduled');
  }

  /**
   * Schedule a burndown snapshot for a specific sprint
   */
  async scheduleBurndownSnapshot(sprintId: string, delay?: number): Promise<void> {
    await this.analyticsQueue.add(
      'burndown-snapshot',
      { type: 'burndown-snapshot', sprintId },
      {
        delay,
        removeOnComplete: true,
        removeOnFail: 5,
      },
    );
  }

  /**
   * Schedule project analysis
   */
  async scheduleProjectAnalysis(projectId: string, delay?: number): Promise<void> {
    await this.analyticsQueue.add(
      'project-analysis',
      { type: 'project-analysis', projectId },
      {
        delay,
        removeOnComplete: true,
        removeOnFail: 5,
        jobId: `analysis-${projectId}`, // Prevent duplicate jobs
      },
    );
  }

  /**
   * Get queue status
   */
  async getQueueStatus(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.analyticsQueue.getWaitingCount(),
      this.analyticsQueue.getActiveCount(),
      this.analyticsQueue.getCompletedCount(),
      this.analyticsQueue.getFailedCount(),
      this.analyticsQueue.getDelayedCount(),
    ]);

    return { waiting, active, completed, failed, delayed };
  }
}
