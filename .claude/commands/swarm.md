# Swarm - Parallel Multi-Agent Orchestration

Execute complex tasks by decomposing them and running multiple specialized agents in parallel, with MCP tool integration.

## Task to Execute
$ARGUMENTS

## Instructions

You are orchestrating a swarm of specialized agents. Follow this process exactly:

### Step 0: Parse Options

Check if the task includes any flags:
- `--dry-run` or `-d`: Show execution plan without running agents
- `--focus=<phase>`: Only run specific phase (e.g., `--focus=2`)
- `--fast`: Use haiku model for simple subtasks to reduce token usage
- `--no-mcp`: Disable MCP tool usage (agents only)

If `--dry-run` is present, skip to Step 3 and stop after showing the plan.

### MCP Tools Available

The swarm can leverage these MCP tools when beneficial:

#### Documentation & Research
| MCP | Tool | Use For |
|-----|------|---------|
| 🔷 **context7** | `resolve-library-id`, `query-docs` | Look up library documentation (React, Fastify, Prisma, etc.) |

#### Code Intelligence
| MCP | Tool | Use For |
|-----|------|---------|
| 🔶 **serena** | `find_symbol`, `get_symbols_overview` | Symbolic code navigation and understanding |
| 🔶 **serena** | `replace_symbol_body`, `insert_after_symbol` | Precise code modifications |
| 🔶 **serena** | `find_referencing_symbols` | Find all usages of a function/class |
| 🟤 **morph-mcp** | `edit_file` | Fast, accurate file editing |
| 🟤 **morph-mcp** | `warpgrep_codebase_search` | Intelligent codebase search |

#### Browser Testing
| MCP | Tool | Use For |
|-----|------|---------|
| 🟢 **playwright** | `browser_navigate`, `browser_snapshot` | E2E testing, UI verification |
| 🟢 **playwright** | `browser_click`, `browser_type` | Automated user interactions |
| 🔵 **chrome-devtools** | `take_snapshot`, `list_network_requests` | Debug frontend issues |
| 🔵 **chrome-devtools** | `list_console_messages`, `performance_*` | Performance analysis |

#### Problem Solving
| MCP | Tool | Use For |
|-----|------|---------|
| 🟣 **sequential-thinking** | `sequentialthinking` | Complex multi-step reasoning |

**When to use MCPs:**
- 📚 Need library docs → Use **context7** before implementing
- 🔍 Complex code search → Use **morph-mcp** warpgrep or **serena** symbols
- ✏️ Precise edits → Use **serena** symbolic editing or **morph-mcp** edit_file
- 🌐 UI verification → Use **playwright** or **chrome-devtools**
- 🧠 Complex reasoning → Use **sequential-thinking**

### Vara Domain Context

This swarm operates on the **Vara** digital safety platform — a monorepo with:
- `apps/web/` — React 18 + Vite + Zustand + TanStack Query + shadcn/ui
- `apps/api/` — Fastify + Prisma + BullMQ + Supabase Auth
- `services/deepface-service/` — Python FastAPI + DeepFace (face recognition)
- `packages/shared/` — Shared TypeScript types, Zod schemas, utilities

Key domains: image scanning pipeline, face recognition, reverse image search (TinEye/SerpAPI), alerts, protection plans, onboarding assessment.

### Agent Color Reference

Use these colored indicators for each agent in ALL output:

```
🔴 frontend-developer, security-engineer (red)
🟠 agent-organizer, code-reviewer, react-specialist (orange)
🟡 backend-developer, microservices-architect (yellow)
🟢 test-engineer, ui-designer, accessibility-tester (green)
🔵 mobile-developer, api-designer (blue)
🟣 ai-ml-engineer, python-pro (purple)
🩵 devops-engineer (cyan)
🩷 postgres-pro (pink)
🟤 performance-engineer, compliance-auditor (brown)
🔘 typescript-pro, debugger (gray)
⚪ Explore, Plan, general-purpose (white/default)
```

### Step 1: Announce Swarm Initiation

Output this EXACT format:

```
╔══════════════════════════════════════════════════════════════╗
║                     🐝 INITIATING SWARM                      ║
╚══════════════════════════════════════════════════════════════╝

Bringing in 🟠 agent-organizer to assign tasks for:
► "$ARGUMENTS"

⏳ Analyzing task complexity...
```

