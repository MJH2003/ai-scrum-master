# Frontend Integration Guide - AI Scrum Master

> **Document Version**: 1.0  
> **Last Updated**: 2026-01-22  
> **Backend API Version**: v1

This document contains all the information needed to build the frontend for AI Scrum Master. It covers API endpoints, data models, authentication, WebSocket events, and TypeScript types.

---

## Table of Contents

1. [API Overview](#api-overview)
2. [Authentication](#authentication)
3. [API Endpoints](#api-endpoints)
   - [Auth](#auth-endpoints)
   - [Users](#users-endpoints)
   - [Projects](#projects-endpoints)
   - [Epics](#epics-endpoints)
   - [Stories](#stories-endpoints)
   - [Tasks](#tasks-endpoints)
   - [Sprints](#sprints-endpoints)
   - [AI Agents](#ai-agents-endpoints)
   - [AI Proposals](#ai-proposals-endpoints)
   - [Chat](#chat-endpoints)
   - [Analytics](#analytics-endpoints)
   - [Insights](#insights-endpoints)
   - [Events](#events-endpoints)
   - [Health](#health-endpoints)
4. [Data Models](#data-models)
5. [WebSocket Events](#websocket-events)
6. [Error Handling](#error-handling)
7. [TypeScript Types](#typescript-types)
8. [Quick Reference](#quick-reference)

---

## API Overview

### Base URL

```
Development: http://localhost:3000/api/v1
Staging:     https://api-staging.ai-scrum-master.com/api/v1
Production:  https://api.ai-scrum-master.com/api/v1
```

### Headers

```typescript
// All authenticated requests
{
  "Authorization": "Bearer <access_token>",
  "Content-Type": "application/json"
}
```

### Response Format

All API responses follow this structure:

```typescript
// Success Response
{
  "data": T,           // Response payload
  "meta"?: {           // Optional metadata
    "total": number,
    "page": number,
    "limit": number
  }
}

// Error Response
{
  "error": {
    "code": string,        // e.g., "AUTH_INVALID_CREDENTIALS"
    "message": string,     // Human-readable message
    "details"?: object,    // Additional error context
    "correlationId"?: string
  }
}
```

---

## Authentication

### JWT Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        Authentication Flow                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Login/Register                                               │
│     POST /auth/login  ──►  { accessToken, refreshToken, user }  │
│                                                                  │
│  2. Use Access Token (15 min lifetime)                          │
│     Authorization: Bearer <accessToken>                          │
│                                                                  │
│  3. Refresh Token (when access token expires)                   │
│     POST /auth/refresh  ──►  { accessToken, refreshToken }      │
│                                                                  │
│  4. Logout                                                       │
│     POST /auth/logout  ──►  Invalidates current refresh token   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Token Storage Recommendations

```typescript
// Access Token: Store in memory (React state/context)
// Refresh Token: Store in httpOnly cookie or secure storage

// Example token refresh interceptor
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      const { accessToken } = await refreshToken();
      error.config.headers.Authorization = `Bearer ${accessToken}`;
      return axios(error.config);
    }
    return Promise.reject(error);
  }
);
```

---

## API Endpoints

### Auth Endpoints

#### Register User
```http
POST /auth/register
```

**Request Body:**
```typescript
{
  email: string;      // Valid email format
  password: string;   // Min 8 chars, 1 uppercase, 1 lowercase, 1 number
  name: string;       // 2-100 characters
}
```

**Response:** `201 Created`
```typescript
{
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    avatar: string | null;
    createdAt: string;
  }
}
```

---

#### Login
```http
POST /auth/login
```

**Request Body:**
```typescript
{
  email: string;
  password: string;
}
```

**Response:** `200 OK`
```typescript
{
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    avatar: string | null;
    createdAt: string;
  }
}
```

---

#### Refresh Token
```http
POST /auth/refresh
```

**Request Body:**
```typescript
{
  refreshToken: string;
}
```

**Response:** `200 OK`
```typescript
{
  accessToken: string;
  refreshToken: string;
}
```

---

#### Logout
```http
POST /auth/logout
Authorization: Bearer <token>
```

**Request Body:**
```typescript
{
  refreshToken: string;
}
```

**Response:** `200 OK`
```typescript
{
  message: "Logged out successfully"
}
```

---

#### Logout All Devices
```http
POST /auth/logout-all
Authorization: Bearer <token>
```

**Response:** `200 OK`
```typescript
{
  message: "Logged out from all devices"
}
```

---

#### Get Current User
```http
GET /auth/me
Authorization: Bearer <token>
```

**Response:** `200 OK`
```typescript
{
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  preferences: object | null;
  createdAt: string;
  updatedAt: string;
}
```

---

### Users Endpoints

#### Get User Profile
```http
GET /users/:id
Authorization: Bearer <token>
```

**Response:** `200 OK`
```typescript
{
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  createdAt: string;
}
```

---

#### Update Profile
```http
PATCH /users/profile
Authorization: Bearer <token>
```

**Request Body:**
```typescript
{
  name?: string;
  avatar?: string;
  preferences?: {
    theme?: 'light' | 'dark' | 'system';
    notifications?: boolean;
    emailDigest?: 'daily' | 'weekly' | 'never';
  };
}
```

**Response:** `200 OK` - Returns updated user

---

#### Change Password
```http
POST /users/change-password
Authorization: Bearer <token>
```

**Request Body:**
```typescript
{
  currentPassword: string;
  newPassword: string;
}
```

**Response:** `200 OK`
```typescript
{
  message: "Password changed successfully"
}
```

---

#### Search Users
```http
GET /users/search?q=<query>&limit=<number>
Authorization: Bearer <token>
```

**Query Parameters:**
- `q` (required): Search term (email or name)
- `limit` (optional): Max results (default: 10, max: 50)

**Response:** `200 OK`
```typescript
{
  users: Array<{
    id: string;
    email: string;
    name: string;
    avatar: string | null;
  }>
}
```

---

### Projects Endpoints

#### Create Project
```http
POST /projects
Authorization: Bearer <token>
```

**Request Body:**
```typescript
{
  name: string;           // 3-100 characters
  description?: string;   // Max 2000 characters
  settings?: {
    defaultSprintDuration?: number;  // Days (default: 14)
    estimationScale?: 'fibonacci' | 'linear' | 'tshirt';
    workingDays?: number[];  // 0-6 (Sun-Sat)
  };
}
```

**Response:** `201 Created`
```typescript
{
  id: string;
  name: string;
  description: string | null;
  slug: string;
  settings: object;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}
```

---

#### List User's Projects
```http
GET /projects
Authorization: Bearer <token>
```

**Query Parameters:**
- `includeArchived` (optional): boolean (default: false)

**Response:** `200 OK`
```typescript
{
  projects: Array<{
    id: string;
    name: string;
    description: string | null;
    slug: string;
    role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
    createdAt: string;
    archivedAt: string | null;
    _count: {
      members: number;
      epics: number;
      stories: number;
    }
  }>
}
```

---

#### Get Project by ID
```http
GET /projects/:projectId
Authorization: Bearer <token>
```

**Response:** `200 OK`
```typescript
{
  id: string;
  name: string;
  description: string | null;
  slug: string;
  settings: object;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  members: Array<{
    userId: string;
    role: ProjectRole;
    user: {
      id: string;
      name: string;
      email: string;
      avatar: string | null;
    }
  }>;
  _count: {
    epics: number;
    stories: number;
    tasks: number;
    sprints: number;
  }
}
```

---

#### Update Project
```http
PATCH /projects/:projectId
Authorization: Bearer <token>
```
*Requires: OWNER or ADMIN role*

**Request Body:**
```typescript
{
  name?: string;
  description?: string;
  settings?: object;
}
```

**Response:** `200 OK` - Returns updated project

---

#### Delete Project
```http
DELETE /projects/:projectId
Authorization: Bearer <token>
```
*Requires: OWNER role*

**Response:** `200 OK`
```typescript
{
  message: "Project deleted successfully"
}
```

---

#### Archive Project
```http
POST /projects/:projectId/archive
Authorization: Bearer <token>
```
*Requires: OWNER or ADMIN role*

**Response:** `200 OK` - Returns archived project

---

#### Unarchive Project
```http
POST /projects/:projectId/unarchive
Authorization: Bearer <token>
```
*Requires: OWNER or ADMIN role*

**Response:** `200 OK` - Returns unarchived project

---

#### Get Project Members
```http
GET /projects/:projectId/members
Authorization: Bearer <token>
```

**Response:** `200 OK`
```typescript
{
  members: Array<{
    userId: string;
    projectId: string;
    role: ProjectRole;
    joinedAt: string;
    user: {
      id: string;
      name: string;
      email: string;
      avatar: string | null;
    }
  }>
}
```

---

#### Add Project Member
```http
POST /projects/:projectId/members
Authorization: Bearer <token>
```
*Requires: OWNER or ADMIN role*

**Request Body:**
```typescript
{
  userId: string;
  role: 'ADMIN' | 'MEMBER' | 'VIEWER';  // Cannot add as OWNER
}
```

**Response:** `201 Created` - Returns member record

---

#### Update Member Role
```http
PATCH /projects/:projectId/members/:userId
Authorization: Bearer <token>
```
*Requires: OWNER or ADMIN role*

**Request Body:**
```typescript
{
  role: 'ADMIN' | 'MEMBER' | 'VIEWER';
}
```

**Response:** `200 OK` - Returns updated member

---

#### Remove Project Member
```http
DELETE /projects/:projectId/members/:userId
Authorization: Bearer <token>
```
*Requires: OWNER or ADMIN role*

**Response:** `200 OK`
```typescript
{
  message: "Member removed successfully"
}
```

---

### Epics Endpoints

#### Create Epic
```http
POST /projects/:projectId/epics
Authorization: Bearer <token>
```
*Requires: OWNER, ADMIN, or MEMBER role*

**Request Body:**
```typescript
{
  title: string;          // 3-200 characters
  description?: string;   // Max 5000 characters
  status?: 'DRAFT' | 'ACTIVE' | 'DONE';
  priority?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  position?: number;
}
```

**Response:** `201 Created`
```typescript
{
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: EpicStatus;
  priority: Priority;
  position: number;
  aiGenerated: boolean;
  createdAt: string;
  updatedAt: string;
}
```

---

#### List Epics
```http
GET /projects/:projectId/epics
Authorization: Bearer <token>
```

**Query Parameters:**
- `status` (optional): Filter by status
- `priority` (optional): Filter by priority

**Response:** `200 OK`
```typescript
{
  epics: Array<Epic & {
    _count: {
      stories: number;
    }
  }>
}
```

---

#### Get Epic by ID
```http
GET /projects/:projectId/epics/:epicId
Authorization: Bearer <token>
```

**Response:** `200 OK`
```typescript
{
  ...Epic,
  stories: Story[];
  _count: {
    stories: number;
  }
}
```

---

#### Update Epic
```http
PATCH /projects/:projectId/epics/:epicId
Authorization: Bearer <token>
```
*Requires: OWNER, ADMIN, or MEMBER role*

**Request Body:**
```typescript
{
  title?: string;
  description?: string;
  status?: EpicStatus;
  priority?: Priority;
  position?: number;
}
```

**Response:** `200 OK` - Returns updated epic

---

#### Delete Epic
```http
DELETE /projects/:projectId/epics/:epicId
Authorization: Bearer <token>
```
*Requires: OWNER, ADMIN, or MEMBER role*

**Response:** `200 OK`
```typescript
{
  message: "Epic deleted successfully"
}
```

---

### Stories Endpoints

#### Create Story
```http
POST /projects/:projectId/stories
Authorization: Bearer <token>
```
*Requires: OWNER, ADMIN, or MEMBER role*

**Request Body:**
```typescript
{
  title: string;                    // 3-300 characters
  description?: string;             // Max 10000 characters
  epicId?: string;                  // Optional parent epic
  status?: StoryStatus;
  priority?: Priority;
  estimate?: number;                // Story points
  confidence?: number;              // 0-100
  assigneeId?: string;
  acceptanceCriteria?: Array<{
    description: string;
    completed: boolean;
  }>;
  position?: number;
}
```

**Response:** `201 Created`
```typescript
{
  id: string;
  projectId: string;
  epicId: string | null;
  title: string;
  description: string | null;
  status: StoryStatus;
  priority: Priority;
  estimate: number | null;
  confidence: number | null;
  position: number;
  assigneeId: string | null;
  acceptanceCriteria: object[];
  aiGenerated: boolean;
  aiSuggestions: object | null;
  createdAt: string;
  updatedAt: string;
}
```

---

#### List Stories
```http
GET /projects/:projectId/stories
Authorization: Bearer <token>
```

**Query Parameters:**
- `epicId` (optional): Filter by epic
- `status` (optional): Filter by status
- `priority` (optional): Filter by priority
- `assigneeId` (optional): Filter by assignee
- `sprintId` (optional): Filter by sprint
- `unassigned` (optional): boolean - stories without sprint

**Response:** `200 OK`
```typescript
{
  stories: Array<Story & {
    epic?: { id: string; title: string };
    assignee?: { id: string; name: string; avatar: string | null };
    _count: { tasks: number };
  }>
}
```

---

#### Get Story by ID
```http
GET /projects/:projectId/stories/:storyId
Authorization: Bearer <token>
```

**Response:** `200 OK`
```typescript
{
  ...Story,
  epic?: Epic;
  assignee?: User;
  tasks: Task[];
  sprintItems: SprintItem[];
}
```

---

#### Update Story
```http
PATCH /projects/:projectId/stories/:storyId
Authorization: Bearer <token>
```

**Request Body:**
```typescript
{
  title?: string;
  description?: string;
  epicId?: string | null;
  status?: StoryStatus;
  priority?: Priority;
  estimate?: number;
  confidence?: number;
  assigneeId?: string | null;
  acceptanceCriteria?: object[];
  position?: number;
}
```

**Response:** `200 OK` - Returns updated story

---

#### Delete Story
```http
DELETE /projects/:projectId/stories/:storyId
Authorization: Bearer <token>
```

**Response:** `200 OK`
```typescript
{
  message: "Story deleted successfully"
}
```

---

### Tasks Endpoints

#### Create Task
```http
POST /projects/:projectId/tasks
Authorization: Bearer <token>
```

**Request Body:**
```typescript
{
  title: string;          // 3-300 characters
  description?: string;   // Max 5000 characters
  storyId: string;        // Required parent story
  status?: TaskStatus;
  estimate?: number;      // Hours
  assigneeId?: string;
  position?: number;
}
```

**Response:** `201 Created`
```typescript
{
  id: string;
  projectId: string;
  storyId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  estimate: number | null;
  position: number;
  assigneeId: string | null;
  aiGenerated: boolean;
  createdAt: string;
  updatedAt: string;
}
```

---

#### List Tasks
```http
GET /projects/:projectId/tasks
Authorization: Bearer <token>
```

**Query Parameters:**
- `storyId` (optional): Filter by story
- `status` (optional): Filter by status
- `assigneeId` (optional): Filter by assignee

**Response:** `200 OK`
```typescript
{
  tasks: Array<Task & {
    story?: { id: string; title: string };
    assignee?: { id: string; name: string; avatar: string | null };
  }>
}
```

---

#### Get Task by ID
```http
GET /projects/:projectId/tasks/:taskId
Authorization: Bearer <token>
```

**Response:** `200 OK` - Returns task with story and assignee

---

#### Update Task
```http
PATCH /projects/:projectId/tasks/:taskId
Authorization: Bearer <token>
```

**Request Body:**
```typescript
{
  title?: string;
  description?: string;
  status?: TaskStatus;
  estimate?: number;
  assigneeId?: string | null;
  position?: number;
}
```

**Response:** `200 OK` - Returns updated task

---

#### Delete Task
```http
DELETE /projects/:projectId/tasks/:taskId
Authorization: Bearer <token>
```

**Response:** `200 OK`
```typescript
{
  message: "Task deleted successfully"
}
```

---

### Sprints Endpoints

#### Create Sprint
```http
POST /projects/:projectId/sprints
Authorization: Bearer <token>
```
*Requires: OWNER, ADMIN, or MEMBER role*

**Request Body:**
```typescript
{
  name: string;           // e.g., "Sprint 1"
  goal?: string;          // Sprint goal
  startDate: string;      // ISO date
  endDate: string;        // ISO date
  capacity?: {            // Per-member capacity in hours
    [userId: string]: number;
  };
}
```

**Response:** `201 Created`
```typescript
{
  id: string;
  projectId: string;
  name: string;
  goal: string | null;
  startDate: string;
  endDate: string;
  status: SprintStatus;
  capacity: object | null;
  createdAt: string;
  updatedAt: string;
}
```

---

#### List Sprints
```http
GET /projects/:projectId/sprints
Authorization: Bearer <token>
```

**Query Parameters:**
- `status` (optional): Filter by status ('PLANNING' | 'ACTIVE' | 'COMPLETED')

**Response:** `200 OK`
```typescript
{
  sprints: Array<Sprint & {
    _count: {
      items: number;
    };
    items?: SprintItem[];
  }>
}
```

---

#### Get Sprint by ID
```http
GET /projects/:projectId/sprints/:sprintId
Authorization: Bearer <token>
```

**Response:** `200 OK`
```typescript
{
  ...Sprint,
  items: Array<SprintItem & {
    story: Story & {
      assignee?: User;
      tasks: Task[];
      _count: { tasks: number };
    }
  }>
}
```

---

#### Update Sprint
```http
PATCH /projects/:projectId/sprints/:sprintId
Authorization: Bearer <token>
```

**Request Body:**
```typescript
{
  name?: string;
  goal?: string;
  startDate?: string;
  endDate?: string;
  capacity?: object;
}
```

**Response:** `200 OK` - Returns updated sprint

---

#### Delete Sprint
```http
DELETE /projects/:projectId/sprints/:sprintId
Authorization: Bearer <token>
```
*Only allowed for PLANNING status sprints*

**Response:** `200 OK`
```typescript
{
  message: "Sprint deleted successfully"
}
```

---

#### Start Sprint
```http
POST /projects/:projectId/sprints/:sprintId/start
Authorization: Bearer <token>
```
*Changes status from PLANNING to ACTIVE*

**Response:** `200 OK` - Returns updated sprint

---

#### Complete Sprint
```http
POST /projects/:projectId/sprints/:sprintId/complete
Authorization: Bearer <token>
```
*Changes status from ACTIVE to COMPLETED*

**Request Body (optional):**
```typescript
{
  moveUnfinishedTo?: string;  // Sprint ID to move incomplete stories
}
```

**Response:** `200 OK`
```typescript
{
  sprint: Sprint;
  movedStories?: number;  // Count of moved stories
}
```

---

#### Add Story to Sprint
```http
POST /projects/:projectId/sprints/:sprintId/items
Authorization: Bearer <token>
```

**Request Body:**
```typescript
{
  storyId: string;
}
```

**Response:** `201 Created`
```typescript
{
  sprintId: string;
  storyId: string;
  addedAt: string;
  originalEstimate: number | null;
}
```

---

#### Remove Story from Sprint
```http
DELETE /projects/:projectId/sprints/:sprintId/items/:storyId
Authorization: Bearer <token>
```

**Response:** `200 OK`
```typescript
{
  message: "Story removed from sprint"
}
```

---

#### Reorder Sprint Items
```http
PATCH /projects/:projectId/sprints/:sprintId/reorder
Authorization: Bearer <token>
```

**Request Body:**
```typescript
{
  items: Array<{
    storyId: string;
    position: number;
  }>;
}
```

**Response:** `200 OK`
```typescript
{
  message: "Sprint items reordered"
}
```

---

### AI Agents Endpoints

#### Generate Backlog from Idea
```http
POST /projects/:projectId/ai/generate-backlog
Authorization: Bearer <token>
```

**Request Body:**
```typescript
{
  idea: string;           // Project idea/description (10-5000 chars)
  preferences?: {
    maxEpics?: number;    // Default: 5
    maxStoriesPerEpic?: number;  // Default: 8
    includeEstimates?: boolean;  // Default: true
    includeTasks?: boolean;      // Default: false
  };
}
```

**Response:** `200 OK`
```typescript
{
  proposal: {
    id: string;
    type: 'BACKLOG_GENERATION';
    status: 'PENDING';
    payload: {
      epics: Array<{
        title: string;
        description: string;
        priority: Priority;
        stories: Array<{
          title: string;
          description: string;
          acceptanceCriteria: string[];
          estimate: number;
          priority: Priority;
          tasks?: Array<{
            title: string;
            estimate: number;
          }>;
        }>;
      }>;
    };
    explanation: string;
    evidence: object;
    createdAt: string;
  }
}
```

---

#### Plan Sprint (AI Suggestion)
```http
POST /projects/:projectId/ai/plan-sprint
Authorization: Bearer <token>
```

**Request Body:**
```typescript
{
  sprintId: string;           // Target sprint
  teamCapacity?: number;      // Total team hours available
  preferences?: {
    priorityWeight?: number;  // 0-1, weight for priority vs effort
    includeInProgress?: boolean;  // Include partially done stories
  };
}
```

**Response:** `200 OK`
```typescript
{
  proposal: {
    id: string;
    type: 'SPRINT_PLANNING';
    status: 'PENDING';
    payload: {
      recommendedStories: Array<{
        storyId: string;
        title: string;
        estimate: number;
        priority: Priority;
        reasoning: string;
      }>;
      totalEstimate: number;
      capacityUtilization: number;  // Percentage
    };
    explanation: string;
    evidence: {
      historicalVelocity: number;
      teamCapacity: number;
    };
    createdAt: string;
  }
}
```

---

#### Analyze Project
```http
POST /projects/:projectId/ai/analyze
Authorization: Bearer <token>
```

**Request Body:**
```typescript
{
  focus?: 'risks' | 'blockers' | 'velocity' | 'health' | 'all';
  sprintId?: string;  // Analyze specific sprint
}
```

**Response:** `200 OK`
```typescript
{
  analysis: {
    summary: string;
    healthScore: number;  // 0-100
    risks: Array<{
      type: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      description: string;
      recommendation: string;
      affectedItems?: string[];
    }>;
    blockers: Array<{
      type: string;
      description: string;
      impact: string;
      suggestion: string;
    }>;
    velocityTrend: {
      current: number;
      average: number;
      trend: 'increasing' | 'stable' | 'decreasing';
    };
    recommendations: string[];
  }
}
```

---

### AI Proposals Endpoints

#### List Pending Proposals
```http
GET /projects/:projectId/proposals
Authorization: Bearer <token>
```

**Query Parameters:**
- `status` (optional): 'PENDING' | 'APPLIED' | 'REJECTED' | 'EXPIRED'
- `type` (optional): Proposal type filter

**Response:** `200 OK`
```typescript
{
  proposals: Array<{
    id: string;
    projectId: string;
    agentType: string;
    proposalType: string;
    status: ProposalStatus;
    explanation: string;
    createdAt: string;
    expiresAt: string | null;
  }>
}
```

---

#### Get Proposal Details
```http
GET /projects/:projectId/proposals/:proposalId
Authorization: Bearer <token>
```

**Response:** `200 OK`
```typescript
{
  id: string;
  projectId: string;
  agentType: string;
  proposalType: string;
  payload: object;        // Full proposal data
  status: ProposalStatus;
  explanation: string;
  evidence: object | null;
  createdBy: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  expiresAt: string | null;
}
```

---

#### Apply Proposal
```http
POST /projects/:projectId/proposals/:proposalId/apply
Authorization: Bearer <token>
```
*Requires: OWNER or ADMIN role*

**Request Body (optional):**
```typescript
{
  modifications?: object;  // Optional modifications to apply
}
```

**Response:** `200 OK`
```typescript
{
  message: "Proposal applied successfully";
  created: {
    epics: number;
    stories: number;
    tasks: number;
  };
}
```

---

#### Reject Proposal
```http
POST /projects/:projectId/proposals/:proposalId/reject
Authorization: Bearer <token>
```

**Request Body (optional):**
```typescript
{
  reason?: string;  // Rejection reason
}
```

**Response:** `200 OK`
```typescript
{
  message: "Proposal rejected"
}
```

---

### Chat Endpoints

#### Send Chat Message (Streaming)
```http
POST /projects/:projectId/chat
Authorization: Bearer <token>
Accept: text/event-stream
```

**Request Body:**
```typescript
{
  message: string;        // User message (1-2000 chars)
  context?: {
    entityType?: 'epic' | 'story' | 'task' | 'sprint';
    entityId?: string;
  };
}
```

**Response:** `200 OK` (Server-Sent Events)
```typescript
// Stream of events:
event: token
data: {"content": "partial response text"}

event: citation
data: {"type": "story", "id": "...", "title": "..."}

event: done
data: {"messageId": "...", "tokensUsed": 150}

// Or error:
event: error
data: {"code": "AI_ERROR", "message": "..."}
```

**Non-streaming alternative:**
```http
POST /projects/:projectId/chat
Authorization: Bearer <token>
Content-Type: application/json
```

**Response:** `200 OK`
```typescript
{
  id: string;
  content: string;
  citations: Array<{
    type: string;
    id: string;
    title: string;
  }>;
  tokensUsed: number;
  createdAt: string;
}
```

---

#### Get Chat History
```http
GET /projects/:projectId/chat/history
Authorization: Bearer <token>
```

**Query Parameters:**
- `limit` (optional): Number of messages (default: 50, max: 100)
- `before` (optional): Cursor for pagination (message ID)

**Response:** `200 OK`
```typescript
{
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    citations?: object[];
    createdAt: string;
  }>;
  hasMore: boolean;
  nextCursor?: string;
}
```

---

#### Clear Chat History
```http
DELETE /projects/:projectId/chat/history
Authorization: Bearer <token>
```

**Response:** `200 OK`
```typescript
{
  message: "Chat history cleared"
}
```

---

### Analytics Endpoints

#### Get Project Summary
```http
GET /projects/:projectId/analytics/summary
Authorization: Bearer <token>
```

**Response:** `200 OK`
```typescript
{
  totalEpics: number;
  totalStories: number;
  totalTasks: number;
  completedStories: number;
  completedTasks: number;
  totalStoryPoints: number;
  completedStoryPoints: number;
  activeSprintId: string | null;
  storiesByStatus: {
    BACKLOG: number;
    READY: number;
    IN_PROGRESS: number;
    REVIEW: number;
    DONE: number;
  };
  tasksByStatus: {
    TODO: number;
    IN_PROGRESS: number;
    DONE: number;
  };
}
```

---

#### Get Velocity Trend
```http
GET /projects/:projectId/analytics/velocity
Authorization: Bearer <token>
```

**Query Parameters:**
- `sprints` (optional): Number of sprints to include (default: 6)

**Response:** `200 OK`
```typescript
{
  sprints: Array<{
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    committed: number;      // Story points committed
    completed: number;      // Story points completed
    velocity: number;       // Completed points
  }>;
  averageVelocity: number;
  trend: 'increasing' | 'stable' | 'decreasing';
}
```

---

#### Get Sprint Burndown
```http
GET /projects/:projectId/sprints/:sprintId/burndown
Authorization: Bearer <token>
```

**Response:** `200 OK`
```typescript
{
  sprintId: string;
  sprintName: string;
  startDate: string;
  endDate: string;
  totalPoints: number;
  data: Array<{
    date: string;
    ideal: number;          // Ideal burndown
    actual: number;         // Actual remaining
    completed: number;      // Completed that day
  }>;
}
```

---

#### Get Sprint Metrics
```http
GET /projects/:projectId/sprints/:sprintId/metrics
Authorization: Bearer <token>
```

**Response:** `200 OK`
```typescript
{
  sprintId: string;
  name: string;
  status: SprintStatus;
  commitment: {
    stories: number;
    points: number;
  };
  completed: {
    stories: number;
    points: number;
  };
  remaining: {
    stories: number;
    points: number;
  };
  velocity: number;
  completionRate: number;   // Percentage
  scopeChange: number;      // Points added/removed after start
  averageCycleTime: number; // Hours per story
  taskMetrics: {
    total: number;
    completed: number;
    inProgress: number;
  };
}
```

---

### Insights Endpoints

#### List Active Insights
```http
GET /projects/:projectId/insights
Authorization: Bearer <token>
```

**Query Parameters:**
- `type` (optional): Filter by type
- `severity` (optional): Filter by severity
- `acknowledged` (optional): boolean

**Response:** `200 OK`
```typescript
{
  insights: Array<{
    id: string;
    type: string;
    severity: 'info' | 'warning' | 'critical';
    title: string;
    description: string;
    recommendation: string;
    affectedEntities: Array<{
      type: string;
      id: string;
      title: string;
    }>;
    acknowledged: boolean;
    acknowledgedBy?: string;
    acknowledgedAt?: string;
    createdAt: string;
  }>
}
```

---

#### Get Project Health Summary
```http
GET /projects/:projectId/insights/summary
Authorization: Bearer <token>
```

**Response:** `200 OK`
```typescript
{
  healthScore: number;      // 0-100
  healthTrend: 'improving' | 'stable' | 'declining';
  insightCounts: {
    critical: number;
    warning: number;
    info: number;
  };
  topRisks: Array<{
    type: string;
    description: string;
    severity: string;
  }>;
  recommendations: string[];
}
```

---

#### Acknowledge Insight
```http
PATCH /projects/:projectId/insights/:insightId/acknowledge
Authorization: Bearer <token>
```

**Response:** `200 OK`
```typescript
{
  ...Insight,
  acknowledged: true,
  acknowledgedBy: string,
  acknowledgedAt: string
}
```

---

### Events Endpoints

#### Get Activity Feed
```http
GET /projects/:projectId/events
Authorization: Bearer <token>
```

**Query Parameters:**
- `limit` (optional): Number of events (default: 50, max: 100)
- `before` (optional): Cursor for pagination
- `entityType` (optional): Filter by entity type
- `entityId` (optional): Filter by entity ID
- `action` (optional): Filter by action

**Response:** `200 OK`
```typescript
{
  events: Array<{
    id: string;
    projectId: string;
    entityType: 'epic' | 'story' | 'task' | 'sprint' | 'project';
    entityId: string;
    action: 'created' | 'updated' | 'deleted' | 'moved' | 'status_changed';
    changes: object | null;
    userId: string | null;
    user?: {
      id: string;
      name: string;
      avatar: string | null;
    };
    aiTriggered: boolean;
    createdAt: string;
  }>;
  hasMore: boolean;
  nextCursor?: string;
}
```

---

#### Get Entity History
```http
GET /projects/:projectId/events/entity/:entityType/:entityId
Authorization: Bearer <token>
```

**Response:** `200 OK` - Array of events for specific entity

---

### Health Endpoints

#### Health Check
```http
GET /health
```
*No authentication required*

**Response:** `200 OK`
```typescript
{
  status: 'ok';
  timestamp: string;
}
```

---

#### Readiness Check
```http
GET /ready
```
*No authentication required*

**Response:** `200 OK`
```typescript
{
  status: 'ok';
  checks: {
    database: 'ok' | 'error';
    redis: 'ok' | 'error';
  };
}
```

---

#### Liveness Check
```http
GET /live
```
*No authentication required*

**Response:** `200 OK`
```typescript
{
  status: 'ok';
}
```

---

## Data Models

### Enums

```typescript
enum ProjectRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
  VIEWER = 'VIEWER'
}

enum EpicStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  DONE = 'DONE'
}

enum StoryStatus {
  BACKLOG = 'BACKLOG',
  READY = 'READY',
  IN_PROGRESS = 'IN_PROGRESS',
  REVIEW = 'REVIEW',
  DONE = 'DONE'
}

enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE'
}

enum SprintStatus {
  PLANNING = 'PLANNING',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED'
}

enum Priority {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW'
}

enum ProposalStatus {
  PENDING = 'PENDING',
  APPLIED = 'APPLIED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED'
}

enum DependencyType {
  BLOCKS = 'BLOCKS',
  REQUIRES = 'REQUIRES'
}
```

### Entity Models

```typescript
interface User {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  preferences: object | null;
  createdAt: string;
  updatedAt: string;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  settings: object;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

interface ProjectMember {
  userId: string;
  projectId: string;
  role: ProjectRole;
  joinedAt: string;
}

interface Epic {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: EpicStatus;
  priority: Priority;
  position: number;
  aiGenerated: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Story {
  id: string;
  projectId: string;
  epicId: string | null;
  title: string;
  description: string | null;
  status: StoryStatus;
  priority: Priority;
  estimate: number | null;
  confidence: number | null;
  position: number;
  assigneeId: string | null;
  acceptanceCriteria: object[];
  aiGenerated: boolean;
  aiSuggestions: object | null;
  createdAt: string;
  updatedAt: string;
}

interface Task {
  id: string;
  projectId: string;
  storyId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  estimate: number | null;
  position: number;
  assigneeId: string | null;
  aiGenerated: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Sprint {
  id: string;
  projectId: string;
  name: string;
  goal: string | null;
  startDate: string;
  endDate: string;
  status: SprintStatus;
  capacity: object | null;
  createdAt: string;
  updatedAt: string;
}

interface SprintItem {
  sprintId: string;
  storyId: string;
  addedAt: string;
  completedAt: string | null;
  originalEstimate: number | null;
  finalEstimate: number | null;
}

interface Dependency {
  id: string;
  projectId: string;
  sourceType: string;
  sourceId: string;
  targetType: string;
  targetId: string;
  dependencyType: DependencyType;
  createdAt: string;
}

interface EventLog {
  id: string;
  projectId: string;
  entityType: string;
  entityId: string;
  action: string;
  changes: object | null;
  userId: string | null;
  aiTriggered: boolean;
  createdAt: string;
}

interface AIProposal {
  id: string;
  projectId: string;
  agentType: string;
  proposalType: string;
  payload: object;
  status: ProposalStatus;
  explanation: string | null;
  evidence: object | null;
  createdBy: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  expiresAt: string | null;
}

interface ChatMessage {
  id: string;
  projectId: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  citations: object | null;
  tokensUsed: number | null;
  createdAt: string;
}
```

---

## WebSocket Events

### Connection

```typescript
import { io } from 'socket.io-client';

const socket = io('ws://localhost:3000', {
  auth: {
    token: accessToken  // JWT token
  },
  transports: ['websocket']
});

socket.on('connect', () => {
  console.log('Connected to WebSocket');
});

socket.on('connect_error', (error) => {
  console.error('Connection failed:', error.message);
});
```

### Client → Server Events

#### Join Project Room
```typescript
socket.emit('joinProject', { projectId: string });
```

#### Leave Project Room
```typescript
socket.emit('leaveProject', { projectId: string });
```

#### Update Presence
```typescript
socket.emit('updatePresence', {
  projectId: string;
  status: 'active' | 'idle' | 'away';
  currentView?: string;        // e.g., 'board', 'backlog', 'sprint'
  currentEntity?: {
    type: 'epic' | 'story' | 'task' | 'sprint';
    id: string;
  };
});
```

### Server → Client Events

#### Project Event (Entity Changes)
```typescript
socket.on('projectEvent', (event: {
  type: 'created' | 'updated' | 'deleted' | 'moved' | 'status_changed';
  entityType: 'epic' | 'story' | 'task' | 'sprint' | 'project';
  entityId: string;
  data: object;           // Updated entity data
  changes?: object;       // Diff of changes
  userId: string;         // Who made the change
  timestamp: string;
}) => {
  // Handle real-time update
});
```

#### User Joined
```typescript
socket.on('userJoined', (data: {
  projectId: string;
  user: {
    id: string;
    name: string;
    avatar: string | null;
  };
  timestamp: string;
}) => {
  // Update presence indicator
});
```

#### User Left
```typescript
socket.on('userLeft', (data: {
  projectId: string;
  userId: string;
  timestamp: string;
}) => {
  // Update presence indicator
});
```

#### Presence Update
```typescript
socket.on('presenceUpdate', (data: {
  projectId: string;
  userId: string;
  status: 'active' | 'idle' | 'away';
  currentView?: string;
  currentEntity?: object;
  timestamp: string;
}) => {
  // Update user's presence status
});
```

#### AI Event
```typescript
socket.on('aiEvent', (event: {
  type: 'proposal_created' | 'analysis_complete' | 'insight_generated';
  projectId: string;
  data: object;
  timestamp: string;
}) => {
  // Handle AI notification
});
```

---

## Error Handling

### Error Response Format

```typescript
interface ErrorResponse {
  error: {
    code: string;           // Unique error code
    message: string;        // Human-readable message
    details?: object;       // Additional context
    correlationId?: string; // For debugging
  };
}
```

### Error Codes Reference

| Code | HTTP Status | Description |
|------|-------------|-------------|
| **Authentication** |
| `AUTH_INVALID_CREDENTIALS` | 401 | Invalid email or password |
| `AUTH_TOKEN_EXPIRED` | 401 | Access token has expired |
| `AUTH_TOKEN_INVALID` | 401 | Invalid or malformed token |
| `AUTH_REFRESH_TOKEN_INVALID` | 401 | Invalid refresh token |
| `AUTH_REFRESH_TOKEN_EXPIRED` | 401 | Refresh token has expired |
| `AUTH_USER_NOT_FOUND` | 404 | User does not exist |
| `AUTH_EMAIL_EXISTS` | 409 | Email already registered |
| **Authorization** |
| `AUTHZ_FORBIDDEN` | 403 | Insufficient permissions |
| `AUTHZ_NOT_PROJECT_MEMBER` | 403 | Not a member of this project |
| `AUTHZ_ROLE_REQUIRED` | 403 | Higher role required |
| **Resources** |
| `RESOURCE_NOT_FOUND` | 404 | Resource does not exist |
| `RESOURCE_ALREADY_EXISTS` | 409 | Resource already exists |
| `RESOURCE_ARCHIVED` | 400 | Resource is archived |
| **Validation** |
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `VALIDATION_MISSING_FIELD` | 400 | Required field missing |
| `VALIDATION_INVALID_FORMAT` | 400 | Invalid field format |
| **Rate Limiting** |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| **AI** |
| `AI_PROVIDER_ERROR` | 502 | AI provider unavailable |
| `AI_RATE_LIMIT` | 429 | AI rate limit exceeded |
| `AI_CONTEXT_TOO_LARGE` | 400 | Context exceeds token limit |
| `AI_PROPOSAL_EXPIRED` | 400 | Proposal has expired |
| `AI_PROPOSAL_ALREADY_PROCESSED` | 400 | Proposal already applied/rejected |
| **Project** |
| `PROJECT_NOT_FOUND` | 404 | Project does not exist |
| `PROJECT_ARCHIVED` | 400 | Project is archived |
| `PROJECT_MEMBER_EXISTS` | 409 | User is already a member |
| **Sprint** |
| `SPRINT_NOT_FOUND` | 404 | Sprint does not exist |
| `SPRINT_ALREADY_ACTIVE` | 400 | Another sprint is active |
| `SPRINT_INVALID_STATUS` | 400 | Invalid status transition |
| `SPRINT_STORY_ALREADY_ADDED` | 409 | Story already in sprint |
| **Server** |
| `SERVER_ERROR` | 500 | Internal server error |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |

### Handling Errors in Frontend

```typescript
// Axios interceptor example
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    const errorResponse = error.response?.data?.error;
    
    if (errorResponse) {
      switch (errorResponse.code) {
        case 'AUTH_TOKEN_EXPIRED':
          // Trigger token refresh
          return refreshAndRetry(error.config);
        
        case 'AUTHZ_FORBIDDEN':
          // Show permission denied message
          toast.error('You do not have permission to perform this action');
          break;
        
        case 'RATE_LIMIT_EXCEEDED':
          // Show rate limit message with retry info
          const retryAfter = error.response.headers['retry-after'];
          toast.warning(`Too many requests. Try again in ${retryAfter}s`);
          break;
        
        case 'VALIDATION_ERROR':
          // Show field-specific errors
          const details = errorResponse.details;
          Object.entries(details).forEach(([field, message]) => {
            setFieldError(field, message as string);
          });
          break;
        
        default:
          toast.error(errorResponse.message);
      }
    }
    
    return Promise.reject(error);
  }
);
```

---

## TypeScript Types

Complete type definitions for frontend use:

```typescript
// ============================================
// Enums
// ============================================

export enum ProjectRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
  VIEWER = 'VIEWER'
}

export enum EpicStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  DONE = 'DONE'
}

export enum StoryStatus {
  BACKLOG = 'BACKLOG',
  READY = 'READY',
  IN_PROGRESS = 'IN_PROGRESS',
  REVIEW = 'REVIEW',
  DONE = 'DONE'
}

export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE'
}

export enum SprintStatus {
  PLANNING = 'PLANNING',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED'
}

export enum Priority {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW'
}

export enum ProposalStatus {
  PENDING = 'PENDING',
  APPLIED = 'APPLIED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED'
}

// ============================================
// Base Entities
// ============================================

export interface User {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  preferences: UserPreferences | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferences {
  theme?: 'light' | 'dark' | 'system';
  notifications?: boolean;
  emailDigest?: 'daily' | 'weekly' | 'never';
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  settings: ProjectSettings;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface ProjectSettings {
  defaultSprintDuration?: number;
  estimationScale?: 'fibonacci' | 'linear' | 'tshirt';
  workingDays?: number[];
}

export interface ProjectMember {
  userId: string;
  projectId: string;
  role: ProjectRole;
  joinedAt: string;
  user: Pick<User, 'id' | 'name' | 'email' | 'avatar'>;
}

export interface Epic {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: EpicStatus;
  priority: Priority;
  position: number;
  aiGenerated: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AcceptanceCriterion {
  description: string;
  completed: boolean;
}

export interface Story {
  id: string;
  projectId: string;
  epicId: string | null;
  title: string;
  description: string | null;
  status: StoryStatus;
  priority: Priority;
  estimate: number | null;
  confidence: number | null;
  position: number;
  assigneeId: string | null;
  acceptanceCriteria: AcceptanceCriterion[];
  aiGenerated: boolean;
  aiSuggestions: object | null;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  storyId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  estimate: number | null;
  position: number;
  assigneeId: string | null;
  aiGenerated: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Sprint {
  id: string;
  projectId: string;
  name: string;
  goal: string | null;
  startDate: string;
  endDate: string;
  status: SprintStatus;
  capacity: Record<string, number> | null;
  createdAt: string;
  updatedAt: string;
}

export interface SprintItem {
  sprintId: string;
  storyId: string;
  addedAt: string;
  completedAt: string | null;
  originalEstimate: number | null;
  finalEstimate: number | null;
}

export interface AIProposal {
  id: string;
  projectId: string;
  agentType: string;
  proposalType: string;
  payload: object;
  status: ProposalStatus;
  explanation: string | null;
  evidence: object | null;
  createdBy: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  expiresAt: string | null;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations: Citation[] | null;
  createdAt: string;
}

export interface Citation {
  type: 'epic' | 'story' | 'task' | 'sprint';
  id: string;
  title: string;
}

export interface EventLog {
  id: string;
  projectId: string;
  entityType: string;
  entityId: string;
  action: string;
  changes: object | null;
  userId: string | null;
  user?: Pick<User, 'id' | 'name' | 'avatar'>;
  aiTriggered: boolean;
  createdAt: string;
}

export interface Insight {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  recommendation: string;
  affectedEntities: Array<{
    type: string;
    id: string;
    title: string;
  }>;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  createdAt: string;
}

// ============================================
// Request DTOs
// ============================================

export interface RegisterDto {
  email: string;
  password: string;
  name: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface RefreshTokenDto {
  refreshToken: string;
}

export interface CreateProjectDto {
  name: string;
  description?: string;
  settings?: ProjectSettings;
}

export interface UpdateProjectDto {
  name?: string;
  description?: string;
  settings?: ProjectSettings;
}

export interface AddMemberDto {
  userId: string;
  role: Exclude<ProjectRole, 'OWNER'>;
}

export interface CreateEpicDto {
  title: string;
  description?: string;
  status?: EpicStatus;
  priority?: Priority;
  position?: number;
}

export interface UpdateEpicDto {
  title?: string;
  description?: string;
  status?: EpicStatus;
  priority?: Priority;
  position?: number;
}

export interface CreateStoryDto {
  title: string;
  description?: string;
  epicId?: string;
  status?: StoryStatus;
  priority?: Priority;
  estimate?: number;
  confidence?: number;
  assigneeId?: string;
  acceptanceCriteria?: AcceptanceCriterion[];
  position?: number;
}

export interface UpdateStoryDto {
  title?: string;
  description?: string;
  epicId?: string | null;
  status?: StoryStatus;
  priority?: Priority;
  estimate?: number;
  confidence?: number;
  assigneeId?: string | null;
  acceptanceCriteria?: AcceptanceCriterion[];
  position?: number;
}

export interface CreateTaskDto {
  title: string;
  description?: string;
  storyId: string;
  status?: TaskStatus;
  estimate?: number;
  assigneeId?: string;
  position?: number;
}

export interface UpdateTaskDto {
  title?: string;
  description?: string;
  status?: TaskStatus;
  estimate?: number;
  assigneeId?: string | null;
  position?: number;
}

export interface CreateSprintDto {
  name: string;
  goal?: string;
  startDate: string;
  endDate: string;
  capacity?: Record<string, number>;
}

export interface UpdateSprintDto {
  name?: string;
  goal?: string;
  startDate?: string;
  endDate?: string;
  capacity?: Record<string, number>;
}

export interface GenerateBacklogDto {
  idea: string;
  preferences?: {
    maxEpics?: number;
    maxStoriesPerEpic?: number;
    includeEstimates?: boolean;
    includeTasks?: boolean;
  };
}

export interface PlanSprintDto {
  sprintId: string;
  teamCapacity?: number;
  preferences?: {
    priorityWeight?: number;
    includeInProgress?: boolean;
  };
}

export interface AnalyzeProjectDto {
  focus?: 'risks' | 'blockers' | 'velocity' | 'health' | 'all';
  sprintId?: string;
}

export interface SendChatMessageDto {
  message: string;
  context?: {
    entityType?: 'epic' | 'story' | 'task' | 'sprint';
    entityId?: string;
  };
}

// ============================================
// Response Types
// ============================================

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: Omit<User, 'preferences' | 'updatedAt'>;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
}

export interface ProjectListItem extends Project {
  role: ProjectRole;
  _count: {
    members: number;
    epics: number;
    stories: number;
  };
}

export interface ProjectDetails extends Project {
  members: ProjectMember[];
  _count: {
    epics: number;
    stories: number;
    tasks: number;
    sprints: number;
  };
}

export interface EpicWithCount extends Epic {
  _count: {
    stories: number;
  };
}

export interface StoryWithRelations extends Story {
  epic?: Pick<Epic, 'id' | 'title'>;
  assignee?: Pick<User, 'id' | 'name' | 'avatar'>;
  _count: {
    tasks: number;
  };
}

export interface TaskWithRelations extends Task {
  story?: Pick<Story, 'id' | 'title'>;
  assignee?: Pick<User, 'id' | 'name' | 'avatar'>;
}

export interface SprintWithItems extends Sprint {
  items: Array<SprintItem & {
    story: StoryWithRelations & {
      tasks: Task[];
    };
  }>;
}

export interface VelocityData {
  sprints: Array<{
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    committed: number;
    completed: number;
    velocity: number;
  }>;
  averageVelocity: number;
  trend: 'increasing' | 'stable' | 'decreasing';
}

export interface BurndownData {
  sprintId: string;
  sprintName: string;
  startDate: string;
  endDate: string;
  totalPoints: number;
  data: Array<{
    date: string;
    ideal: number;
    actual: number;
    completed: number;
  }>;
}

export interface SprintMetrics {
  sprintId: string;
  name: string;
  status: SprintStatus;
  commitment: { stories: number; points: number };
  completed: { stories: number; points: number };
  remaining: { stories: number; points: number };
  velocity: number;
  completionRate: number;
  scopeChange: number;
  averageCycleTime: number;
  taskMetrics: { total: number; completed: number; inProgress: number };
}

export interface ProjectSummary {
  totalEpics: number;
  totalStories: number;
  totalTasks: number;
  completedStories: number;
  completedTasks: number;
  totalStoryPoints: number;
  completedStoryPoints: number;
  activeSprintId: string | null;
  storiesByStatus: Record<StoryStatus, number>;
  tasksByStatus: Record<TaskStatus, number>;
}

export interface HealthSummary {
  healthScore: number;
  healthTrend: 'improving' | 'stable' | 'declining';
  insightCounts: { critical: number; warning: number; info: number };
  topRisks: Array<{ type: string; description: string; severity: string }>;
  recommendations: string[];
}

// ============================================
// WebSocket Event Types
// ============================================

export interface ProjectEvent {
  type: 'created' | 'updated' | 'deleted' | 'moved' | 'status_changed';
  entityType: 'epic' | 'story' | 'task' | 'sprint' | 'project';
  entityId: string;
  data: object;
  changes?: object;
  userId: string;
  timestamp: string;
}

export interface PresenceData {
  projectId: string;
  userId: string;
  status: 'active' | 'idle' | 'away';
  currentView?: string;
  currentEntity?: { type: string; id: string };
  timestamp: string;
}

export interface AIEvent {
  type: 'proposal_created' | 'analysis_complete' | 'insight_generated';
  projectId: string;
  data: object;
  timestamp: string;
}

// ============================================
// API Error Types
// ============================================

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, string>;
  correlationId?: string;
}

export interface ApiErrorResponse {
  error: ApiError;
}
```

---

## Quick Reference

### Role Permissions Matrix

| Action | OWNER | ADMIN | MEMBER | VIEWER |
|--------|:-----:|:-----:|:------:|:------:|
| View project | ✅ | ✅ | ✅ | ✅ |
| Edit project settings | ✅ | ✅ | ❌ | ❌ |
| Delete project | ✅ | ❌ | ❌ | ❌ |
| Archive/unarchive | ✅ | ✅ | ❌ | ❌ |
| Manage members | ✅ | ✅ | ❌ | ❌ |
| Create/edit epics | ✅ | ✅ | ✅ | ❌ |
| Create/edit stories | ✅ | ✅ | ✅ | ❌ |
| Create/edit tasks | ✅ | ✅ | ✅ | ❌ |
| Manage sprints | ✅ | ✅ | ✅ | ❌ |
| Apply AI proposals | ✅ | ✅ | ❌ | ❌ |
| Use AI chat | ✅ | ✅ | ✅ | ✅ |
| Generate backlog | ✅ | ✅ | ✅ | ❌ |

### Status Transitions

```
Story Status Flow:
BACKLOG → READY → IN_PROGRESS → REVIEW → DONE
    ↑_________|_________|_________|
    (can move back to any previous status)

Sprint Status Flow:
PLANNING → ACTIVE → COMPLETED
    ↑________|
    (cannot go back once completed)

Epic Status Flow:
DRAFT ↔ ACTIVE ↔ DONE
```

### Estimation Scales

```typescript
// Fibonacci (default)
const fibonacci = [1, 2, 3, 5, 8, 13, 21];

// Linear
const linear = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// T-Shirt
const tshirt = { XS: 1, S: 2, M: 3, L: 5, XL: 8 };
```

### API Rate Limits

| Endpoint | Limit |
|----------|-------|
| Authentication | 5 requests/minute |
| AI Endpoints | 10 requests/minute |
| Chat | 30 requests/minute |
| Other Endpoints | 100 requests/minute |

---

## Swagger Documentation

Interactive API documentation is available at:

```
Development: http://localhost:3000/api/docs
```

*Note: Swagger is disabled in production by default.*

---

## Support

For backend issues or questions:
- Check the [backend README](./backend/README.md)
- Review error codes in this document
- Check server logs for `correlationId`

---

**Document maintained by**: Backend Development Team  
**For frontend development use only**
