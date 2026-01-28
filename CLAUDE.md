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
├── services/
│   └── deepface-service/    # Python face recognition microservice
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
- **Face Recognition**: DeepFace (self-hosted Python microservice)
- **Deepfake Detection**: Third-party API (TBD)
- **Reverse Image Search**: TinEye, Google Vision APIs
- **Breach Detection**: Have I Been Pwned API

#### Infrastructure
- **Frontend Hosting**: Vercel (vara-web-eta.vercel.app)
- **Backend Hosting**: Render (vara-api-yaqq.onrender.com)
- **DeepFace Service**: Render (vara-deepface.onrender.com)
- **CI/CD**: GitHub Actions
- **Database**: Supabase (PostgreSQL)

> **Full deployment docs**: See `docs/deployment.md` for env vars, service configs, troubleshooting, and deployment checklist.

---

## Core Features (MVP - V1)

### 1. Onboarding Assessment
8-12 question emotionally intelligent quiz that identifies exposure level, generates personalized Protection Plan, and sets emotional tone (supportive, not alarming).

### 2. Identity & Exposure Mapping
Email/phone exposure, public profile info, image variations, username matches, known data breaches (HIBP).

### 3. AI Image Misuse & Impersonation Detection
Unauthorized photo use, fake profile detection, deepfake detection, continuous image replication tracking.

### 4. Behavioral Risk Monitoring
Follower surge detection, suspicious accounts, pattern changes, cross-platform correlation.

### 5. Alerts & Recommendations
Calm, clear, non-technical alerts with plain language explanation, severity indicator, recommended actions, and escalation options.

### 6. Personalized Protection Plan
Dynamic plan evolving based on risk profile, observed threats, safety goals, and actions taken.

---

## Design Philosophy

1. **Emotional Clarity, Not Panic** - Calm, supportive tone; never alarmist, always actionable
2. **Privacy-First** - No selling/sharing data; all scanning opt-in; transparent permissions
3. **Non-Technical Accessibility** - No jargon; plain language; visual indicators over text
4. **Holistic Protection** - Single dashboard; connected threats in context; progress tracking

### UI/UX Guidelines
- **Colors**: Calming, empowering (no red for errors, use softer alternatives)
- **Typography**: Clean, readable, accessible
- **Spacing**: Generous whitespace
- **Animations**: Subtle, purposeful
- **Empty/Loading States**: Encouraging, reassuring

---

## Data Models

### Core Entities

```
User
├── id (uuid), email, emailVerified, passwordHash (nullable), createdAt, updatedAt
└── profile → UserProfile

UserProfile
├── id, userId (FK), displayName, riskLevel (LOW|MEDIUM|HIGH|CRITICAL)
├── onboardingCompleted, protectionPlanId (FK), createdAt

OnboardingResponse
├── id, userId (FK), questionId, response (JSON), createdAt

ConnectedAccount
├── id, userId (FK), platform (INSTAGRAM|TIKTOK|FACEBOOK|...)
├── platformUserId, accessToken (encrypted), refreshToken (encrypted)
├── tokenExpiry, permissions (JSON), lastSynced, createdAt

ProtectedImage
├── id, userId (FK), storageUrl, embedding (vector[512])
├── hash (perceptual), uploadedAt, lastScanned, status (ACTIVE|ARCHIVED)

ImageMatch
├── id, protectedImageId (FK), sourceUrl, platform, similarity (float)
├── matchType (EXACT|SIMILAR|MODIFIED|DEEPFAKE), detectedAt
├── status (NEW|REVIEWED|ACTIONED|DISMISSED)

Alert
├── id, userId (FK), type (IMAGE_MISUSE|FAKE_PROFILE|DATA_BREACH|...)
├── severity (INFO|LOW|MEDIUM|HIGH|CRITICAL), title, description
├── metadata (JSON), status (NEW|VIEWED|ACTIONED|DISMISSED)
├── createdAt, viewedAt, actionedAt

ProtectionPlan → ProtectionPlanItem[]
├── id, userId (FK), generatedAt, lastUpdated
├── Items: category, title, description, priority, status, dueDate

ScanJob
├── id, userId (FK), type (IMAGE_SCAN|PROFILE_SCAN|BREACH_CHECK|...)
├── status (PENDING|RUNNING|COMPLETED|FAILED), startedAt, completedAt
├── result (JSON), errorMessage (nullable)
```

---

## API Design

### Endpoint Structure
```
/api/v1/
├── auth/     POST signup, login, logout, refresh, forgot-password, reset-password
├── users/    GET/PATCH/DELETE /me
├── onboarding/ GET /questions, POST /responses, GET /results
├── accounts/ GET /, POST /connect/:platform, DELETE /:id, POST /:id/sync
├── images/   GET /, POST /upload, DELETE /:id, GET /:id/matches
├── alerts/   GET /, GET /:id, PATCH /:id/status, POST /:id/action
├── protection-plan/ GET /, PATCH /items/:id, POST /regenerate
└── scans/    GET /, POST /trigger, GET /:id/status
```

### Response Format
```typescript
// Success: { data: T, meta?: { pagination?: { page, limit, total, totalPages } } }
// Error:   { error: { code: string, message: string, details?: any } }
```