### Step 2: Call Agent Organizer

Use the Task tool to call the **agent-organizer** agent with this prompt:

"Analyze and decompose this task into subtasks that can be executed by specialized agents. Identify which agents to use, map dependencies, and determine which tasks can run in parallel.

Task: $ARGUMENTS

Available agents (Vara-optimized):

Core Development:
- backend-developer: Fastify API, BullMQ workers, Supabase auth, Prisma, scanning pipeline (apps/api/)
- frontend-developer: React 18 components, hooks, pages, Zustand/TanStack Query, shadcn/ui (apps/web/)
- react-specialist: Advanced React patterns, hooks optimization, state management
- ui-designer: Visual design, accessibility, Tailwind/shadcn, calm empowering UX
- mobile-developer: React Native migration planning, cross-platform mobile

Data & AI:
- postgres-pro: PostgreSQL + pgvector optimization, Prisma migrations, HNSW indexes
- ai-ml-engineer: CLIP embeddings, DeepFace integration, similarity search, scanning pipeline
- python-pro: DeepFace Python microservice (FastAPI, TensorFlow, OpenCV) (services/deepface-service/)

Quality & Security:
- security-engineer: Auth flows, OAuth, encryption, OWASP, PII handling
- test-engineer: Vitest, React Testing Library, Supertest, Playwright
- code-reviewer: Code quality, security vulnerabilities, performance
- compliance-auditor: GDPR/CCPA compliance, data privacy, audit reporting
- accessibility-tester: WCAG 2.1 AA compliance, inclusive design

Infrastructure & Type Safety:
- devops-engineer: Vercel, Render, Docker, GitHub Actions, monitoring
- microservices-architect: Service boundaries, DeepFace communication, resilience
- api-designer: REST API design, OpenAPI documentation, Fastify patterns
- performance-engineer: Pipeline optimization, database tuning, Core Web Vitals
- typescript-pro: Advanced TypeScript patterns, monorepo type safety

Research & Debug:
- Explore: Codebase exploration, finding files (thoroughness: quick/medium/very thorough)
- Plan: Architecture and design
- debugger: Multi-service debugging (API → BullMQ → TinEye → DeepFace)
- general-purpose: Complex multi-step research

Available MCP tools (use when beneficial):
- context7: Library documentation lookup (React, Fastify, Prisma docs)
- serena: Symbolic code navigation (find_symbol, replace_symbol_body)
- morph-mcp: Smart file editing (edit_file) and search (warpgrep_codebase_search)
- playwright: Browser automation for E2E testing
- chrome-devtools: Frontend debugging and performance
- sequential-thinking: Complex multi-step reasoning

For each subtask, specify:
1. Agent: Which agent handles this
2. Complexity: Low/Medium/High
3. Estimated tokens: Small (<2k), Medium (2-5k), Large (5k+)
4. MCP tools: List SPECIFIC MCP tools that SHOULD be used (be explicit):
   - context7: For looking up library docs (specify which library)
   - serena: For code navigation/editing (specify: find_symbol, replace_symbol_body, etc.)
   - morph-mcp: For file editing (edit_file) or search (warpgrep_codebase_search)
   - playwright: For browser testing (browser_navigate, browser_snapshot, browser_click)
   - chrome-devtools: For frontend debugging (take_snapshot, list_console_messages)
   - sequential-thinking: For complex multi-step reasoning
   - 'none': Only if no MCP tools apply

Be specific about WHY each MCP tool helps the subtask (e.g., 'context7: Look up Fastify route validation docs').

Provide a clear execution plan with phases, identifying which agents can run in parallel."

### Step 3: Display Execution Plan

After agent-organizer responds, output the plan with colors and MCP indicators:

