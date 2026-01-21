import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MetricsService } from './metrics.service';
import {
  BurndownDto,
  SprintMetricsDto,
  VelocityDto,
  ProjectSummaryDto,
} from './dto';

@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/analytics')
export class AnalyticsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get project summary with key metrics' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'Project summary', type: ProjectSummaryDto })
  async getProjectSummary(
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ): Promise<ProjectSummaryDto> {
    return this.metricsService.getProjectSummary(projectId);
  }

  @Get('velocity')
  @ApiOperation({ summary: 'Get velocity trend for the project' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiQuery({
    name: 'sprints',
    required: false,
    description: 'Number of sprints to include (default: 10)',
  })
  @ApiResponse({ status: 200, description: 'Velocity data', type: VelocityDto })
  async getVelocityTrend(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query('sprints', new DefaultValuePipe(10), ParseIntPipe) sprintCount: number,
  ): Promise<VelocityDto> {
    return this.metricsService.getVelocityTrend(projectId, sprintCount);
  }

  @Get('sprints/:sprintId/burndown')
  @ApiOperation({ summary: 'Get burndown chart data for a sprint' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'sprintId', description: 'Sprint ID' })
  @ApiResponse({ status: 200, description: 'Burndown data', type: BurndownDto })
  async getSprintBurndown(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('sprintId', ParseUUIDPipe) sprintId: string,
  ): Promise<BurndownDto> {
    return this.metricsService.getSprintBurndown(projectId, sprintId);
  }

  @Get('sprints/:sprintId/metrics')
  @ApiOperation({ summary: 'Get metrics for a specific sprint' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'sprintId', description: 'Sprint ID' })
  @ApiResponse({ status: 200, description: 'Sprint metrics', type: SprintMetricsDto })
  async getSprintMetrics(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('sprintId', ParseUUIDPipe) sprintId: string,
  ): Promise<SprintMetricsDto> {
    return this.metricsService.getSprintMetrics(projectId, sprintId);
  }
}
