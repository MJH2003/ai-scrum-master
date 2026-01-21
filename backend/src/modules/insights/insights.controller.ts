import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InsightsService } from './insights.service';
import {
  InsightDto,
  RiskDto,
  InsightFilterDto,
  InsightSummaryDto,
} from './dto';
import { Severity } from '@prisma/client';

@ApiTags('Insights')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/insights')
export class InsightsController {
  constructor(private readonly insightsService: InsightsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all insights for a project' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiQuery({ name: 'severity', enum: Severity, required: false })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'acknowledged', required: false, type: Boolean })
  @ApiQuery({ name: 'sprintId', required: false })
  @ApiResponse({ status: 200, description: 'List of insights', type: [InsightDto] })
  async getInsights(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() filters: InsightFilterDto,
  ): Promise<InsightDto[]> {
    return this.insightsService.getProjectInsights(projectId, filters);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get insight summary counts' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({
    status: 200,
    description: 'Insight summary',
    type: InsightSummaryDto,
  })
  async getInsightSummary(
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ): Promise<InsightSummaryDto> {
    return this.insightsService.getInsightSummary(projectId);
  }

  @Get('risks')
  @ApiOperation({ summary: 'Get risk register (high/critical insights)' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'List of risks', type: [RiskDto] })
  async getRisks(
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ): Promise<RiskDto[]> {
    return this.insightsService.getProjectRisks(projectId);
  }

  @Post('analyze')
  @ApiOperation({ summary: 'Trigger project analysis to generate insights' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({
    status: 201,
    description: 'New insights generated',
    type: [InsightDto],
  })
  async analyzeProject(
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ): Promise<InsightDto[]> {
    return this.insightsService.analyzeProject(projectId);
  }

  @Patch(':insightId/acknowledge')
  @ApiOperation({ summary: 'Acknowledge an insight' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'insightId', description: 'Insight ID' })
  @ApiResponse({
    status: 200,
    description: 'Insight acknowledged',
    type: InsightDto,
  })
  async acknowledgeInsight(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('insightId', ParseUUIDPipe) insightId: string,
    @Request() req: { user: { userId: string } },
  ): Promise<InsightDto> {
    return this.insightsService.acknowledgeInsight(
      projectId,
      insightId,
      req.user.userId,
    );
  }
}