```
╔══════════════════════════════════════════════════════════════╗
║                   📋 SWARM EXECUTION PLAN                    ║
╚══════════════════════════════════════════════════════════════╝

📋 Task: [Brief summary]

┌─────────────────────────────────────────────────────────────┐
│ PHASE 1: [Description]                          [PARALLEL]  │
├─────────────────────────────────────────────────────────────┤
│  🟡 backend-developer   │ [task]           │ ~3k tokens    │
│     └─ 🔷 context7: Fastify docs                            │
│  🔴 frontend-developer  │ [task]           │ ~4k tokens    │
│     └─ 🔶 serena: find_symbol                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ PHASE 2: [Description]                         [SEQUENTIAL] │
├─────────────────────────────────────────────────────────────┤
│  🟢 test-engineer       │ [task]           │ ~2k tokens    │
│     └─ 🟢 playwright: browser testing                       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      📊 ESTIMATES                           │
├─────────────────────────────────────────────────────────────┤
│  Agents: [X]  │  Phases: [Y]  │  Est. Tokens: ~[Z]k        │
│  MCPs Used: [N]  │  Parallel Efficiency: [X]%              │
└─────────────────────────────────────────────────────────────┘
```

**Parallel Efficiency** = (Total if sequential - Actual with parallel) / Total if sequential * 100
- Higher is better (more work done in parallel)

**If `--dry-run` was specified, STOP HERE and output:**
```
════════════════════════════════════════════════════════════════
DRY RUN COMPLETE - No agents were deployed
Estimated token usage: ~[X]k tokens
Run without --dry-run to execute this plan
════════════════════════════════════════════════════════════════
```

### Step 4: Deploy Agents

Output:
```
╔══════════════════════════════════════════════════════════════╗
║                    🚀 DEPLOYING AGENTS                       ║
╚══════════════════════════════════════════════════════════════╝
```

### Step 5: Execute Each Phase

For EACH phase, track time and show status with colors:

```
┌─────────────────────────────────────────────────────────────┐
│ PHASE 1: [Description]                                      │
│ Started: [timestamp]  │  Agents: [X]  │  Mode: PARALLEL     │
└─────────────────────────────────────────────────────────────┘

  ⚡ 🟡 backend-developer starting...
     └─ Task: [brief description]
     └─ MCPs: 🔷 context7 (docs), 🔶 serena (code)

  ⚡ 🔴 frontend-developer starting...
     └─ Task: [brief description]
     └─ MCPs: 🟤 morph-mcp (editing)
```

Then launch ALL agents for that phase in a SINGLE message with multiple Task tool calls.

**CRITICAL - MCP TOOL INJECTION**: For EACH agent's Task call, you MUST include MCP instructions in the prompt. Use this template:

```
[Agent's specific task description]

**MCP TOOLS - USE THESE:**
You have access to these MCP tools and SHOULD use them:

[If context7 recommended]
- 🔷 **context7**: Look up library documentation before implementing
  - First call `mcp__context7__resolve-library-id` with the library name
  - Then call `mcp__context7__query-docs` with the resolved ID and your question
  - Example: Look up "Fastify validation" or "React hooks" docs

[If serena recommended]
- 🔶 **serena**: Use for precise code navigation and editing
  - `mcp__serena__find_symbol` to find functions/classes by name
  - `mcp__serena__get_symbols_overview` for file structure
  - `mcp__serena__replace_symbol_body` for precise edits
  - `mcp__serena__find_referencing_symbols` to find all usages

[If morph-mcp recommended]
- 🟤 **morph-mcp**: Use for fast file editing and search
  - `mcp__morph-mcp__edit_file` for efficient edits with minimal context
  - `mcp__morph-mcp__warpgrep_codebase_search` for intelligent code search

[If playwright recommended]
- 🟢 **playwright**: Use for browser automation and testing
  - `mcp__playwright__browser_navigate` to open pages
  - `mcp__playwright__browser_snapshot` to see page structure
  - `mcp__playwright__browser_click` / `browser_type` for interactions

[If chrome-devtools recommended]
- 🔵 **chrome-devtools**: Use for frontend debugging
  - `mcp__chrome-devtools__take_snapshot` for page analysis
  - `mcp__chrome-devtools__list_console_messages` for errors
  - `mcp__chrome-devtools__list_network_requests` for API debugging

[If sequential-thinking recommended]
- 🟣 **sequential-thinking**: Use for complex reasoning
  - `mcp__sequential-thinking__sequentialthinking` for multi-step analysis

**IMPORTANT**: Actively use these MCP tools during your work. They are already available and will improve your output quality.
```

**TOKEN OPTIMIZATION**: If `--fast` flag was used, add `model: "haiku"` to Task calls for Low complexity subtasks.

