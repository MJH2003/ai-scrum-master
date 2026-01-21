import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SprintStatus } from '@prisma/client';

export class SprintDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  goal!: string | null;

  @ApiPropertyOptional()
  startDate!: Date | null;

  @ApiPropertyOptional()
  endDate!: Date | null;

  @ApiProperty({ enum: SprintStatus })
  status!: SprintStatus;

  @ApiProperty()
  projectId!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class SprintWithStatsDto extends SprintDto {
  @ApiProperty()
  totalStories!: number;

  @ApiProperty()
  completedStories!: number;

  @ApiProperty()
  totalEstimate!: number;

  @ApiProperty()
  completedEstimate!: number;

  @ApiPropertyOptional()
  progress?: number;

  @ApiPropertyOptional()
  daysRemaining?: number | null;
}

export class SprintListItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  goal!: string | null;

  @ApiPropertyOptional()
  startDate!: Date | null;

  @ApiPropertyOptional()
  endDate!: Date | null;

  @ApiProperty({ enum: SprintStatus })
  status!: SprintStatus;

  @ApiProperty()
  totalStories!: number;

  @ApiProperty()
  completedStories!: number;

  @ApiProperty()
  totalEstimate!: number;
}
