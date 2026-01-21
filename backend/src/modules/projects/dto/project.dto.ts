import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectRole } from '@prisma/client';

export class ProjectMemberDto {
  @ApiProperty({ example: 'clx1234567890' })
  userId!: string;

  @ApiProperty({ example: 'john@example.com' })
  email!: string;

  @ApiProperty({ example: 'John Doe', nullable: true })
  name!: string | null;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg' })
  avatar!: string | null;

  @ApiProperty({ enum: ProjectRole, example: ProjectRole.OWNER })
  role!: ProjectRole;

  @ApiProperty({ example: '2024-01-21T12:00:00.000Z' })
  joinedAt!: Date;
}

export class ProjectDto {
  @ApiProperty({ example: 'clx1234567890' })
  id!: string;

  @ApiProperty({ example: 'AI Scrum Master' })
  name!: string;

  @ApiPropertyOptional({ example: 'An AI-native agile project management platform' })
  description!: string | null;

  @ApiProperty({ example: 'ai-scrum-master' })
  slug!: string;

  @ApiPropertyOptional({ description: 'Project settings' })
  settings!: Record<string, any> | null;

  @ApiProperty({ example: '2024-01-21T12:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2024-01-21T12:00:00.000Z' })
  updatedAt!: Date;
}

export class ProjectWithMembersDto extends ProjectDto {
  @ApiProperty({ type: [ProjectMemberDto] })
  members!: ProjectMemberDto[];
}

export class ProjectWithStatsDto extends ProjectDto {
  @ApiProperty({ example: 3 })
  memberCount!: number;

  @ApiProperty({ example: 5 })
  epicCount!: number;

  @ApiProperty({ example: 25 })
  storyCount!: number;

  @ApiProperty({ example: 2 })
  sprintCount!: number;

  @ApiProperty({ enum: ProjectRole })
  userRole!: ProjectRole;
}

export class ProjectListItemDto extends ProjectDto {
  @ApiProperty({ example: 3 })
  memberCount!: number;

  @ApiProperty({ enum: ProjectRole })
  userRole!: ProjectRole;
}
