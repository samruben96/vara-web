# Vara - Digital Safety Platform for Women

## Project Overview

Vara is a comprehensive digital safety platform designed specifically for women, providing real-time protection from online harassment, stalking, impersonation, image misuse, deepfakes, and privacy leaks.

### Mission
Create the first comprehensive safety layer built around women's unique digital vulnerabilities, empowering women to take control of their online presence with confidence.

### Target Users
- Women ages 18-44, digitally active
- High-risk profiles: creators, journalists, women exiting relationships, dating app users, college-aged women

---

## Architecture

### Monorepo Structure
```
vara-web/
├── apps/
│   ├── web/                 # React web application (Vite)
│   └── api/                 # Fastify API server
├── packages/
│   ├── shared/              # Shared types, utilities, constants
│   ├── ui/                  # Shared UI components (future)
│   └── config/              # Shared configs (future)
├── prisma/                  # Database schema and migrations
├── turbo.json               # Turborepo configuration
├── pnpm-workspace.yaml      # pnpm workspace configuration
└── package.json             # Root package.json
```

### Tech Stack

#### Frontend (apps/web)
- **Framework**: React 18+ with TypeScript (strict mode)
- **Build Tool**: Vite
- **Routing**: React Router v6
- **State Management**: Zustand (client state), TanStack Query (server state)
- **Styling**: Tailwind CSS + shadcn/ui components
- **Forms**: React Hook Form + Zod validation
- **Future**: React Native migration planned - architecture decisions prioritize code sharing

#### Backend (apps/api)
- **Runtime**: Node.js 20+
- **Framework**: Fastify with TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Vector Search**: pgvector extension for image embeddings
- **Auth**: Supabase Auth (supports OAuth for Instagram, TikTok, Facebook)
- **Storage**: Supabase Storage for photo uploads
- **Queue**: BullMQ + Redis for background scanning jobs

#### AI/ML Integrations
- **Image Embeddings**: OpenAI CLIP
- **Deepfake Detection**: Third-party API (TBD)
- **Reverse Image Search**: TinEye, Google Vision APIs
- **Breach Detection**: Have I Been Pwned API

#### Infrastructure
- **Frontend Hosting**: Vercel
- **Backend Hosting**: Render
- **CI/CD**: GitHub Actions
- **Database**: Supabase (PostgreSQL)

---

## Production Deployment

### Live URLs

| Service | URL | Platform |
|---------|-----|----------|
| **Frontend** | https://vara-web-eta.vercel.app | Vercel |
| **Backend API** | https://vara-api-yaqq.onrender.com | Render |
| **Database** | PostgreSQL via Supabase | Supabase |

### Vercel Configuration (Frontend)

**Project:** `vara-web` in `samruben96s-projects`

**Environment Variables (Production & Preview):**

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://vara-api-yaqq.onrender.com` |
| `VITE_SUPABASE_URL` | `https://vgwkptzwvoxtfaxmeuqn.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key |

**Build Configuration (vercel.json):**
- Build Command: `pnpm turbo build --filter=@vara/web`
- Output Directory: `apps/web/dist`
- Install Command: `pnpm install`
- Framework: Vite

**Deployment:**
```bash
# Deploy to production
vercel --prod

# Check deployment status
vercel ls

# View environment variables
vercel env ls
```

### Render Configuration (Backend API)

**Service:** `vara-api` (Web Service)

**Environment Variables:**

| Variable | Value | Notes |
|----------|-------|-------|
| `NODE_ENV` | `production` | |
| `PORT` | `4000` | Or let Render set automatically |
| `WEB_URL` | `https://vara-web-eta.vercel.app` | **Critical for CORS** - must match frontend URL exactly, no trailing slash |
| `DATABASE_URL` | Supabase pooler connection string | Use `?pgbouncer=true` for connection pooling |
| `SUPABASE_URL` | `https://vgwkptzwvoxtfaxmeuqn.supabase.co` | |
| `SUPABASE_SERVICE_KEY` | Supabase service role key | Keep secret! |
| `SUPABASE_JWT_SECRET` | Supabase JWT secret | Keep secret! |
| `OPENAI_API_KEY` | OpenAI API key | For CLIP embeddings |
| `GOOGLE_VISION_API_KEY` | Google Cloud API key | For reverse image search |

