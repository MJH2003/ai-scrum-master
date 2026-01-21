import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddSprintItemDto {
  @ApiProperty({ description: 'Story ID to add to sprint' })
  @IsString()
  @MinLength(20)
  @MaxLength(30)
  storyId!: string;
}

export class SprintItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  sprintId!: string;

  @ApiProperty()
  storyId!: string;

  @ApiProperty()
  addedAt!: Date;

  @ApiPropertyOptional()
  completedAt?: Date | null;

  @ApiPropertyOptional()
  originalEstimate?: number | null;

  @ApiPropertyOptional()
  finalEstimate?: number | null;

  @ApiPropertyOptional()
  story?: {
    id: string;
    title: string;
    status: string;
    estimate?: number | null;
  };
}
