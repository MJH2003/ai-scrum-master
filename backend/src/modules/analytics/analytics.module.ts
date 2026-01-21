import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { MetricsService } from './metrics.service';

@Module({
  controllers: [AnalyticsController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class AnalyticsModule {}
