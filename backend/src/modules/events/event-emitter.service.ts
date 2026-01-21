import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EntityType, EventAction } from '@prisma/client';
import { EventsService, CreateEventInput } from '../events/events.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { ProjectEventPayload } from '../realtime/types';

export interface EmitEventOptions extends Omit<CreateEventInput, 'projectId'> {
  projectId: string;
  entityTitle?: string;
  userName?: string;
}

@Injectable()
export class EventEmitterService implements OnModuleInit {
  private readonly logger = new Logger(EventEmitterService.name);

  constructor(
    private readonly eventsService: EventsService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  onModuleInit() {
    this.logger.log('EventEmitterService initialized');
  }

  /**
   * Log an event and broadcast it via WebSocket
   */
  async emit(options: EmitEventOptions): Promise<void> {
    const {
      projectId,
      entityType,
      entityId,
      action,
      changes,
      userId,
      aiTriggered,
      entityTitle,
      userName,
    } = options;

    // Log to database
    const eventLog = await this.eventsService.logEvent({
      projectId,
      entityType,
      entityId,
      action,
      changes,
      userId,
      aiTriggered,
    });

    // Broadcast via WebSocket
    const payload: ProjectEventPayload = {
      projectId,
      entityType,
      entityId,
      action,
      changes,
      userId,
      userName: userName ?? eventLog.userName ?? undefined,
      aiTriggered: aiTriggered ?? false,
      timestamp: eventLog.createdAt,
      entityTitle: entityTitle ?? eventLog.entityTitle,
    };

    this.realtimeGateway.broadcastProjectEvent(payload);

    this.logger.debug(
      `Event emitted: ${action} on ${entityType} ${entityId} in project ${projectId}`,
    );
  }

  /**
   * Emit a CREATED event
   */
  async emitCreated(
    projectId: string,
    entityType: EntityType,
    entityId: string,
    entity: Record<string, any>,
    options?: {
      userId?: string;
      userName?: string;
      aiTriggered?: boolean;
    },
  ): Promise<void> {
    await this.emit({
      projectId,
      entityType,
      entityId,
      action: EventAction.CREATED,
      changes: entity,
      entityTitle: entity.title ?? entity.name,
      ...options,
    });
  }

  /**
   * Emit an UPDATED event with diff
   */
  async emitUpdated(
    projectId: string,
    entityType: EntityType,
    entityId: string,
    oldValue: Record<string, any>,
    newValue: Record<string, any>,
    options?: {
      userId?: string;
      userName?: string;
      aiTriggered?: boolean;
    },
  ): Promise<void> {
    const changes = this.eventsService.generateDiff(oldValue, newValue);

    // Only emit if there are actual changes
    if (Object.keys(changes).length === 0) {
      return;
    }

    await this.emit({
      projectId,
      entityType,
      entityId,
      action: EventAction.UPDATED,
      changes,
      entityTitle: newValue.title ?? newValue.name,
      ...options,
    });
  }

  /**
   * Emit a DELETED event
   */
  async emitDeleted(
    projectId: string,
    entityType: EntityType,
    entityId: string,
    entity: Record<string, any>,
    options?: {
      userId?: string;
      userName?: string;
      aiTriggered?: boolean;
    },
  ): Promise<void> {
    await this.emit({
      projectId,
      entityType,
      entityId,
      action: EventAction.DELETED,
      changes: { deleted: entity },
      entityTitle: entity.title ?? entity.name,
      ...options,
    });
  }

  /**
   * Emit a STATUS_CHANGED event
   */
  async emitStatusChanged(
    projectId: string,
    entityType: EntityType,
    entityId: string,
    oldStatus: string,
    newStatus: string,
    options?: {
      userId?: string;
      userName?: string;
      entityTitle?: string;
    },
  ): Promise<void> {
    await this.emit({
      projectId,
      entityType,
      entityId,
      action: EventAction.STATUS_CHANGED,
      changes: { status: { old: oldStatus, new: newStatus } },
      ...options,
    });
  }

  /**
   * Emit an ASSIGNED event
   */
  async emitAssigned(
    projectId: string,
    entityType: EntityType,
    entityId: string,
    assigneeId: string,
    assigneeName: string,
    options?: {
      userId?: string;
      userName?: string;
      entityTitle?: string;
    },
  ): Promise<void> {
    await this.emit({
      projectId,
      entityType,
      entityId,
      action: EventAction.ASSIGNED,
      changes: { assignee: { id: assigneeId, name: assigneeName } },
      ...options,
    });
  }

  /**
   * Emit a SPRINT_ADDED event
   */
  async emitSprintAdded(
    projectId: string,
    entityId: string,
    sprintId: string,
    sprintName: string,
    options?: {
      userId?: string;
      userName?: string;
      entityTitle?: string;
      aiTriggered?: boolean;
    },
  ): Promise<void> {
    await this.emit({
      projectId,
      entityType: EntityType.STORY,
      entityId,
      action: EventAction.SPRINT_ADDED,
      changes: { sprint: { id: sprintId, name: sprintName } },
      ...options,
    });
  }

  /**
   * Emit a SPRINT_REMOVED event
   */
  async emitSprintRemoved(
    projectId: string,
    entityId: string,
    sprintId: string,
    sprintName: string,
    options?: {
      userId?: string;
      userName?: string;
      entityTitle?: string;
    },
  ): Promise<void> {
    await this.emit({
      projectId,
      entityType: EntityType.STORY,
      entityId,
      action: EventAction.SPRINT_REMOVED,
      changes: { sprint: { id: sprintId, name: sprintName } },
      ...options,
    });
  }
}
