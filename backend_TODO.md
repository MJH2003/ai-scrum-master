# Backend Development Plan – AI Scrum Master

## Overview
This document outlines the complete backend development plan for the AI Scrum Master SaaS platform. The backend will be a production-ready, scalable API that supports AI-native agile project management for small software teams.

---

## Tech Stack Recommendation

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Runtime | Node.js (v20+) | Modern async, great ecosystem |
| Framework | NestJS | Enterprise-grade, modular, TypeScript-native |
| Database | PostgreSQL | ACID compliance, JSON support, mature |
| ORM | Prisma | Type-safe, migrations, excellent DX |
| Cache | Redis | Sessions, real-time, rate limiting |
| Queue | BullMQ (Redis) | Background jobs, AI task processing |
| Auth | JWT + OAuth 2.0 | Stateless, scalable |
| AI Integration | OpenAI API / Self-hosted LLM | RAG, structured outputs |
| Vector DB | pgvector / Qdrant | RAG embeddings for project context |
| Real-time | Socket.io / WebSockets | Board updates, notifications |
| Storage | S3-compatible | Attachments, exports |
| Testing | Jest + Supertest | Unit + E2E coverage |
| API Docs | OpenAPI/Swagger | Auto-generated documentation |

---

## Phase 1: Foundation & Infrastructure (Week 1)

### 1.1 Project Setup
- [ ] Initialize NestJS project with TypeScript strict mode
- [ ] Configure ESLint + Prettier with strict rules
- [ ] Set up Husky pre-commit hooks
- [ ] Configure environment variables (.env schema with validation)
- [ ] Docker Compose for local development (Postgres, Redis)
- [ ] Set up logging system (structured JSON logs, log levels)
- [ ] Configure error handling middleware (global exception filter)
- [ ] Health check endpoints (/health, /ready)

### 1.2 Database Setup
- [ ] Initialize Prisma with PostgreSQL
- [ ] Design and implement core schema (see Data Model section)
- [ ] Set up migration workflow
- [ ] Seed scripts for development data
- [ ] Database connection pooling configuration

### 1.3 Authentication & Authorization
- [ ] JWT authentication module
- [ ] Refresh token rotation strategy
- [ ] OAuth 2.0 integration (Google, GitHub)
- [ ] User registration with email verification
- [ ] Password reset flow
- [ ] Role-based access control (RBAC) foundation
- [ ] Project-scoped permissions middleware
- [ ] Rate limiting per user/IP

---

## Phase 2: Core Data Model & CRUD APIs (Week 1-2)

### 2.1 Data Model Design

```
User
├── id, email, name, avatar, passwordHash
├── createdAt, updatedAt
└── preferences (JSON)

Organization (future-proof)
├── id, name, slug
└── plan, createdAt

ProjectMember
├── userId, projectId
├── role (owner, admin, member, viewer)
└── joinedAt

Project
├── id, name, description, slug
├── organizationId (nullable for MVP)
├── settings (JSON)
├── createdAt, updatedAt, archivedAt
└── ownerId

Epic
├── id, projectId
├── title, description
├── status (draft, active, done)
├── priority, position
├── aiGenerated (boolean)
└── createdAt, updatedAt

Story
├── id, epicId, projectId
├── title, description
├── acceptanceCriteria (JSON array)
├── status (backlog, ready, in_progress, review, done)
├── priority, position
├── estimate, confidence (0-100)
├── assigneeId
├── aiGenerated, aiSuggestions (JSON)
└── createdAt, updatedAt

Task
├── id, storyId, projectId
├── title, description
├── status (todo, in_progress, done)
├── estimate, position
├── assigneeId
├── aiGenerated
└── createdAt, updatedAt

Sprint
├── id, projectId
├── name, goal
├── startDate, endDate
├── status (planning, active, completed)
├── capacity (JSON: per member)
└── createdAt, updatedAt

SprintItem
├── sprintId, storyId
├── addedAt, completedAt
└── originalEstimate, finalEstimate

Dependency
├── id, projectId
├── sourceType, sourceId
├── targetType, targetId
├── dependencyType (blocks, requires)
└── createdAt

EventLog (Audit Trail)
├── id, projectId
├── entityType, entityId
├── action (created, updated, deleted, moved)
├── changes (JSON diff)
├── userId
├── aiTriggered (boolean)
└── createdAt

AIProposal
├── id, projectId
├── agentType (backlog, sprint_planner, analyst)
├── proposalType
├── payload (JSON)
├── status (pending, applied, rejected, expired)
├── explanation, evidence (JSON)
├── createdBy (userId or 'system')
├── reviewedBy, reviewedAt
└── createdAt

ProjectInsight
├── id, projectId, sprintId (nullable)
├── insightType (velocity, risk, blocker, scope_creep)
├── severity (info, warning, critical)
├── title, description
├── linkedEntities (JSON)
├── aiExplanation
├── acknowledged
└── createdAt

ChatMessage
├── id, projectId
├── role (user, assistant, system)
├── content
├── context (JSON: what AI saw)
├── citations (JSON: entity references)
├── actions (JSON: suggested actions)
└── createdAt
```

