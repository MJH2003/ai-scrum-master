import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatus } from '@prisma/client';

export class TaskDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional()
  description!: string | null;

  @ApiProperty({ enum: TaskStatus })
  status!: TaskStatus;

  @ApiPropertyOptional()
  estimate!: number | null;

  @ApiProperty()
  projectId!: string;

  @ApiProperty()
  storyId!: string;

  @ApiPropertyOptional()
  assigneeId!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class TaskWithRelationsDto extends TaskDto {
  @ApiPropertyOptional()
  story?: { id: string; title: string } | null;

  @ApiPropertyOptional()
  assignee?: { id: string; name: string | null; email: string } | null;
}

export class TaskListItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ enum: TaskStatus })
  status!: TaskStatus;

  @ApiPropertyOptional()
  estimate!: number | null;

  @ApiProperty()
  storyId!: string;

  @ApiPropertyOptional()
  storyTitle?: string | null;

  @ApiPropertyOptional()
  assigneeId!: string | null;

  @ApiPropertyOptional()
  assigneeName?: string | null;

  @ApiProperty()
  createdAt!: Date;
}
