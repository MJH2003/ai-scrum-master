import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MinLength, MaxLength, Matches, IsObject } from 'class-validator';

export class UpdateProjectDto {
  @ApiPropertyOptional({
    example: 'AI Scrum Master v2',
    description: 'Project name',
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters' })
  @MaxLength(100, { message: 'Name must not exceed 100 characters' })
  name?: string;

  @ApiPropertyOptional({
    example: 'Updated description',
    description: 'Project description',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Description must not exceed 1000 characters' })
  description?: string;

  @ApiPropertyOptional({
    example: 'ai-scrum-master-v2',
    description: 'URL-friendly project slug',
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
  })
  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;
}
