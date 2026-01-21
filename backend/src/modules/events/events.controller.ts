import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ProjectRole, EntityType, EventAction } from '@prisma/client';
import { EventsService } from './events.service';
import { EventLogListDto } from './dto';
import { ProjectMemberGuard, ProjectRolesGuard, ProjectRoles } from '../projects/guards';

@ApiTags('Events')
@ApiBearerAuth('JWT-auth')
@Controller('projects/:projectId/events')
@UseGuards(ProjectMemberGuard, ProjectRolesGuard)
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  @ProjectRoles(ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.MEMBER, ProjectRole.VIEWER)
  @ApiOperation({ summary: 'Get project activity feed' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'entityType', required: false, enum: EntityType })
  @ApiQuery({ name: 'action', required: false, enum: EventAction })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Activity feed', type: EventLogListDto })
  async getProjectEvents(
    @Param('projectId') projectId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
    @Query('entityType') entityType?: EntityType,
    @Query('action') action?: EventAction,
    @Query('userId') userId?: string,
  ): Promise<EventLogListDto> {
    return this.eventsService.getProjectEvents(projectId, {
      page,
      pageSize,
      entityType,
      action,
      userId,
    });
  }

  @Get('entities/:entityType/:entityId')
  @ProjectRoles(ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.MEMBER, ProjectRole.VIEWER)
  @ApiOperation({ summary: 'Get event history for a specific entity' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'entityType', enum: EntityType, description: 'Entity type' })
  @ApiParam({ name: 'entityId', description: 'Entity ID' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Entity event history', type: EventLogListDto })
  async getEntityEvents(
    @Param('projectId') projectId: string,
    @Param('entityType') entityType: EntityType,
    @Param('entityId') entityId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
  ): Promise<EventLogListDto> {
    return this.eventsService.getEntityEvents(projectId, entityType, entityId, {
      page,
      pageSize,
    });
  }
}
