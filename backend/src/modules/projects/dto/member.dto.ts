import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum, IsEmail, IsOptional } from 'class-validator';
import { ProjectRole } from '@prisma/client';

export class AddMemberDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'Email of the user to add',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    enum: ProjectRole,
    example: ProjectRole.MEMBER,
    description: 'Role to assign to the member',
  })
  @IsEnum(ProjectRole)
  role!: ProjectRole;
}

export class UpdateMemberRoleDto {
  @ApiProperty({
    enum: ProjectRole,
    example: ProjectRole.ADMIN,
    description: 'New role for the member',
  })
  @IsEnum(ProjectRole)
  role!: ProjectRole;
}
