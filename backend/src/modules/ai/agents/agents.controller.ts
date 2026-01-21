import { Controller, Post, Body, Param, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { ProjectRole } from '@prisma/client';
import { AgentsService } from './agents.service';
import {
  GenerateBacklogDto,
  PlanSprintDto,
  AnalyzeProjectDto,
  AgentResponseDto,
} from './dto';
import { ProjectMemberGuard, ProjectRolesGuard, ProjectRoles } from '../../projects/guards';
import { CurrentUser } from '../../auth';

@ApiTags('AI Agents')
@ApiBearerAuth('JWT-auth')
@Controller('projects/:projectId/ai')
@UseGuards(ProjectMemberGuard, ProjectRolesGuard)
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Post('generate-backlog')
  @ProjectRoles(ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.MEMBER)
  @ApiOperation({
    summary: 'Generate backlog from specification',
    description: 'Uses AI to analyze a product specification and generate epics, stories, and optionally tasks. Returns a proposal that can be reviewed and applied.',
  })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 200, type: AgentResponseDto })
  async generateBacklog(
    @Param('projectId') projectId: string,
    @Body() dto: GenerateBacklogDto,
    @CurrentUser('id') userId: string,
  ): Promise<AgentResponseDto> {
    return this.agentsService.generateBacklog(projectId, dto, userId);
  }

  @Post('plan-sprint')
  @ProjectRoles(ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.MEMBER)
  @ApiOperation({
    summary: 'AI-assisted sprint planning',
    description: 'Analyzes backlog and suggests optimal story selection for a sprint based on velocity and priorities. Returns a proposal.',
  })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 200, type: AgentResponseDto })
  async planSprint(
    @Param('projectId') projectId: string,
    @Body() dto: PlanSprintDto,
    @CurrentUser('id') userId: string,
  ): Promise<AgentResponseDto> {
    return this.agentsService.planSprint(projectId, dto, userId);
  }

  @Post('analyze')
  @ProjectRoles(ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.MEMBER, ProjectRole.VIEWER)
  @ApiOperation({
    summary: 'Analyze project health',
    description: 'Generates insights about velocity, risks, blockers, and scope. Insights are stored directly and can be viewed in the project.',
  })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 200, type: AgentResponseDto })
  async analyzeProject(
    @Param('projectId') projectId: string,
    @Body() dto: AnalyzeProjectDto,
    @CurrentUser('id') userId: string,
  ): Promise<AgentResponseDto & { insights: any[] }> {
    return this.agentsService.analyzeProject(projectId, dto, userId);
  }
}
