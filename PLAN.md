# Agent Manager — Implementation Plan

> **Last Updated:** 2026-02-08
> **Status:** Engine prototype complete (Layers 1-3). Rebuilding as real app.

## Vision

A local desktop app that orchestrates AI agent sessions across multiple runtimes (Claude Code, GSD, MetaMorph, etc.), providing a unified UI for dispatching tasks, observing agent work in real-time, and verifying outputs through a structured pipeline — integrated with Jira and GitHub Enterprise.

## Hard Constraints

- **Subscription auth required** — must work with Claude Pro/Max subscriptions, not just API keys. This means wrapping the `claude` CLI (not embedding the SDK).
- **CLI-first adapter model** — all agent runtimes are spawned as child processes. The adapter pattern is: spawn process → parse structured stdout → normalize to `AgentEvent` → push to UI.
- **Local-first** — filesystem is the database. No mandatory cloud sync.
- **BYOK** — users bring their own subscriptions/keys for each runtime.

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│              UI (React 19 + shadcn + TW4)                │
│  Ops view (issue detail) │ Kanban (board overview)       │
│  Brief (session start)   │ Agent console (streaming)     │
└─────────────────────┬────────────────────────────────────┘
                      │ WebSocket / IPC
┌─────────────────────▼────────────────────────────────────┐
│            Backend (Bun + Hono)                          │
│  Sessions, adapters, events, persistence                 │
└─────────────────────┬────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
 ┌─────────────┐ ┌─────────┐ ┌───────────┐
 │ Claude CLI  │ │   GSD   │ │ MetaMorph │
 │   Adapter   │ │ Adapter │ │  Adapter  │
 └──────┬──────┘ └────┬────┘ └─────┬─────┘
        │              │            │
   claude -p ...   gsd run ...   mm exec ...