**Build & Start Commands:**
- Build: `pnpm install && pnpm build --filter=@vara/api`
- Start: `node apps/api/dist/index.js`

### Supabase Configuration

**Project:** `vgwkptzwvoxtfaxmeuqn`

**Services Used:**
- PostgreSQL database (with pgvector extension)
- Authentication (email/password + OAuth providers)
- Storage (for protected images)

**Connection Strings:**
- Pooler (for API): Use port `6543` with `?pgbouncer=true`
- Direct (for migrations): Use port `5432`

### Deployment Checklist

When deploying changes:

1. **Frontend changes only:**
   - Push to `main` branch (auto-deploys via Vercel GitHub integration)
   - Or run `vercel --prod` manually

2. **Backend changes only:**
   - Push to `main` branch (auto-deploys via Render GitHub integration)
   - Or trigger manual deploy in Render dashboard

3. **Database schema changes:**
   ```bash
   # Generate migration
   pnpm db:migrate:dev --name <migration_name>

   # Apply to production (run from local with production DATABASE_URL)
   DATABASE_URL="<production_url>" pnpm db:migrate:deploy
   ```

4. **Environment variable changes:**
   - Vercel: `vercel env add <NAME> production`
   - Render: Update in dashboard → Environment → Redeploy

### Troubleshooting

#### CORS Errors
If you see CORS errors in the browser console:
1. Check `WEB_URL` on Render matches the exact frontend URL
2. Ensure no trailing slash on `WEB_URL`
3. Redeploy backend after changing `WEB_URL`

**Verify CORS:**
```bash
curl -I -X OPTIONS https://vara-api-yaqq.onrender.com/api/v1/auth/login \
  -H "Origin: https://vara-web-eta.vercel.app" \
  -H "Access-Control-Request-Method: POST"
# Should return: access-control-allow-origin: https://vara-web-eta.vercel.app
```

#### API Connection Issues
1. Verify `VITE_API_URL` on Vercel points to correct Render URL
2. Check Render service is running (not sleeping on free tier)
3. Test API directly: `curl https://vara-api-yaqq.onrender.com/api/v1/auth/login`

#### Authentication Failures
1. Verify Supabase keys match between frontend (anon) and backend (service role)
2. Check `SUPABASE_JWT_SECRET` is set correctly on Render
3. Ensure Supabase project URL is consistent across all configs

---

## Core Features (MVP - V1)

### 1. Onboarding Assessment
8-12 question emotionally intelligent quiz that:
- Identifies exposure level and specific risks
- Uses branching logic based on responses
- Generates personalized Protection Plan
- Sets emotional tone for the platform (supportive, not alarming)

### 2. Identity & Exposure Mapping
Baseline understanding of user's digital footprint:
- Email and phone number exposure
- Public profile information across platforms
- Image variations (user-uploaded reference photos)
- Username/handle matches across platforms
- Known data breaches (via HIBP)

### 3. AI Image Misuse & Impersonation Detection
- Unauthorized photo use detection
- Fake profile detection across platforms
- Deepfake detection
- Continuous image replication tracking across the web

### 4. Behavioral Risk Monitoring
- Follower surge detection
- Suspicious account identification
- Pattern change analysis
- Cross-platform correlation

### 5. Alerts & Recommendations
Calm, clear, non-technical alerts including:
- What happened (plain language)
- What it means for the user
- Severity level (visual indicator)
- Recommended next steps
- Escalation options (legal, platform reporting, etc.)

### 6. Personalized Protection Plan
Dynamic plan that evolves based on:
- Initial risk profile
- Observed threats over time
- User's safety goals
- Actions taken

---

## Design Philosophy

### Core Principles

1. **Emotional Clarity, Not Panic**
   - Calm, supportive tone throughout
   - Never alarmist, always actionable
   - Use color and visual hierarchy for severity, not scary language

2. **Privacy-First**
   - No selling or sharing user data, ever
   - All scanning is opt-in with transparent permissions
   - Users control what we monitor and store
   - Clear data retention and deletion policies

3. **Non-Technical Accessibility**
   - No cybersecurity jargon
   - Plain language explanations
   - Visual indicators over text where possible
   - Guided flows, not configuration screens

4. **Holistic Protection**
   - Single dashboard for complete digital safety view
   - Connected threats shown in context
   - Progress tracking and safety score evolution

