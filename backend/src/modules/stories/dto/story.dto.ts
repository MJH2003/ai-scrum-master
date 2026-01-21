import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StoryStatus, Priority } from '@prisma/client';

export class StoryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional()
  description!: string | null;

  @ApiProperty({ description: 'Acceptance criteria', type: [String] })
  acceptanceCriteria!: string[];

  @ApiProperty({ enum: StoryStatus })
  status!: StoryStatus;

  @ApiProperty({ enum: Priority })
  priority!: Priority;

  @ApiPropertyOptional()
  estimate!: number | null;

  @ApiPropertyOptional()
  confidence!: number | null;

  @ApiProperty()
  projectId!: string;

  @ApiPropertyOptional()
  epicId!: string | null;

  @ApiPropertyOptional()
  assigneeId!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class StoryWithRelationsDto extends StoryDto {
  @ApiPropertyOptional()
  epic?: { id: string; title: string } | null;

  @ApiPropertyOptional()
  assignee?: { id: string; name: string | null; email: string } | null;

  @ApiProperty()
  taskCount!: number;

  @ApiProperty()
  completedTaskCount!: number;
}

export class StoryListItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ enum: StoryStatus })
  status!: StoryStatus;

  @ApiProperty({ enum: Priority })
  priority!: Priority;

  @ApiPropertyOptional()
  estimate!: number | null;

  @ApiPropertyOptional()
  epicId!: string | null;

  @ApiPropertyOptional()
  epicTitle?: string | null;

  @ApiPropertyOptional()
  assigneeId!: string | null;

  @ApiPropertyOptional()
  assigneeName?: string | null;

  @ApiProperty()
  taskCount!: number;

  @ApiProperty()
  completedTaskCount!: number;

  @ApiProperty()
  createdAt!: Date;
}
