import { Injectable } from '@nestjs/common';
import { EntityType, EventAction, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { EventLogDto, EventLogListDto, EventLogQueryDto } from './dto';

export interface CreateEventInput {
  projectId: string;
  entityType: EntityType;
  entityId: string;
  action: EventAction;
  changes?: Record<string, any>;
  userId?: string;
  aiTriggered?: boolean;
}

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Log an event for an entity change
   */
  async logEvent(input: CreateEventInput): Promise<EventLogDto> {
    const event = await this.prisma.eventLog.create({
      data: {
        projectId: input.projectId,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        changes: input.changes ?? {},
        userId: input.userId,
        aiTriggered: input.aiTriggered ?? false,
      },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    return {
      id: event.id,
      projectId: event.projectId,
      entityType: event.entityType,
      entityId: event.entityId,
      action: event.action,
      changes: event.changes as Record<string, any>,
      userId: event.userId,
      userName: event.user?.name,
      aiTriggered: event.aiTriggered,
      createdAt: event.createdAt,
    };
  }

  /**
   * Get paginated activity feed for a project
   */
  async getProjectEvents(
    projectId: string,
    query: EventLogQueryDto,
  ): Promise<EventLogListDto> {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 100);
    const skip = (page - 1) * pageSize;

    const where: Prisma.EventLogWhereInput = {
      projectId,
      ...(query.entityType && { entityType: query.entityType }),
      ...(query.action && { action: query.action }),
      ...(query.userId && { userId: query.userId }),
    };

    const [events, total] = await Promise.all([
      this.prisma.eventLog.findMany({
        where,
        include: {
          user: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.eventLog.count({ where }),
    ]);

    // Fetch entity titles for context
    const eventsWithTitles = await this.enrichEventsWithTitles(events);

    return {
      items: eventsWithTitles,
      total,
      page,
      pageSize,
      hasMore: skip + events.length < total,
    };
  }

  /**
   * Get event history for a specific entity
   */
  async getEntityEvents(
    projectId: string,
    entityType: EntityType,
    entityId: string,
    query: EventLogQueryDto,
  ): Promise<EventLogListDto> {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 100);
    const skip = (page - 1) * pageSize;

    const where: Prisma.EventLogWhereInput = {
      projectId,
      entityType,
      entityId,
      ...(query.action && { action: query.action }),
    };

    const [events, total] = await Promise.all([
      this.prisma.eventLog.findMany({
        where,
        include: {
          user: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.eventLog.count({ where }),
    ]);

    return {
      items: events.map((event) => ({
        id: event.id,
        projectId: event.projectId,
        entityType: event.entityType,
        entityId: event.entityId,
        action: event.action,
        changes: event.changes as Record<string, any>,
        userId: event.userId,
        userName: event.user?.name,
        aiTriggered: event.aiTriggered,
        createdAt: event.createdAt,
      })),
      total,
      page,
      pageSize,
      hasMore: skip + events.length < total,
    };
  }

  /**
   * Generate a diff between old and new values
   */
  generateDiff(
    oldValue: Record<string, any>,
    newValue: Record<string, any>,
  ): Record<string, { old: any; new: any }> {
    const diff: Record<string, { old: any; new: any }> = {};
    const allKeys = new Set([
      ...Object.keys(oldValue),
      ...Object.keys(newValue),
    ]);

    for (const key of allKeys) {
      // Skip internal fields
      if (['updatedAt', 'createdAt', 'id', 'projectId'].includes(key)) {
        continue;
      }

      const oldVal = oldValue[key];
      const newVal = newValue[key];

      // Deep comparison for objects/arrays
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        diff[key] = { old: oldVal, new: newVal };
      }
    }

    return diff;
  }

  /**
   * Enrich events with entity titles for better display
   */
  private async enrichEventsWithTitles(
    events: Array<{
      id: string;
      projectId: string;
      entityType: EntityType;
      entityId: string;
      action: EventAction;
      changes: Prisma.JsonValue;
      userId: string | null;
      aiTriggered: boolean;
      createdAt: Date;
      user: { id: string; name: string | null } | null;
    }>,
  ): Promise<EventLogDto[]> {
    // Group events by entity type for efficient batch fetching
    const epicIds = new Set<string>();
    const storyIds = new Set<string>();
    const taskIds = new Set<string>();

    for (const event of events) {
      switch (event.entityType) {
        case EntityType.EPIC:
          epicIds.add(event.entityId);
          break;
        case EntityType.STORY:
          storyIds.add(event.entityId);
          break;
        case EntityType.TASK:
          taskIds.add(event.entityId);
          break;
      }
    }

    // Batch fetch titles
    const [epics, stories, tasks] = await Promise.all([
      epicIds.size > 0
        ? this.prisma.epic.findMany({
            where: { id: { in: Array.from(epicIds) } },
            select: { id: true, title: true },
          })
        : [],
      storyIds.size > 0
        ? this.prisma.story.findMany({
            where: { id: { in: Array.from(storyIds) } },
            select: { id: true, title: true },
          })
        : [],
      taskIds.size > 0
        ? this.prisma.task.findMany({
            where: { id: { in: Array.from(taskIds) } },
            select: { id: true, title: true },
          })
        : [],
    ]);

    // Create lookup maps
    const titleMap = new Map<string, string>();
    epics.forEach((e) => titleMap.set(e.id, e.title));
    stories.forEach((s) => titleMap.set(s.id, s.title));
    tasks.forEach((t) => titleMap.set(t.id, t.title));

    return events.map((event) => ({
      id: event.id,
      projectId: event.projectId,
      entityType: event.entityType,
      entityId: event.entityId,
      action: event.action,
      changes: event.changes as Record<string, any>,
      userId: event.userId,
      userName: event.user?.name,
      aiTriggered: event.aiTriggered,
      createdAt: event.createdAt,
      entityTitle: titleMap.get(event.entityId),
    }));
  }
}
