import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { ProjectRole } from '@prisma/client';
import { ProjectsService } from './projects.service';
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
import { JwtAuthGuard, CurrentUser } from '../auth';
import { ProjectMemberGuard, ProjectRolesGuard, ProjectRoles } from './guards';

@ApiTags('Projects')
@Controller('projects')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new project' })
  @ApiResponse({
    status: 201,
    description: 'Project created successfully',
    type: ProjectWithStatsDto,
  })
  async create(
    @CurrentUser('id') userId: string,
    @Body() createProjectDto: CreateProjectDto,
  ): Promise<ProjectWithStatsDto> {
    return this.projectsService.create(userId, createProjectDto);
  }

  @Get()
  @ApiOperation({ summary: 'List all projects for current user' })
  @ApiResponse({
    status: 200,
    description: 'List of projects',
    type: [ProjectListItemDto],
  })
  async findAll(@CurrentUser('id') userId: string): Promise<ProjectListItemDto[]> {
    return this.projectsService.findAllForUser(userId);
  }

  @Get(':projectId')
  @UseGuards(ProjectMemberGuard)
  @ApiOperation({ summary: 'Get project by ID' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({
    status: 200,
    description: 'Project details',
    type: ProjectWithStatsDto,
  })
  async findById(
    @Param('projectId') projectId: string,
    @CurrentUser('id') userId: string,
  ): Promise<ProjectWithStatsDto> {
    return this.projectsService.findById(projectId, userId);
  }

  @Patch(':projectId')
  @UseGuards(ProjectMemberGuard, ProjectRolesGuard)
  @ProjectRoles(ProjectRole.ADMIN, ProjectRole.OWNER)
  @ApiOperation({ summary: 'Update project' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({
    status: 200,
    description: 'Project updated',
    type: ProjectDto,
  })
  async update(
    @Param('projectId') projectId: string,
    @Body() updateProjectDto: UpdateProjectDto,
  ): Promise<ProjectDto> {
    return this.projectsService.update(projectId, updateProjectDto);
  }

  @Post(':projectId/archive')
  @UseGuards(ProjectMemberGuard, ProjectRolesGuard)
  @ProjectRoles(ProjectRole.OWNER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Archive project' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({
    status: 204,
    description: 'Project archived',
  })
  async archive(@Param('projectId') projectId: string): Promise<void> {
    return this.projectsService.archive(projectId);
  }

  @Delete(':projectId')
  @UseGuards(ProjectMemberGuard, ProjectRolesGuard)
  @ProjectRoles(ProjectRole.OWNER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete project permanently' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({
    status: 204,
    description: 'Project deleted',
  })
  async delete(@Param('projectId') projectId: string): Promise<void> {
    return this.projectsService.delete(projectId);
  }

  // Member management endpoints
  @Get(':projectId/members')
  @UseGuards(ProjectMemberGuard)
  @ApiOperation({ summary: 'Get project members' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({
    status: 200,
    description: 'List of project members',
    type: [ProjectMemberDto],
  })
  async getMembers(
    @Param('projectId') projectId: string,
  ): Promise<ProjectMemberDto[]> {
    return this.projectsService.getMembers(projectId);
  }

  @Post(':projectId/members')
  @UseGuards(ProjectMemberGuard, ProjectRolesGuard)
  @ProjectRoles(ProjectRole.ADMIN, ProjectRole.OWNER)
  @ApiOperation({ summary: 'Add member to project' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({
    status: 201,
    description: 'Member added',
    type: ProjectMemberDto,
  })
  async addMember(
    @Param('projectId') projectId: string,
    @Body() addMemberDto: AddMemberDto,
    @CurrentUser('id') currentUserId: string,
  ): Promise<ProjectMemberDto> {
    return this.projectsService.addMember(projectId, addMemberDto, currentUserId);
  }

  @Patch(':projectId/members/:memberId')
  @UseGuards(ProjectMemberGuard, ProjectRolesGuard)
  @ProjectRoles(ProjectRole.ADMIN, ProjectRole.OWNER)
  @ApiOperation({ summary: 'Update member role' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'memberId', description: 'Member user ID' })
  @ApiResponse({
    status: 200,
    description: 'Member role updated',
    type: ProjectMemberDto,
  })
  async updateMemberRole(
    @Param('projectId') projectId: string,
    @Param('memberId') memberId: string,
    @Body() updateMemberRoleDto: UpdateMemberRoleDto,
    @CurrentUser('id') currentUserId: string,
  ): Promise<ProjectMemberDto> {
    return this.projectsService.updateMemberRole(
      projectId,
      memberId,
      updateMemberRoleDto,
      currentUserId,
    );
  }

  @Delete(':projectId/members/:memberId')
  @UseGuards(ProjectMemberGuard, ProjectRolesGuard)
  @ProjectRoles(ProjectRole.ADMIN, ProjectRole.OWNER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove member from project' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'memberId', description: 'Member user ID' })
  @ApiResponse({
    status: 204,
    description: 'Member removed',
  })
  async removeMember(
    @Param('projectId') projectId: string,
    @Param('memberId') memberId: string,
    @CurrentUser('id') currentUserId: string,
  ): Promise<void> {
    return this.projectsService.removeMember(projectId, memberId, currentUserId);
  }

  @Post(':projectId/leave')
  @UseGuards(ProjectMemberGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Leave project' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({
    status: 204,
    description: 'Successfully left project',
  })
  async leaveProject(
    @Param('projectId') projectId: string,
    @CurrentUser('id') userId: string,
  ): Promise<void> {
    return this.projectsService.leaveProject(projectId, userId);
  }
}
