import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
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
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    // Core modules
    ConfigModule,
    LoggerModule,
    DatabaseModule,

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
