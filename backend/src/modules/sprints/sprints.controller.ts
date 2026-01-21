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
import { SprintsService } from './sprints.service';
import {
  CreateSprintDto,
  UpdateSprintDto,
  SprintDto,
  SprintWithStatsDto,
  SprintListItemDto,
  AddSprintItemDto,
  SprintItemDto,
} from './dto';
import { ProjectMemberGuard, ProjectRolesGuard, ProjectRoles } from '../projects/guards';

@ApiTags('Sprints')
@ApiBearerAuth('JWT-auth')
@Controller('projects/:projectId/sprints')
@UseGuards(ProjectMemberGuard, ProjectRolesGuard)
export class SprintsController {
  constructor(private readonly sprintsService: SprintsService) {}

  @Post()
  @ProjectRoles(ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.MEMBER)
  @ApiOperation({ summary: 'Create a new sprint' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 201, description: 'Sprint created', type: SprintWithStatsDto })
  async create(
    @Param('projectId') projectId: string,
    @Body() createSprintDto: CreateSprintDto,
  ): Promise<SprintWithStatsDto> {
    return this.sprintsService.create(projectId, createSprintDto);
  }

  @Get()
  @ProjectRoles(ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.MEMBER, ProjectRole.VIEWER)
  @ApiOperation({ summary: 'Get all sprints for a project' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'List of sprints', type: [SprintListItemDto] })
  async findAll(@Param('projectId') projectId: string): Promise<SprintListItemDto[]> {
    return this.sprintsService.findAll(projectId);
  }

  @Get(':sprintId')
  @ProjectRoles(ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.MEMBER, ProjectRole.VIEWER)
  @ApiOperation({ summary: 'Get sprint by ID' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'sprintId', description: 'Sprint ID' })
  @ApiResponse({ status: 200, description: 'Sprint details', type: SprintWithStatsDto })
  async findById(
    @Param('projectId') projectId: string,
    @Param('sprintId') sprintId: string,
  ): Promise<SprintWithStatsDto> {
    return this.sprintsService.findById(projectId, sprintId);
  }

  @Patch(':sprintId')
  @ProjectRoles(ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.MEMBER)
  @ApiOperation({ summary: 'Update a sprint' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'sprintId', description: 'Sprint ID' })
  @ApiResponse({ status: 200, description: 'Sprint updated', type: SprintDto })
  async update(
    @Param('projectId') projectId: string,
    @Param('sprintId') sprintId: string,
    @Body() updateSprintDto: UpdateSprintDto,
  ): Promise<SprintDto> {
    return this.sprintsService.update(projectId, sprintId, updateSprintDto);
  }

  @Delete(':sprintId')
  @ProjectRoles(ProjectRole.OWNER, ProjectRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a sprint' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'sprintId', description: 'Sprint ID' })
  @ApiResponse({ status: 204, description: 'Sprint deleted' })
  async delete(
    @Param('projectId') projectId: string,
    @Param('sprintId') sprintId: string,
  ): Promise<void> {
    return this.sprintsService.delete(projectId, sprintId);
  }

  // Sprint lifecycle
  @Post(':sprintId/start')
  @ProjectRoles(ProjectRole.OWNER, ProjectRole.ADMIN)
  @ApiOperation({ summary: 'Start a sprint' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'sprintId', description: 'Sprint ID' })
  @ApiResponse({ status: 200, description: 'Sprint started', type: SprintDto })
  async startSprint(
    @Param('projectId') projectId: string,
    @Param('sprintId') sprintId: string,
  ): Promise<SprintDto> {
    return this.sprintsService.startSprint(projectId, sprintId);
  }

  @Post(':sprintId/complete')
  @ProjectRoles(ProjectRole.OWNER, ProjectRole.ADMIN)
  @ApiOperation({ summary: 'Complete a sprint' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'sprintId', description: 'Sprint ID' })
  @ApiResponse({ status: 200, description: 'Sprint completed', type: SprintDto })
  async completeSprint(
    @Param('projectId') projectId: string,
    @Param('sprintId') sprintId: string,
  ): Promise<SprintDto> {
    return this.sprintsService.completeSprint(projectId, sprintId);
  }

  // Sprint items
  @Get(':sprintId/items')
  @ProjectRoles(ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.MEMBER, ProjectRole.VIEWER)
  @ApiOperation({ summary: 'Get all stories in a sprint' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'sprintId', description: 'Sprint ID' })
  @ApiResponse({ status: 200, description: 'Sprint items', type: [SprintItemDto] })
  async getItems(
    @Param('projectId') projectId: string,
    @Param('sprintId') sprintId: string,
  ): Promise<SprintItemDto[]> {
    return this.sprintsService.getItems(projectId, sprintId);
  }

  @Post(':sprintId/items')
  @ProjectRoles(ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.MEMBER)
  @ApiOperation({ summary: 'Add story to sprint' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'sprintId', description: 'Sprint ID' })
  @ApiResponse({ status: 201, description: 'Story added', type: SprintItemDto })
  async addItem(
    @Param('projectId') projectId: string,
    @Param('sprintId') sprintId: string,
    @Body() addItemDto: AddSprintItemDto,
  ): Promise<SprintItemDto> {
    return this.sprintsService.addItem(projectId, sprintId, addItemDto);
  }

  @Delete(':sprintId/items/:storyId')
  @ProjectRoles(ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.MEMBER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove story from sprint' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'sprintId', description: 'Sprint ID' })
  @ApiParam({ name: 'storyId', description: 'Story ID' })
  @ApiResponse({ status: 204, description: 'Story removed' })
  async removeItem(
    @Param('projectId') projectId: string,
    @Param('sprintId') sprintId: string,
    @Param('storyId') storyId: string,
  ): Promise<void> {
    return this.sprintsService.removeItem(projectId, sprintId, storyId);
  }
}
