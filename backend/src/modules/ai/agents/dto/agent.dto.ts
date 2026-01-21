import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsNumber, Min, Max, MaxLength, IsArray } from 'class-validator';

export class GenerateBacklogDto {
  @ApiProperty({ description: 'Product/feature specification or PRD text' })
  @IsString()
  @MaxLength(50000)
  specification!: string;

  @ApiPropertyOptional({ description: 'Additional context or constraints' })
  @IsString()
  @IsOptional()
  @MaxLength(5000)
  context?: string;

  @ApiPropertyOptional({ description: 'Target number of epics (1-10)', default: 3 })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(10)
  targetEpics?: number;

  @ApiPropertyOptional({ description: 'Whether to generate tasks within stories', default: false })
  @IsBoolean()
  @IsOptional()
  includeTasks?: boolean;
}

export class PlanSprintDto {
  @ApiProperty({ description: 'Sprint ID to plan for' })
  @IsString()
  sprintId!: string;

  @ApiPropertyOptional({ description: 'Team velocity (story points per sprint)' })
  @IsNumber()
  @IsOptional()
  @Min(1)
  velocity?: number;

  @ApiPropertyOptional({ description: 'Focus areas or priorities' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  focusAreas?: string[];

  @ApiPropertyOptional({ description: 'Additional constraints or considerations' })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  constraints?: string;
}

export class AnalyzeProjectDto {
  @ApiPropertyOptional({ description: 'Specific analysis focus (velocity, risks, blockers, scope)' })
  @IsString()
  @IsOptional()
  focus?: 'velocity' | 'risks' | 'blockers' | 'scope' | 'all';

  @ApiPropertyOptional({ description: 'Sprint ID for sprint-specific analysis' })
  @IsString()
  @IsOptional()
  sprintId?: string;

  @ApiPropertyOptional({ description: 'Include historical comparison', default: true })
  @IsBoolean()
  @IsOptional()
  includeHistory?: boolean;
}

export class AgentResponseDto {
  @ApiProperty()
  proposalId!: string;

  @ApiProperty({ description: 'Brief summary of the proposal' })
  summary!: string;

  @ApiProperty({ description: 'Estimated items to be created/modified' })
  estimatedChanges!: {
    epics?: number;
    stories?: number;
    tasks?: number;
    insights?: number;
  };

  @ApiProperty({ description: 'Token usage for cost tracking' })
  tokenUsage!: {
    input: number;
    output: number;
    total: number;
  };
}