**MCP SKIP**: If `--no-mcp` flag was used, do NOT include the MCP TOOLS section in agent prompts. Skip all MCP tool injection and proceed with agents using only standard tools.

**CRITICAL**: Launch all phase agents in parallel (multiple Task calls in one message).
**CRITICAL**: Unless `--no-mcp` is set, each Task call MUST include the MCP tool instructions above for tools recommended in the execution plan.

### Step 6: Report Agent Completions

As each agent completes, check its response for MCP tool usage (look for `mcp__` tool calls in the output) and output with color and metrics:

**Detecting MCP usage**: Look for tool calls in the agent's response containing:
- `mcp__context7__` → Report as 🔷 context7
- `mcp__serena__` → Report as 🔶 serena
- `mcp__morph-mcp__` → Report as 🟤 morph-mcp
- `mcp__playwright__` → Report as 🟢 playwright
- `mcp__chrome-devtools__` → Report as 🔵 chrome-devtools
- `mcp__sequential-thinking__` → Report as 🟣 sequential-thinking

```
  ✓ 🟡 backend-developer completed
    ├─ Duration: [X]s
    ├─ Result: [1-2 sentence summary]
    ├─ Files: [count] modified
    └─ MCP: 🔷 context7 (looked up Fastify validation docs)
```

If multiple MCPs were used:
```
  ✓ 🔴 frontend-developer completed
    ├─ Duration: [X]s
    ├─ Result: [1-2 sentence summary]
    ├─ Files: [count] modified
    └─ MCPs: 🔶 serena (find_symbol), 🟤 morph-mcp (edit_file)
```

If no MCP was used (but was recommended, note this):
```
  ✓ 🩷 postgres-pro completed
    ├─ Duration: [X]s
    ├─ Result: [1-2 sentence summary]
    ├─ Files: [count] modified
    └─ MCP: none (recommended: 🔶 serena)
```

If an agent FAILS, output:
```
  ✗ 🔴 frontend-developer FAILED
    ├─ Duration: [X]s
    ├─ Error: [error description]
    └─ Recovery: [Attempting retry / Skipping / Blocking]
```

### Step 7: Handle Failures

If an agent fails:

1. **Non-critical agent**: Log the failure, continue with remaining agents
```
⚠️  Non-critical failure: 🟢 test-engineer
    Continuing with remaining agents...
```

2. **Critical agent (blocks other phases)**: Attempt ONE retry
```
🔄 Critical failure: 🟡 backend-developer
   Attempting retry (1/1)...
```

3. **Retry also fails**: Stop the swarm
```
🛑 SWARM HALTED
   Critical agent 🟡 backend-developer failed after retry

   Completed before failure:
   - [list of completed work]

   Manual intervention required for:
   - [remaining tasks]
```

### Step 8: Phase Transitions

Between phases, show metrics:
```
┌─────────────────────────────────────────────────────────────┐
│ ✓ PHASE 1 COMPLETE                                         │
├─────────────────────────────────────────────────────────────┤
│  Duration: [X]s  │  Agents: [Y]  │  Success: [Z]/[Y]       │
│  Files Changed: [N]  │  Lines Modified: ~[M]               │
└─────────────────────────────────────────────────────────────┘

Proceeding to Phase 2...
```

### Step 9: Final Summary