### UI/UX Guidelines

- **Color Palette**: Calming, empowering colors (no red for errors, use softer alternatives)
- **Typography**: Clean, readable, accessible
- **Spacing**: Generous whitespace, not cramped
- **Animations**: Subtle, purposeful, never distracting
- **Empty States**: Encouraging, not lonely
- **Loading States**: Reassuring progress indicators

---

## Data Models

### Core Entities

```
User
├── id (uuid)
├── email
├── emailVerified
├── passwordHash (nullable - for social auth)
├── createdAt
├── updatedAt
└── profile → UserProfile

UserProfile
├── id (uuid)
├── userId (FK)
├── displayName
├── riskLevel (enum: LOW, MEDIUM, HIGH, CRITICAL)
├── onboardingCompleted
├── protectionPlanId (FK)
└── createdAt

OnboardingResponse
├── id (uuid)
├── userId (FK)
├── questionId
├── response (JSON)
├── createdAt

ConnectedAccount
├── id (uuid)
├── userId (FK)
├── platform (enum: INSTAGRAM, TIKTOK, FACEBOOK, etc.)
├── platformUserId
├── accessToken (encrypted)
├── refreshToken (encrypted)
├── tokenExpiry
├── permissions (JSON)
├── lastSynced
├── createdAt

ProtectedImage
├── id (uuid)
├── userId (FK)
├── storageUrl
├── embedding (vector[512])
├── hash (perceptual hash)
├── uploadedAt
├── lastScanned
├── status (enum: ACTIVE, ARCHIVED)

ImageMatch
├── id (uuid)
├── protectedImageId (FK)
├── sourceUrl
├── platform
├── similarity (float)
├── matchType (enum: EXACT, SIMILAR, MODIFIED, DEEPFAKE)
├── detectedAt
├── status (enum: NEW, REVIEWED, ACTIONED, DISMISSED)

Alert
├── id (uuid)
├── userId (FK)
├── type (enum: IMAGE_MISUSE, FAKE_PROFILE, DATA_BREACH, etc.)
├── severity (enum: INFO, LOW, MEDIUM, HIGH, CRITICAL)
├── title
├── description
├── metadata (JSON)
├── status (enum: NEW, VIEWED, ACTIONED, DISMISSED)
├── createdAt
├── viewedAt
├── actionedAt

ProtectionPlan
├── id (uuid)
├── userId (FK)
├── items → ProtectionPlanItem[]
├── generatedAt
├── lastUpdated

ProtectionPlanItem
├── id (uuid)
├── planId (FK)
├── category
├── title
├── description
├── priority
├── status (enum: PENDING, IN_PROGRESS, COMPLETED, SKIPPED)
├── dueDate (nullable)

ScanJob
├── id (uuid)
├── userId (FK)
├── type (enum: IMAGE_SCAN, PROFILE_SCAN, BREACH_CHECK, etc.)
├── status (enum: PENDING, RUNNING, COMPLETED, FAILED)
├── startedAt
├── completedAt
├── result (JSON)
├── errorMessage (nullable)
```

---

## API Design

### Endpoint Structure
```
/api/v1/
├── auth/
│   ├── POST /signup
│   ├── POST /login
│   ├── POST /logout
│   ├── POST /refresh
│   ├── POST /forgot-password
│   └── POST /reset-password
├── users/
│   ├── GET /me
│   ├── PATCH /me
│   └── DELETE /me
├── onboarding/
│   ├── GET /questions
│   ├── POST /responses
│   └── GET /results
├── accounts/
│   ├── GET /
│   ├── POST /connect/:platform
│   ├── DELETE /:id
│   └── POST /:id/sync
├── images/
│   ├── GET /
│   ├── POST /upload
│   ├── DELETE /:id
│   └── GET /:id/matches
├── alerts/
│   ├── GET /
│   ├── GET /:id
│   ├── PATCH /:id/status
│   └── POST /:id/action
├── protection-plan/
│   ├── GET /
│   ├── PATCH /items/:id
│   └── POST /regenerate
└── scans/
    ├── GET /
    ├── POST /trigger
    └── GET /:id/status
```

