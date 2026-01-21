import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EntityType, EventAction } from '@prisma/client';

export class EventLogDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  projectId!: string;

  @ApiProperty({ enum: EntityType })
  entityType!: EntityType;

  @ApiProperty()
  entityId!: string;

  @ApiProperty({ enum: EventAction })
  action!: EventAction;

  @ApiProperty({ description: 'JSON diff of changes' })
  changes!: Record<string, any>;

  @ApiPropertyOptional()
  userId!: string | null;

  @ApiPropertyOptional()
  userName?: string | null;

  @ApiProperty()
  aiTriggered!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiPropertyOptional({ description: 'Entity title/name for display' })
  entityTitle?: string;
}

export class EventLogListDto {
  @ApiProperty({ type: [EventLogDto] })
  items!: EventLogDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;

  @ApiProperty()
  hasMore!: boolean;
}

export class EventLogQueryDto {
  page?: number;
  pageSize?: number;
  entityType?: EntityType;
  action?: EventAction;
  userId?: string;
}
