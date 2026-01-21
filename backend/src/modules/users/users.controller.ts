import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateUserDto, ChangePasswordDto, UserDto, UserWithStatsDto } from './dto';
import { JwtAuthGuard, CurrentUser } from '../auth';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile with stats' })
  @ApiResponse({
    status: 200,
    description: 'User profile with stats',
    type: UserWithStatsDto,
  })
  async getMe(@CurrentUser('id') userId: string): Promise<UserWithStatsDto> {
    return this.usersService.findByIdWithStats(userId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({
    status: 200,
    description: 'User profile updated',
    type: UserDto,
  })
  async updateMe(
    @CurrentUser('id') userId: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<UserDto> {
    return this.usersService.update(userId, updateUserDto);
  }

  @Patch('me/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Change current user password' })
  @ApiResponse({
    status: 204,
    description: 'Password changed successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Current password is incorrect',
  })
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() changePasswordDto: ChangePasswordDto,
  ): Promise<void> {
    return this.usersService.changePassword(userId, changePasswordDto);
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete current user account' })
  @ApiResponse({
    status: 204,
    description: 'Account deleted successfully',
  })
  async deleteMe(@CurrentUser('id') userId: string): Promise<void> {
    return this.usersService.delete(userId);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search users by name or email' })
  @ApiQuery({ name: 'q', description: 'Search query', required: true })
  @ApiQuery({ name: 'exclude', description: 'User IDs to exclude', required: false, isArray: true })
  @ApiQuery({ name: 'limit', description: 'Max results', required: false })
  @ApiResponse({
    status: 200,
    description: 'Search results',
    type: [UserDto],
  })
  async searchUsers(
    @Query('q') query: string,
    @Query('exclude') exclude?: string | string[],
    @Query('limit') limit?: string,
  ): Promise<UserDto[]> {
    const excludeIds = exclude
      ? Array.isArray(exclude)
        ? exclude
        : [exclude]
      : [];
    const maxResults = limit ? parseInt(limit, 10) : 10;
    return this.usersService.searchUsers(query, excludeIds, maxResults);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({
    status: 200,
    description: 'User found',
    type: UserDto,
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async findById(@Param('id') id: string): Promise<UserDto> {
    return this.usersService.findById(id);
  }
}
