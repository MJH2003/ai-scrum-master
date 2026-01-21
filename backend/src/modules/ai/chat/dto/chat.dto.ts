import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChatRole } from '@prisma/client';
import { IsString, IsOptional, IsBoolean, MaxLength, IsObject } from 'class-validator';

export class CreateChatMessageDto {
  @ApiProperty({ description: 'User message' })
  @IsString()
  @MaxLength(10000)
  content!: string;

  @ApiPropertyOptional({ description: 'Additional context to include' })
  @IsObject()
  @IsOptional()
  context?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Whether to stream the response', default: false })
  @IsBoolean()
  @IsOptional()
  stream?: boolean;
}

export class ChatMessageDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  projectId!: string;

  @ApiPropertyOptional()
  userId!: string | null;

  @ApiProperty({ enum: ChatRole })
  role!: ChatRole;

  @ApiProperty()
  content!: string;

  @ApiProperty()
  context!: any;

  @ApiProperty({ description: 'Referenced entities' })
  citations!: any[];

  @ApiProperty({ description: 'Suggested actions' })
  actions!: any[];

  @ApiProperty()
  createdAt!: Date;
}

export class ChatResponseDto {
  @ApiProperty()
  messageId!: string;

  @ApiProperty()
  content!: string;

  @ApiProperty({ description: 'Referenced project entities' })
  citations!: Array<{
    type: 'epic' | 'story' | 'task' | 'sprint';
    id: string;
    title: string;
  }>;

  @ApiProperty({ description: 'Suggested follow-up actions' })
  actions!: Array<{
    type: 'view' | 'edit' | 'create';
    entity: string;
    entityId?: string;
    label: string;
  }>;

  @ApiProperty()
  tokenUsage!: {
    input: number;
    output: number;
    total: number;
  };
}

export class ChatHistoryDto {
  @ApiProperty({ type: [ChatMessageDto] })
  messages!: ChatMessageDto[];

  @ApiProperty()
  hasMore!: boolean;
}
