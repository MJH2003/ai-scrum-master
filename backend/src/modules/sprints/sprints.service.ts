import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { SprintStatus, StoryStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  CreateSprintDto,
  UpdateSprintDto,
  SprintDto,
  SprintWithStatsDto,
  SprintListItemDto,
  AddSprintItemDto,
  SprintItemDto,
} from './dto';

@Injectable()
export class SprintsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(projectId: string, createSprintDto: CreateSprintDto): Promise<SprintWithStatsDto> {
    const { startDate, endDate, ...rest } = createSprintDto;

    // Validate dates if both provided
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (end <= start) {
        throw new BadRequestException('End date must be after start date');
      }
    }

    const sprint = await this.prisma.sprint.create({
      data: {
        ...rest,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        projectId,
      },
    });

    return {
      id: sprint.id,
      name: sprint.name,
      goal: sprint.goal,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      status: sprint.status,
      projectId: sprint.projectId,
      createdAt: sprint.createdAt,
      updatedAt: sprint.updatedAt,
      totalStories: 0,
      completedStories: 0,
      totalEstimate: 0,
      completedEstimate: 0,
      progress: 0,
      daysRemaining: sprint.endDate ? this.calculateDaysRemaining(sprint.endDate) : null,
    };
  }

  async findAll(projectId: string): Promise<SprintListItemDto[]> {
    const sprints = await this.prisma.sprint.findMany({
      where: { projectId },
      include: {
        items: {
          include: {
            story: { select: { status: true, estimate: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return sprints.map((sprint) => {
      const totalStories = sprint.items.length;
      const completedStories = sprint.items.filter(
        (item) => item.story.status === StoryStatus.DONE,
      ).length;
      const totalEstimate = sprint.items.reduce(
        (sum, item) => sum + (item.story.estimate ?? 0),
        0,
      );

      return {
        id: sprint.id,
        name: sprint.name,
        goal: sprint.goal,
        startDate: sprint.startDate,
        endDate: sprint.endDate,
        status: sprint.status,
        totalStories,
        completedStories,
        totalEstimate,
      };
    });
  }

  async findById(projectId: string, sprintId: string): Promise<SprintWithStatsDto> {
    const sprint = await this.prisma.sprint.findFirst({
      where: { id: sprintId, projectId },
      include: {
        items: {
          include: {
            story: { select: { status: true, estimate: true } },
          },
        },
      },
    });

    if (!sprint) {
      throw new NotFoundException('Sprint not found');
    }

    const totalStories = sprint.items.length;
    const completedItems = sprint.items.filter(
      (item) => item.story.status === StoryStatus.DONE,
    );
    const completedStories = completedItems.length;
    const totalEstimate = sprint.items.reduce(
      (sum, item) => sum + (item.story.estimate ?? 0),
      0,
    );
    const completedEstimate = completedItems.reduce(
      (sum, item) => sum + (item.story.estimate ?? 0),
      0,
    );
    const progress = totalStories > 0 ? Math.round((completedStories / totalStories) * 100) : 0;

    return {
      id: sprint.id,
      name: sprint.name,
      goal: sprint.goal,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      status: sprint.status,
      projectId: sprint.projectId,
      createdAt: sprint.createdAt,
      updatedAt: sprint.updatedAt,
      totalStories,
      completedStories,
      totalEstimate,
      completedEstimate,
      progress,
      daysRemaining: sprint.endDate ? this.calculateDaysRemaining(sprint.endDate) : null,
    };
  }

  async update(projectId: string, sprintId: string, updateSprintDto: UpdateSprintDto): Promise<SprintDto> {
    const sprint = await this.prisma.sprint.findFirst({
      where: { id: sprintId, projectId },
    });

    if (!sprint) {
      throw new NotFoundException('Sprint not found');
    }

    const data: any = { ...updateSprintDto };

    // Parse dates if provided
    if (updateSprintDto.startDate !== undefined) {
      data.startDate = updateSprintDto.startDate ? new Date(updateSprintDto.startDate) : null;
    }
    if (updateSprintDto.endDate !== undefined) {
      data.endDate = updateSprintDto.endDate ? new Date(updateSprintDto.endDate) : null;
    }

    // Validate dates
    const startDate = data.startDate ?? sprint.startDate;
    const endDate = data.endDate ?? sprint.endDate;

    if (startDate && endDate && endDate <= startDate) {
      throw new BadRequestException('End date must be after start date');
    }

    const updated = await this.prisma.sprint.update({
      where: { id: sprintId },
      data,
    });

    return {
      id: updated.id,
      name: updated.name,
      goal: updated.goal,
      startDate: updated.startDate,
      endDate: updated.endDate,
      status: updated.status,
      projectId: updated.projectId,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  async delete(projectId: string, sprintId: string): Promise<void> {
    const sprint = await this.prisma.sprint.findFirst({
      where: { id: sprintId, projectId },
    });

    if (!sprint) {
      throw new NotFoundException('Sprint not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.sprintItem.deleteMany({ where: { sprintId } });
      await tx.sprint.delete({ where: { id: sprintId } });
    });
  }

  // Sprint Item Management
  async addItem(projectId: string, sprintId: string, addItemDto: AddSprintItemDto): Promise<SprintItemDto> {
    const sprint = await this.prisma.sprint.findFirst({
      where: { id: sprintId, projectId },
    });

    if (!sprint) {
      throw new NotFoundException('Sprint not found');
    }

    // Verify story exists in project
    const story = await this.prisma.story.findFirst({
      where: { id: addItemDto.storyId, projectId },
    });
    if (!story) {
      throw new NotFoundException('Story not found in this project');
    }

    // Check if story is already in this sprint
    const existingItem = await this.prisma.sprintItem.findUnique({
      where: {
        sprintId_storyId: { sprintId, storyId: addItemDto.storyId },
      },
    });

    if (existingItem) {
      throw new ConflictException('Story is already in this sprint');
    }

    const sprintItem = await this.prisma.sprintItem.create({
      data: {
        sprintId,
        storyId: addItemDto.storyId,
        originalEstimate: story.estimate,
      },
      include: {
        story: { select: { id: true, title: true, status: true, estimate: true } },
      },
    });

    return {
      id: sprintItem.id,
      sprintId: sprintItem.sprintId,
      storyId: sprintItem.storyId,
      addedAt: sprintItem.addedAt,
      completedAt: sprintItem.completedAt,
      originalEstimate: sprintItem.originalEstimate,
      finalEstimate: sprintItem.finalEstimate,
      story: sprintItem.story,
    };
  }

  async removeItem(projectId: string, sprintId: string, storyId: string): Promise<void> {
    const sprint = await this.prisma.sprint.findFirst({
      where: { id: sprintId, projectId },
    });

    if (!sprint) {
      throw new NotFoundException('Sprint not found');
    }

    const sprintItem = await this.prisma.sprintItem.findUnique({
      where: {
        sprintId_storyId: { sprintId, storyId },
      },
    });

    if (!sprintItem) {
      throw new NotFoundException('Story not found in this sprint');
    }

    await this.prisma.sprintItem.delete({ where: { id: sprintItem.id } });
  }

  async getItems(projectId: string, sprintId: string): Promise<SprintItemDto[]> {
    const sprint = await this.prisma.sprint.findFirst({
      where: { id: sprintId, projectId },
    });

    if (!sprint) {
      throw new NotFoundException('Sprint not found');
    }

    const items = await this.prisma.sprintItem.findMany({
      where: { sprintId },
      include: {
        story: { select: { id: true, title: true, status: true, estimate: true } },
      },
      orderBy: { addedAt: 'asc' },
    });

    return items.map((item) => ({
      id: item.id,
      sprintId: item.sprintId,
      storyId: item.storyId,
      addedAt: item.addedAt,
      completedAt: item.completedAt,
      originalEstimate: item.originalEstimate,
      finalEstimate: item.finalEstimate,
      story: item.story,
    }));
  }

  // Sprint lifecycle
  async startSprint(projectId: string, sprintId: string): Promise<SprintDto> {
    const sprint = await this.prisma.sprint.findFirst({
      where: { id: sprintId, projectId },
    });

    if (!sprint) {
      throw new NotFoundException('Sprint not found');
    }

    if (sprint.status !== SprintStatus.PLANNING) {
      throw new BadRequestException('Only sprints in PLANNING status can be started');
    }

    // Check if there's already an active sprint
    const activeSprint = await this.prisma.sprint.findFirst({
      where: { projectId, status: SprintStatus.ACTIVE },
    });

    if (activeSprint) {
      throw new ConflictException('There is already an active sprint in this project');
    }

    const updated = await this.prisma.sprint.update({
      where: { id: sprintId },
      data: {
        status: SprintStatus.ACTIVE,
        startDate: sprint.startDate ?? new Date(),
      },
    });

    return {
      id: updated.id,
      name: updated.name,
      goal: updated.goal,
      startDate: updated.startDate,
      endDate: updated.endDate,
      status: updated.status,
      projectId: updated.projectId,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  async completeSprint(projectId: string, sprintId: string): Promise<SprintDto> {
    const sprint = await this.prisma.sprint.findFirst({
      where: { id: sprintId, projectId },
    });

    if (!sprint) {
      throw new NotFoundException('Sprint not found');
    }

    if (sprint.status !== SprintStatus.ACTIVE) {
      throw new BadRequestException('Only ACTIVE sprints can be completed');
    }

    const updated = await this.prisma.sprint.update({
      where: { id: sprintId },
      data: {
        status: SprintStatus.COMPLETED,
        endDate: sprint.endDate ?? new Date(),
      },
    });

    return {
      id: updated.id,
      name: updated.name,
      goal: updated.goal,
      startDate: updated.startDate,
      endDate: updated.endDate,
      status: updated.status,
      projectId: updated.projectId,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  private calculateDaysRemaining(endDate: Date): number {
    const now = new Date();
    const diffTime = endDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }
}