### Response Format
```typescript
// Success
{
  data: T,
  meta?: {
    pagination?: { page, limit, total, totalPages }
  }
}

// Error
{
  error: {
    code: string,      // e.g., "AUTH_INVALID_TOKEN"
    message: string,   // Human-readable message
    details?: any      // Additional context
  }
}
```

### HTTP Status Codes
- `200` - Success
- `201` - Created
- `204` - No Content (successful deletion)
- `400` - Bad Request (validation error)
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `422` - Unprocessable Entity
- `429` - Rate Limited
- `500` - Internal Server Error

---

## Coding Standards

### TypeScript
- **Strict mode**: Always enabled
- **No `any`**: Use `unknown` with type guards instead
- **Interfaces vs Types**: Interfaces for object shapes, types for unions/primitives
- **Zod**: Runtime validation matching TypeScript types
- **Explicit return types**: On all exported functions

```typescript
// Good
interface User {
  id: string;
  email: string;
  profile: UserProfile | null;
}

type AlertSeverity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

// Bad
const user: any = await getUser();
```

### React Patterns
- **Functional components only**: No class components
- **Custom hooks**: Extract reusable logic into hooks
- **Co-location**: Components with their tests and styles
- **Server state**: TanStack Query for all API data
- **Client state**: Zustand for UI-only state
- **Forms**: React Hook Form + Zod schemas

```typescript
// Component structure
components/
├── Button/
│   ├── Button.tsx
│   ├── Button.test.tsx
│   └── index.ts
```

### File Naming
- **Components**: PascalCase (`AlertCard.tsx`)
- **Hooks**: camelCase with `use` prefix (`useAlerts.ts`)
- **Utilities**: camelCase (`formatDate.ts`)
- **Types**: PascalCase (`Alert.ts` or inline)
- **Constants**: SCREAMING_SNAKE_CASE in camelCase files

### Import Order
```typescript
// 1. React/external libraries
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

// 2. Internal packages
import { Alert } from '@vara/shared';

// 3. Local imports
import { AlertCard } from './AlertCard';
import { useAlerts } from '../hooks/useAlerts';

// 4. Types (if separate)
import type { AlertProps } from './types';
```

### Git Workflow
- **Branch naming**: `feature/`, `fix/`, `chore/`, `docs/`
- **Commits**: Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`)
- **PRs**: One feature/fix per branch, squash merge to main

```
feat: add image upload functionality
fix: resolve auth token refresh race condition
chore: update dependencies
docs: add API documentation
```

---

## Security Requirements (Critical)

### Data Protection
- All sensitive data encrypted at rest (AES-256)
- OAuth tokens encrypted before database storage
- Images stored with non-guessable URLs (UUID-based)
- PII handled according to GDPR/CCPA requirements

### API Security
- Rate limiting on all endpoints
- Input sanitization on all user input
- Parameterized queries (Prisma handles this)
- CORS properly configured (whitelist origins)
- CSP headers set
- HTTPS only

### Authentication
- Secure session management via Supabase
- JWT tokens with appropriate expiry
- Refresh token rotation
- OAuth state parameter validation

### Image Security
- Virus scanning on upload
- File type validation (magic bytes, not just extension)
- Size limits enforced
- No direct public URLs to original images

---

## Testing Strategy

### Unit Tests (Jest)
- Business logic functions
- Utility functions
- Custom hooks (with @testing-library/react-hooks)

### Component Tests (React Testing Library)
- User interactions
- Accessibility
- Edge cases (loading, error, empty states)

### Integration Tests (Jest + Supertest)
- API endpoint testing
- Database operations
- Auth flows

### E2E Tests (Playwright)
- Critical user flows:
  - Sign up → Onboarding → Dashboard
  - Image upload → Scan → Alert view
  - Social account connection
  - Alert response flow

### Coverage Targets
- Unit: 80%+
- Integration: 70%+
- E2E: Critical paths covered

---

## Environment Variables

### Web (apps/web)
```env
VITE_API_URL=
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

### API (apps/api)
```env
# Server
PORT=
NODE_ENV=
API_URL=
WEB_URL=

# Database
DATABASE_URL=

# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
SUPABASE_JWT_SECRET=

# Redis
REDIS_URL=

# External APIs
OPENAI_API_KEY=
TINEYE_API_KEY=
GOOGLE_VISION_API_KEY=
HIBP_API_KEY=

# OAuth (via Supabase, but may need for direct API calls)
INSTAGRAM_CLIENT_ID=
INSTAGRAM_CLIENT_SECRET=
TIKTOK_CLIENT_ID=
TIKTOK_CLIENT_SECRET=
FACEBOOK_CLIENT_ID=
FACEBOOK_CLIENT_SECRET=
```

