# Agent Manager — Implementation Plan

> **Last Updated:** 2026-02-09
> **Status:** Phase 1 complete (engine ported). Expanding scope: universal agent UI framework with contracts, workflow plugins, multi-agent, remote access.

## Vision

A **universal agent UI framework** — a high-performance desktop application (with remote web access) that provides rich, composable UI components for common agent concepts (commands, skills, tasks, research docs, worktrees, MCPs, hooks) and in-chat interactive elements (choice-pickers, confirmations, file selectors). It orchestrates AI agent sessions across multiple runtimes (Claude Code, GSD, MetaMorph, and any future agent), providing a unified interface for dispatching tasks, observing agent work in real-time, and verifying outputs — integrated with Jira and GitHub Enterprise.

The framework defines **abstract contracts** for agent concepts that allow both generic and specialized UI rendering, and supports **pluggable workflow systems** where opinionated high-level flows (like GSD's plan→execute→verify) map onto the primitive UI components. The desktop app also exposes a **remote access layer**, allowing authenticated users to connect to a running instance from any web browser, including mobile devices.

## Hard Constraints

- **Subscription auth required** — must work with Claude Pro/Max subscriptions, not just API keys. This means wrapping the `claude` CLI (not embedding the SDK).
- **CLI-first adapter model** — all agent runtimes are spawned as child processes. The adapter pattern is: spawn process → parse structured stdout → normalize to `AgentEvent` → push to UI.
- **Local-first** — filesystem is the database. No mandatory cloud sync.
- **BYOK** — users bring their own subscriptions/keys for each runtime.
- **Multi-agent** — not tied to Claude Code CLI. The contract system must support any agent runtime (Claude, GSD, MetaMorph, custom) with both generic and specialized UI.
- **Fully responsive** — the UI must work on desktop, tablet, and mobile screens. Layout adapts via container queries and responsive breakpoints. Remote web access makes mobile support essential.
- **Remote-accessible** — a running desktop instance must be connectable from any web browser via an authenticated proxy/tunnel, enabling remote monitoring and interaction from anywhere.

## Architecture

```
                    ┌──────────────────────┐
                    │   Remote Clients     │
                    │  (Browser / Mobile)  │
                    └──────────┬───────────┘
                               │ HTTPS / WSS
                    ┌──────────▼───────────┐
                    │   Proxy Service      │
                    │   (Auth + Relay)     │
                    └──────────┬───────────┘
                               │
┌──────────────────────────────▼───────────────────────────┐
│  UI Layer (React 19 + packages/ui + TW4)                 │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  Agent Concept Components     Chat UI Elements      │ │
│  │  CommandPalette, SkillCard    ChoicePicker, DiffView │ │
│  │  TaskCard, McpBrowser...      Confirmation, Form... │ │
│  ├─────────────────────────────────────────────────────┤ │
│  │  Workflow Phase Renderers                           │ │
│  │  document | stream | kanban | timeline | split      │ │
│  ├─────────────────────────────────────────────────────┤ │
│  │  Views (responsive: desktop → tablet → mobile)      │ │
│  │  Ops │ Kanban │ Brief │ Settings │ Workflow         │ │
│  └─────────────────────┬───────────────────────────────┘ │
└─────────────────────────┼────────────────────────────────┘
                          │ WebSocket / IPC
┌─────────────────────────▼────────────────────────────────┐
│  Backend (Bun + Hono)                                    │
│  ┌──────────────────┐ ┌──────────────────┐               │
│  │ Session Manager  │ │ Workflow Engine   │               │
│  │ (orchestration)  │ │ (phase state +   │               │
│  │                  │ │  transitions)    │               │
│  ├──────────────────┤ ├──────────────────┤               │
│  │ Adapter Registry │ │ Event Bus        │               │
│  │ (multi-agent)    │ │ (pub/sub)        │               │
│  └────────┬─────────┘ └──────────────────┘               │
└───────────┼──────────────────────────────────────────────┘
            │
  ┌─────────┼─────────────┬─────────────┐
  ▼         ▼             ▼             ▼
┌───────┐ ┌───────┐ ┌───────────┐ ┌─────────┐
│Claude │ │  GSD  │ │ MetaMorph │ │ Custom  │
│CLI    │ │       │ │           │ │ Adapter │
│Adapter│ │Adapter│ │  Adapter  │ │ (plugin)│
└───┬───┘ └───┬───┘ └─────┬─────┘ └────┬────┘
    │         │            │             │
 claude    gsd run      mm exec     user-defined
```

## Agent UI Component System

The core of the framework is a library of UI components that map 1:1 to common agent concepts. Each component has a **contract** (abstract interface) and one or more **implementations** (concrete UI).

### Core Agent Concept Components

| Concept | What it represents | UI Representation |
|---------|-------------------|-------------------|
| **Command** | An imperative action an agent can perform (`/commit`, `/review-pr`, `/help`) | Command palette, inline triggers, toolbar buttons |
| **Skill** | A higher-level capability with context (code review, debugging, deployment) | Skill cards, activation panels, skill status indicators |
| **Task** | A unit of work with status, progress, and subtasks | Task cards, progress bars, kanban items, timeline entries |
| **Research Doc** | A knowledge artifact produced or consumed during work (plans, analyses, constitutions) | Document viewer/editor, collapsible panels, markdown renderer |
| **Worktree** | A git worktree or workspace context the agent is operating in | Worktree selector, file tree, diff viewer, branch indicator |
| **MCP** | Model Context Protocol server/tool available to the agent | MCP registry, tool cards, connection status, capability browser |
| **Hook** | Lifecycle event handler (pre-commit, post-session, on-error, etc.) | Hook configuration panel, event log, trigger indicators |

### In-Chat UI Elements

Interactive elements that appear inline within the agent conversation stream:

| Element | Purpose | Example |
|---------|---------|---------|
| **Choice Picker** | Agent presents options, user selects | "Which approach?" → [Option A] [Option B] [Option C] |
| **Confirmation** | Agent requests yes/no approval | "Apply these changes?" → [Approve] [Reject] |
| **File Selector** | Agent asks user to pick files/paths | Inline file browser with search |
| **Progress Indicator** | Long-running operation feedback | Inline progress bar with status text |
| **Code Block** | Syntax-highlighted code with actions | Copy, apply, diff view, expand/collapse |
| **Tool Call** | Visualize agent tool usage | Collapsible tool invocation with input/output |
| **Cost Ticker** | Running token/cost display | Inline badge updating in real-time |
| **Diff View** | Show proposed changes | Inline unified/split diff with accept/reject |
| **Form** | Structured input collection | Inline form fields for agent configuration |

## Contract Architecture

Contracts define agent concepts in an **abstract, agent-agnostic** way. Each contract is a TypeScript interface + Zod schema that any agent adapter can implement. The UI binds to contracts, not to specific agent implementations.

### Design Principles

1. **Generic base, specialized extensions** — every contract has a base interface that works for any agent. Specific agents can extend it with richer data (e.g., Claude's `Skill` includes `autodiscovery: true`, GSD's `Task` includes `constitution_ref`).
2. **UI renders from contracts** — components receive contract data and render appropriately. A `TaskCard` works whether the task came from Claude, GSD, or a custom agent.
3. **Progressive enhancement** — if an agent provides richer data (e.g., detailed cost breakdown), the UI enhances. If not, it falls back gracefully.
4. **Schema-validated boundaries** — all data crossing adapter→engine→UI boundaries is Zod-validated against the contract schemas.

### Contract Hierarchy

```
AgentContract (base)
├── CommandContract          — { id, name, description, parameters?, keybinding? }
├── SkillContract            — { id, name, description, triggers?, autoDiscoverable? }
├── TaskContract             — { id, title, status, progress?, subtasks?, session? }
├── ResearchDocContract      — { id, title, content, format, role: plan|constitution|analysis|... }
├── WorktreeContract         — { id, path, branch, repo, status }
├── McpContract              — { id, name, uri, tools[], status: connected|disconnected }
├── HookContract             — { id, event, handler, enabled, lastRun? }
└── ChatElementContract      — { type: choice|confirm|file|progress|..., payload }
```

### Specialization Example

```
SkillContract (base)
├── ClaudeSkillContract      — adds: { source: 'autodiscovered'|'user', slashCommand }
├── GsdSkillContract         — adds: { constitutionRef, phase: plan|execute|verify }
└── CustomSkillContract      — open extension point
```

The UI component `<SkillCard skill={skill} />` renders any `SkillContract`. If it detects a `ClaudeSkillContract`, it can show Claude-specific details (slash command, autodiscovery badge). This is **progressive enhancement**, not branching.

## Workflow Plugin Architecture

High-level, opinionated workflows (like GSD's "get shit done" flow) introduce structured processes that go beyond individual commands and skills. These workflows need **first-class representation** — not just a bag of primitives, but a coherent flow with phases, transitions, and purpose-built UI.

### The Problem

A workflow like GSD defines:
1. Start with a **constitution** (guiding principles)
2. Create a **plan** (structured breakdown)
3. Execute via **sessions** (agent does the work)
4. Verify via **pipeline** (automated checks + human review)

Each step *can* be represented with low-level primitives (ResearchDoc, Task, Command stream, Hook), but the **overall flow and its specific UI patterns** need dedicated support. Users need to see "I'm in the planning phase of GSD" not "here are some docs and tasks."

### Workflow Contract

```typescript
interface WorkflowDefinition {
  id: string;                          // e.g., 'gsd', 'metamorph', 'custom-review'
  name: string;
  description: string;
  phases: WorkflowPhase[];             // ordered sequence of phases
  initialPhase: string;                // which phase to start with
  transitions: PhaseTransition[];      // allowed phase transitions
  ui: WorkflowUIConfig;               // top-level layout preferences
}

interface WorkflowPhase {
  id: string;                          // e.g., 'constitution', 'planning', 'execution', 'verification'
  name: string;
  description: string;
  primitiveMapping: PrimitiveMapping;  // how this phase maps to core contracts
  ui: PhaseUIConfig;                   // phase-specific UI configuration
  entryConditions?: Condition[];       // what must be true to enter this phase
  exitConditions?: Condition[];        // what must be true to leave this phase
}

interface PrimitiveMapping {
  // How this phase's concepts map to core agent primitives
  primaryArtifact?: 'research_doc' | 'task' | 'command_stream' | 'hook';
  artifactRole?: string;               // e.g., 'constitution', 'plan', 'execution_log'
  supportingConcepts?: string[];       // other primitives active in this phase
  customData?: Record<string, unknown>;// workflow-specific extensions
}

interface PhaseUIConfig {
  layout: 'document' | 'stream' | 'kanban' | 'timeline' | 'split' | 'custom';
  components: string[];                // which UI components to show
  emphasis: 'content' | 'progress' | 'interaction';  // what to highlight
}
```

### Workflow ↔ Primitive Mapping (GSD Example)

| GSD Phase | Primary Primitive | Artifact Role | UI Layout | What the User Sees |
|-----------|------------------|---------------|-----------|-------------------|
| **Constitution** | ResearchDoc | `constitution` | `document` | Editable principles doc with agent suggestions |
| **Planning** | ResearchDoc + Task[] | `plan` | `split` | Plan document on left, task breakdown on right |
| **Execution** | Task + Command stream | `execution_log` | `stream` | Agent console with task progress sidebar |
| **Verification** | Hook + Task | `verification` | `timeline` | Pipeline stages with pass/fail indicators |

### Registration & Discovery

Workflows register themselves at startup:

```typescript
// A workflow plugin provides:
interface WorkflowPlugin {
  definition: WorkflowDefinition;
  adapter?: string;                    // preferred agent adapter, if any
  phaseRenderers?: Record<string, ComponentType>;  // custom phase UI overrides
  onPhaseEnter?: (phase: string, context: WorkflowContext) => void;
  onPhaseExit?: (phase: string, context: WorkflowContext) => void;
}
```

The framework ships with built-in workflow definitions for common patterns. Third-party or user-defined workflows register via the plugin system.

## Multi-Agent Support

The system is designed from the ground up to support multiple agent runtimes, not just Claude Code CLI.

### Agent Adapter Contract

Every agent runtime implements the `AgentAdapter` interface:

```typescript
interface AgentAdapter {
  id: string;                          // e.g., 'claude-cli', 'gsd', 'metamorph'
  name: string;
  capabilities: AgentCapabilities;     // what this agent supports

  // Lifecycle
  spawn(config: SessionConfig): AgentProcess;
  interrupt(sessionId: string): void;
  terminate(sessionId: string): void;

  // Discovery
  discoverCommands?(): Promise<CommandContract[]>;
  discoverSkills?(): Promise<SkillContract[]>;
  discoverMcps?(): Promise<McpContract[]>;
  discoverHooks?(): Promise<HookContract[]>;
}

interface AgentCapabilities {
  streaming: boolean;                  // real-time event output
  interruptible: boolean;              // can be interrupted mid-task
  commands: boolean;                   // supports slash commands
  skills: boolean;                     // supports skills
  mcps: boolean;                       // supports MCP servers
  hooks: boolean;                      // supports lifecycle hooks
  worktrees: boolean;                  // supports multiple worktrees
  costTracking: boolean;               // reports token/cost data
  subagents: boolean;                  // can spawn sub-agents
  autodiscovery: boolean;              // can enumerate its own capabilities
}
```

### Claude Code Auto-Discovery

Claude Code CLI is the first fully-implemented adapter. It supports auto-discovery of:

- **Skills** — enumerate available skills from the CLI, including user-defined ones
- **Commands** — slash commands (`/commit`, `/review-pr`, etc.) with parameter schemas
- **MCPs** — connected MCP servers and their available tools
- **Hooks** — configured hooks (session-start, pre-commit, etc.)

The adapter calls the CLI's introspection capabilities and normalizes results to the contract schemas.

### Adapter Registry

```
AdapterRegistry
├── claude-cli    → ClaudeCliAdapter    (implemented)
├── gsd           → GsdAdapter          (planned)
├── metamorph     → MetaMorphAdapter    (planned)
└── custom/*      → user-registered adapters via plugin API
```

The UI's adapter picker, session dispatch, and capability indicators all bind to the registry. Adding a new agent is: implement `AgentAdapter`, register it, done. The generic UI works immediately; specialized UI can be added progressively.

## Remote Access Architecture

Beyond the desktop app, users need to connect to a running instance from any web browser — e.g., monitoring a long-running agent session from a phone, or accessing the manager from a different machine.

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Desktop App (Tauri / Bun local)                        │
│  ┌─────────────┐  ┌──────────────────────────────────┐  │
│  │  Backend     │  │  Tunnel / Proxy Server           │  │
│  │  (Bun+Hono)  │──│  Exposes WS + REST over HTTPS   │  │
│  └─────────────┘  └──────────────┬───────────────────┘  │
└──────────────────────────────────┼──────────────────────┘
                                   │ Authenticated HTTPS/WSS
                    ┌──────────────▼───────────────┐
                    │  Proxy Service (cloud-hosted) │
                    │  Auth gateway + relay         │
                    └──────────────┬───────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
        ┌──────────┐        ┌──────────┐        ┌──────────┐
        │ Browser  │        │ Mobile   │        │ Another  │
        │ (remote) │        │ Browser  │        │ Desktop  │
        └──────────┘        └──────────┘        └──────────┘
```

### Access Modes

| Mode | How it works | Use case |
|------|-------------|----------|
| **Local** | Direct `localhost:PORT` access | Primary desktop use |
| **LAN** | Direct IP access on local network | Access from another device at home/office |
| **Remote (tunneled)** | Desktop ↔ proxy service ↔ browser | Access from anywhere (phone, travel laptop) |

### Security Model

- **Auth token** — generated on the desktop app, required for all remote connections
- **E2E encryption** — TLS between browser and proxy, proxy and desktop
- **Session tokens** — short-lived, revocable from the desktop app
- **Read-only mode** — option to connect as observer without ability to dispatch tasks
- **Rate limiting** — proxy enforces connection and request rate limits

### Implementation Options

1. **Self-hosted proxy** — user runs their own relay (e.g., on a VPS)
2. **Managed proxy service** — we host a thin relay (just auth + WebSocket forwarding, no data storage)
3. **Direct tunnel** — tools like Cloudflare Tunnel, ngrok, or Tailscale for direct p2p access

The proxy is intentionally **thin** — it authenticates and relays. All state and logic remain on the desktop instance. The remote browser loads the same React app, just pointed at the proxy URL instead of localhost.

### Responsive Design

The UI is fully responsive, supporting all screen sizes:

| Breakpoint | Target | Layout Adaptation |
|------------|--------|-------------------|
| **≥1280px** | Desktop | Full multi-panel layout (sidebar + main + detail) |
| **≥768px** | Tablet | Collapsible sidebar, stacked panels |
| **≥480px** | Phone landscape | Single panel with navigation drawer |
| **<480px** | Phone portrait | Single panel, bottom nav, condensed cards |

Implementation approach:
- **Container queries** (TW4 native) for component-level responsiveness
- **CSS `@media`** for top-level layout shifts
- **Touch-friendly targets** — minimum 44px tap targets on mobile
- **Swipe gestures** — panel navigation on mobile (swipe to switch between sidebar/main/detail)
- **Progressive disclosure** — mobile shows summary; expand for detail
- **Same React app** — no separate mobile app. One codebase, responsive CSS.

## Tech Stack

Priorities: **typesafety** and **testability** above all else.

### Runtime & Backend

| Choice | Why |
|--------|-----|
| **Bun 1.3** | Built-in HTTP/WS server, fast test runner, TS-native, child_process compat |
| **Hono** | Lightweight, end-to-end type-safe routes, works on Bun natively, RPC client for frontend |
| **Bun.serve()** | Unified HTTP + WebSocket in one server — no `ws` package needed |
| **SQLite via Bun** | Local-first persistence for sessions, issues, tasks. Tauri-friendly (single file) |

**Why Hono over raw Bun.serve():** Hono's `hono/client` gives us a typed RPC layer — the frontend gets autocomplete and type errors for every API call without codegen. Combined with Zod validators, every request/response is validated at the boundary and typed end-to-end.

### Frontend

| Choice | Why |
|--------|-----|
| **React 19** | Stable, ref-as-prop, Actions, `use()` hook |
| **Vite 7** | Fast dev, first-party TW4 plugin, proxy for backend |
| **Tailwind CSS 4** | CSS-first `@theme` config, Rust engine, built-in container queries |
| **shadcn/ui** | Copy-paste components we own, built on Radix, TW4 + React 19 ready |
| **TanStack Router** | File-based routing with full type safety (params, search, loaders all typed) |
| **Zustand** | Minimal, no boilerplate, works with React 19, easy to test (plain functions) |

**Why TanStack Router over React Router:** Type-safe route params, search params, and loaders. Every `useParams()`, `useSearch()`, `Link to=` is validated at compile time.

**Why Zustand over context:** Zustand stores are plain JS objects testable without React. No provider wrapping. Selectors prevent unnecessary re-renders. Works with React 19.

### Monorepo & Tooling

| Choice | Why |
|--------|-----|
| **Bun workspaces** | Same runtime everywhere, zero extra tooling |
| **TypeScript 5.9** | Current stable, strict mode |
| **Bun test** | Built-in, fast, Jest-compatible API, runs TS natively |
| **Playwright** | E2E tests for the UI |

### Desktop (future)

| Choice | Why |
|--------|-----|
| **Tauri 2.10** | Rust backend, OS webview, tiny binaries, SQLite-friendly |

Tauri considerations baked in now:
- SQLite for persistence (ships as single file, Tauri can access natively)
- All backend logic in pure TS/Bun (portable to Tauri's sidecar or Rust FFI later)
- No server-only features in UI (everything works via IPC or localhost)
- File paths handled via Tauri's path API abstraction when ready

### Type Safety Strategy

End-to-end types, no `any`, no codegen:

```
Zod schema (source of truth)
  ↓ infer
TypeScript types
  ↓ shared package
Backend (Hono validators)  ←→  Frontend (Hono RPC client)
  ↓                               ↓
Runtime validation              Compile-time autocomplete
```

- **Zod schemas** define all data shapes in `packages/shared/`
- **Hono validators** use Zod at route boundaries — invalid requests rejected with typed errors
- **Hono RPC client** (`hono/client`) — frontend calls `api.sessions.$get()` with full type inference
- **Zustand stores** typed from the same Zod-inferred types
- **WebSocket messages** validated with Zod discriminated unions on both sides
- **Zero `any`** — `tsconfig` strict mode, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`

### Testing Strategy

Every layer testable in isolation:

| Layer | Tool | What |
|-------|------|------|
| **Shared schemas** | `bun test` | Zod parse/reject for all types |
| **Backend routes** | `bun test` + Hono `testClient` | Type-safe route testing without HTTP |
| **Adapters** | `bun test` | Mock child processes, verify event normalization |
| **Zustand stores** | `bun test` | Plain function tests, no React needed |
| **React components** | `bun test` + Testing Library | Unit tests for component logic |
| **E2E flows** | Playwright | Full UI → backend → agent flow |

Hono's `testClient` is key — it lets us test routes as typed function calls:
```ts
const res = await testClient(app).api.sessions.$post({ json: { ... } });
// res is fully typed, no HTTP overhead
```

## Project Structure

```
agent-manager/
├── PLAN.md                     # This file
├── RESEARCH_PLAN.md            # Deep research notes
├── variant-showcase.pdf        # Visual reference for UI variants
├── bunfig.toml                 # Bun config
├── package.json                # Workspace root
│
├── packages/
│   ├── shared/                 # Shared types + schemas + contracts
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── schemas/        # Zod schemas (source of truth)
│   │   │   │   ├── events.ts   # AgentEvent schemas
│   │   │   │   ├── sessions.ts # Session, adapter schemas
│   │   │   │   ├── workflow.ts # Issue, task, plan schemas
│   │   │   │   └── ws.ts       # WebSocket command schemas
│   │   │   ├── contracts/      # Agent concept contracts
│   │   │   │   ├── command.ts  # CommandContract + specializations
│   │   │   │   ├── skill.ts    # SkillContract + specializations
│   │   │   │   ├── task.ts     # TaskContract + specializations
│   │   │   │   ├── research-doc.ts  # ResearchDocContract
│   │   │   │   ├── worktree.ts # WorktreeContract
│   │   │   │   ├── mcp.ts      # McpContract
│   │   │   │   ├── hook.ts     # HookContract
│   │   │   │   ├── chat-element.ts  # ChatElementContract (all inline UI types)
│   │   │   │   └── index.ts    # Contract re-exports
│   │   │   ├── workflows/      # Workflow plugin schemas
│   │   │   │   ├── definition.ts    # WorkflowDefinition, Phase, Transition
│   │   │   │   ├── mapping.ts       # PrimitiveMapping, PhaseUIConfig
│   │   │   │   ├── gsd.ts           # Built-in GSD workflow definition
│   │   │   │   └── index.ts
│   │   │   └── index.ts        # Public API
│   │   └── tests/
│   │
│   └── ui/                     # Agent concept UI component library
│       ├── package.json
│       ├── src/
│       │   ├── concepts/       # Agent concept components
│       │   │   ├── command-palette.tsx
│       │   │   ├── skill-card.tsx
│       │   │   ├── task-card.tsx
│       │   │   ├── research-doc-viewer.tsx
│       │   │   ├── worktree-selector.tsx
│       │   │   ├── mcp-browser.tsx
│       │   │   └── hook-config-panel.tsx
│       │   ├── chat/           # In-chat interactive elements
│       │   │   ├── choice-picker.tsx
│       │   │   ├── confirmation.tsx
│       │   │   ├── file-selector.tsx
│       │   │   ├── progress-indicator.tsx
│       │   │   ├── code-block.tsx
│       │   │   ├── tool-call-viewer.tsx
│       │   │   ├── cost-ticker.tsx
│       │   │   ├── diff-view.tsx
│       │   │   └── inline-form.tsx
│       │   ├── workflow/       # Workflow-specific UI
│       │   │   ├── phase-indicator.tsx
│       │   │   ├── phase-renderer.tsx  # Dispatches to layout-specific renderers
│       │   │   ├── workflow-progress.tsx
│       │   │   └── layouts/    # Phase layout implementations
│       │   │       ├── document-layout.tsx
│       │   │       ├── stream-layout.tsx
│       │   │       ├── kanban-layout.tsx
│       │   │       ├── timeline-layout.tsx
│       │   │       └── split-layout.tsx
│       │   ├── primitives/     # Shared UI primitives (shadcn/ui based)
│       │   │   └── ...         # Button, Card, Dialog, etc.
│       │   └── index.ts
│       └── tests/
│
├── apps/
│   ├── server/                 # Bun + Hono backend
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── app.ts          # Hono app (routes composed here)
│   │   │   ├── main.ts         # Entry: Bun.serve() with app
│   │   │   ├── routes/
│   │   │   │   ├── sessions.ts
│   │   │   │   ├── adapters.ts
│   │   │   │   ├── capabilities.ts  # Adapter capability/discovery routes
│   │   │   │   ├── workflows.ts     # Workflow CRUD + phase management
│   │   │   │   └── ws.ts           # WebSocket handler
│   │   │   ├── core/
│   │   │   │   ├── event-bus.ts
│   │   │   │   ├── process-manager.ts
│   │   │   │   ├── session-manager.ts
│   │   │   │   ├── workflow-engine.ts   # Phase state, transitions, events
│   │   │   │   └── adapter-registry.ts  # Multi-adapter registration + discovery
│   │   │   ├── adapters/
│   │   │   │   ├── adapter.ts       # AgentAdapter interface
│   │   │   │   ├── claude-cli.ts    # Claude Code CLI adapter
│   │   │   │   ├── gsd.ts          # GSD adapter (future)
│   │   │   │   └── metamorph.ts     # MetaMorph adapter (future)
│   │   │   ├── tunnel/             # Remote access
│   │   │   │   ├── tunnel-server.ts # Exposes local server via tunnel
│   │   │   │   └── auth.ts         # Token generation + validation
│   │   │   └── db/
│   │   │       ├── schema.ts
│   │   │       └── queries.ts
│   │   └── tests/
│   │
│   ├── web/                    # React frontend
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   ├── src/
│   │   │   ├── main.tsx
│   │   │   ├── routes/         # TanStack Router file-based routes
│   │   │   │   ├── __root.tsx
│   │   │   │   ├── index.tsx   # → redirect to /ops
│   │   │   │   ├── ops.tsx
│   │   │   │   ├── kanban.tsx
│   │   │   │   ├── brief.tsx
│   │   │   │   └── settings.tsx
│   │   │   ├── components/
│   │   │   │   ├── layout/     # Responsive shell (sidebar, nav, panels)
│   │   │   │   ├── ui/         # shadcn primitives (re-exported from packages/ui)
│   │   │   │   └── domain/     # App-specific compositions
│   │   │   ├── stores/
│   │   │   │   ├── sessions.ts
│   │   │   │   ├── workflow.ts
│   │   │   │   ├── adapters.ts     # Adapter registry + capabilities
│   │   │   │   └── connection.ts
│   │   │   ├── lib/
│   │   │   │   ├── api.ts      # Hono RPC client (typed)
│   │   │   │   └── ws.ts       # WebSocket manager
│   │   │   └── styles/
│   │   │       └── app.css     # Tailwind imports + @theme + responsive tokens
│   │   └── tests/
│   │
│   └── proxy/                  # Remote access proxy service (deployable)
│       ├── package.json
│       ├── src/
│       │   ├── main.ts         # Proxy entry point
│       │   ├── auth.ts         # Token validation + session management
│       │   └── relay.ts        # WebSocket + HTTP relay
│       └── tests/
│
└── prototype/                  # Archived UI exploration (14 variants)
    └── ...                     # Reference only — not the real app
```

## What We Keep From the Engine Prototype

The core abstractions in `src/` are solid and runtime-agnostic. Port them to `apps/server/`:

| Component | Action | Notes |
|-----------|--------|-------|
| `EventBus` | Port as-is | Pure TS, no Node dependencies |
| `ProcessManager` | Port, adapt for Bun | `child_process` → `Bun.spawn()` (or keep, Bun supports both) |
| `SessionManager` | Port as-is | Pure TS orchestrator |
| `Adapter` interface | Port as-is | Clean contract |
| `ClaudeCliAdapter` | Port as-is | Well-tested NDJSON parser |
| `AgentEvent` types | Rewrite as Zod schemas | Source of truth moves to `packages/shared/` |
| REST API routes | Rewrite in Hono | Gain typed routes + validation |
| WS transport | Rewrite for Bun.serve() WS | Native Bun WebSocket, no `ws` package |
| 38 tests | Port to `bun test` | Same assertions, new runner |

## Data Model

One type system, defined as Zod schemas in `packages/shared/`. Three layers:

### Core Schemas (existing)

- **AgentEvent** — 10 event types emitted by adapters (session_start, text_delta, tool_call, etc.)
- **Session** — runtime state of an agent execution (id, adapter, prompt, status, cost, events)
- **Issue** — external work item (Jira ticket, GH issue). The *what*.
- **Task** — local agent work unit. The *how*. One issue → many tasks. One task ↔ one session.
- **Plan** — analysis output: steps, affected repos, complexity, risks
- **VerificationPipeline** — 4-stage gate: Prechecks → AI Review → PR → Approval
- **Agent** — adapter instance with current status and cost tracking
- **Project/Repo** — container for repos with external links

### Agent Concept Contracts (new)

Abstract interfaces for agent capabilities, agent-agnostic:

- **CommandContract** — `{ id, name, description, parameters?, keybinding?, source }` — represents any action an agent can perform
- **SkillContract** — `{ id, name, description, triggers?, autoDiscoverable? }` — a higher-level capability
- **TaskContract** — `{ id, title, status, progress?, subtasks?, sessionId? }` — a tracked unit of work
- **ResearchDocContract** — `{ id, title, content, format, role }` — knowledge artifact (plan, constitution, analysis)
- **WorktreeContract** — `{ id, path, branch, repo, status }` — git worktree or workspace
- **McpContract** — `{ id, name, uri, tools[], status }` — MCP server/tool
- **HookContract** — `{ id, event, handler, enabled, lastRun? }` — lifecycle event handler
- **ChatElementContract** — discriminated union: `{ type: 'choice'|'confirm'|'file'|'progress'|'code'|'tool_call'|'cost'|'diff'|'form', payload }` — inline interactive UI

Each contract has a base type and optional specialization discriminated unions (e.g., `ClaudeSkillContract`, `GsdTaskContract`).

### Workflow Schemas (new)

- **WorkflowDefinition** — `{ id, name, phases[], initialPhase, transitions[], ui }` — describes an opinionated flow
- **WorkflowPhase** — `{ id, name, primitiveMapping, ui, entryConditions?, exitConditions? }` — one step in the flow
- **PrimitiveMapping** — how a phase maps to core contracts (primaryArtifact, artifactRole, supportingConcepts)
- **PhaseUIConfig** — `{ layout, components[], emphasis }` — how to render a phase
- **WorkflowPlugin** — `{ definition, adapter?, phaseRenderers?, hooks }` — a registered workflow
- **WorkflowState** — runtime state: current phase, phase history, phase-specific data

## Implementation Phases

### Phase 1: Scaffold + Port Engine ✅

Set up the monorepo, port the working engine code, verify with tests.

| Task | Description | Status |
|------|-------------|--------|
| Init Bun workspace | `package.json` workspaces, `bunfig.toml`, tsconfig | ✅ Done |
| Create `packages/shared` | Zod schemas for AgentEvent, Session, Workflow types | ✅ Done |
| Create `apps/server` | Hono app skeleton, port core engine (EventBus, ProcessManager, SessionManager) | ✅ Done |
| Port adapters | ClaudeCliAdapter → `apps/server/src/adapters/` | ✅ Done |
| Port + rewrite routes | Session/adapter CRUD as Hono typed routes with Zod validation | ✅ Done |
| Rewrite WS transport | Bun-native WebSocket in Hono | ✅ Done |
| Port tests | All 38 engine tests → `bun test` (84 tests now) | ✅ Done |
| Add DB layer | SQLite schema for sessions, issues, tasks | Pending |

### Phase 2: Contract System + Agent UI Components

Define the abstract contract layer and build the core UI component library. This is the foundation everything else builds on.

| Task | Description |
|------|-------------|
| **Contract schemas** | Define Zod schemas for all agent concept contracts in `packages/shared/`: `CommandContract`, `SkillContract`, `TaskContract`, `ResearchDocContract`, `WorktreeContract`, `McpContract`, `HookContract`, `ChatElementContract` |
| **Contract specialization** | Add extension mechanism for agent-specific contract variants (e.g., `ClaudeSkillContract extends SkillContract`) with discriminated unions |
| **`packages/ui`** | New shared package: agent concept UI components built on shadcn/ui. Agent-agnostic, contract-driven. |
| **Core concept components** | Implement: `CommandPalette`, `SkillCard`, `TaskCard`, `ResearchDocViewer`, `WorktreeSelector`, `McpBrowser`, `HookConfigPanel` |
| **Chat UI elements** | Implement inline chat elements: `ChoicePicker`, `Confirmation`, `FileSelector`, `ProgressIndicator`, `CodeBlock`, `ToolCallViewer`, `CostTicker`, `DiffView`, `InlineForm` |
| **Responsive foundations** | All components responsive from day one. Container queries for component-level, media queries for layout. Mobile-first design tokens. |
| **Component tests** | Unit tests for all components with Testing Library. Responsive snapshot tests at multiple breakpoints. |

### Phase 3: Frontend Shell + Responsive Layout

Stand up the real React app with routing, components, and live data. Responsive from the start.

| Task | Description |
|------|-------------|
| Init `apps/web` | Vite 7 + React 19 + TW4 + shadcn/ui |
| TanStack Router | File-based routes: `/ops`, `/kanban`, `/brief`, `/settings` |
| Responsive shell | Adaptive layout: multi-panel (desktop) → stacked (tablet) → single + drawer (mobile). Bottom nav on mobile. |
| Hono RPC client | Typed API client generated from server routes |
| WebSocket store | Zustand store for connection + real-time events |
| Session store | Zustand store for sessions, tasks, workflow state |
| Adapter store | Zustand store for adapter registry, capabilities, discovered commands/skills/MCPs |
| Ops view | Port design from prototype, wire to live stores, responsive layout |
| Kanban view | Port design from prototype, wire to live stores, responsive layout |
| Brief/dispatch view | Session creation: pick adapter, enter prompt, configure, launch. Adapter capability-aware. |

### Phase 4: Claude Auto-Discovery + End-to-End Flow

Complete the Claude adapter with full capability discovery. Wire the entire dispatch→stream→verify loop.

| Task | Description |
|------|-------------|
| Claude CLI discovery | Auto-discover skills, commands, MCPs, and hooks from the Claude CLI. Normalize to contract schemas. |
| Adapter capability API | REST endpoints + WS events for adapter capabilities. UI binds to discovered capabilities. |
| Real Claude CLI test | Test adapter against actual `claude` binary |
| Session lifecycle | Start → stream events → cost tracking → end/interrupt |
| Chat element rendering | Render inline chat UI elements (choices, confirmations, diffs) from agent events |
| Task ↔ Session link | One task = one session, bidirectional state sync |
| Verification pipeline | Run prechecks (lint/test/build) after session completes |
| Persistence | Sessions + events saved to SQLite, survive restart |

### Phase 5: Workflow Plugin System

Implement the workflow plugin architecture and ship the first built-in workflow (GSD).

| Task | Description |
|------|-------------|
| Workflow schemas | `WorkflowDefinition`, `WorkflowPhase`, `PrimitiveMapping`, `PhaseUIConfig` Zod schemas in `packages/shared/` |
| Workflow engine | Backend service: load workflow definitions, manage phase state, enforce transitions, emit phase events |
| Workflow registry | Plugin registration API. Built-in + user-defined workflows. |
| Workflow UI shell | Phase-aware layout: shows current phase, progress through phases, phase-specific UI |
| Phase renderers | Default renderers for each `PhaseUIConfig.layout`: `document`, `stream`, `kanban`, `timeline`, `split` |
| GSD workflow | Built-in workflow: Constitution → Planning → Execution → Verification. Maps to ResearchDoc, Task[], Command stream, Hook. |
| Custom workflow API | API for users to define and register their own workflows via JSON/YAML config |
| Workflow ↔ adapter binding | Workflows can declare preferred adapters. UI shows workflow-aware adapter picker. |

### Phase 6: Multi-Agent + Additional Adapters

Expand beyond Claude to support multiple agent runtimes.

| Task | Description |
|------|-------------|
| Adapter plugin API | Formalize adapter registration: implement `AgentAdapter` → register → generic UI works immediately |
| GSD adapter | Research GSD CLI output format, implement adapter, test discovery |
| MetaMorph adapter | Research MetaMorph CLI output format, implement adapter, test discovery |
| GitHub adapter | `gh` CLI for PR creation (verification pipeline stage 3) |
| Jira adapter | REST API for issue sync |
| Multi-session UI | Run multiple agent sessions simultaneously. Split-view, tabbed, or tiled layouts. |
| Cross-agent workflows | A single workflow can involve multiple agents (e.g., Claude for coding, MetaMorph for review) |
| File locking | Advisory locks to prevent agent-user collisions across concurrent sessions |

### Phase 7: Remote Access + Desktop

Enable web-based remote access and wrap in Tauri for native desktop.

| Task | Description |
|------|-------------|
| Tunnel server | Lightweight proxy service: auth gateway + WebSocket relay. No data storage. |
| Auth system | Token generation on desktop, short-lived session tokens, revocation UI |
| Remote connection | Browser connects to proxy URL, loads same React app, all state proxied from desktop |
| Read-only mode | Observer connections that can view but not dispatch tasks |
| LAN access | Direct IP access on local network with auth |
| Mobile optimization | Final responsive polish: swipe gestures, touch targets, bottom nav, condensed cards |
| Tauri shell | Wrap the web app in Tauri for native desktop |
| Tauri IPC | Replace HTTP with Tauri IPC commands for desktop mode (same API, different transport) |

### Phase 8: Polish + Ecosystem

| Task | Description |
|------|-------------|
| Custom adapter SDK | Documentation + template for building third-party adapters |
| Custom workflow SDK | Documentation + template for building third-party workflows |
| Plugin marketplace | Discovery and installation of community adapters/workflows |
| Theme system | Dark/light mode, customizable color schemes |
| Keyboard shortcuts | Full keyboard navigation, vim-style bindings option |
| Accessibility | WCAG 2.1 AA compliance, screen reader support |
| Performance | Bundle splitting, virtual scrolling for large event streams, WebSocket backpressure |
| Documentation | User guide, developer guide, API reference |

## Key UI Views (from prototype exploration)

| View | Role | Design Reference |
|------|------|------------------|
| **Ops** | Primary working view | `prototype/src/variants/ops/` |
| **Kanban** | Overview/triage board | `prototype/src/variants/kanban/` |
| **Brief** | Session start/dispatch | `prototype/src/variants/startup-brief/` |

The `prototype/` directory (14 variants, 92 screenshot tests) is preserved as design reference. The real app extracts the Ops/Kanban/Brief designs into `apps/web/` with proper architecture.
