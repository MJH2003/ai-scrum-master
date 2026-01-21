import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ConfigModule } from './config';
import { LoggerModule } from './common/logger';
import { CorrelationIdMiddleware } from './common/middleware';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';
import { DatabaseModule } from './database';
import { HealthModule } from './health';
import { MetricsModule } from './metrics';
import { AuthModule, JwtAuthGuard } from './modules/auth';
import { UsersModule } from './modules/users';
import { ProjectsModule } from './modules/projects';
import { EpicsModule } from './modules/epics';
import { StoriesModule } from './modules/stories';
import { TasksModule } from './modules/tasks';
import { SprintsModule } from './modules/sprints';
import { EventsModule } from './modules/events';
import { RealtimeModule } from './modules/realtime';
import { AIModule } from './modules/ai';
import { AnalyticsModule } from './modules/analytics';
import { InsightsModule } from './modules/insights';
import { JobsModule } from './modules/jobs';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    // Core modules
    ConfigModule,
    LoggerModule,
    DatabaseModule,

    // Rate Limiting
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: 'short',
            ttl: config.get<number>('throttle.ttl', 60) * 1000,
            limit: config.get<number>('throttle.limit', 100),
          },
          {
            name: 'long',
            ttl: 60000, // 1 minute
            limit: 1000, // 1000 requests per minute
          },
        ],
      }),
    }),

    // BullMQ for background jobs
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('redis.host', 'localhost'),
          port: config.get<number>('redis.port', 6379),
        },
      }),
    }),

    // Feature modules
    HealthModule,
    MetricsModule,
    AuthModule,
    UsersModule,
    ProjectsModule,
    EpicsModule,
    StoriesModule,
    TasksModule,
    SprintsModule,
    EventsModule,
    RealtimeModule,
    AIModule,
    AnalyticsModule,
    InsightsModule,
    JobsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Global JWT Auth Guard
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Global Rate Limiting Guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Global Audit Log Interceptor
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
