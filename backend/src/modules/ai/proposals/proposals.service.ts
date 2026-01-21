import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { AIAgentType, ProposalStatus, EntityType, EventAction, Priority, StoryStatus, TaskStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { EventEmitterService } from '../../events/event-emitter.service';
import {
  CreateProposalDto,
  ProposalDto,
  ProposalListItemDto,
  ApplyProposalDto,
} from './dto';

@Injectable()
export class ProposalsService {
  private readonly logger = new Logger(ProposalsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitterService,
  ) {}

  async create(
    projectId: string,
    createDto: CreateProposalDto,
    userId?: string,
  ): Promise<ProposalDto> {
    // Set expiration to 24 hours from now
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const proposal = await this.prisma.aIProposal.create({
      data: {
        projectId,
        agentType: createDto.agentType,
        proposalType: createDto.proposalType,
        payload: createDto.payload,
        explanation: createDto.explanation,
        evidence: createDto.evidence ?? [],
        createdBy: userId,
        expiresAt,
      },
    });

    return this.mapToDto(proposal);
  }

  async findAll(projectId: string, status?: ProposalStatus): Promise<ProposalListItemDto[]> {
    // Auto-expire old proposals
    await this.expireOldProposals(projectId);

    const proposals = await this.prisma.aIProposal.findMany({
      where: {
        projectId,
        ...(status && { status }),
      },
      orderBy: { createdAt: 'desc' },
    });

    return proposals.map((p) => ({
      id: p.id,
      agentType: p.agentType,
      proposalType: p.proposalType,
      status: p.status,
      explanation: p.explanation,
      createdAt: p.createdAt,
      expiresAt: p.expiresAt,
    }));
  }

  async findById(projectId: string, proposalId: string): Promise<ProposalDto> {
    const proposal = await this.prisma.aIProposal.findFirst({
      where: { id: proposalId, projectId },
    });

    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    return this.mapToDto(proposal);
  }

  async apply(
    projectId: string,
    proposalId: string,
    applyDto: ApplyProposalDto,
    userId: string,
  ): Promise<{ applied: boolean; created: any[] }> {
    const proposal = await this.prisma.aIProposal.findFirst({
      where: { id: proposalId, projectId, status: ProposalStatus.PENDING },
    });

    if (!proposal) {
      throw new NotFoundException('Pending proposal not found');
    }

    // Check if expired
    if (proposal.expiresAt && proposal.expiresAt < new Date()) {
      await this.prisma.aIProposal.update({
        where: { id: proposalId },
        data: { status: ProposalStatus.EXPIRED },
      });
      throw new BadRequestException('Proposal has expired');
    }

    // Apply modifications if provided
    const payload = applyDto.modifications
      ? { ...(proposal.payload as object), ...applyDto.modifications }
      : proposal.payload;

    // Apply the proposal based on type
    const created = await this.applyProposalPayload(
      projectId,
      proposal.agentType,
      proposal.proposalType,
      payload as Record<string, any>,
      userId,
    );

    // Mark as applied
    await this.prisma.aIProposal.update({
      where: { id: proposalId },
      data: {
        status: ProposalStatus.APPLIED,
        reviewedBy: userId,
        reviewedAt: new Date(),
      },
    });

    this.logger.log(`Proposal ${proposalId} applied by user ${userId}`);

    return { applied: true, created };
  }

  async reject(
    projectId: string,
    proposalId: string,
    reason: string | undefined,
    userId: string,
  ): Promise<void> {
    const proposal = await this.prisma.aIProposal.findFirst({
      where: { id: proposalId, projectId, status: ProposalStatus.PENDING },
    });

    if (!proposal) {
      throw new NotFoundException('Pending proposal not found');
    }

    await this.prisma.aIProposal.update({
      where: { id: proposalId },
      data: {
        status: ProposalStatus.REJECTED,
        reviewedBy: userId,
        reviewedAt: new Date(),
        // Store rejection reason in evidence
        evidence: [...(proposal.evidence as any[]), { type: 'rejection', reason, at: new Date() }],
      },
    });

    this.logger.log(`Proposal ${proposalId} rejected by user ${userId}`);
  }

  private async applyProposalPayload(
    projectId: string,
    agentType: AIAgentType,
    proposalType: string,
    payload: Record<string, any>,
    userId: string,
  ): Promise<any[]> {
    const created: any[] = [];

    switch (proposalType) {
      case 'create_backlog':
        // Create epics, stories, and tasks from AI-generated backlog
        if (payload.epics) {
          for (const epicData of payload.epics) {
            const epic = await this.prisma.epic.create({
              data: {
                projectId,
                title: epicData.title,
                description: epicData.description,
                priority: epicData.priority || Priority.MEDIUM,
              },
            });
            created.push({ type: 'epic', id: epic.id, title: epic.title });

            // Emit event
            await this.eventEmitter.emitCreated(
              projectId,
              EntityType.EPIC,
              epic.id,
              { title: epic.title },
              { userId, aiTriggered: true },
            );

            // Create stories for this epic
            if (epicData.stories) {
              for (const storyData of epicData.stories) {
                const story = await this.prisma.story.create({
                  data: {
                    projectId,
                    epicId: epic.id,
                    title: storyData.title,
                    description: storyData.description,
                    acceptanceCriteria: storyData.acceptanceCriteria || [],
                    estimate: storyData.estimate,
                    priority: storyData.priority || Priority.MEDIUM,
                  },
                });
                created.push({ type: 'story', id: story.id, title: story.title });

                await this.eventEmitter.emitCreated(
                  projectId,
                  EntityType.STORY,
                  story.id,
                  { title: story.title, epicId: epic.id },
                  { userId, aiTriggered: true },
                );

                // Create tasks for this story
                if (storyData.tasks) {
                  for (const taskData of storyData.tasks) {
                    const task = await this.prisma.task.create({
                      data: {
                        projectId,
                        storyId: story.id,
                        title: taskData.title,
                        description: taskData.description,
                        estimate: taskData.estimate,
                      },
                    });
                    created.push({ type: 'task', id: task.id, title: task.title });

                    await this.eventEmitter.emitCreated(
                      projectId,
                      EntityType.TASK,
                      task.id,
                      { title: task.title, storyId: story.id },
                      { userId, aiTriggered: true },
                    );
                  }
                }
              }
            }
          }
        }

        // Create standalone stories
        if (payload.stories) {
          for (const storyData of payload.stories) {
            const story = await this.prisma.story.create({
              data: {
                projectId,
                title: storyData.title,
                description: storyData.description,
                acceptanceCriteria: storyData.acceptanceCriteria || [],
                estimate: storyData.estimate,
                priority: storyData.priority || Priority.MEDIUM,
              },
            });
            created.push({ type: 'story', id: story.id, title: story.title });

            await this.eventEmitter.emitCreated(
              projectId,
              EntityType.STORY,
              story.id,
              { title: story.title },
              { userId, aiTriggered: true },
            );
          }
        }
        break;

      case 'plan_sprint':
        // Add stories to sprint
        if (payload.sprintId && payload.storyIds) {
          for (const storyId of payload.storyIds) {
            const story = await this.prisma.story.findFirst({
              where: { id: storyId, projectId },
            });
            if (story) {
              await this.prisma.sprintItem.create({
                data: {
                  sprintId: payload.sprintId,
                  storyId,
                  originalEstimate: story.estimate,
                },
              });
              created.push({ type: 'sprint_item', storyId });

              await this.eventEmitter.emitSprintAdded(
                projectId,
                storyId,
                payload.sprintId,
                payload.sprintName || 'Sprint',
                { userId, aiTriggered: true },
              );
            }
          }
        }
        break;

      default:
        this.logger.warn(`Unknown proposal type: ${proposalType}`);
    }

    return created;
  }

  private async expireOldProposals(projectId: string): Promise<void> {
    await this.prisma.aIProposal.updateMany({
      where: {
        projectId,
        status: ProposalStatus.PENDING,
        expiresAt: { lt: new Date() },
      },
      data: { status: ProposalStatus.EXPIRED },
    });
  }

  private mapToDto(proposal: any): ProposalDto {
    return {
      id: proposal.id,
      projectId: proposal.projectId,
      agentType: proposal.agentType,
      proposalType: proposal.proposalType,
      payload: proposal.payload as Record<string, any>,
      status: proposal.status,
      explanation: proposal.explanation,
      evidence: proposal.evidence as any[],
      createdBy: proposal.createdBy,
      reviewedBy: proposal.reviewedBy,
      reviewedAt: proposal.reviewedAt,
      expiresAt: proposal.expiresAt,
      createdAt: proposal.createdAt,
    };
  }
}
