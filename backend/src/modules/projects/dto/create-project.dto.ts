import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  Matches,
  IsObject,
} from 'class-validator';

export class CreateProjectDto {
  @ApiProperty({
    example: 'AI Scrum Master',
    description: 'Project name',
  })
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters' })
  @MaxLength(100, { message: 'Name must not exceed 100 characters' })
  name!: string;

  @ApiPropertyOptional({
    example: 'An AI-native agile project management platform',
    description: 'Project description',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Description must not exceed 1000 characters' })
  description?: string;

  @ApiPropertyOptional({
    example: 'ai-scrum-master',
    description: 'URL-friendly project slug (auto-generated if not provided)',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug must be lowercase letters, numbers, and hyphens only',
  })
  slug?: string;

  @ApiPropertyOptional({
    description: 'Project settings (JSON)',
    example: { sprintDuration: 14, workingDays: ['mon', 'tue', 'wed', 'thu', 'fri'] },
  })
  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;
}
