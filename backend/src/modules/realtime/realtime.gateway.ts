import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EntityType, EventAction } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  WsEvents,
  JoinProjectPayload,
  LeaveProjectPayload,
  PresenceUpdatePayload,
  ProjectEventPayload,
  OnlineUser,
  WsAuthPayload,
} from './types';

@WebSocketGateway({
  cors: {
    origin: '*', // Configure in production
    credentials: true,
  },
  namespace: '/ws',
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RealtimeGateway.name);

  // Track users per project: Map<projectId, Map<socketId, OnlineUser>>
  private projectPresence = new Map<string, Map<string, OnlineUser>>();

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  afterInit() {
    this.logger.log('WebSocket Gateway initialized');
  }

  async handleConnection(client: Socket) {
    try {
      const user = await this.authenticateSocket(client);
      if (!user) {
        client.disconnect();
        return;
      }
      client.data.user = user;
      this.logger.log(`Client connected: ${client.id} (user: ${user.userId})`);
    } catch (error) {
      this.logger.error(`Connection error: ${error}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const user = client.data.user as WsAuthPayload | undefined;
    if (user) {
      // Remove user from all projects they were in
      this.projectPresence.forEach((users, projectId) => {
        if (users.has(client.id)) {
          users.delete(client.id);
          this.broadcastPresence(projectId);
          this.server.to(`project:${projectId}`).emit(WsEvents.USER_LEFT, {
            projectId,
            userId: user.userId,
          });
        }
      });
    }
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage(WsEvents.JOIN_PROJECT)
  async handleJoinProject(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinProjectPayload,
  ) {
    const user = client.data.user as WsAuthPayload;
    if (!user) {
      client.emit(WsEvents.ERROR, { message: 'Unauthorized' });
      return;
    }

    const { projectId } = payload;

    // Verify user has access to this project
    const membership = await this.prisma.projectMember.findFirst({
      where: {
        projectId,
        userId: user.userId,
      },
      include: {
        user: { select: { name: true } },
      },
    });

    if (!membership) {
      client.emit(WsEvents.ERROR, { message: 'Access denied to project' });
      return;
    }

    // Join the project room
    const roomName = `project:${projectId}`;
    await client.join(roomName);

    // Track presence
    if (!this.projectPresence.has(projectId)) {
      this.projectPresence.set(projectId, new Map());
    }

    const projectUsers = this.projectPresence.get(projectId)!;
    const onlineUser: OnlineUser = {
      userId: user.userId,
      userName: membership.user?.name ?? 'Unknown',
      socketId: client.id,
      joinedAt: new Date(),
    };
    projectUsers.set(client.id, onlineUser);

    // Notify others in the project
    client.to(roomName).emit(WsEvents.USER_JOINED, {
      projectId,
      userId: user.userId,
      userName: membership.user?.name,
    });

    // Send current presence to the joining user
    this.broadcastPresence(projectId, client);

    this.logger.log(`User ${user.userId} joined project ${projectId}`);

    return { success: true, projectId };
  }

  @SubscribeMessage(WsEvents.LEAVE_PROJECT)
  async handleLeaveProject(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: LeaveProjectPayload,
  ) {
    const user = client.data.user as WsAuthPayload;
    if (!user) return;

    const { projectId } = payload;
    const roomName = `project:${projectId}`;

    await client.leave(roomName);

    // Remove from presence
    const projectUsers = this.projectPresence.get(projectId);
    if (projectUsers) {
      projectUsers.delete(client.id);
      this.broadcastPresence(projectId);
    }

    // Notify others
    this.server.to(roomName).emit(WsEvents.USER_LEFT, {
      projectId,
      userId: user.userId,
    });

    this.logger.log(`User ${user.userId} left project ${projectId}`);

    return { success: true };
  }

  @SubscribeMessage(WsEvents.UPDATE_PRESENCE)
  handleUpdatePresence(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: PresenceUpdatePayload,
  ) {
    const user = client.data.user as WsAuthPayload;
    if (!user) return;

    const { projectId, entityType, entityId } = payload;
    const projectUsers = this.projectPresence.get(projectId);

    if (projectUsers?.has(client.id)) {
      const onlineUser = projectUsers.get(client.id)!;
      onlineUser.viewingEntity = entityType && entityId
        ? { type: entityType, id: entityId }
        : undefined;
      this.broadcastPresence(projectId);
    }

    return { success: true };
  }

  /**
   * Broadcast an event to all users in a project
   */
  broadcastProjectEvent(event: ProjectEventPayload) {
    const roomName = `project:${event.projectId}`;
    this.server.to(roomName).emit(WsEvents.PROJECT_EVENT, event);
    this.logger.debug(
      `Broadcast ${event.action} on ${event.entityType} ${event.entityId} to ${roomName}`,
    );
  }

  /**
   * Broadcast current presence to project members
   */
  private broadcastPresence(projectId: string, specificClient?: Socket) {
    const projectUsers = this.projectPresence.get(projectId);
    const users = projectUsers ? Array.from(projectUsers.values()) : [];

    const presenceData = {
      projectId,
      users: users.map((u) => ({
        userId: u.userId,
        userName: u.userName,
        viewingEntity: u.viewingEntity,
      })),
    };

    if (specificClient) {
      specificClient.emit(WsEvents.PRESENCE_UPDATE, presenceData);
    } else {
      this.server
        .to(`project:${projectId}`)
        .emit(WsEvents.PRESENCE_UPDATE, presenceData);
    }
  }

  /**
   * Authenticate socket connection
   */
  private async authenticateSocket(client: Socket): Promise<WsAuthPayload | null> {
    const token = this.extractToken(client);
    if (!token) {
      this.logger.warn(`No token for socket ${client.id}`);
      return null;
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
      return {
        userId: payload.sub,
        email: payload.email,
      };
    } catch {
      this.logger.warn(`Invalid token for socket ${client.id}`);
      return null;
    }
  }

  private extractToken(client: Socket): string | null {
    const authHeader = client.handshake.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    if (client.handshake.query.token) {
      return client.handshake.query.token as string;
    }
    if (client.handshake.auth?.token) {
      return client.handshake.auth.token;
    }
    return null;
  }

  /**
   * Get online users for a project (for REST API)
   */
  getProjectOnlineUsers(projectId: string): OnlineUser[] {
    const projectUsers = this.projectPresence.get(projectId);
    return projectUsers ? Array.from(projectUsers.values()) : [];
  }
}
