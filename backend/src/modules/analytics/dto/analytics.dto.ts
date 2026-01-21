import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BurndownPointDto {
  @ApiProperty()
  date!: string;

  @ApiProperty()
  totalPoints!: number;

  @ApiProperty()
  remainingPoints!: number;

  @ApiProperty()
  completedPoints!: number;

  @ApiProperty()
  addedPoints!: number;

  @ApiProperty()
  removedPoints!: number;

  @ApiPropertyOptional({ description: 'Ideal burndown line value' })
  idealRemaining?: number;
}

export class BurndownDto {
  @ApiProperty()
  sprintId!: string;

  @ApiProperty()
  sprintName!: string;

  @ApiProperty()
  startDate!: string;

  @ApiProperty()
  endDate!: string;

  @ApiProperty()
  totalPoints!: number;

  @ApiProperty({ type: [BurndownPointDto] })
  data!: BurndownPointDto[];
}

export class SprintMetricsDto {
  @ApiProperty()
  sprintId!: string;

  @ApiProperty()
  sprintName!: string;

  @ApiProperty({ description: 'Total story points committed' })
  committedPoints!: number;

  @ApiProperty({ description: 'Story points completed' })
  completedPoints!: number;

  @ApiProperty({ description: 'Completion percentage' })
  completionRate!: number;

  @ApiProperty({ description: 'Stories completed' })
  storiesCompleted!: number;

  @ApiProperty({ description: 'Total stories in sprint' })
  totalStories!: number;

  @ApiProperty({ description: 'Points added after sprint start' })
  scopeChange!: number;

  @ApiProperty({ description: 'Average cycle time in hours' })
  avgCycleTime!: number | null;

  @ApiProperty({ description: 'Sprint duration in days' })
  durationDays!: number;
}

export class VelocityPointDto {
  @ApiProperty()
  sprintId!: string;

  @ApiProperty()
  sprintName!: string;

  @ApiProperty()
  completedPoints!: number;

  @ApiProperty()
  committedPoints!: number;

  @ApiProperty()
  endDate!: string;
}

export class VelocityDto {
  @ApiProperty({ type: [VelocityPointDto] })
  sprints!: VelocityPointDto[];

  @ApiProperty({ description: 'Average velocity over all sprints' })
  averageVelocity!: number;

  @ApiProperty({ description: 'Velocity trend (positive = improving)' })
  trend!: number;

  @ApiProperty({ description: 'Velocity standard deviation' })
  standardDeviation!: number;

  @ApiProperty({ description: 'Predicted velocity for next sprint' })
  predictedVelocity!: number;
}

export class ProjectSummaryDto {
  @ApiProperty()
  projectId!: string;

  @ApiProperty()
  projectName!: string;

  @ApiProperty()
  totalEpics!: number;

  @ApiProperty()
  totalStories!: number;

  @ApiProperty()
  totalTasks!: number;

  @ApiProperty()
  completedStories!: number;

  @ApiProperty()
  inProgressStories!: number;

  @ApiProperty()
  backlogStories!: number;

  @ApiProperty()
  totalSprints!: number;

  @ApiProperty()
  activeSprint!: {
    id: string;
    name: string;
    progress: number;
    daysRemaining: number;
  } | null;

  @ApiProperty()
  averageVelocity!: number;

  @ApiProperty()
  totalStoryPoints!: number;

  @ApiProperty()
  completedStoryPoints!: number;

  @ApiProperty({ description: 'Overall project health score (0-100)' })
  healthScore!: number;
}