### 2.2 API Endpoints - Core Entities

#### Users & Auth
- [ ] `POST /auth/register` - User registration
- [ ] `POST /auth/login` - Login with credentials
- [ ] `POST /auth/refresh` - Refresh access token
- [ ] `POST /auth/logout` - Invalidate refresh token
- [ ] `POST /auth/forgot-password` - Request password reset
- [ ] `POST /auth/reset-password` - Reset password with token
- [ ] `GET /auth/oauth/:provider` - OAuth initiation
- [ ] `GET /auth/oauth/:provider/callback` - OAuth callback
- [ ] `GET /users/me` - Current user profile
- [ ] `PATCH /users/me` - Update profile
- [ ] `DELETE /users/me` - Delete account

#### Projects
- [ ] `POST /projects` - Create project
- [ ] `GET /projects` - List user's projects
- [ ] `GET /projects/:id` - Get project details
- [ ] `PATCH /projects/:id` - Update project
- [ ] `DELETE /projects/:id` - Archive project
- [ ] `POST /projects/:id/members` - Invite member
- [ ] `DELETE /projects/:id/members/:userId` - Remove member
- [ ] `PATCH /projects/:id/members/:userId` - Update member role

#### Epics
- [ ] `POST /projects/:projectId/epics` - Create epic
- [ ] `GET /projects/:projectId/epics` - List epics
- [ ] `GET /projects/:projectId/epics/:id` - Get epic with stories
- [ ] `PATCH /projects/:projectId/epics/:id` - Update epic
- [ ] `DELETE /projects/:projectId/epics/:id` - Delete epic
- [ ] `PATCH /projects/:projectId/epics/reorder` - Reorder epics

#### Stories
- [ ] `POST /projects/:projectId/stories` - Create story
- [ ] `GET /projects/:projectId/stories` - List stories (filterable)
- [ ] `GET /projects/:projectId/stories/:id` - Get story with tasks
- [ ] `PATCH /projects/:projectId/stories/:id` - Update story
- [ ] `DELETE /projects/:projectId/stories/:id` - Delete story
- [ ] `PATCH /projects/:projectId/stories/:id/move` - Move to epic/status
- [ ] `PATCH /projects/:projectId/stories/reorder` - Bulk reorder

#### Tasks
- [ ] `POST /projects/:projectId/tasks` - Create task
- [ ] `GET /projects/:projectId/tasks` - List tasks (filterable)
- [ ] `PATCH /projects/:projectId/tasks/:id` - Update task
- [ ] `DELETE /projects/:projectId/tasks/:id` - Delete task
- [ ] `PATCH /projects/:projectId/tasks/:id/move` - Move status