---

## Development Workflow

### Getting Started
```bash
# Install dependencies
pnpm install

# Set up environment variables
cp apps/web/.env.example apps/web/.env.local
cp apps/api/.env.example apps/api/.env

# Start database (if local)
docker-compose up -d

# Run migrations
pnpm db:migrate

# Start development
pnpm dev
```

### Common Commands
```bash
pnpm dev          # Start all apps in development
pnpm build        # Build all apps
pnpm test         # Run all tests
pnpm lint         # Lint all packages
pnpm typecheck    # TypeScript check all packages
pnpm db:migrate   # Run Prisma migrations
pnpm db:studio    # Open Prisma Studio
pnpm db:seed      # Seed database
```

---

## Key User Flows

### Flow 1: Onboarding
```
1. User signs up (email/password or social OAuth)
2. Welcome screen with platform introduction
3. Onboarding assessment quiz (8-12 questions, branching logic)
4. Processing animation while Protection Plan generates
5. Results screen with risk summary
6. Dashboard populated with initial recommendations
```

### Flow 2: Connect Social Accounts
```
1. User navigates to Settings > Connected Accounts
2. Selects platform to connect
3. OAuth flow with transparent permission explanation
4. Success confirmation
5. Initial scan triggers automatically
6. Behavioral baseline established over 7 days
```

### Flow 3: Photo Upload & Protection
```
1. User navigates to Protected Images
2. Uploads photos (drag & drop or file picker)
3. Processing indicator while:
   - Image validated and virus scanned
   - CLIP embedding generated
   - Perceptual hash computed
   - Stored securely
4. Confirmation with "Protection Active" status
5. Initial scan queued
6. User notified when scan completes
```

### Flow 4: Alert & Response
```
1. System detects potential threat
2. Alert created with appropriate severity
3. User sees notification (in-app, email based on preferences)
4. Alert detail view shows:
   - What was detected (with visual if applicable)
   - Plain language explanation
   - Severity indicator
   - Recommended actions
5. User selects action (dismiss, report, escalate)
6. Action logged, status updated
7. Protection Plan updates if relevant
```

---

## Claude Code Subagent System (MANDATORY)

This project leverages Claude Code's powerful subagent system for efficient development. **Always prefer using specialized subagents over manual file searching and reading.**

### Slash Commands

| Command | Description | Example |
|---------|-------------|---------|
| `/swarm <task>` | Decompose a complex task and run multiple agents in parallel | `/swarm Add user notifications with database, API, and UI` |
| `/swarm --dry-run <task>` | Preview execution plan without running agents | `/swarm --dry-run Refactor auth system` |
| `/swarm --fast <task>` | Use haiku model for simple subtasks (reduces tokens) | `/swarm --fast Add health check endpoint` |
| `/swarm --focus=N <task>` | Run only phase N of the execution plan | `/swarm --focus=2 Add image upload` |
| `/swarm --no-mcp <task>` | Disable MCP tools (agents only) | `/swarm --no-mcp Simple code refactor` |

The `/swarm` command automatically:
1. Analyzes and decomposes your task into subtasks
2. Selects the optimal agent for each subtask (with color-coded indicators)
3. Estimates token usage per agent and total
4. Identifies dependencies and parallelization opportunities
5. Executes agents in parallel phases for maximum efficiency
6. Tracks timing, success rates, and files changed per agent
7. Handles failures with automatic retry for critical agents
8. Synthesizes results into a unified output with comprehensive statistics

**Features:**
- **Agent Colors**: Each agent has a unique color indicator (🟡 backend, 🔴 frontend, 🟢 test, etc.)
- **MCP Integration**: Automatically uses available MCP tools (context7, serena, playwright, etc.)
- **Token Estimates**: See estimated token usage before and after execution
- **Dry Run Mode**: Preview the plan before executing with `--dry-run`
- **Fast Mode**: Use `--fast` to reduce token usage on simple subtasks
- **Phase Focus**: Run specific phases with `--focus=N`
- **Error Recovery**: Automatic retry for critical failures
- **Time Tracking**: Duration for each agent, phase, and total execution
- **Parallel Efficiency**: See how much time is saved vs sequential execution
- **File Metrics**: Lines added/removed per agent and total

