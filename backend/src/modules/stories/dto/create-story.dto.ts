import { IsString, IsOptional, IsEnum, IsInt, Min, Max, MaxLength, MinLength, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StoryStatus, Priority } from '@prisma/client';

export class CreateStoryDto {
  @ApiProperty({ description: 'Story title', example: 'As a user, I want to login' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  title!: string;

  @ApiPropertyOptional({ description: 'Story description' })
  @IsString()
  @IsOptional()
  @MaxLength(10000)
  description?: string;

  @ApiPropertyOptional({ description: 'Acceptance criteria (array of strings)' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  acceptanceCriteria?: string[];

  @ApiPropertyOptional({ enum: StoryStatus, default: StoryStatus.BACKLOG })
  @IsEnum(StoryStatus)
  @IsOptional()
  status?: StoryStatus;

  @ApiPropertyOptional({ enum: Priority, default: Priority.MEDIUM })
  @IsEnum(Priority)
  @IsOptional()
  priority?: Priority;

  @ApiPropertyOptional({ description: 'Story estimate (points)', example: 5 })
  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(100)
  estimate?: number;

  @ApiPropertyOptional({ description: 'Confidence percentage (0-100)', example: 80 })
  @IsInt()
  @IsOptional()
  @Min(0)
  @Max(100)
  confidence?: number;

  @ApiPropertyOptional({ description: 'Epic ID' })
  @IsString()
  @IsOptional()
  @MinLength(20)
  @MaxLength(30)
  epicId?: string;

  @ApiPropertyOptional({ description: 'Assigned user ID' })
  @IsString()
  @IsOptional()
  @MinLength(20)
  @MaxLength(30)
  assigneeId?: string;
}