```

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
├── packages/
│   └── shared/                 # Shared types + schemas
│       ├── package.json
│       ├── src/
│       │   ├── schemas/        # Zod schemas (source of truth)
│       │   │   ├── events.ts   # AgentEvent schemas
│       │   │   ├── sessions.ts # Session, adapter schemas
│       │   │   └── workflow.ts # Issue, task, plan schemas
│       │   ├── types/          # Inferred TS types (re-exported)
│       │   └── index.ts        # Public API
│       └── tests/
├── apps/
│   ├── server/                 # Bun + Hono backend
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── app.ts          # Hono app (routes composed here)
│   │   │   ├── main.ts         # Entry: Bun.serve() with app
│   │   │   ├── routes/         # Hono route modules
│   │   │   │   ├── sessions.ts
│   │   │   │   ├── adapters.ts
│   │   │   │   └── events.ts   # WebSocket upgrade route
│   │   │   ├── core/           # Engine logic (ported from src/)
│   │   │   │   ├── event-bus.ts
│   │   │   │   ├── process-manager.ts
│   │   │   │   └── session-manager.ts
│   │   │   ├── adapters/       # CLI adapters
│   │   │   │   ├── adapter.ts
│   │   │   │   └── claude-cli.ts
│   │   │   └── db/             # SQLite persistence
│   │   │       ├── schema.ts   # Table definitions
│   │   │       └── queries.ts  # Typed query functions
│   │   └── tests/
│   │       ├── routes/         # Route tests via testClient
│   │       ├── adapters/       # Adapter unit tests
│   │       └── core/           # Engine unit tests
│   └── web/                    # React frontend
│       ├── package.json
│       ├── vite.config.ts
│       ├── src/
│       │   ├── main.tsx
│       │   ├── routes/         # TanStack Router file-based routes
│       │   │   ├── __root.tsx
│       │   │   ├── index.tsx   # → redirect to /ops
│       │   │   ├── ops.tsx
│       │   │   ├── kanban.tsx
│       │   │   └── brief.tsx
│       │   ├── components/     # shadcn/ui + custom components
│       │   │   ├── ui/         # shadcn primitives
│       │   │   └── domain/     # App-specific (IssueCard, TaskCard, etc.)
│       │   ├── stores/         # Zustand stores
│       │   │   ├── sessions.ts
│       │   │   ├── workflow.ts
│       │   │   └── connection.ts
│       │   ├── lib/            # API client, WS connection, utilities
│       │   │   ├── api.ts      # Hono RPC client (typed)
│       │   │   └── ws.ts       # WebSocket manager
│       │   └── styles/
│       │       └── app.css     # Tailwind imports + @theme
│       └── tests/
│           ├── components/     # Component unit tests
│           ├── stores/         # Store unit tests
│           └── e2e/            # Playwright E2E
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

One type system, defined as Zod schemas in `packages/shared/`:

- **AgentEvent** — 10 event types emitted by adapters (session_start, text_delta, tool_call, etc.)
- **Session** — runtime state of an agent execution (id, adapter, prompt, status, cost, events)
- **Issue** — external work item (Jira ticket, GH issue). The *what*.
- **Task** — local agent work unit. The *how*. One issue → many tasks. One task ↔ one session.
- **Plan** — analysis output: steps, affected repos, complexity, risks
- **VerificationPipeline** — 4-stage gate: Prechecks → AI Review → PR → Approval
- **Agent** — adapter instance with current status and cost tracking
- **Project/Repo** — container for repos with external links

## Implementation Phases

### Phase 1: Scaffold + Port Engine

Set up the monorepo, port the working engine code, verify with tests.

| Task | Description |
|------|-------------|
| Init Bun workspace | `package.json` workspaces, `bunfig.toml`, tsconfig |
| Create `packages/shared` | Zod schemas for AgentEvent, Session, Workflow types |
| Create `apps/server` | Hono app skeleton, port core engine (EventBus, ProcessManager, SessionManager) |
| Port adapters | ClaudeCliAdapter → `apps/server/src/adapters/` |
| Port + rewrite routes | Session/adapter CRUD as Hono typed routes with Zod validation |
| Rewrite WS transport | Bun-native WebSocket in Hono |
| Port tests | All 38 engine tests → `bun test` |
| Add DB layer | SQLite schema for sessions, issues, tasks |

### Phase 2: Frontend Shell

Stand up the real React app with routing, components, and live data.

| Task | Description |
|------|-------------|
| Init `apps/web` | Vite 7 + React 19 + TW4 + shadcn/ui |
| TanStack Router | File-based routes: `/ops`, `/kanban`, `/brief` |
| Hono RPC client | Typed API client generated from server routes |
| WebSocket store | Zustand store for connection + real-time events |
| Session store | Zustand store for sessions, tasks, workflow state |
| Ops view | Port design from prototype, wire to live stores |
| Kanban view | Port design from prototype, wire to live stores |
| Brief/dispatch view | Session creation: pick adapter, enter prompt, configure, launch |

### Phase 3: End-to-End Flow

A complete loop: dispatch task → agent runs → events stream → UI updates → session ends.

| Task | Description |
|------|-------------|
| Real Claude CLI test | Test adapter against actual `claude` binary |
| Session lifecycle | Start → stream events → cost tracking → end/interrupt |
| Task ↔ Session link | One task = one session, bidirectional state sync |
| Verification pipeline | Run prechecks (lint/test/build) after session completes |
| Persistence | Sessions + events saved to SQLite, survive restart |

### Phase 4: Polish + Integrate

| Task | Description |
|------|-------------|
| GitHub adapter | `gh` CLI for PR creation (verification pipeline stage 3) |
| Jira adapter | REST API for issue sync |
| Additional agent adapters | GSD, MetaMorph (research CLI output formats) |
| File locking | Advisory locks to prevent agent-user collisions |
| Tauri shell | Wrap the web app in Tauri for native desktop |

## Key UI Views (from prototype exploration)

| View | Role | Design Reference |
|------|------|------------------|
| **Ops** | Primary working view | `prototype/src/variants/ops/` |
| **Kanban** | Overview/triage board | `prototype/src/variants/kanban/` |
| **Brief** | Session start/dispatch | `prototype/src/variants/startup-brief/` |

The `prototype/` directory (14 variants, 92 screenshot tests) is preserved as design reference. The real app extracts the Ops/Kanban/Brief designs into `apps/web/` with proper architecture.