**MCP Tools Used by Swarm:**
| MCP | Color | Use For |
|-----|-------|---------|
| 🔷 **context7** | Blue Diamond | Library documentation (React, Fastify, Prisma) |
| 🔶 **serena** | Orange Diamond | Symbolic code navigation and editing |
| 🟤 **morph-mcp** | Brown | Smart file editing and codebase search |
| 🟢 **playwright** | Green | Browser automation and E2E testing |
| 🔵 **chrome-devtools** | Blue | Frontend debugging and performance |
| 🟣 **sequential-thinking** | Purple | Complex multi-step reasoning |

**Use `/swarm` for any task that spans multiple domains or would benefit from multiple specialist agents working together.**

### Why Use Subagents?

Subagents provide:
- **Parallel execution** - Multiple agents can work simultaneously
- **Domain expertise** - Each agent is optimized for specific tasks
- **Reduced context usage** - Agents handle their own context management
- **Better results** - Specialized agents produce higher quality output

### Complete Agent Reference

#### Exploration & Research Agents

| Agent | Use When | Example Prompts |
|-------|----------|-----------------|
| **Explore** | Finding files, understanding code, researching the codebase | "Find all authentication-related files", "How does the image scanning workflow work?" |
| **general-purpose** | Complex multi-step research, autonomous investigation | "Investigate why the scan queue is failing and propose solutions" |

**Explore Agent Thoroughness Levels:**
- `quick` - Basic file/pattern search
- `medium` - Moderate exploration with some context
- `very thorough` - Comprehensive analysis across multiple locations

#### Planning Agent

| Agent | Use When | Example Prompts |
|-------|----------|-----------------|
| **Plan** | Before implementing any non-trivial feature | "Design the implementation approach for adding deepfake detection" |

**Always use Plan before:**
- New feature implementation
- Major refactoring
- Architectural changes
- Multi-file modifications

#### Domain Specialist Agents

| Agent | Domain | Use For |
|-------|--------|---------|
| **backend-developer** | Server-side | APIs, Fastify routes, authentication, middleware, background jobs, integrations |
| **frontend-developer** | Client-side | React components, hooks, pages, forms, state management, UI logic |
| **react-specialist** | React 18+ | Hooks, state management, Server Components, performance optimization, concurrent features |
| **ui-designer** | Visual Design | Component styling, accessibility, design systems, responsive layouts, dark mode |
| **mobile-developer** | Mobile | React Native, Flutter, native modules, mobile-specific optimizations, app store prep |
| **postgres-pro** | PostgreSQL DBA | Performance tuning, replication, backup/recovery, EXPLAIN analysis, index design |
| **microservices-architect** | Distributed Systems | Service boundaries, communication patterns (REST/gRPC/messaging), service mesh, container orchestration, resilience patterns |
| **security-engineer** | Security | Security audits, OAuth flows, encryption, OWASP compliance, PII handling, vulnerability assessment |
| **ai-ml-engineer** | AI/ML | Image embeddings (CLIP), vector search (pgvector), deepfake detection, similarity matching, ML pipelines |
| **test-engineer** | Testing | Unit tests (Jest), integration tests, E2E tests (Playwright), coverage analysis, test strategy |
| **devops-engineer** | DevOps | CI/CD (GitHub Actions), Docker, deployment automation, monitoring, Vercel/Render configuration |

#### Code Quality Agents

| Agent | Use When | Example |
|-------|----------|---------|
| **code-reviewer** | After writing significant code | Review authentication implementation for security issues |

#### Orchestration Agents

| Agent | Use When | How It Helps |
|-------|----------|--------------|
| **agent-organizer** | Complex tasks requiring 3+ agents | Decomposes tasks, selects optimal agents, designs workflows |

#### System & Utility Agents

| Agent | Use When | Example |
|-------|----------|---------|
| **Bash** | Git operations, command execution, terminal tasks | "Run git status", "Execute npm install" |
| **claude-code-guide** | Questions about Claude Code CLI, Agent SDK, or Claude API | "How do I configure hooks?", "How do I use the Anthropic SDK?" |

