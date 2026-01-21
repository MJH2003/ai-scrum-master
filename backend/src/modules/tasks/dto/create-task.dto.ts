import { IsString, IsOptional, IsEnum, IsInt, Min, Max, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatus } from '@prisma/client';

export class CreateTaskDto {
  @ApiProperty({ description: 'Task title', example: 'Implement login API endpoint' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  title!: string;

  @ApiPropertyOptional({ description: 'Task description' })
  @IsString()
  @IsOptional()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({ enum: TaskStatus, default: TaskStatus.TODO })
  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;

  @ApiPropertyOptional({ description: 'Estimated hours', example: 4 })
  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(100)
  estimate?: number;

  @ApiProperty({ description: 'Story ID (required)' })
  @IsString()
  @MinLength(20)
  @MaxLength(30)
  storyId!: string;

  @ApiPropertyOptional({ description: 'Assigned user ID' })
  @IsString()
  @IsOptional()
  @MinLength(20)
  @MaxLength(30)
  assigneeId?: string;
}