#### Sprints
- [ ] `POST /projects/:projectId/sprints` - Create sprint
- [ ] `GET /projects/:projectId/sprints` - List sprints
- [ ] `GET /projects/:projectId/sprints/active` - Get active sprint
- [ ] `GET /projects/:projectId/sprints/:id` - Get sprint details
- [ ] `PATCH /projects/:projectId/sprints/:id` - Update sprint
- [ ] `POST /projects/:projectId/sprints/:id/start` - Start sprint
- [ ] `POST /projects/:projectId/sprints/:id/complete` - Complete sprint
- [ ] `POST /projects/:projectId/sprints/:id/items` - Add story to sprint
- [ ] `DELETE /projects/:projectId/sprints/:id/items/:storyId` - Remove from sprint

#### Dependencies
- [ ] `POST /projects/:projectId/dependencies` - Create dependency
- [ ] `GET /projects/:projectId/dependencies` - List dependencies
- [ ] `DELETE /projects/:projectId/dependencies/:id` - Remove dependency

---

## Phase 3: Event System & Real-time (Week 2)

### 3.1 Event Logging System
- [ ] Implement EventLog service
- [ ] Automatic change detection via Prisma middleware
- [ ] JSON diff generation for updates
- [ ] Event aggregation for bulk operations
- [ ] Event API endpoints:
  - [ ] `GET /projects/:projectId/events` - Activity feed (paginated)
  - [ ] `GET /projects/:projectId/entities/:type/:id/events` - Entity history