### Agent Details

#### security-engineer
Essential for Vara's sensitive data handling:
- OAuth token security and encryption
- Image upload validation and virus scanning
- PII protection (GDPR/CCPA compliance)
- OWASP Top 10 vulnerability checks
- Authentication flow security audits
- Secure session management
- Input sanitization and validation

#### ai-ml-engineer
Core to Vara's image protection features:
- CLIP embedding generation and optimization
- pgvector similarity search configuration
- Deepfake detection API integration
- Reverse image search (TinEye, Google Vision)
- Perceptual hashing for duplicate detection
- Batch processing and ML pipeline design
- Similarity threshold tuning

#### test-engineer
Comprehensive testing coverage:
- Unit tests with Jest for business logic
- React Testing Library for components
- Supertest for API integration tests
- Playwright for E2E critical paths
- Test factories and mock utilities
- Coverage analysis and reporting

#### devops-engineer
Deployment and infrastructure:
- GitHub Actions CI/CD pipelines
- Docker multi-stage builds
- Vercel frontend deployment
- Render backend deployment
- Health checks and monitoring
- Environment variable management
- Secret rotation procedures

#### microservices-architect
Use this agent when designing, implementing, or evolving distributed microservices architectures:
- Service boundary definition and decomposition
- Communication patterns (REST/gRPC/messaging)
- Service mesh configuration (Istio/Linkerd)
- Container orchestration (Kubernetes)
- Resilience patterns (circuit breakers, retries, fallbacks)
- Data management strategies across services
- Observability and monitoring setup

#### react-specialist
Use for advanced React 18+ work including:
- Hooks implementation and optimization
- State management (Redux, Zustand, Jotai, Context API)
- Performance optimization (memoization, virtualization)
- Server-side rendering (Next.js, Remix)
- Server Components and concurrent features
- Testing with React Testing Library

#### postgres-pro
Use for PostgreSQL-specific database work:
- Query performance tuning and EXPLAIN analysis
- Replication setup and high availability
- Backup and recovery strategies
- Vacuum and maintenance operations
- Configuration tuning
- Partitioning strategies
- JSONB optimization

### The Agent Organizer (Your Secret Weapon)

The **agent-organizer** is essential for complex, multi-domain tasks. Use it when:

- A task spans frontend, backend, AND database
- You're unsure which agents to use
- Work needs to be coordinated across multiple specialists
- Dependencies between subtasks need management

**Example Usage:**
```
Task: "Build a real-time notification system for image scan results"

Agent Organizer will:
1. Decompose into subtasks (WebSocket setup, UI components, database triggers)
2. Identify required agents (backend-developer, frontend-developer, postgres-pro)
3. Define execution order and dependencies
4. Coordinate handoffs between agents
```

### Trigger Keywords → Required Agents

| User Says | Launch This Agent |
|-----------|-------------------|
| "find", "search", "where is", "locate" | **Explore** |
| "how does X work", "explain", "understand" | **Explore** |
| "implement", "add feature", "build", "create" | **Plan** first |
| "fix bug", "debug", "error", "not working" | **Explore** first |
| "refactor", "improve", "optimize" | **Plan** first |
| "database", "migration", "SQL", "schema" | **postgres-pro** |
| "component", "UI", "React", "hook", "page" | **frontend-developer** |
| "API", "endpoint", "auth", "backend" | **backend-developer** |
| "design", "accessibility", "visual", "layout" | **ui-designer** |
| "microservices", "service mesh", "kubernetes" | **microservices-architect** |
| "security", "vulnerability", "encryption", "OAuth" | **security-engineer** |
| "embedding", "CLIP", "vector", "similarity", "ML" | **ai-ml-engineer** |
| "test", "coverage", "Jest", "Playwright" | **test-engineer** |
| "deploy", "CI/CD", "Docker", "pipeline" | **devops-engineer** |
| "how do I use Claude Code", "hooks", "SDK" | **claude-code-guide** |
| complex multi-domain task | **agent-organizer** or **/swarm** |

### Best Practices

#### 1. Evaluate Before Acting
```
ALWAYS: Check if a subagent applies before manual grep/glob/read
NEVER: Jump straight into manual file searching
```

