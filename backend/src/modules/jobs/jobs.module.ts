import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AnalyticsProcessor, ANALYTICS_QUEUE } from './analytics.processor';
import { JobSchedulerService } from './job-scheduler.service';
import { AnalyticsModule } from '../analytics/analytics.module';
import { InsightsModule } from '../insights/insights.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: ANALYTICS_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    }),
    AnalyticsModule,
    InsightsModule,
  ],
  providers: [AnalyticsProcessor, JobSchedulerService],
  exports: [JobSchedulerService],
})
export class JobsModule {}
