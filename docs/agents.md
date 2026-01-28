# Claude Code Subagent System - Full Reference

This project leverages Claude Code's subagent system for efficient development. **Always prefer using specialized subagents over manual file searching and reading.**

## Slash Commands

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
- **Agent Colors**: Each agent has a unique color indicator
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
| context7 | Blue Diamond | Library documentation (React, Fastify, Prisma) |
| serena | Orange Diamond | Symbolic code navigation and editing |
| morph-mcp | Brown | Smart file editing and codebase search |
| playwright | Green | Browser automation and E2E testing |
| chrome-devtools | Blue | Frontend debugging and performance |
| sequential-thinking | Purple | Complex multi-step reasoning |

## Complete Agent Reference (21 Total)

### Exploration & Research Agents

| Agent | Use When | Example Prompts |
|-------|----------|-----------------|
| **Explore** | Finding files, understanding code, researching the codebase | "Find all authentication-related files", "How does the image scanning workflow work?" |
| **general-purpose** | Complex multi-step research, autonomous investigation | "Investigate why the scan queue is failing and propose solutions" |

**Explore Agent Thoroughness Levels:**
- `quick` - Basic file/pattern search
- `medium` - Moderate exploration with some context
- `very thorough` - Comprehensive analysis across multiple locations

### Planning Agent

| Agent | Use When | Example Prompts |
|-------|----------|-----------------|
| **Plan** | Before implementing any non-trivial feature | "Design the implementation approach for adding deepfake detection" |

### Core Development

| Agent | Domain | Use For |
|-------|--------|---------|
| **backend-developer** | Fastify API | Routes, BullMQ workers, Supabase auth, Prisma, scanning pipeline (`apps/api/`) |
| **frontend-developer** | React UI | Components, hooks, pages, Zustand/TanStack Query, shadcn/ui (`apps/web/`) |
| **react-specialist** | React 18+ | Advanced hooks, state management, performance optimization, concurrent features |
| **ui-designer** | Visual Design | Calm empowering UX, Tailwind/shadcn, accessibility, responsive layouts |
| **mobile-developer** | Mobile | React Native migration planning, cross-platform mobile |
| **typescript-pro** | TypeScript | Advanced type patterns, monorepo type safety, strict mode (`packages/shared/`) |

### Data, AI & Python

| Agent | Domain | Use For |
|-------|--------|---------|
| **postgres-pro** | PostgreSQL + pgvector | Similarity search, HNSW indexes, Prisma migrations, query tuning |
| **ai-ml-engineer** | AI/ML | CLIP embeddings, DeepFace, TinEye/SerpAPI, deepfake detection, similarity |
| **python-pro** | Python | DeepFace microservice (FastAPI, TensorFlow, OpenCV) (`services/deepface-service/`) |

### Security & Compliance

| Agent | Domain | Use For |
|-------|--------|---------|
| **security-engineer** | Security | Auth flows, OAuth, encryption, OWASP, PII handling, vulnerability assessment |
| **compliance-auditor** | Compliance | GDPR/CCPA compliance, data privacy audits, consent management |

### Quality & Testing

| Agent | Domain | Use For |
|-------|--------|---------|
| **test-engineer** | Testing | Vitest, React Testing Library, Supertest, Playwright, coverage analysis |
| **code-reviewer** | Code Quality | Security vulnerabilities, performance issues, best practices review |
| **accessibility-tester** | Accessibility | WCAG 2.1 AA compliance, screen reader testing, inclusive design |

### Infrastructure & APIs

| Agent | Domain | Use For |
|-------|--------|---------|
| **devops-engineer** | DevOps | Vercel, Render, Docker, GitHub Actions, monitoring, CI/CD |
| **microservices-architect** | Distributed Systems | DeepFace service architecture, resilience patterns, communication |
| **api-designer** | API Design | REST API patterns, OpenAPI documentation, Fastify route design |
| **performance-engineer** | Performance | Pipeline optimization, database tuning, Core Web Vitals |

### Debug & Research

| Agent | Domain | Use For |
|-------|--------|---------|
| **debugger** | Debugging | Multi-service debugging (API → BullMQ → TinEye → DeepFace) |

### Orchestration Agents

| Agent | Use When | How It Helps |
|-------|----------|--------------|
| **agent-organizer** | Complex tasks requiring 3+ agents | Decomposes tasks, selects from 21 agents, designs workflows |

### System & Utility Agents