#### 2. Launch Agents in Parallel
When tasks are independent, launch ALL applicable agents in a single message:
```
CORRECT: One message with 3 Task tool calls (parallel)
WRONG: Three separate messages with sequential calls
```

#### 3. Be Specific in Prompts
Every agent prompt should include:
- Clear objective
- Scope boundaries (which directories/files)
- Expected output format
- Thoroughness level (for Explore)

#### 4. Trust Agent Results
Agent outputs are reliable. Synthesize and present findings without re-doing their work.

### Common Patterns for Vara

#### Understanding the Codebase
```
-> Explore (very thorough): "Map out the image scanning workflow from upload to alert generation"
```

#### Implementing a New Feature
```
1. Explore: "Find similar existing features or patterns"
2. Plan: "Design implementation approach"
3. Review plan with user
4. frontend-developer / backend-developer: Implement
5. code-reviewer: Review implementation
```

#### Fixing a Bug
```
1. Explore: "Find all code related to [feature/error]"
2. Analyze findings
3. Implement fix
4. Test
```

#### Database Changes
```
-> postgres-pro: "Design migration for adding scan priority field with index optimization"
```

#### Full-Stack Feature
```
-> agent-organizer: "Coordinate implementation of user notification preferences"
   - Decomposes into: API endpoints, React components, database schema
   - Assigns: backend-developer, frontend-developer, postgres-pro
   - Manages: execution order and dependencies
```

### Anti-Patterns (Avoid These)

| Don't Do This | Do This Instead |
|---------------|-----------------|
| Manual grep for "where is auth?" | Use Explore agent |
| Start coding without a plan | Use Plan agent first |
| Sequential single-agent calls | Parallel multi-agent calls |
| Re-verify agent findings manually | Trust and synthesize results |
| Use agents for trivial tasks | Read known single files directly |

### Domain Responsibilities in Vara

| Domain | Primary Agent | Scope |
|--------|---------------|-------|
| Frontend | frontend-developer | `apps/web/src/**` - Components, hooks, pages |
| Backend | backend-developer | `apps/api/src/**` - Routes, services, workers |
| Database | postgres-pro | `apps/api/prisma/**` - Schema, migrations |
| Queues | backend-developer | `apps/api/src/queues/**`, `apps/api/src/workers/**` |
| Shared | Explore | `packages/shared/**` - Types, utilities |
| Security | security-engineer | Auth, OAuth, encryption, PII, vulnerability audits |
| AI/ML | ai-ml-engineer | CLIP embeddings, pgvector, deepfake detection, similarity |
| Testing | test-engineer | `**/*.test.ts`, `e2e/**` - Unit, integration, E2E tests |
| DevOps | devops-engineer | `.github/workflows/**`, `Dockerfile`, deployment configs |

---

## Decision Log

| Date | Decision | Rationale | Author |
|------|----------|-----------|--------|
| 2025-01-07 | Monorepo with Turborepo | Enables code sharing, parallel builds, single CI/CD | Initial |
| 2025-01-07 | Zustand over Redux | Simpler, less boilerplate, migrates well to React Native | Initial |
| 2025-01-07 | Fastify over Express | Better TypeScript support, faster, built-in validation | Initial |
| 2025-01-07 | Supabase for Auth | OAuth support, good DX, handles social providers | Initial |
| 2025-01-07 | pgvector for embeddings | Native PostgreSQL, no separate vector DB needed | Initial |
| 2026-01-12 | Vercel for frontend hosting | GitHub integration, automatic deployments, good monorepo support | Deployment |
| 2026-01-12 | Render for backend hosting | Simple deployment, auto-sleep on free tier, good Node.js support | Deployment |
| 2026-01-12 | Supabase pooler for production DB | Connection pooling via pgbouncer prevents connection exhaustion | Deployment |

---

## Future Considerations

### React Native Migration
- Zustand state management already compatible
- TanStack Query works on React Native
- Plan to extract shared hooks to `packages/hooks`
- UI components will need platform-specific implementations

### Scaling Considerations
- BullMQ queues designed for horizontal scaling
- Image scanning can be parallelized
- Consider read replicas for dashboard queries
- CDN for static assets and processed images

### Compliance
- GDPR data subject requests (export, deletion)
- CCPA compliance for California users
- SOC 2 preparation for enterprise customers (future)