### HTTP Status Codes
200 Success | 201 Created | 204 No Content | 400 Bad Request | 401 Unauthorized | 403 Forbidden | 404 Not Found | 409 Conflict | 422 Unprocessable | 429 Rate Limited | 500 Internal Error

---

## Coding Standards

### TypeScript
- **Strict mode**: Always enabled
- **No `any`**: Use `unknown` with type guards instead
- **Interfaces vs Types**: Interfaces for object shapes, types for unions/primitives
- **Zod**: Runtime validation matching TypeScript types
- **Explicit return types**: On all exported functions

### React Patterns
- **Functional components only**: No class components
- **Custom hooks**: Extract reusable logic into hooks
- **Co-location**: Components with their tests and styles
- **Server state**: TanStack Query for all API data
- **Client state**: Zustand for UI-only state
- **Forms**: React Hook Form + Zod schemas

### File Naming
- **Components**: PascalCase (`AlertCard.tsx`)
- **Hooks**: camelCase with `use` prefix (`useAlerts.ts`)
- **Utilities**: camelCase (`formatDate.ts`)
- **Types**: PascalCase (`Alert.ts` or inline)
- **Constants**: SCREAMING_SNAKE_CASE in camelCase files

### Import Order
1. React/external libraries
2. Internal packages (`@vara/shared`)
3. Local imports
4. Types (if separate)

### Git Workflow
- **Branch naming**: `feature/`, `fix/`, `chore/`, `docs/`
- **Commits**: Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`)
- **PRs**: One feature/fix per branch, squash merge to main

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
- CSP headers set, HTTPS only

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

- **Unit Tests (Vitest)**: Business logic, utilities, custom hooks
- **Component Tests (React Testing Library)**: User interactions, accessibility, edge cases
- **Integration Tests (Supertest)**: API endpoints, database operations, auth flows
- **E2E Tests (Playwright)**: Sign up → Onboarding → Dashboard, Image upload → Scan → Alert
- **Coverage Targets**: Unit 80%+, Integration 70%+, E2E critical paths

---

## Development Workflow

```bash
pnpm install              # Install dependencies
cp apps/web/.env.example apps/web/.env.local
cp apps/api/.env.example apps/api/.env
docker-compose up -d      # Start database
pnpm db:migrate           # Run migrations
pnpm dev                  # Start all apps

# Common commands
pnpm build    pnpm test    pnpm lint    pnpm typecheck
pnpm db:migrate    pnpm db:studio    pnpm db:seed
```

---

## Key User Flows

1. **Onboarding**: Sign up → Quiz (8-12 Qs, branching) → Protection Plan generated → Dashboard
2. **Connect Accounts**: Settings → Select platform → OAuth → Initial scan → 7-day baseline
3. **Photo Protection**: Upload → Validate/scan → CLIP embedding + perceptual hash → Queue scan
4. **Alert Response**: Threat detected → Alert created → Notification → Detail view → Action (dismiss/report/escalate)

---

## Claude Code Subagent System (MANDATORY)

Always prefer specialized subagents over manual file searching. Use `/swarm` for multi-domain tasks.

> **Full agent reference**: See `docs/agents.md` for complete agent catalog, trigger keywords, domain responsibilities, and best practices.

### Key Rules
- **Evaluate before acting**: Check if a subagent applies before manual grep/glob/read
- **Launch agents in parallel**: Independent tasks = single message with multiple Task calls
- **Use Plan agent first**: Before implementing any non-trivial feature
- **Trust agent results**: Synthesize without re-doing their work

### Quick Agent Lookup

| Domain | Primary Agent | Scope |
|--------|---------------|-------|
| Frontend | frontend-developer | `apps/web/src/**` |
| Backend | backend-developer | `apps/api/src/**` |
| Database | postgres-pro | `prisma/**`, pgvector |
| DeepFace | python-pro | `services/deepface-service/**` |
| AI/ML | ai-ml-engineer | CLIP, TinEye, similarity |
| Security | security-engineer | Auth, OAuth, PII |
| Testing | test-engineer | Vitest (NOT Jest), Playwright |
| DevOps | devops-engineer | Vercel, Render, Docker |
| Types | typescript-pro | `packages/shared/**` |
| Research | Explore | Codebase exploration |

### Test Framework Note
Use **Vitest** (NOT Jest) for unit tests.

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-01-07 | Monorepo with Turborepo | Code sharing, parallel builds, single CI/CD |
| 2025-01-07 | Zustand over Redux | Simpler, less boilerplate, React Native compatible |
| 2025-01-07 | Fastify over Express | Better TypeScript, faster, built-in validation |
| 2025-01-07 | Supabase for Auth | OAuth support, good DX, social providers |
| 2025-01-07 | pgvector for embeddings | Native PostgreSQL, no separate vector DB |
| 2026-01-12 | Vercel for frontend | GitHub integration, automatic deploys, monorepo support |
| 2026-01-12 | Render for backend | Simple deployment, good Node.js support |
| 2026-01-12 | Supabase pooler for prod DB | pgbouncer prevents connection exhaustion |

---

## Future Considerations

- **React Native Migration**: Zustand + TanStack Query already compatible; extract shared hooks to `packages/hooks`
- **Scaling**: BullMQ horizontal scaling, parallelized scanning, read replicas, CDN
- **Compliance**: GDPR data subject requests, CCPA, SOC 2 preparation
