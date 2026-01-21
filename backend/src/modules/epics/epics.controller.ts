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
import { EpicsService } from './epics.service';
import { CreateEpicDto, UpdateEpicDto, EpicDto, EpicWithStatsDto, EpicListItemDto } from './dto';
import { ProjectMemberGuard, ProjectRolesGuard, ProjectRoles } from '../projects/guards';

@ApiTags('Epics')
@ApiBearerAuth('JWT-auth')
@Controller('projects/:projectId/epics')
@UseGuards(ProjectMemberGuard, ProjectRolesGuard)
export class EpicsController {
  constructor(private readonly epicsService: EpicsService) {}

  @Post()
  @ProjectRoles(ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.MEMBER)
  @ApiOperation({ summary: 'Create a new epic' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 201, description: 'Epic created', type: EpicWithStatsDto })
  async create(
    @Param('projectId') projectId: string,
    @Body() createEpicDto: CreateEpicDto,
  ): Promise<EpicWithStatsDto> {
    return this.epicsService.create(projectId, createEpicDto);
  }

  @Get()
  @ProjectRoles(ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.MEMBER, ProjectRole.VIEWER)
  @ApiOperation({ summary: 'Get all epics for a project' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'List of epics', type: [EpicListItemDto] })
  async findAll(@Param('projectId') projectId: string): Promise<EpicListItemDto[]> {
    return this.epicsService.findAll(projectId);
  }

  @Get(':epicId')
  @ProjectRoles(ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.MEMBER, ProjectRole.VIEWER)
  @ApiOperation({ summary: 'Get epic by ID' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'epicId', description: 'Epic ID' })
  @ApiResponse({ status: 200, description: 'Epic details', type: EpicWithStatsDto })
  async findById(
    @Param('projectId') projectId: string,
    @Param('epicId') epicId: string,
  ): Promise<EpicWithStatsDto> {
    return this.epicsService.findById(projectId, epicId);
  }

  @Patch(':epicId')
  @ProjectRoles(ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.MEMBER)
  @ApiOperation({ summary: 'Update an epic' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'epicId', description: 'Epic ID' })
  @ApiResponse({ status: 200, description: 'Epic updated', type: EpicDto })
  async update(
    @Param('projectId') projectId: string,
    @Param('epicId') epicId: string,
    @Body() updateEpicDto: UpdateEpicDto,
  ): Promise<EpicDto> {
    return this.epicsService.update(projectId, epicId, updateEpicDto);
  }

  @Delete(':epicId')
  @ProjectRoles(ProjectRole.OWNER, ProjectRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an epic' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'epicId', description: 'Epic ID' })
  @ApiResponse({ status: 204, description: 'Epic deleted' })
  async delete(
    @Param('projectId') projectId: string,
    @Param('epicId') epicId: string,
  ): Promise<void> {
    return this.epicsService.delete(projectId, epicId);
  }
}
