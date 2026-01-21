import { IsString, IsOptional, IsEnum, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EpicStatus } from '@prisma/client';

export class CreateEpicDto {
  @ApiProperty({ description: 'Epic title', example: 'User Authentication System' })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional({ description: 'Epic description' })
  @IsString()
  @IsOptional()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({ enum: EpicStatus, default: EpicStatus.DRAFT })
  @IsEnum(EpicStatus)
  @IsOptional()
  status?: EpicStatus;
}
