import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { TaskStatus, Prisma, EntityType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { EventEmitterService } from '../events/event-emitter.service';
import { CreateStoryDto, UpdateStoryDto, StoryDto, StoryWithRelationsDto, StoryListItemDto } from './dto';

@Injectable()
export class StoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitterService,
  ) {}

  async create(projectId: string, createStoryDto: CreateStoryDto, userId?: string): Promise<StoryWithRelationsDto> {
    // Validate epicId belongs to the project if provided
    if (createStoryDto.epicId) {
      const epic = await this.prisma.epic.findFirst({
        where: { id: createStoryDto.epicId, projectId },
      });
      if (!epic) {
        throw new BadRequestException('Epic not found in this project');
      }
    }

    // Validate assigneeId is a project member if provided
    if (createStoryDto.assigneeId) {
      const member = await this.prisma.projectMember.findUnique({
        where: {
          userId_projectId: { userId: createStoryDto.assigneeId, projectId },
        },
      });
      if (!member) {
        throw new BadRequestException('Assignee is not a member of this project');
      }
    }

    const { acceptanceCriteria, ...rest } = createStoryDto;

    const story = await this.prisma.story.create({
      data: {
        ...rest,
        acceptanceCriteria: acceptanceCriteria ?? [],
        projectId,
      },
      include: {
        epic: { select: { id: true, title: true } },
        assignee: { select: { id: true, name: true, email: true } },
      },
    });

    // Emit event for real-time updates
    await this.eventEmitter.emitCreated(
      projectId,
      EntityType.STORY,
      story.id,
      { title: story.title, status: story.status, priority: story.priority, estimate: story.estimate },
      { userId },
    );

    return {
      id: story.id,
      title: story.title,
      description: story.description,
      acceptanceCriteria: Array.isArray(story.acceptanceCriteria) ? story.acceptanceCriteria as string[] : [],
      status: story.status,
      priority: story.priority,
      estimate: story.estimate,
      confidence: story.confidence,
      projectId: story.projectId,
      epicId: story.epicId,
      assigneeId: story.assigneeId,
      createdAt: story.createdAt,
      updatedAt: story.updatedAt,
      epic: story.epic,
      assignee: story.assignee,
      taskCount: 0,
      completedTaskCount: 0,
    };
  }

  async findAll(projectId: string, epicId?: string): Promise<StoryListItemDto[]> {
    const where: Prisma.StoryWhereInput = { projectId };
    if (epicId) {
      where.epicId = epicId;
    }

    const stories = await this.prisma.story.findMany({
      where,
      include: {
        epic: { select: { title: true } },
        assignee: { select: { name: true } },
        _count: { select: { tasks: true } },
        tasks: {
          where: { status: TaskStatus.DONE },
          select: { id: true },
        },
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    });

    return stories.map((story) => ({
      id: story.id,
      title: story.title,
      status: story.status,
      priority: story.priority,
      estimate: story.estimate,
      epicId: story.epicId,
      epicTitle: story.epic?.title ?? null,
      assigneeId: story.assigneeId,
      assigneeName: story.assignee?.name ?? null,
      taskCount: story._count.tasks,
      completedTaskCount: story.tasks.length,
      createdAt: story.createdAt,
    }));
  }

  async findById(projectId: string, storyId: string): Promise<StoryWithRelationsDto> {
    const story = await this.prisma.story.findFirst({
      where: { id: storyId, projectId },
      include: {
        epic: { select: { id: true, title: true } },
        assignee: { select: { id: true, name: true, email: true } },
        _count: { select: { tasks: true } },
        tasks: {
          where: { status: TaskStatus.DONE },
          select: { id: true },
        },
      },
    });

    if (!story) {
      throw new NotFoundException('Story not found');
    }

    return {
      id: story.id,
      title: story.title,
      description: story.description,
      acceptanceCriteria: Array.isArray(story.acceptanceCriteria) ? story.acceptanceCriteria as string[] : [],
      status: story.status,
      priority: story.priority,
      estimate: story.estimate,
      confidence: story.confidence,
      projectId: story.projectId,
      epicId: story.epicId,
      assigneeId: story.assigneeId,
      createdAt: story.createdAt,
      updatedAt: story.updatedAt,
      epic: story.epic,
      assignee: story.assignee,
      taskCount: story._count.tasks,
      completedTaskCount: story.tasks.length,
    };
  }

  async update(projectId: string, storyId: string, updateStoryDto: UpdateStoryDto, userId?: string): Promise<StoryDto> {
    const story = await this.prisma.story.findFirst({
      where: { id: storyId, projectId },
    });

    if (!story) {
      throw new NotFoundException('Story not found');
    }

    // Store old values for diff
    const oldValue = {
      title: story.title,
      description: story.description,
      status: story.status,
      priority: story.priority,
      estimate: story.estimate,
      epicId: story.epicId,
      assigneeId: story.assigneeId,
    };

    // Validate epicId if being changed
    if (updateStoryDto.epicId) {
      const epic = await this.prisma.epic.findFirst({
        where: { id: updateStoryDto.epicId, projectId },
      });
      if (!epic) {
        throw new BadRequestException('Epic not found in this project');
      }
    }

    // Validate assigneeId if being changed
    if (updateStoryDto.assigneeId) {
      const member = await this.prisma.projectMember.findUnique({
        where: {
          userId_projectId: { userId: updateStoryDto.assigneeId, projectId },
        },
      });
      if (!member) {
        throw new BadRequestException('Assignee is not a member of this project');
      }
    }

    const { acceptanceCriteria, ...rest } = updateStoryDto;
    const data: Prisma.StoryUpdateInput = { ...rest };

    if (acceptanceCriteria !== undefined) {
      data.acceptanceCriteria = acceptanceCriteria;
    }

    const updated = await this.prisma.story.update({
      where: { id: storyId },
      data,
    });

    // Emit update event
    const newValue = {
      title: updated.title,
      description: updated.description,
      status: updated.status,
      priority: updated.priority,
      estimate: updated.estimate,
      epicId: updated.epicId,
      assigneeId: updated.assigneeId,
    };

    await this.eventEmitter.emitUpdated(
      projectId,
      EntityType.STORY,
      storyId,
      oldValue,
      newValue,
      { userId },
    );

    return {
      id: updated.id,
      title: updated.title,
      description: updated.description,
      acceptanceCriteria: Array.isArray(updated.acceptanceCriteria) ? updated.acceptanceCriteria as string[] : [],
      status: updated.status,
      priority: updated.priority,
      estimate: updated.estimate,
      confidence: updated.confidence,
      projectId: updated.projectId,
      epicId: updated.epicId,
      assigneeId: updated.assigneeId,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  async delete(projectId: string, storyId: string, userId?: string): Promise<void> {
    const story = await this.prisma.story.findFirst({
      where: { id: storyId, projectId },
    });

    if (!story) {
      throw new NotFoundException('Story not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.task.deleteMany({ where: { storyId } });
      await tx.story.delete({ where: { id: storyId } });
    });

    // Emit delete event
    await this.eventEmitter.emitDeleted(
      projectId,
      EntityType.STORY,
      storyId,
      { title: story.title },
      { userId },
    );
  }
}
