import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateTaskDto, UpdateTaskDto, TaskDto, TaskWithRelationsDto, TaskListItemDto } from './dto';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async create(projectId: string, createTaskDto: CreateTaskDto): Promise<TaskWithRelationsDto> {
    // Validate storyId belongs to the project
    const story = await this.prisma.story.findFirst({
      where: { id: createTaskDto.storyId, projectId },
    });
    if (!story) {
      throw new BadRequestException('Story not found in this project');
    }

    // Validate assigneeId is a project member if provided
    if (createTaskDto.assigneeId) {
      const member = await this.prisma.projectMember.findUnique({
        where: {
          userId_projectId: { userId: createTaskDto.assigneeId, projectId },
        },
      });
      if (!member) {
        throw new BadRequestException('Assignee is not a member of this project');
      }
    }

    const task = await this.prisma.task.create({
      data: {
        title: createTaskDto.title,
        description: createTaskDto.description,
        status: createTaskDto.status,
        estimate: createTaskDto.estimate,
        storyId: createTaskDto.storyId,
        assigneeId: createTaskDto.assigneeId,
        projectId,
      },
      include: {
        story: { select: { id: true, title: true } },
        assignee: { select: { id: true, name: true, email: true } },
      },
    });

    return {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      estimate: task.estimate,
      projectId: task.projectId,
      storyId: task.storyId,
      assigneeId: task.assigneeId,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      story: task.story,
      assignee: task.assignee,
    };
  }

  async findAll(projectId: string, storyId?: string, status?: string): Promise<TaskListItemDto[]> {
    const where: Prisma.TaskWhereInput = { projectId };
    if (storyId) {
      where.storyId = storyId;
    }
    if (status) {
      where.status = status as any;
    }

    const tasks = await this.prisma.task.findMany({
      where,
      include: {
        story: { select: { title: true } },
        assignee: { select: { name: true } },
      },
      orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
    });

    return tasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      estimate: task.estimate,
      storyId: task.storyId,
      storyTitle: task.story?.title ?? null,
      assigneeId: task.assigneeId,
      assigneeName: task.assignee?.name ?? null,
      createdAt: task.createdAt,
    }));
  }

  async findById(projectId: string, taskId: string): Promise<TaskWithRelationsDto> {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, projectId },
      include: {
        story: { select: { id: true, title: true } },
        assignee: { select: { id: true, name: true, email: true } },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    return {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      estimate: task.estimate,
      projectId: task.projectId,
      storyId: task.storyId,
      assigneeId: task.assigneeId,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      story: task.story,
      assignee: task.assignee,
    };
  }

  async update(projectId: string, taskId: string, updateTaskDto: UpdateTaskDto): Promise<TaskDto> {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, projectId },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    // Validate assigneeId if being changed
    if (updateTaskDto.assigneeId) {
      const member = await this.prisma.projectMember.findUnique({
        where: {
          userId_projectId: { userId: updateTaskDto.assigneeId, projectId },
        },
      });
      if (!member) {
        throw new BadRequestException('Assignee is not a member of this project');
      }
    }

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: updateTaskDto,
    });

    return {
      id: updated.id,
      title: updated.title,
      description: updated.description,
      status: updated.status,
      estimate: updated.estimate,
      projectId: updated.projectId,
      storyId: updated.storyId,
      assigneeId: updated.assigneeId,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  async delete(projectId: string, taskId: string): Promise<void> {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, projectId },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    await this.prisma.task.delete({ where: { id: taskId } });
  }
}
