import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from './config';
import { LoggerModule } from './common/logger';
import { CorrelationIdMiddleware } from './common/middleware';
import { DatabaseModule } from './database';
import { HealthModule } from './health';
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
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
