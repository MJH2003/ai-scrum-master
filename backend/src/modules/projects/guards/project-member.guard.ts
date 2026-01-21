import {
  Injectable,
  CanActivate,
  ExecutionContext,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class ProjectMemberGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const projectId = request.params.projectId || request.params.id;

    if (!user || !projectId) {
      return false;
    }

    const membership = await this.prisma.projectMember.findUnique({
      where: {
        userId_projectId: {
          userId: user.id,
          projectId,
        },
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            slug: true,
            archivedAt: true,
          },
        },
      },
    });

    if (!membership) {
      throw new NotFoundException('Project not found or you do not have access');
    }

    if (membership.project.archivedAt) {
      throw new NotFoundException('This project has been archived');
    }

    // Attach to request for later use
    request.projectMembership = membership;
    request.project = membership.project;

    return true;
  }
}
