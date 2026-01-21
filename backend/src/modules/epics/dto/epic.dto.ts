import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EpicStatus } from '@prisma/client';

export class EpicDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional()
  description!: string | null;

  @ApiProperty({ enum: EpicStatus })
  status!: EpicStatus;

  @ApiProperty()
  projectId!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class EpicWithStatsDto extends EpicDto {
  @ApiProperty()
  storyCount!: number;

  @ApiProperty()
  completedStoryCount!: number;

  @ApiPropertyOptional()
  progress?: number;
}

export class EpicListItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional()
  description!: string | null;

  @ApiProperty({ enum: EpicStatus })
  status!: EpicStatus;

  @ApiProperty()
  storyCount!: number;

  @ApiProperty()
  completedStoryCount!: number;

  @ApiProperty()
  createdAt!: Date;
}
