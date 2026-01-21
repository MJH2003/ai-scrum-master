import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { Severity } from '@prisma/client';

export class InsightDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  projectId!: string;

  @ApiPropertyOptional()
  sprintId?: string | null;

  @ApiProperty({ enum: Severity })
  severity!: Severity;

  @ApiProperty()
  type!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  description!: string;

  @ApiPropertyOptional()
  recommendation?: string | null;

  @ApiPropertyOptional()
  dataSnapshot?: Record<string, unknown> | null;

  @ApiProperty()
  acknowledged!: boolean;

  @ApiPropertyOptional()
  acknowledgedBy?: string | null;

  @ApiPropertyOptional()
  acknowledgedAt?: Date | null;

  @ApiProperty()
  createdAt!: Date;
}

export class CreateInsightDto {
  @ApiProperty({ enum: Severity })
  @IsEnum(Severity)
  severity!: Severity;

  @ApiProperty()
  @IsString()
  type!: string;

  @ApiProperty()
  @IsString()
  title!: string;

  @ApiProperty()
  @IsString()
  description!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  recommendation?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  sprintId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  dataSnapshot?: Record<string, unknown>;
}

export class AcknowledgeInsightDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}

export class RiskDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: Severity })
  severity!: Severity;

  @ApiProperty()
  type!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  description!: string;

  @ApiPropertyOptional()
  recommendation?: string | null;

  @ApiProperty()
  impact!: string;

  @ApiPropertyOptional()
  affectedSprint?: string | null;

  @ApiProperty()
  mitigated!: boolean;

  @ApiProperty()
  createdAt!: Date;
}

export class InsightFilterDto {
  @ApiPropertyOptional({ enum: Severity })
  @IsEnum(Severity)
  @IsOptional()
  severity?: Severity;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  acknowledged?: boolean;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  sprintId?: string;
}

export class InsightSummaryDto {
  @ApiProperty()
  total!: number;

  @ApiProperty()
  critical!: number;

  @ApiProperty()
  high!: number;

  @ApiProperty()
  medium!: number;

  @ApiProperty()
  low!: number;

  @ApiProperty()
  unacknowledged!: number;
}
