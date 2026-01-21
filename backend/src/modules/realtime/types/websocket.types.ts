import { EntityType, EventAction } from '@prisma/client';

export interface WsAuthPayload {
  userId: string;
  email: string;
}

export interface JoinProjectPayload {
  projectId: string;
}

export interface LeaveProjectPayload {
  projectId: string;
}

export interface ProjectEventPayload {
  projectId: string;
  entityType: EntityType;
  entityId: string;
  action: EventAction;
  changes?: Record<string, any>;
  userId?: string;
  userName?: string;
  aiTriggered?: boolean;
  timestamp: Date;
  entityTitle?: string;
}

export interface PresencePayload {
  projectId: string;
  userId: string;
  userName: string;
  viewingEntity?: {
    type: EntityType;
    id: string;
  };
}

export interface PresenceUpdatePayload {
  projectId: string;
  entityType?: EntityType;
  entityId?: string;
}

export interface OnlineUser {
  userId: string;
  userName: string;
  socketId: string;
  viewingEntity?: {
    type: EntityType;
    id: string;
  };
  joinedAt: Date;
}

export interface ProjectPresence {
  projectId: string;
  users: OnlineUser[];
}

// WebSocket event names
export enum WsEvents {
  // Client -> Server
  JOIN_PROJECT = 'joinProject',
  LEAVE_PROJECT = 'leaveProject',
  UPDATE_PRESENCE = 'updatePresence',

  // Server -> Client
  PROJECT_EVENT = 'projectEvent',
  USER_JOINED = 'userJoined',
  USER_LEFT = 'userLeft',
  PRESENCE_UPDATE = 'presenceUpdate',
  ERROR = 'error',
}
