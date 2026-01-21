import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ProjectRole } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

export const PROJECT_ROLES_KEY = 'project_roles';

export const ProjectRoles = (...roles: ProjectRole[]) => {
  return (target: any, key?: string, descriptor?: PropertyDescriptor) => {
    Reflect.defineMetadata(PROJECT_ROLES_KEY, roles, descriptor?.value ?? target);
    return descriptor ?? target;
  };
};

@Injectable()
export class ProjectRolesGuard implements CanActivate {
  // Role hierarchy: OWNER > ADMIN > MEMBER > VIEWER
  private readonly roleHierarchy: Record<ProjectRole, number> = {
    [ProjectRole.VIEWER]: 1,
    [ProjectRole.MEMBER]: 2,
    [ProjectRole.ADMIN]: 3,
    [ProjectRole.OWNER]: 4,
  };

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.get<ProjectRole[]>(
      PROJECT_ROLES_KEY,
      context.getHandler(),
    );

    // If no roles are required, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const projectId = request.params.projectId || request.params.id;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    if (!projectId) {
      throw new ForbiddenException('Project ID not found in request');
    }

    // Get user's membership in the project
    const membership = await this.prisma.projectMember.findUnique({
      where: {
        userId_projectId: {
          userId: user.id,
          projectId,
        },
      },
    });

    if (!membership) {
      throw new NotFoundException('Project not found or you do not have access');
    }

    // Check if user has sufficient role
    const userRoleLevel = this.roleHierarchy[membership.role];
    const hasRequiredRole = requiredRoles.some(
      (role) => userRoleLevel >= this.roleHierarchy[role],
    );

    if (!hasRequiredRole) {
      throw new ForbiddenException('Insufficient permissions for this action');
    }

    // Attach membership to request for use in controllers
    request.projectMembership = membership;

    return true;
  }
}