After all phases, show comprehensive metrics:
```
╔══════════════════════════════════════════════════════════════╗
║                    ✅ SWARM COMPLETE                         ║
╚══════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────┐
│                     📊 STATISTICS                           │
├─────────────────────────────────────────────────────────────┤
│  Total Duration     │  [X]s                                 │
│  Agents Deployed    │  [count]                              │
│  Phases Executed    │  [count]                              │
│  Success Rate       │  [X]%                                 │
│  Retries            │  [count]                              │
├─────────────────────────────────────────────────────────────┤
│  Files Changed      │  [count]                              │
│  Lines Added        │  +[count]                             │
│  Lines Removed      │  -[count]                             │
├─────────────────────────────────────────────────────────────┤
│  Parallel Efficiency│  [X]%                                 │
│  Time Saved         │  ~[Y]s (vs sequential)                │
├─────────────────────────────────────────────────────────────┤
│  MCP Tools Used     │  [count]                              │
│  Docs Lookups       │  [count] (context7)                   │
│  Code Navigations   │  [count] (serena)                     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   🤖 AGENTS DEPLOYED                        │
├─────────────────────────────────────────────────────────────┤
│  🟡 backend-developer    │ ✓ 12s │ Built API   │ 🔷 context7│
│  🔴 frontend-developer   │ ✓ 15s │ Created UI  │ 🔶 serena  │
│  🩷 postgres-pro         │ ✓  8s │ Schema      │ -          │
│  🟢 test-engineer        │ ✓ 10s │ 12 tests    │ 🟢 playwright│
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     📋 SUMMARY                              │
├─────────────────────────────────────────────────────────────┤
│  ✓ [Key outcome 1]                                         │
│  ✓ [Key outcome 2]                                         │
│  ✓ [Key outcome 3]                                         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   📁 FILES CHANGED                          │
├─────────────────────────────────────────────────────────────┤
│  • apps/api/src/routes/notifications.ts    [+125 lines]    │
│  • apps/web/src/components/Notification.tsx [+89 lines]    │
│  • prisma/schema.prisma                    [+15 lines]     │
└─────────────────────────────────────────────────────────────┘

════════════════════════════════════════════════════════════════
                    All tasks completed successfully.
════════════════════════════════════════════════════════════════
```

## Agent Reference with Colors (21 Agents)

### Core Development
| Color | Agent | Vara Domain | Token Usage |
|-------|-------|-------------|-------------|
| 🟡 | **backend-developer** | Fastify API, BullMQ, scanning pipeline | Medium-Large |
| 🔴 | **frontend-developer** | React UI, Zustand, TanStack Query | Medium-Large |
| 🟠 | **react-specialist** | Advanced hooks, state optimization | Medium |
| 🩷 | **postgres-pro** | pgvector, Prisma, similarity search | Small-Medium |
| 🔘 | **typescript-pro** | Monorepo types, strict TS patterns | Small-Medium |

### AI, ML & Python
| Color | Agent | Vara Domain | Token Usage |
|-------|-------|-------------|-------------|
| 🟣 | **ai-ml-engineer** | CLIP, DeepFace, TinEye, similarity | Medium-Large |
| 🟣 | **python-pro** | DeepFace service (FastAPI, TF, OpenCV) | Medium |

### Security & Compliance
| Color | Agent | Vara Domain | Token Usage |
|-------|-------|-------------|-------------|
| 🔴 | **security-engineer** | Auth, OAuth, PII, OWASP | Medium |
| 🟤 | **compliance-auditor** | GDPR/CCPA, data privacy | Medium |

### Design & Accessibility
| Color | Agent | Vara Domain | Token Usage |
|-------|-------|-------------|-------------|
| 🟢 | **ui-designer** | Calm UX, Tailwind/shadcn | Medium |
| 🟢 | **accessibility-tester** | WCAG 2.1 AA compliance | Small-Medium |

### Quality & Testing
| Color | Agent | Vara Domain | Token Usage |
|-------|-------|-------------|-------------|
| 🟢 | **test-engineer** | Vitest, RTL, Supertest, Playwright | Medium |
| 🟠 | **code-reviewer** | Code quality, security review | Small-Medium |

### Infrastructure & APIs
| Color | Agent | Vara Domain | Token Usage |
|-------|-------|-------------|-------------|
| 🩵 | **devops-engineer** | Vercel, Render, Docker, CI/CD | Small-Medium |
| 🟡 | **microservices-architect** | DeepFace service architecture | Medium |
| 🔵 | **api-designer** | REST API, OpenAPI, Fastify patterns | Small-Medium |
| 🟤 | **performance-engineer** | Pipeline optimization, Web Vitals | Medium |

### Mobile & Future
| Color | Agent | Vara Domain | Token Usage |
|-------|-------|-------------|-------------|
| 🔵 | **mobile-developer** | React Native migration planning | Medium-Large |

### Research & Debug
| Color | Agent | Vara Domain | Token Usage |
|-------|-------|-------------|-------------|
| ⚪ | **Explore** | Codebase research | Small |
| ⚪ | **Plan** | Architecture design | Medium |
| 🔘 | **debugger** | Multi-service debugging | Medium |
| ⚪ | **general-purpose** | Complex research | Large |

## Token Usage Guide

