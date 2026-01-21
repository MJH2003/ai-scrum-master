import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AIAgentType, ProposalStatus } from '@prisma/client';
import { IsString, IsOptional, IsEnum, IsObject, MaxLength } from 'class-validator';

export class CreateProposalDto {
  @ApiProperty({ enum: AIAgentType })
  @IsEnum(AIAgentType)
  agentType!: AIAgentType;

  @ApiProperty({ description: 'Type of proposal (e.g., "create_stories", "plan_sprint")' })
  @IsString()
  @MaxLength(100)
  proposalType!: string;

  @ApiProperty({ description: 'Proposal payload (structured data)' })
  @IsObject()
  payload!: Record<string, any>;

  @ApiPropertyOptional({ description: 'AI explanation of the proposal' })
  @IsString()
  @IsOptional()
  @MaxLength(5000)
  explanation?: string;

  @ApiPropertyOptional({ description: 'Evidence/reasoning as JSON array' })
  @IsOptional()
  evidence?: any[];
}

export class ProposalDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  projectId!: string;

  @ApiProperty({ enum: AIAgentType })
  agentType!: AIAgentType;

  @ApiProperty()
  proposalType!: string;

  @ApiProperty()
  payload!: Record<string, any>;

  @ApiProperty({ enum: ProposalStatus })
  status!: ProposalStatus;

  @ApiPropertyOptional()
  explanation!: string | null;

  @ApiProperty()
  evidence!: any[];

  @ApiPropertyOptional()
  createdBy!: string | null;

  @ApiPropertyOptional()
  reviewedBy!: string | null;

  @ApiPropertyOptional()
  reviewedAt!: Date | null;

  @ApiPropertyOptional()
  expiresAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;
}

export class ProposalListItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: AIAgentType })
  agentType!: AIAgentType;

  @ApiProperty()
  proposalType!: string;

  @ApiProperty({ enum: ProposalStatus })
  status!: ProposalStatus;

  @ApiPropertyOptional()
  explanation!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiPropertyOptional()
  expiresAt!: Date | null;
}

export class ApplyProposalDto {
  @ApiPropertyOptional({ description: 'Optional modifications to the proposal before applying' })
  @IsOptional()
  @IsObject()
  modifications?: Record<string, any>;
}

export class RejectProposalDto {
  @ApiPropertyOptional({ description: 'Reason for rejection' })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  reason?: string;
}
