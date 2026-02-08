# Agent Manager — Implementation Plan

> **Last Updated:** 2026-02-08
> **Status:** Layers 1+2+3 complete. Layer 4 next.

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
│                     UI (React)                           │
│  Ops view (issue detail) │ Kanban (board overview)       │
│  Brief (session start)   │ Agent console (streaming)     │
└─────────────────────┬────────────────────────────────────┘
                      │ WebSocket / IPC
┌─────────────────────▼────────────────────────────────────┐
│                 Session Manager                          │
│  Tracks sessions, routes events through EventBus         │
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
   --output-format
    stream-json
```

Each adapter implements the same interface:
1. `checkAvailability()` — verify the CLI binary exists
2. `startSession(config, onEvent)` — spawn process, normalize stdout, emit `AgentEvent`s

## Layers & Progress

### Layer 1: Core Engine — DONE

| Component | File | Status | Description |
|-----------|------|--------|-------------|
| Event types | `src/types/events.ts` | Done | 10 normalized `AgentEvent` types |
| CLI types | `src/types/claude-cli.ts` | Done | Raw `stream-json` NDJSON types |
| Process Manager | `src/core/process-manager.ts` | Done | Spawn/track/kill child processes, parse NDJSON |
| Event Bus | `src/core/event-bus.ts` | Done | Typed pub/sub (global + per-session) |
| Session Manager | `src/core/session-manager.ts` | Done | Multi-session orchestrator, cost tracking |

### Layer 2: Adapter System — DONE (Claude adapter)

| Component | File | Status | Description |
|-----------|------|--------|-------------|
| Adapter interface | `src/adapters/adapter.ts` | Done | Universal contract for any CLI agent |
| Claude CLI adapter | `src/adapters/claude-cli.ts` | Done | Wraps `claude -p --output-format stream-json` |
| Tests | `src/adapters/claude-cli.test.ts` | Done | 10 tests passing (fake claude shell scripts) |

### Layer 3: Transport + API Server — DONE

Expose the engine over WebSocket so the React UI can connect.

| Component | File | Status | Description |
|-----------|------|--------|-------------|
| WebSocket server | `src/server/ws.ts` | Done | Streams `AgentEvent`s to connected UI clients via subscribe/unsubscribe commands |
| REST endpoints | `src/server/api.ts` | Done | Start/stop/list sessions, list adapters, check availability |
| Server entry | `src/server/index.ts` | Done | `createServer()` factory combining WS + REST with CORS support |
| Tests | `src/server/server.test.ts` | Done | 17 tests (11 REST + 6 WebSocket) |

### Layer 4: UI Integration — TODO

Wire the existing Ops and Kanban prototypes (in `prototype/`) to live data from the engine.

| Component | Status | Description |
|-----------|--------|-------------|
| Ops view | TODO | Replace mock data with WebSocket event stream |
| Kanban view | TODO | Replace mock data with session list + status |
| Brief startup | TODO | Session start page with adapter selection |
| Shared types | TODO | Move `AgentEvent` types to a shared package usable by frontend |

### Layer 5: Additional Adapters — TODO

| Adapter | Status | Notes |
|---------|--------|-------|
| Claude CLI | Done | `claude -p --output-format stream-json` |
| GSD | TODO | Need to research GSD CLI output format |
| MetaMorph | TODO | Need to research MetaMorph CLI output format |

### Layer 6: External System Integration — TODO

| Component | Status | Description |
|-----------|--------|-------------|
| Jira adapter | TODO | Pull issues, push status updates |
| GitHub Enterprise adapter | TODO | PR creation, review status, CI checks |
| Verification pipeline runner | TODO | Prechecks → AI Review → PR → Approval |

## Data Model

Two type systems exist (see `prototype/src/types/`):

1. **Primitives** (`primitives.ts`) — abstract: Context, Strategy, Execution, Verification. Used by the 8 main UI variants.
2. **Workflow** (`workflow.ts`) — concrete: Project → Issue → Plan → Task → VerificationPipeline. Used by Ops and Kanban. **This is the primary model going forward.**

The workflow model maps to real dev workflows:
- **Issue** = external work item (Jira ticket, GH issue). The *what*.
- **Task** = local agent work unit. The *how*. One issue → many tasks.
- **VerificationPipeline** = 4-stage gate per task: Prechecks (auto) → AI Review (auto) → PR (auto) → Approval (manual).

## Key UI Variants (from 14 explored)

| Variant | Role | Why |
|---------|------|-----|
| **Ops** | Primary working view | Detail view: issue → plan → tasks → verification pipeline → agent activity |
| **Kanban** | Overview/triage | Board across all issues: Backlog → Planning → In Progress → Blocked → Review → Done |
| **Brief** | Session start | Mission briefing + chat sidebar. Entry point for new sessions |

The other 11 variants (AgentOS, Hive, Pipeline, Nerve Center, Mosaic, Command Center, Flow, Spatial, Chat, Dashboard, Command) are preserved in `prototype/` for reference.

## File Structure

```
agent-manager/
├── RESEARCH_PLAN.md        # Deep research (SDK analysis, trade-offs, experiments)
├── PLAN.md                 # This file — concrete implementation plan
├── variant-showcase.pdf    # Visual reference for all 14 UI variants
├── package.json            # Engine deps
├── tsconfig.json
├── src/                    # Orchestration engine
│   ├── index.ts            # Public API
│   ├── types/
│   │   ├── events.ts       # Normalized AgentEvent schema (10 types)
│   │   └── claude-cli.ts   # Raw stream-json NDJSON types
│   ├── core/
│   │   ├── process-manager.ts  # Child process spawn + NDJSON parsing
│   │   ├── event-bus.ts        # Typed pub/sub
│   │   └── session-manager.ts  # Multi-session orchestrator
│   ├── adapters/
│   │   ├── adapter.ts          # Universal adapter interface
│   │   ├── claude-cli.ts       # Claude Code CLI adapter
│   │   └── claude-cli.test.ts  # 10 tests
│   └── server/
│       ├── ws.ts               # WebSocket transport (subscribe/unsubscribe)
│       ├── api.ts              # REST API handler (sessions, adapters)
│       ├── index.ts            # createServer() factory
│       └── server.test.ts      # 17 tests
└── prototype/              # UI prototypes (14 variants, 92 screenshot tests)
    ├── src/variants/...
    ├── src/types/          # Primitives + Workflow type systems
    └── ...
```

## Next Steps

1. **Layer 4: Wire Ops view** — replace mock data with real event stream; one issue, one task, one live agent
2. **GSD/MetaMorph adapters** — research their CLI output formats and implement adapters
3. **GitHub adapter** — `gh` CLI or GraphQL for PR creation (connects to the "PR" stage of verification pipeline)
4. **Jira adapter** — REST API for issue sync