**Estimated tokens per agent complexity:**
- **Small** (<2k): Simple lookups, small edits, config changes
- **Medium** (2-5k): Feature implementation, component creation
- **Large** (5k+): Complex features, multi-file changes, research

**Tips to reduce token usage:**
1. Use `--fast` flag to use haiku model for simple subtasks
2. Be specific in task description to reduce exploration
3. Use `--focus=N` to run only needed phases
4. Use `--dry-run` first to preview and refine the plan

## Examples (Vara-Specific)

### Standard Execution
```
/swarm Add email notification preferences with database migration, API endpoints, and settings UI
```

### Image Scanning Feature
```
/swarm Add deepfake detection to the image scanning pipeline with DeepFace integration and alert creation
```

### Security & Compliance
```
/swarm Implement GDPR data export and deletion with API endpoints, database queries, and UI flow
```

### Dry Run (Preview Only)
```
/swarm --dry-run Refactor the image-scan.worker.ts into smaller composable services
```

### Fast Mode (Reduced Tokens)
```
/swarm --fast Add health check endpoint that reports TinEye and DeepFace service status
```

### Focus on Specific Phase
```
/swarm --focus=2 Optimize the pgvector similarity search with HNSW indexes
```

### Full-Stack Feature
```
/swarm Build real-time scan progress tracking with WebSocket updates, React progress UI, and BullMQ job events
```

## Example Output

```
╔══════════════════════════════════════════════════════════════╗
║                     🐝 INITIATING SWARM                      ║
╚══════════════════════════════════════════════════════════════╝

Bringing in 🟠 agent-organizer to assign tasks for:
► "Add user notifications with database, API, and UI"

⏳ Analyzing task complexity...

╔══════════════════════════════════════════════════════════════╗
║                   📋 SWARM EXECUTION PLAN                    ║
╚══════════════════════════════════════════════════════════════╝

📋 Task: Implement complete user notification system

┌─────────────────────────────────────────────────────────────┐
│ PHASE 1: Discovery & Schema                     [PARALLEL]  │
├─────────────────────────────────────────────────────────────┤
│  ⚪ Explore              │ Find patterns       │ ~1k tokens │
│  🩷 postgres-pro         │ Design schema       │ ~2k tokens │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ PHASE 2: Implementation                         [PARALLEL]  │
├─────────────────────────────────────────────────────────────┤
│  🟡 backend-developer    │ Build API           │ ~4k tokens │
│  🔴 frontend-developer   │ Create UI           │ ~4k tokens │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ PHASE 3: Quality                               [SEQUENTIAL] │
├─────────────────────────────────────────────────────────────┤
│  🟢 test-engineer        │ Write tests         │ ~3k tokens │
│  🟠 code-reviewer        │ Review code         │ ~2k tokens │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      📊 ESTIMATES                           │
├─────────────────────────────────────────────────────────────┤
│  Agents: 6   │  Phases: 3   │  Est. Tokens: ~16k           │
│  Parallel Efficiency: 67%  │  Est. Time: ~45s              │
└─────────────────────────────────────────────────────────────┘

╔══════════════════════════════════════════════════════════════╗
║                    🚀 DEPLOYING AGENTS                       ║
╚══════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────┐
│ PHASE 1: Discovery & Schema                                 │
│ Started: 14:32:05  │  Agents: 2  │  Mode: PARALLEL          │
└─────────────────────────────────────────────────────────────┘

  ⚡ ⚪ Explore starting...
     └─ Task: Find existing notification patterns in codebase

  ⚡ 🩷 postgres-pro starting...
     └─ Task: Design notification database schema

  ✓ ⚪ Explore completed
    ├─ Duration: 8s
    ├─ Result: Found alert system in apps/api/src/services/
    └─ Files: 0 modified

  ✓ 🩷 postgres-pro completed
    ├─ Duration: 12s
    ├─ Result: Created notifications table with preferences
    └─ Files: 1 modified

┌─────────────────────────────────────────────────────────────┐
│ ✓ PHASE 1 COMPLETE                                         │
├─────────────────────────────────────────────────────────────┤
│  Duration: 12s  │  Agents: 2  │  Success: 2/2              │
│  Files Changed: 1  │  Lines Modified: +23                  │
└─────────────────────────────────────────────────────────────┘

Proceeding to Phase 2...
```

Now begin the swarm execution for the provided task.
