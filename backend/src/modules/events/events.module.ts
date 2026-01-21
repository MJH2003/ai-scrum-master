import { Module, Global, forwardRef } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { EventEmitterService } from './event-emitter.service';
import { RealtimeModule } from '../realtime/realtime.module';

@Global()
@Module({
  imports: [forwardRef(() => RealtimeModule)],
  controllers: [EventsController],
  providers: [EventsService, EventEmitterService],
  exports: [EventsService, EventEmitterService],
})
export class EventsModule {}
