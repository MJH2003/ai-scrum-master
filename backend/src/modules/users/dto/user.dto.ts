import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserDto {
  @ApiProperty({ example: 'clx1234567890' })
  id!: string;

  @ApiProperty({ example: 'john@example.com' })
  email!: string;

  @ApiProperty({ example: 'John Doe', nullable: true })
  name!: string | null;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg' })
  avatar!: string | null;

  @ApiProperty({ example: '2024-01-21T12:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2024-01-21T12:00:00.000Z' })
  updatedAt!: Date;
}

export class UserWithStatsDto extends UserDto {
  @ApiProperty({ example: 5, description: 'Number of projects user is a member of' })
  projectCount!: number;
}
