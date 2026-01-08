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
- **Backend Hosting**: Railway or Render
- **CI/CD**: GitHub Actions
- **Database**: Supabase (PostgreSQL)

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

## Multi-Agent Collaboration

This project uses specialized Claude Code agents for different domains:

### Agent Usage Guidelines
1. **Always check CLAUDE.md first** for context and established patterns
2. **Follow existing patterns** - check similar code before creating new patterns
3. **Document decisions** - update CLAUDE.md when making architectural choices
4. **Use conventional commits** for clear history
5. **Create focused PRs** - one feature/fix per branch

### Domain Responsibilities
- **Frontend**: React components, hooks, pages, state management
- **Backend**: API routes, business logic, integrations
- **Database**: Schema design, migrations, queries
- **Security**: Auth, encryption, validation
- **AI/ML**: Image processing, embedding generation, similarity search

---

## Decision Log

| Date | Decision | Rationale | Author |
|------|----------|-----------|--------|
| 2025-01-07 | Monorepo with Turborepo | Enables code sharing, parallel builds, single CI/CD | Initial |
| 2025-01-07 | Zustand over Redux | Simpler, less boilerplate, migrates well to React Native | Initial |
| 2025-01-07 | Fastify over Express | Better TypeScript support, faster, built-in validation | Initial |
| 2025-01-07 | Supabase for Auth | OAuth support, good DX, handles social providers | Initial |
| 2025-01-07 | pgvector for embeddings | Native PostgreSQL, no separate vector DB needed | Initial |

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