| Agent | Use When | Example |
|-------|----------|---------|
| **Bash** | Git operations, command execution, terminal tasks | "Run git status", "Execute pnpm install" |
| **claude-code-guide** | Questions about Claude Code CLI, Agent SDK, or Claude API | "How do I configure hooks?" |
| **agent-installer** | Browse, install, or uninstall community agents | "Install the python-pro agent" |

## Agent Details

### security-engineer
- OAuth token security and encryption
- Image upload validation and virus scanning
- PII protection (GDPR/CCPA compliance)
- OWASP Top 10 vulnerability checks
- Authentication flow security audits

### ai-ml-engineer
- CLIP embedding generation and optimization
- pgvector similarity search configuration
- Deepfake detection API integration
- Reverse image search (TinEye, Google Vision)
- Perceptual hashing for duplicate detection

### test-engineer
- Unit tests with **Vitest** (NOT Jest) for business logic
- React Testing Library for components
- Supertest for API integration tests
- Playwright for E2E critical paths

### devops-engineer
- GitHub Actions CI/CD pipelines (currently missing — priority gap)
- Docker multi-stage builds (DeepFace service)
- Vercel, Render, DeepFace Docker deployments
- Health checks and monitoring

### postgres-pro
- **pgvector similarity search** (HNSW indexes, cosine distance)
- Query performance tuning and EXPLAIN analysis
- Prisma migration design and optimization

### python-pro
- FastAPI endpoints for face recognition
- TensorFlow/DeepFace model integration
- OpenCV image preprocessing
- Docker build optimization for ML models

### compliance-auditor
- GDPR compliance for EU users (biometric data = special category)
- CCPA compliance for California users
- Privacy impact assessments for face recognition
- Consent management for image scanning

## Trigger Keywords → Required Agents

| User Says | Launch This Agent |
|-----------|-------------------|
| "find", "search", "where is", "locate" | **Explore** |
| "how does X work", "explain", "understand" | **Explore** |
| "implement", "add feature", "build", "create" | **Plan** first |
| "fix bug", "debug", "error", "not working" | **debugger** or **Explore** first |
| "refactor", "improve", "optimize" | **Plan** first |
| "database", "migration", "SQL", "schema", "pgvector" | **postgres-pro** |
| "component", "UI", "React", "hook", "page" | **frontend-developer** |
| "API", "endpoint", "auth", "backend", "Fastify" | **backend-developer** |
| "design", "visual", "layout", "color", "UX" | **ui-designer** |
| "accessibility", "WCAG", "screen reader", "a11y" | **accessibility-tester** |
| "security", "vulnerability", "encryption", "OAuth" | **security-engineer** |
| "GDPR", "CCPA", "compliance", "privacy", "consent" | **compliance-auditor** |
| "embedding", "CLIP", "vector", "similarity", "ML" | **ai-ml-engineer** |
| "Python", "FastAPI", "DeepFace", "TensorFlow" | **python-pro** |
| "TypeScript", "types", "generics", "strict mode" | **typescript-pro** |
| "test", "coverage", "Vitest", "Playwright" | **test-engineer** |
| "deploy", "CI/CD", "Docker", "pipeline" | **devops-engineer** |
| "performance", "slow", "optimize", "Web Vitals" | **performance-engineer** |
| complex multi-domain task | **agent-organizer** or **/swarm** |

## Best Practices

1. **Evaluate Before Acting**: Check if a subagent applies before manual grep/glob/read
2. **Launch Agents in Parallel**: When tasks are independent, launch ALL applicable agents in a single message
3. **Be Specific in Prompts**: Include clear objective, scope boundaries, expected output format
4. **Trust Agent Results**: Synthesize and present findings without re-doing their work

## Domain Responsibilities

| Domain | Primary Agent | Secondary Agents | Scope |
|--------|---------------|------------------|-------|
| Frontend | frontend-developer | react-specialist, ui-designer | `apps/web/src/**` |
| Backend | backend-developer | api-designer | `apps/api/src/**` |
| Database | postgres-pro | performance-engineer | `apps/api/prisma/**` |
| Queues | backend-developer | debugger | `apps/api/src/queues/**`, `apps/api/src/workers/**` |
| Shared Types | typescript-pro | Explore | `packages/shared/**` |
| DeepFace | python-pro | ai-ml-engineer | `services/deepface-service/**` |
| Image Pipeline | ai-ml-engineer | backend-developer | CLIP, TinEye, SerpAPI, similarity |
| Security | security-engineer | compliance-auditor | Auth, OAuth, encryption, PII |
| Testing | test-engineer | code-reviewer | `**/*.test.ts`, `e2e/**` |
| DevOps | devops-engineer | microservices-architect | Vercel, Render, Docker, CI/CD |