### 3.2 Real-time Updates (WebSocket)
- [ ] Socket.io gateway setup
- [ ] Authentication middleware for sockets
- [ ] Room management (project rooms)
- [ ] Event broadcasting on entity changes
- [ ] Presence tracking (who's viewing what)
- [ ] Optimistic update support (client sync)

---

## Phase 4: AI Integration Layer (Week 3-4)

### 4.1 AI Infrastructure
- [ ] AI service abstraction layer (provider-agnostic)
- [ ] LLM client wrapper (OpenAI, local LLM support)
- [ ] Token usage tracking and limits
- [ ] Retry logic with exponential backoff
- [ ] Streaming response support
- [ ] Cost tracking per project/user

### 4.2 RAG System (Project Context)
- [ ] Vector embedding service
- [ ] pgvector extension setup (or Qdrant integration)
- [ ] Document chunking strategy for project entities
- [ ] Embedding generation on entity create/update
- [ ] Context retrieval service
- [ ] Context window management (token limits)
- [ ] Relevance scoring and filtering

### 4.3 AI Agents

#### Spec-to-Backlog Agent
- [ ] Prompt engineering for idea parsing
- [ ] Structured output schema (epics, stories, tasks)
- [ ] Acceptance criteria generation
- [ ] Estimate inference
- [ ] Constraint awareness (team size, timeline)
- [ ] Endpoint: `POST /projects/:projectId/ai/generate-backlog`
  - Input: idea text, constraints
  - Output: AIProposal with structured backlog

#### Sprint Planner Agent
- [ ] Capacity calculation engine
- [ ] Story prioritization logic
- [ ] Risk-aware sprint composition
- [ ] Dependency conflict detection
- [ ] Endpoint: `POST /projects/:projectId/ai/plan-sprint`
  - Input: sprintId, preferences
  - Output: AIProposal with recommended stories

#### Project Analyst Agent
- [ ] Project state summarization
- [ ] Risk detection rules engine
- [ ] Blocker identification
- [ ] Scope creep detection
- [ ] Trend analysis (velocity, completion rate)
- [ ] Natural language explanation generation
- [ ] Endpoint: `POST /projects/:projectId/ai/analyze`
  - Output: Insights with explanations

### 4.4 AI Proposal System
- [ ] Proposal creation service
- [ ] Proposal preview (dry-run mode)
- [ ] Proposal application logic (atomic transactions)
- [ ] Proposal rejection handling
- [ ] Proposal expiration (auto-expire old proposals)
- [ ] Endpoints:
  - [ ] `GET /projects/:projectId/proposals` - List pending proposals
  - [ ] `GET /projects/:projectId/proposals/:id` - Get proposal details
  - [ ] `POST /projects/:projectId/proposals/:id/apply` - Apply proposal
  - [ ] `POST /projects/:projectId/proposals/:id/reject` - Reject proposal

### 4.5 Project Chat
- [ ] Chat history storage
- [ ] Context assembly service (RAG + current state)
- [ ] Intent detection (question vs action request)
- [ ] Action extraction from AI responses
- [ ] Citation linking to entities
- [ ] Streaming chat responses
- [ ] Endpoints:
  - [ ] `POST /projects/:projectId/chat` - Send message (streaming)
  - [ ] `GET /projects/:projectId/chat/history` - Get chat history
  - [ ] `POST /projects/:projectId/chat/actions/:actionId/execute` - Execute suggested action

---

## Phase 5: Analytics & Insights (Week 4-5)

### 5.1 Metrics Calculation Engine
- [ ] Burndown data calculation (daily snapshots)
- [ ] Velocity calculation (story points per sprint)
- [ ] Cycle time tracking
- [ ] Lead time tracking
- [ ] Throughput metrics
- [ ] Sprint commitment vs completion ratio

### 5.2 Scheduled Jobs (Background Workers)
- [ ] Daily burndown snapshot job
- [ ] Sprint auto-complete check
- [ ] AI insight generation job (daily/on-demand)
- [ ] Stale proposal cleanup
- [ ] Metrics aggregation job

### 5.3 Insights API
- [ ] `GET /projects/:projectId/insights` - List active insights
- [ ] `GET /projects/:projectId/insights/risks` - Risk register
- [ ] `GET /projects/:projectId/insights/blockers` - Blocker analysis
- [ ] `PATCH /projects/:projectId/insights/:id/acknowledge` - Acknowledge insight

### 5.4 Sprint Analytics API
- [ ] `GET /projects/:projectId/sprints/:id/burndown` - Burndown data
- [ ] `GET /projects/:projectId/sprints/:id/metrics` - Sprint metrics
- [ ] `GET /projects/:projectId/analytics/velocity` - Velocity trend
- [ ] `GET /projects/:projectId/analytics/summary` - Project summary

---

## Phase 6: Production Hardening (Week 5-6)

### 6.1 Security
- [ ] Input validation on all endpoints (class-validator)
- [ ] SQL injection prevention (Prisma handles)
- [ ] XSS prevention in stored content
- [ ] CORS configuration
- [ ] Helmet.js security headers
- [ ] API key support for integrations
- [ ] Audit logging for sensitive operations
- [ ] Data encryption at rest (sensitive fields)

### 6.2 Performance Optimization
- [ ] Database query optimization
- [ ] N+1 query prevention (Prisma includes)
- [ ] Response caching (Redis)
- [ ] Database indexing strategy
- [ ] Connection pooling tuning
- [ ] Pagination on all list endpoints
- [ ] API response compression

### 6.3 Reliability
- [ ] Circuit breaker for AI services
- [ ] Graceful degradation (AI failure handling)
- [ ] Transaction management
- [ ] Idempotency keys for critical operations
- [ ] Retry queues for failed jobs
- [ ] Database backup strategy

### 6.4 Observability
- [ ] Structured logging (correlation IDs)
- [ ] Metrics collection (Prometheus format)
- [ ] Distributed tracing (OpenTelemetry)
- [ ] Error tracking integration (Sentry)
- [ ] Performance monitoring
- [ ] AI latency tracking

### 6.5 API Documentation
- [ ] OpenAPI/Swagger specification
- [ ] Auto-generated from decorators
- [ ] Request/response examples
- [ ] Authentication documentation
- [ ] Error code documentation

---

## Phase 7: Testing & Quality (Ongoing)

### 7.1 Testing Strategy
- [ ] Unit tests for services (80%+ coverage target)
- [ ] Integration tests for API endpoints
- [ ] E2E tests for critical flows
- [ ] AI response mocking for deterministic tests
- [ ] Load testing (artillery/k6)
- [ ] Database migration tests

### 7.2 Critical Test Scenarios
- [ ] User registration and login flow
- [ ] Project creation and member management
- [ ] Full backlog generation flow
- [ ] Sprint planning and execution
- [ ] Real-time sync between clients
- [ ] AI proposal apply/reject
- [ ] Concurrent edit handling

---

## Phase 8: Deployment & DevOps

### 8.1 Infrastructure
- [ ] Dockerfile (multi-stage build)
- [ ] Docker Compose for full stack
- [ ] Kubernetes manifests (optional)
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Environment management (dev, staging, prod)
- [ ] Secrets management
- [ ] Database migration in CI/CD

### 8.2 Deployment Checklist
- [ ] SSL/TLS configuration
- [ ] Domain and DNS setup
- [ ] CDN for static assets (if any)
- [ ] Database hosted service (e.g., Neon, Supabase, RDS)
- [ ] Redis hosted service
- [ ] Monitoring dashboards
- [ ] Alerting rules
- [ ] Backup verification

---

## API Design Principles

1. **RESTful conventions** with resource-based URLs
2. **Consistent error format**: `{ error: { code, message, details } }`
3. **Pagination**: Cursor-based for large lists
4. **Filtering**: Query params with clear naming
5. **Sorting**: `?sort=field:asc|desc`
6. **Partial updates**: PATCH with sparse objects
7. **Bulk operations**: Where it makes sense (reorder, move)
8. **Idempotency**: POST operations with idempotency keys
9. **Versioning**: URL prefix `/api/v1/` (future-proof)

---

## Non-Functional Requirements Checklist

| Requirement | Target | Implementation |
|-------------|--------|----------------|
| Board API latency | < 200ms | Caching, query optimization |
| AI response start | < 2s | Streaming, queue priority |
| Concurrent users | 10 per project | WebSocket rooms, optimistic locking |
| Entity limit | ~2000 per project | Pagination, lazy loading |
| Uptime | 99.9% | Health checks, redundancy |
| Data retention | Configurable | Soft deletes, archival |

---

## Risk Mitigation

| Risk | Backend Mitigation |
|------|-------------------|
| AI hallucinations | RAG with verified project data, confidence scores |
| Over-automation | Proposal system with explicit apply actions |
| Data loss | Event sourcing pattern, soft deletes, backups |
| Performance degradation | Query monitoring, caching, background jobs |
| Security breach | Auth best practices, audit logs, encryption |

---

## Definition of Done (Backend MVP)

The backend MVP is complete when:

1. ✅ User can register, login, and manage profile
2. ✅ User can create projects and invite members
3. ✅ Full CRUD for epics, stories, tasks with proper permissions
4. ✅ Sprint creation, planning, and tracking works
5. ✅ AI can generate backlog from idea input
6. ✅ AI can propose sprint composition
7. ✅ AI can analyze project and generate insights
8. ✅ Chat with project context works
9. ✅ Real-time updates sync across clients
10. ✅ Burndown and velocity metrics calculate correctly
11. ✅ All APIs documented in Swagger
12. ✅ Core flows have integration tests
13. ✅ Deployed to staging environment

---

## Estimated Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Foundation | 5 days | None |
| Phase 2: Core APIs | 5 days | Phase 1 |
| Phase 3: Events & Real-time | 3 days | Phase 2 |
| Phase 4: AI Integration | 7 days | Phase 2 |
| Phase 5: Analytics | 4 days | Phase 3, 4 |
| Phase 6: Hardening | 4 days | Phase 5 |
| Phase 7: Testing | Ongoing | All phases |
| Phase 8: Deployment | 2 days | Phase 6 |

**Total: ~30 working days (6 weeks)**

---

## Next Steps

1. Review and approve this plan
2. Set up development environment
3. Initialize project with Phase 1 tasks
4. Begin iterative development with weekly checkpoints

---

**Document Version**: 1.0  
**Last Updated**: 2026-01-21  
**Author**: Backend Development Team
