import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
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
  ApiQuery,
} from '@nestjs/swagger';
import { ProjectRole } from '@prisma/client';
import { StoriesService } from './stories.service';
import { CreateStoryDto, UpdateStoryDto, StoryDto, StoryWithRelationsDto, StoryListItemDto } from './dto';
import { ProjectMemberGuard, ProjectRolesGuard, ProjectRoles } from '../projects/guards';
import { CurrentUser } from '../auth';

@ApiTags('Stories')
@ApiBearerAuth('JWT-auth')
@Controller('projects/:projectId/stories')
@UseGuards(ProjectMemberGuard, ProjectRolesGuard)
export class StoriesController {
  constructor(private readonly storiesService: StoriesService) {}

  @Post()
  @ProjectRoles(ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.MEMBER)
  @ApiOperation({ summary: 'Create a new story' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 201, description: 'Story created', type: StoryWithRelationsDto })
  async create(
    @Param('projectId') projectId: string,
    @Body() createStoryDto: CreateStoryDto,
    @CurrentUser('id') userId: string,
  ): Promise<StoryWithRelationsDto> {
    return this.storiesService.create(projectId, createStoryDto, userId);
  }

  @Get()
  @ProjectRoles(ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.MEMBER, ProjectRole.VIEWER)
  @ApiOperation({ summary: 'Get all stories for a project' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiQuery({ name: 'epicId', required: false, description: 'Filter by epic ID' })
  @ApiResponse({ status: 200, description: 'List of stories', type: [StoryListItemDto] })
  async findAll(
    @Param('projectId') projectId: string,
    @Query('epicId') epicId?: string,
  ): Promise<StoryListItemDto[]> {
    return this.storiesService.findAll(projectId, epicId);
  }

  @Get(':storyId')
  @ProjectRoles(ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.MEMBER, ProjectRole.VIEWER)
  @ApiOperation({ summary: 'Get story by ID' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'storyId', description: 'Story ID' })
  @ApiResponse({ status: 200, description: 'Story details', type: StoryWithRelationsDto })
  async findById(
    @Param('projectId') projectId: string,
    @Param('storyId') storyId: string,
  ): Promise<StoryWithRelationsDto> {
    return this.storiesService.findById(projectId, storyId);
  }

  @Patch(':storyId')
  @ProjectRoles(ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.MEMBER)
  @ApiOperation({ summary: 'Update a story' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'storyId', description: 'Story ID' })
  @ApiResponse({ status: 200, description: 'Story updated', type: StoryDto })
  async update(
    @Param('projectId') projectId: string,
    @Param('storyId') storyId: string,
    @Body() updateStoryDto: UpdateStoryDto,
    @CurrentUser('id') userId: string,
  ): Promise<StoryDto> {
    return this.storiesService.update(projectId, storyId, updateStoryDto, userId);
  }

  @Delete(':storyId')
  @ProjectRoles(ProjectRole.OWNER, ProjectRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a story' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'storyId', description: 'Story ID' })
  @ApiResponse({ status: 204, description: 'Story deleted' })
  async delete(
    @Param('projectId') projectId: string,
    @Param('storyId') storyId: string,
    @CurrentUser('id') userId: string,
  ): Promise<void> {
    return this.storiesService.delete(projectId, storyId, userId);
  }
}
