import { IsString, IsOptional, IsEnum, IsDateString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SprintStatus } from '@prisma/client';

export class CreateSprintDto {
  @ApiProperty({ description: 'Sprint name', example: 'Sprint 1' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ description: 'Sprint goal' })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  goal?: string;

  @ApiPropertyOptional({ description: 'Start date', example: '2024-01-15' })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date', example: '2024-01-29' })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({ enum: SprintStatus, default: SprintStatus.PLANNING })
  @IsEnum(SprintStatus)
  @IsOptional()
  status?: SprintStatus;
}
