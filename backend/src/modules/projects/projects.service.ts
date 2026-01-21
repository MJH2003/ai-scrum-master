import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ProjectRole, Prisma, EventAction, EntityType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  CreateProjectDto,
  UpdateProjectDto,
  AddMemberDto,
  UpdateMemberRoleDto,
  ProjectDto,
  ProjectWithStatsDto,
  ProjectListItemDto,
  ProjectMemberDto,
} from './dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    createProjectDto: CreateProjectDto,
  ): Promise<ProjectWithStatsDto> {
    const { name, description, slug, settings } = createProjectDto;

    // Generate slug if not provided
    const projectSlug = slug || this.generateSlug(name);

    // Check if slug is unique (we need to handle this differently since slug alone isn't unique)
    const existingProject = await this.prisma.project.findFirst({
      where: { slug: projectSlug },
    });

    if (existingProject) {
      throw new ConflictException('A project with this slug already exists');
    }

    // Create project with owner membership
    const project = await this.prisma.project.create({
      data: {
        name,
        description,
        slug: projectSlug,
        settings: settings || Prisma.JsonNull,
        ownerId: userId,
        members: {
          create: {
            userId,
            role: ProjectRole.OWNER,
          },
        },
      },
      include: {
        _count: {
          select: {
            members: true,
            epics: true,
            stories: true,
            sprints: true,
          },
        },
      },
    });

    return {
      id: project.id,
      name: project.name,
      description: project.description,
      slug: project.slug,
      settings: project.settings as Record<string, any> | null,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      memberCount: project._count.members,
      epicCount: project._count.epics,
      storyCount: project._count.stories,
      sprintCount: project._count.sprints,
      userRole: ProjectRole.OWNER,
    };
  }

  async findAllForUser(userId: string): Promise<ProjectListItemDto[]> {
    const memberships = await this.prisma.projectMember.findMany({
      where: { userId },
      include: {
        project: {
          include: {
            _count: {
              select: { members: true },
            },
          },
        },
      },
      orderBy: { project: { updatedAt: 'desc' } },
    });

    return memberships
      .filter((m) => !m.project.archivedAt)
      .map((m) => ({
        id: m.project.id,
        name: m.project.name,
        description: m.project.description,
        slug: m.project.slug,
        settings: m.project.settings as Record<string, any> | null,
        createdAt: m.project.createdAt,
        updatedAt: m.project.updatedAt,
        memberCount: m.project._count.members,
        userRole: m.role,
      }));
  }

  async findById(projectId: string, userId: string): Promise<ProjectWithStatsDto> {
    const membership = await this.prisma.projectMember.findUnique({
      where: {
        userId_projectId: { userId, projectId },
      },
      include: {
        project: {
          include: {
            _count: {
              select: {
                members: true,
                epics: true,
                stories: true,
                sprints: true,
              },
            },
          },
        },
      },
    });

    if (!membership) {
      throw new NotFoundException('Project not found');
    }

    const project = membership.project;

    return {
      id: project.id,
      name: project.name,
      description: project.description,
      slug: project.slug,
      settings: project.settings as Record<string, any> | null,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      memberCount: project._count.members,
      epicCount: project._count.epics,
      storyCount: project._count.stories,
      sprintCount: project._count.sprints,
      userRole: membership.role,
    };
  }

  async findBySlug(slug: string, userId: string): Promise<ProjectWithStatsDto> {
    const project = await this.prisma.project.findFirst({
      where: { slug },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return this.findById(project.id, userId);
  }

  async update(
    projectId: string,
    updateProjectDto: UpdateProjectDto,
  ): Promise<ProjectDto> {
    // Check if slug is being changed and is unique
    if (updateProjectDto.slug) {
      const existingProject = await this.prisma.project.findFirst({
        where: {
          slug: updateProjectDto.slug,
          id: { not: projectId },
        },
      });

      if (existingProject) {
        throw new ConflictException('A project with this slug already exists');
      }
    }

    const project = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        ...updateProjectDto,
        settings: updateProjectDto.settings || undefined,
      },
    });

    return {
      id: project.id,
      name: project.name,
      description: project.description,
      slug: project.slug,
      settings: project.settings as Record<string, any> | null,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  }

  async archive(projectId: string): Promise<void> {
    await this.prisma.project.update({
      where: { id: projectId },
      data: { archivedAt: new Date() },
    });
  }

  async delete(projectId: string): Promise<void> {
    // Hard delete - in production you might want to keep this as soft delete only
    await this.prisma.$transaction(async (tx) => {
      // Delete all related data
      await tx.chatMessage.deleteMany({ where: { projectId } });
      await tx.projectInsight.deleteMany({ where: { projectId } });
      await tx.aIProposal.deleteMany({ where: { projectId } });
      await tx.eventLog.deleteMany({ where: { projectId } });
      await tx.dependency.deleteMany({ where: { projectId } });
      await tx.sprintItem.deleteMany({
        where: { sprint: { projectId } },
      });
      await tx.sprint.deleteMany({ where: { projectId } });
      await tx.task.deleteMany({ where: { projectId } });
      await tx.story.deleteMany({ where: { projectId } });
      await tx.epic.deleteMany({ where: { projectId } });
      await tx.projectMember.deleteMany({ where: { projectId } });
      await tx.project.delete({ where: { id: projectId } });
    });
  }

  // Member management
  async getMembers(projectId: string): Promise<ProjectMemberDto[]> {
    const members = await this.prisma.projectMember.findMany({
      where: { projectId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatar: true,
          },
        },
      },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    });

    return members.map((m) => ({
      userId: m.user.id,
      email: m.user.email,
      name: m.user.name,
      avatar: m.user.avatar,
      role: m.role,
      joinedAt: m.joinedAt,
    }));
  }

  async addMember(
    projectId: string,
    addMemberDto: AddMemberDto,
    currentUserId: string,
  ): Promise<ProjectMemberDto> {
    const { email, role } = addMemberDto;

    // Cannot add another owner
    if (role === ProjectRole.OWNER) {
      throw new BadRequestException('Cannot add another owner to the project');
    }

    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      throw new NotFoundException('User not found with this email');
    }

    // Check if user is already a member
    const existingMembership = await this.prisma.projectMember.findUnique({
      where: {
        userId_projectId: { userId: user.id, projectId },
      },
    });

    if (existingMembership) {
      throw new ConflictException('User is already a member of this project');
    }

    // Add member
    const membership = await this.prisma.projectMember.create({
      data: {
        projectId,
        userId: user.id,
        role,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatar: true,
          },
        },
      },
    });

    return {
      userId: membership.user.id,
      email: membership.user.email,
      name: membership.user.name,
      avatar: membership.user.avatar,
      role: membership.role,
      joinedAt: membership.joinedAt,
    };
  }

  async updateMemberRole(
    projectId: string,
    memberId: string,
    updateMemberRoleDto: UpdateMemberRoleDto,
    currentUserId: string,
  ): Promise<ProjectMemberDto> {
    const { role } = updateMemberRoleDto;

    // Cannot change to owner
    if (role === ProjectRole.OWNER) {
      throw new BadRequestException('Cannot change role to owner');
    }

    const membership = await this.prisma.projectMember.findUnique({
      where: {
        userId_projectId: { userId: memberId, projectId },
      },
    });

    if (!membership) {
      throw new NotFoundException('Member not found');
    }

    // Cannot change owner's role
    if (membership.role === ProjectRole.OWNER) {
      throw new ForbiddenException('Cannot change the owner\'s role');
    }

    const updatedMembership = await this.prisma.projectMember.update({
      where: {
        userId_projectId: { userId: memberId, projectId },
      },
      data: { role },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatar: true,
          },
        },
      },
    });

    return {
      userId: updatedMembership.user.id,
      email: updatedMembership.user.email,
      name: updatedMembership.user.name,
      avatar: updatedMembership.user.avatar,
      role: updatedMembership.role,
      joinedAt: updatedMembership.joinedAt,
    };
  }

  async removeMember(
    projectId: string,
    memberId: string,
    currentUserId: string,
  ): Promise<void> {
    const membership = await this.prisma.projectMember.findUnique({
      where: {
        userId_projectId: { userId: memberId, projectId },
      },
    });

    if (!membership) {
      throw new NotFoundException('Member not found');
    }

    // Cannot remove owner
    if (membership.role === ProjectRole.OWNER) {
      throw new ForbiddenException('Cannot remove the project owner');
    }

    await this.prisma.projectMember.delete({
      where: {
        userId_projectId: { userId: memberId, projectId },
      },
    });
  }

  async leaveProject(projectId: string, userId: string): Promise<void> {
    const membership = await this.prisma.projectMember.findUnique({
      where: {
        userId_projectId: { userId, projectId },
      },
    });

    if (!membership) {
      throw new NotFoundException('You are not a member of this project');
    }

    // Owner cannot leave - must transfer ownership first
    if (membership.role === ProjectRole.OWNER) {
      throw new ForbiddenException(
        'Project owner cannot leave. Transfer ownership first or delete the project.',
      );
    }

    await this.prisma.projectMember.delete({
      where: {
        userId_projectId: { userId, projectId },
      },
    });
  }

  private generateSlug(name: string): string {
    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    // Add random suffix to ensure uniqueness
    const suffix = Math.random().toString(36).substring(2, 8);
    return `${baseSlug}-${suffix}`;
  }
}
