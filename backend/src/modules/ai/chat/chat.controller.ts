import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ProjectRole } from '@prisma/client';
import { ChatService } from './chat.service';
import {
  CreateChatMessageDto,
  ChatResponseDto,
  ChatHistoryDto,
} from './dto';
import { ProjectMemberGuard, ProjectRolesGuard, ProjectRoles } from '../../projects/guards';
import { CurrentUser } from '../../auth';

@ApiTags('Project Chat')
@ApiBearerAuth('JWT-auth')
@Controller('projects/:projectId/chat')
@UseGuards(ProjectMemberGuard, ProjectRolesGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  @ProjectRoles(ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.MEMBER, ProjectRole.VIEWER)
  @ApiOperation({
    summary: 'Send a chat message',
    description: 'Send a message to the AI assistant and receive a response. Set stream=true for streaming response.',
  })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 200, type: ChatResponseDto })
  async chat(
    @Param('projectId') projectId: string,
    @Body() dto: CreateChatMessageDto,
    @CurrentUser('id') userId: string,
    @Res() res: Response,
  ): Promise<void> {
    if (dto.stream) {
      // Server-Sent Events for streaming
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      try {
        for await (const chunk of this.chatService.streamChat(projectId, userId, dto)) {
          if (chunk.type === 'token') {
            res.write(`data: ${JSON.stringify({ type: 'token', content: chunk.content })}\n\n`);
          } else {
            res.write(`data: ${JSON.stringify({ type: 'done', data: chunk.data })}\n\n`);
          }
        }
      } catch (error: any) {
        res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
      }

      res.end();
    } else {
      // Regular response
      const response = await this.chatService.chat(projectId, userId, dto);
      res.json(response);
    }
  }

  @Get('history')
  @ProjectRoles(ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.MEMBER, ProjectRole.VIEWER)
  @ApiOperation({ summary: 'Get chat history' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'before', required: false, type: String, description: 'ISO date for pagination' })
  @ApiResponse({ status: 200, type: ChatHistoryDto })
  async getHistory(
    @Param('projectId') projectId: string,
    @Query('limit') limit?: number,
    @Query('before') before?: string,
  ): Promise<ChatHistoryDto> {
    return this.chatService.getHistory(projectId, limit, before);
  }

  @Delete('history')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ProjectRoles(ProjectRole.OWNER, ProjectRole.ADMIN)
  @ApiOperation({ summary: 'Clear chat history' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 204, description: 'History cleared' })
  async clearHistory(@Param('projectId') projectId: string): Promise<void> {
    return this.chatService.clearHistory(projectId);
  }
}
