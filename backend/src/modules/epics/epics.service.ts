import { Injectable, NotFoundException } from '@nestjs/common';
import { EpicStatus, StoryStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateEpicDto, UpdateEpicDto, EpicDto, EpicWithStatsDto, EpicListItemDto } from './dto';

@Injectable()
export class EpicsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(projectId: string, createEpicDto: CreateEpicDto): Promise<EpicWithStatsDto> {
    const epic = await this.prisma.epic.create({
      data: {
        ...createEpicDto,
        projectId,
      },
    });

    return {
      ...epic,
      storyCount: 0,
      completedStoryCount: 0,
      progress: 0,
    };
  }

  async findAll(projectId: string): Promise<EpicListItemDto[]> {
    const epics = await this.prisma.epic.findMany({
      where: { projectId },
      include: {
        _count: {
          select: { stories: true },
        },
        stories: {
          where: { status: StoryStatus.DONE },
          select: { id: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return epics.map((epic) => ({
      id: epic.id,
      title: epic.title,
      description: epic.description,
      status: epic.status,
      storyCount: epic._count.stories,
      completedStoryCount: epic.stories.length,
      createdAt: epic.createdAt,
    }));
  }

  async findById(projectId: string, epicId: string): Promise<EpicWithStatsDto> {
    const epic = await this.prisma.epic.findFirst({
      where: { id: epicId, projectId },
      include: {
        _count: {
          select: { stories: true },
        },
        stories: {
          where: { status: StoryStatus.DONE },
          select: { id: true },
        },
      },
    });

    if (!epic) {
      throw new NotFoundException('Epic not found');
    }

    const storyCount = epic._count.stories;
    const completedStoryCount = epic.stories.length;
    const progress = storyCount > 0 ? Math.round((completedStoryCount / storyCount) * 100) : 0;

    return {
      id: epic.id,
      title: epic.title,
      description: epic.description,
      status: epic.status,
      projectId: epic.projectId,
      createdAt: epic.createdAt,
      updatedAt: epic.updatedAt,
      storyCount,
      completedStoryCount,
      progress,
    };
  }

  async update(projectId: string, epicId: string, updateEpicDto: UpdateEpicDto): Promise<EpicDto> {
    const epic = await this.prisma.epic.findFirst({
      where: { id: epicId, projectId },
    });

    if (!epic) {
      throw new NotFoundException('Epic not found');
    }

    return this.prisma.epic.update({
      where: { id: epicId },
      data: updateEpicDto,
    });
  }

  async delete(projectId: string, epicId: string): Promise<void> {
    const epic = await this.prisma.epic.findFirst({
      where: { id: epicId, projectId },
    });

    if (!epic) {
      throw new NotFoundException('Epic not found');
    }

    // Delete epic and cascade to stories
    await this.prisma.$transaction(async (tx) => {
      // Delete tasks belonging to stories of this epic
      await tx.task.deleteMany({
        where: { story: { epicId } },
      });
      // Delete stories
      await tx.story.deleteMany({
        where: { epicId },
      });
      // Delete epic
      await tx.epic.delete({
        where: { id: epicId },
      });
    });
  }
}
