# Agent Manager — Implementation Plan

> **Last Updated:** 2026-02-10
> **Status:** Phase 1 complete (engine ported). Differentiation defined: universal agent shell for full project workflows.

## Vision

**The universal agent shell for full project workflows.**

A high-performance desktop app (with remote web access) that provides the *operating environment* for AI coding agents. Not an IDE, not a terminal multiplexer, not locked to one agent — a standalone shell that renders rich UI for the concepts agents expose (commands, skills, tasks, MCPs, hooks, worktrees) through standards-based contracts, supports any agent via adapters, and enables full project workflows without forcing a specific methodology.

Standards-first: MCP for tools, AG-UI for streaming, A2A for discovery. Skills, commands, and hooks are first-class UI citizens with auto-discovery. Workflow plugins (GSD, custom) provide opinionated flows that map onto the primitive UI components. Any agent runtime plugs in through one adapter.

The framework defines **abstract contracts** for agent concepts that allow both generic and specialized UI rendering, and supports **pluggable workflow systems** where opinionated high-level flows (like GSD's plan→execute→verify) map onto the primitive UI components. The desktop app also exposes a **remote access layer**, allowing authenticated users to connect to a running instance from any web browser, including mobile devices.

## Competitive Landscape

The space is crowded but fragmented. Every tool occupies a specific niche. Nothing occupies ours.

### Existing Categories

**1. IDE Extensions (locked to one editor)**
- **Cline** (4M+ installs) — VS Code extension, single-agent Plan/Act pipeline, MCP tools, model-agnostic but locked to VS Code. No multi-agent.
- **Roo Code** — VS Code fork of Cline with multi-agent roles, but still VS Code-only.
- **Continue.dev** — VS Code/JetBrains extension, open-source, best MCP integration, model-agnostic. But it's an *extension*, not a shell.
- **Cursor** — Full IDE (VS Code fork), deep agent integration, background agents, worktrees. But it IS the IDE — you can't use it alongside your existing editor.

**2. Agent Orchestrator Desktop Apps (closest to us)**
- **Conductor** (conductor.build, Melty Labs) — **Our closest competitor.** macOS-only desktop app for running parallel Claude Code / Codex agents in isolated git worktrees. Rich UI: diff viewer with turn-by-turn diffs, checkpoints with revert, MCP support, PR creation, workspace-per-feature flow, scratchpad, code review with inline comments, workspace status (backlog/in-progress/in-review/done). Backed by $2.8M funding, used by Linear/Vercel/Notion/Stripe engineers. 250% growth Jan 2026. But: **macOS-only**, **Claude/Codex-only** (no adapter system for arbitrary agents), **no workflow plugin system** (single fixed workflow: create workspace → develop → review → PR → merge), **no standards-based extensibility** (no AG-UI, A2A — direct CLI wrapping only), **no remote web access**, **no mobile**, **no contract architecture for agent concepts** (skills/hooks rendered as Claude Code features, not abstract contracts). It's a well-polished "run Claude Codes in parallel" app, not a universal agent shell.
- **Agents UI** (macOS, Tauri) — native terminal app for multi-agent sessions. Closest to us in tech (Tauri) but terminal-first, no agent concept UI, no workflows.

**3. Terminal Session Managers (TUI, no rich UI)**
- **Agent Deck** (Go + Bubble Tea TUI) — multi-agent sessions via tmux, MCP management, worktrees, session forking. Smart status detection. But it's a TUI — no graphical UI, no workflow representation, no chat elements.
- **Agent of Empires** — multi-agent via tmux + Docker sandboxing. Similar limitations.
- **Conduit**, **TmuxCC** — same category, less featured.

**4. Autonomous Agent Platforms (opinionated, closed)**
- **Devin** — full VM-based autonomous agent. Rich UI (planner, timeline, browser, editor). But it's *Devin's* UI for *Devin's* agent. Not extensible. Not a shell.
- **Jules** — Google's async agent. Cloud-only. Rich activity model. But closed platform.
- **OpenAI Codex App** (macOS, Feb 2026) — multi-agent management, skills as first-class objects. But OpenAI-only.

**5. Agent Frameworks / SDKs (developer tools, not end-user UIs)**
- **OpenHands** (64k stars) — event-sourced SDK + web UI. Modular V1 architecture. But the UI is a single-agent coding interface, not a multi-agent project shell.
- **CopilotKit** (28.6k stars) — AG-UI protocol, generative UI, multi-agent orchestration. But it's an *in-app framework* — for embedding agents in YOUR app, not a standalone shell.
- **Goose** (27k stars, Block) — CLI + desktop, MCP-native, 3000+ MCP servers. But single-agent, no workflow system, minimal UI.
- **LangGraph** — agent state machines. Backend framework, no UI.

**6. Platform Agent Hubs (locked to platform)**
- **VS Code Agent HQ** — unified multi-agent dashboard within VS Code. Multi-vendor (Copilot, Claude, Codex). But it's inside VS Code — you must use VS Code.
- **GitHub Copilot Workspace** — most sophisticated staged workflow (spec→plan→implement→verify). But GitHub-only, Copilot-only.

**7. Standards Emerging (protocols, not products)**
- **AG-UI** (CopilotKit) — agent↔frontend streaming protocol
- **A2UI** (Google) — declarative agent-generated UI specification
- **MCP** (Anthropic/Linux Foundation) — agent↔tool protocol
- **A2A** (Google/Linux Foundation) — agent↔agent discovery
- **AGENTS.md** (OpenAI/Linux Foundation) — project-level agent instructions

### The Gap

| What exists | What's missing |
|-------------|---------------|
| IDE extensions with agent features | A standalone shell that works with *any* editor/terminal |
| TUI session managers for multi-agent | Rich graphical UI for agent concepts (skills, MCPs, hooks, workflows) |
| Conductor (parallel Claude/Codex, polished UI) | **Agent-agnostic** orchestration (not locked to 2 agents). **Pluggable workflows** (not one fixed flow). **Standards-based** extensibility. Cross-platform + remote access. |
| Opinionated agent platforms (Devin, Jules) | An *open*, *extensible* shell that any agent can plug into |
| Agent frameworks for developers | An *end-user* product for managing project-level agent work |
| Per-agent UIs (each agent has its own) | A *unified* UI that renders any agent's concepts through contracts |
| Workflow tools (Copilot Workspace) | Workflow support that's *not locked to one agent* |
| Protocol standards (AG-UI, MCP, A2A) | A product that *implements all of them together* as a coherent shell |

**Conductor is the closest competitor** — same category (desktop app for orchestrating coding agents), similar features (worktrees, diff viewer, checkpoints, MCP). But it's a polished **Claude/Codex runner**, not a **universal agent shell**. It has no adapter system, no contract architecture, no workflow plugins, no standards-based extensibility, no remote access, no cross-platform support. We build the operating environment that Conductor's features are a subset of.

## Differentiation

### What We Are

**A universal agent shell for full project workflows.**

Not an IDE. Not a framework. Not a TUI. Not locked to one agent. A standalone desktop app (with remote web access) that provides:

1. **Rich, first-party UI for agent primitives** — commands, skills, tasks, MCPs, hooks, worktrees, research docs are not just listed but have dedicated, interactive, beautiful components that any agent can populate through contracts
2. **Full project workflow support** — from "what should I work on?" to "is this done?" — without forcing a specific methodology. The shell supports plan-first, execution-first, or any workflow pattern through the plugin system
3. **Standards-based extensibility** — MCP for tools, AG-UI for streaming, A2A for discovery. Skills, commands, hooks are first-class concepts with auto-discovery. Not our own proprietary extension format.
4. **Adapter-based multi-agent** — Claude Code, OpenHands, Goose, GSD, MetaMorph, or any CLI agent. One adapter = full UI integration.

### What We Are NOT

- **Not an IDE** — we don't replace your editor. We run alongside it (like Devin's web UI, but local and multi-agent).
- **Not a terminal multiplexer** — Agent Deck/Conduit manage terminal sessions. We provide *graphical UI* for agent *concepts*.
- **Not a framework for embedding AI** — CopilotKit helps you build AI into YOUR app. We ARE the app.
- **Not locked to one agent** — unlike Devin, Jules, Copilot Workspace, or Codex App.
- **Not locked to one workflow** — unlike Copilot Workspace's spec→plan→implement→verify.

### The "Operating Environment" Metaphor

Think of it as the **desktop environment for AI agents**:

| Desktop OS Concept | Agent Shell Equivalent |
|-------------------|----------------------|
| Window Manager | Session Manager (multiple agent sessions in panels/tabs) |
| File Manager | Worktree Browser (navigate repos/branches agents work in) |
| System Preferences | Adapter Configuration (model, auth, MCP servers, hooks) |
| Task Manager | Agent Dashboard (running sessions, resource usage, cost) |
| App Store | Adapter + Workflow Plugin Registry |
| Notification Center | Event Stream (agent progress, errors, input-required) |
| Launcher / Dock | Command Palette + Skill Picker + Workflow Starter |

### Key Differentiators vs. Closest Competitors

| vs. | Their approach | Our differentiation |
|-----|---------------|-------------------|
| **Conductor** | macOS app for parallel Claude/Codex in worktrees. Diff viewer, checkpoints, PR flow. $2.8M funded. | **Cross-platform** (not macOS-only). **Any agent** via adapters (not just Claude/Codex). **Standards-based** (AG-UI, MCP, A2A — not just CLI wrapping). **Workflow plugins** (not one fixed flow). **Remote web access** + mobile. **Abstract contracts** for agent concepts (skills/hooks/MCPs work for any agent, not just Claude's). Conductor is a polished parallel-Claude runner; we're the universal agent operating environment. |
| **Agent Deck** | TUI over tmux. Multi-agent sessions. | Rich graphical UI. Agent concept components (skills, MCPs, hooks). Workflow system. Remote access. |
| **Agents UI** | Native terminal app (Tauri). Multi-session. | Same tech (Tauri), but we add contract-driven concept UI, workflow plugins, responsive web access. |
| **VS Code Agent HQ** | Multi-agent dashboard inside VS Code. | Standalone — works with any editor. Deeper agent concept UI. Not locked to VS Code ecosystem. |
| **Devin** | Richest agent UI (planner, timeline, browser). | Open + multi-agent. Not locked to Cognition's agent. Adapter pattern means any agent gets the UI. |
| **CopilotKit** | Framework for building agent-native apps. | End-user product, not a framework. We USE AG-UI protocol; they provide it. |
| **OpenHands** | Event-sourced SDK + web UI. | We're a shell, not an SDK. Could integrate OpenHands as an adapter. |
| **Goose** | CLI + desktop, MCP-native. | Richer UI, workflow system, multi-agent. Goose could be an adapter. |

### Adapter Strategy (Priority Order)

| Adapter | Priority | Why | Difficulty |
|---------|----------|-----|-----------|
| **Claude Code CLI** | P0 | Primary user base. Richest concept surface (skills, commands, hooks, MCPs, worktrees, subagents). Best stream-json protocol. | Implemented |
| **OpenHands** | P1 | 64k stars, event-sourced architecture maps cleanly to our event bus. REST+WS API already exists. Open source. | Medium — existing API |
| **Goose** | P1 | 27k stars, MCP-native, CLI + desktop. Apache 2.0. Large community. | Medium — CLI wrapper |
| **Codex CLI** | P2 | OpenAI's agent. NDJSON output, MCP server mode. Large enterprise user base. | Easy — NDJSON similar to Claude |
| **Aider** | P2 | Popular terminal agent, architect/editor split. | Easy — terminal output parsing |
| **GSD** | P2 | Opinionated workflow (constitution→plan→execute→verify). First workflow plugin candidate. | Medium — workflow mapping |
| **MetaMorph** | P3 | Multi-agent orchestration. | Research needed |
| **Continue.dev** | P3 | Model-agnostic, MCP-first. Could be complementary. | Research needed |

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

## App Shell Design

The app shell is the outermost layout chrome — navbar, sidebar, status bar, and panel arrangement. It is intentionally **dumb**: it renders content grouped by adapter but has no opinion about what adapters do or how they work. All intelligence lives in the adapters; the shell is just a frame.

### Core Principles

1. **Shell is a dumb renderer.** The shell provides layout (sidebar, main, detail panels), navigation, and grouping. It does not interpret adapter content — it receives structured data and renders it.
2. **Adapters drive content.** Each adapter declares what it supports via `AgentCapabilities`. The shell uses this to decide which nav sections to show (Sessions, Skills, MCP Servers, Hooks, Worktrees) per adapter.
3. **Default renderer with adapter override.** Every content type has a default renderer (e.g., sessions render as chat threads). Adapters can optionally provide richer views when they have something better to offer. Files open predictably; adapters enhance progressively.

### Multi-Adapter Concurrency

Multiple adapters (and workflow extensions layered on the same base adapter) run **fully concurrently**. The shell handles this by:

- **Grouping by adapter.** The nav tree organizes all content under its owning adapter. Sessions, skills, workflows, MCP servers — everything is scoped to the adapter that provides it.
- **Primary vs. background awareness.** Each adapter can detect whether it's the **primary active** adapter (e.g., because the user initiated a session through it directly) or **backgrounded** (another adapter took over the user's focus). This distinction affects which actions an adapter surfaces — the primary adapter shows its full action set, while backgrounded adapters show minimal or contextual actions only.
- **Shell renders both.** When multiple adapters are active, the shell renders all of their content, grouped by adapter. There is no conflict resolution at the shell level — if two adapters both provide suggested actions, both sets appear (grouped under their respective adapter headers). The user disambiguates by context.

This means a workflow extension like GSD that runs **within** Claude Code is handled entirely by Claude — the shell doesn't need to know about GSD's internals. If a separate adapter (e.g., `aider`) is also running, its content appears in its own nav tree section.

### AgentCapabilities

Each adapter declares its capabilities in the manifest:

```typescript
interface AgentCapabilities {
  streaming: boolean;        // real-time event output
  interruptible: boolean;    // can be interrupted mid-task
  commands: boolean;         // supports slash commands
  skills: boolean;           // supports skills
  mcps: boolean;             // supports MCP servers
  hooks: boolean;            // supports lifecycle hooks
  worktrees: boolean;        // supports multiple worktrees
  costTracking: boolean;     // reports token/cost data
  subagents: boolean;        // can spawn sub-agents
  autodiscovery: boolean;    // can enumerate its own capabilities
}
```

The sidebar nav tree only shows sections for capabilities the adapter actually supports. An adapter that doesn't support MCP won't have an "MCP Servers" section. An adapter that doesn't support skills won't show a "Skills" section. This keeps the UI honest — you only see what's real.

### Nav Tree Structure

```
AGENTS
├── claude-code (●connected)
│   ├── Sessions (expandable)
│   │   ├── ● Add unit tests for payment... (running)
│   │   ├── ● Refactor auth module... (completed)
│   │   └── ● Fix database pool leak... (failed)
│   ├── Workflows (if adapter.capabilities → supported)
│   ├── Skills (if adapter.capabilities.skills)
│   └── MCP Servers (if adapter.capabilities.mcps)
├── aider (●starting, dimmed)
│   └── Sessions
│       └── ● Migrate from Express... (starting)
WORKSPACES
├── ● main (clean)
├── ● feature/auth (dirty, 5 files)
└── ● fix/overflow (conflict)
Settings
```

### Session Context in Sidebar

Sessions in the nav tree show meaningful context beyond just the adapter ID:
- **Prompt snippet** — truncated first line of the task prompt
- **Status indicator** — color-coded dot (running/completed/failed/starting)
- **Model** — which model is being used (when relevant)
- **Working directory** — the cwd context for the session

### Command Actions (Landing View)

When no session is selected, the main panel shows adapter-provided actions:
- **Workflows** — multi-phase operations the adapter supports (Plan & Build, Code Review, Debug & Fix)
- **Quick Commands** — slash commands from adapter discovery (`/commit`, `/test`, `/refactor`)
- **Context hints** — environmental awareness (uncommitted files, MCP errors, active workflow progress)
- **Composer** — prompt input to start a new session

These actions are grouped by adapter. When multiple adapters are active, each adapter's actions appear under its own header. The primary adapter's actions appear first/prominently.

#### Command Invocation Modes

Not every command is a fire-and-forget button press. The `invocation` field on `CommandContract` (aligned with ACP's `AvailableCommand.input`) determines how each command is rendered and triggered:

| Mode | When | UI Rendering | Example |
|------|------|-------------|---------|
| **`immediate`** (or absent) | No user input needed | Single-click chip/button | `/compact`, `/clear`, `/stop` |
| **`prompt`** | Requires free-form text | Chip → inline input field with `hint` placeholder | `/plan` → "What should I plan?", `/search` → "Search query" |
| **`form`** | Requires structured parameters | Chip → mini-form with named fields | `/deploy` → [env: staging/prod] [branch: ___] |

This prevents the "waste tokens" problem where invoking a prompt-requiring command with no input causes the agent to hallucinate or request clarification on its first turn. The shell can enforce: don't submit a `prompt` command with empty input.

#### Context-Aware Action Suggestions (v2)

**Beyond static command lists:** Instead of showing all available commands equally, the shell can use a lightweight model to suggest contextually relevant actions based on the current conversation state.

**How it works:**
1. Agent adapters advertise their available commands via ACP's `AvailableCommandsUpdate` (or our equivalent)
2. The shell maintains conversation context: recent messages, active session state, visible files, git status
3. A small/fast LLM (Haiku-class) reads the context and the available command list, then returns a ranked subset with pre-filled prompt suggestions

**Example flow:**
```
Context: User just reviewed a PR and the agent showed 3 failing tests.

Available commands: /plan, /commit, /test, /review-pr, /compact, /help, ...

LLM suggestion:
  1. /test  → "Re-run the 3 failing tests after the fix"  [immediate]
  2. /plan  → "Fix the test failures in auth.test.ts"       [pre-filled prompt]
  3. /commit → "Commit the PR review changes"               [pre-filled prompt]
```

**Design constraints:**
- The LLM call must be **non-blocking** — the static command list always renders immediately, suggestions overlay/reorder asynchronously
- **Caching** — same context fingerprint → skip the LLM call
- **Cost-conscious** — Haiku-class model, aggressive prompt compression, only trigger on meaningful context changes (not every keystroke)
- **Fallback** — if the LLM call fails or times out, the UI shows the default alphabetical/grouped command list

**This is a v2 feature.** For v1, the shell renders commands statically using the `invocation` metadata. Context-aware suggestions are an enhancement once the command system is stable.

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

## Protocol Stack

Three complementary protocols form the interoperability backbone. Each operates at a different layer.

```
┌──────────────────────────────────────────────────────────┐
│  UI Layer                                                │
│  AG-UI events → React components (assistant-ui / custom) │
└─────────────────────────┬────────────────────────────────┘
                          │ 16 typed streaming events
┌─────────────────────────▼────────────────────────────────┐
│  AG-UI Protocol (@ag-ui/core)                            │
│  Agent ↔ Frontend communication                          │
│  text_delta, tool_call_start/args/result, state_snapshot │
│  state_delta, run_start/end, messages, custom            │
└─────────────────────────┬────────────────────────────────┘
                          │
         ┌────────────────┼────────────────┐
         ▼                ▼                ▼
┌─────────────┐  ┌──────────────┐  ┌─────────────────┐
│ MCP         │  │ A2A          │  │ Agent Adapter    │
│ Agent↔Tool  │  │ Agent↔Agent  │  │ (CLI wrapper)    │
│ Tools,      │  │ Agent Cards, │  │ spawn → parse →  │
│ Resources,  │  │ Tasks, SSE   │  │ normalize events │
│ Prompts     │  │ JSON-RPC 2.0 │  │                  │
└─────────────┘  └──────────────┘  └─────────────────┘
```

### MCP — Model Context Protocol

The canonical way to define tools, resources, and prompts that any agent can consume.

| Detail | Value |
|--------|-------|
| npm | `@modelcontextprotocol/sdk` v1.26.0 |
| Stars | ~11.6k |
| License | Apache 2.0 / MIT |
| Spec version | 2025-11-25 |
| Peer deps | `zod` (v3.25+ or v4) |

**What we use it for:**
- `McpContract` schema derived from MCP's tool/resource/prompt definitions
- MCP client in adapters to discover tools from connected MCP servers
- `@modelcontextprotocol/hono` for Hono integration on our backend
- MCP UI extensions (`@mcp-ui/client`, `@mcp-ui/server`) for rendering interactive tool results inline

### A2A — Agent-to-Agent Protocol (Google)

Discovery and communication between agents from different providers/frameworks.

| Detail | Value |
|--------|-------|
| npm | `@a2a-js/sdk` |
| License | Apache 2.0 |
| Spec version | v0.3 (July 2025) |
| Governance | Linux Foundation |
| Supporters | 150+ orgs (Atlassian, Salesforce, Microsoft, LangChain) |

**What we use it for:**
- **Agent Cards** (`/.well-known/agent.json`) for dynamic adapter discovery — agents register their name, endpoint, skills, auth, and capabilities
- **Task lifecycle states** (submitted, working, input-required, completed, canceled, failed) as a standard vocabulary for `TaskContract.status`
- **A2UI** for agents that generate UI layouts as messages (renderable by our framework)
- Future: cross-agent workflow orchestration (Phase 6)

### AG-UI — Agent-to-Frontend Protocol (CopilotKit)

The emerging standard for agent-to-frontend streaming communication. 16 typed event types.

| Detail | Value |
|--------|-------|
| npm | `@ag-ui/core` v0.0.44, `@ag-ui/client`, `@ag-ui/proto` |
| License | MIT |
| Adopters | Google, LangChain, AWS, Microsoft, Mastra, PydanticAI |

**What we use it for:**
- **Wire format** for agent→UI streaming: text deltas, tool calls (start/args/result), state snapshots/deltas, run lifecycle, custom events
- `@ag-ui/client` (`HttpAgent`, `AbstractAgent`) as base class for adapters that speak AG-UI natively
- `@ag-ui/langgraph` for LangGraph agent integration
- `@ag-ui/proto` for Protocol Buffers binary serialization (high-throughput scenarios)
- Map our `AgentEvent` types to AG-UI's 16 event types for interop

### Protocol Relationship

| Layer | Protocol | Purpose |
|-------|----------|---------|
| Agent ↔ Tool | **MCP** | Define and invoke tools, resources, prompts |
| Agent ↔ Agent | **A2A** | Cross-agent discovery, delegation, communication |
| Agent ↔ Frontend | **AG-UI** | Real-time streaming events for UI rendering |
| Agent ↔ Our Backend | **Adapter** | CLI wrapper (spawn → parse → normalize to AG-UI events) |

Our adapters normalize any agent's output into AG-UI events. The UI binds to AG-UI events. MCP defines the tool/resource layer. A2A enables multi-agent discovery. All three are open protocols under active governance.

## Library Selections

Research-validated selections, all confirmed React 19 + Tailwind 4 compatible.

### AI Chat & Agent UI

| Library | npm | Stars | License | Role |
|---------|-----|-------|---------|------|
| **assistant-ui** | `@assistant-ui/react` v0.12.9 | 8.4k | MIT | Composable chat primitives (Thread, Message, Composer, Tool Call rendering). Radix-style API. shadcn/ui theme. Vercel AI SDK + MCP integrations. |
| **CopilotKit** | `@copilotkit/react-core` v1.51.3 | 28.6k | MIT | Reference for AG-UI protocol integration, `useAgent` hook pattern, shared state model. We adopt the protocol, not the full framework. |
| **Vercel AI SDK** | `ai` v6, `@ai-sdk/react` | 21.6k | Apache 2.0 | `useChat` hooks for streaming state management, provider abstraction, `UIMessage` with `parts` type system. |

**Decision:** Use **assistant-ui** as the chat component foundation (composable primitives, shadcn-compatible). Adopt **AG-UI protocol** from CopilotKit as our event wire format. Use **Vercel AI SDK** patterns for streaming hooks and message types.

### Code & Developer Tools

| Library | npm | Version | Stars | React 19 | Role |
|---------|-----|---------|-------|----------|------|
| **Monaco Editor** | `@monaco-editor/react` | 4.7.0 | ~4k | Yes | Primary code editor (full IDE features, diff editor, IntelliSense) |
| **CodeMirror 6** | `@uiw/react-codemirror` | 4.25.4 | ~2.1k | Yes | Lightweight inline editor (config panels, quick-edit, ~50KB vs Monaco's ~2MB) |
| **Shiki** | `shiki` + `react-shiki` | 3.22.0 | ~12.9k | Yes | Syntax highlighting (VS Code engine, 200+ languages, streaming-friendly) |
| **xterm.js** | `@xterm/xterm` | 6.0.0 | ~20k | Yes (agnostic) | Terminal emulation for agent command execution display |
| **Diff Viewer** | `@alexbruf/react-diff-viewer` | latest | — | Yes | Split/unified diff views for agent-proposed file changes |
| **File Tree** | `react-complex-tree` | 2.6.1 | ~1k | Yes | Worktree/file browser with DnD, keyboard nav, unopinionated rendering |

### Interaction & Layout

| Library | npm | Version | Stars | React 19 | Role |
|---------|-----|---------|-------|----------|------|
| **Command Palette** | `cmdk` | 1.1.1 | ~12.2k | Partial* | Command palette (used by shadcn/ui's `<Command>`) |
| **React Flow** | `@xyflow/react` | 12.10.0 | ~35k | Yes | Workflow graph visualization, pipeline DAGs, tool-call dependency views |
| **Drag & Drop** | `@atlaskit/pragmatic-drag-and-drop` | 1.7.7 | — | Yes | Kanban boards, sortable lists (~4.7KB, framework-agnostic core) |
| **Gantt/Timeline** | `@svar-ui/react-gantt` | 2.5.2 | — | Yes | Pipeline/verification stage timelines |
| **Markdown** | `react-markdown` + `remark-gfm` + `rehype-pretty-code` | 10.1.0 | ~15.4k | Yes | Research doc rendering, agent output formatting |

*cmdk: use `--legacy-peer-deps` or pnpm override for React 19. shadcn PR #6644 patches this.

### Remote Access

| Library | npm | Version | Role |
|---------|-----|---------|------|
| **Cloudflare Tunnel** | `cloudflared` | 0.7.1 | Production tunneling (programmatic API, auto-installs binary, TLS-terminated) |
| **bore** | (Rust binary) | 0.6.0 | Self-hosted alternative (~400 lines Rust, MIT, spawn as Tauri sidecar) |

**Avoid:** `localtunnel` (abandoned), `@tailscale/connect` (stale WASM experiment), `kbar` (blocked on React 19).

### Desktop

| Library | npm | Version | Stars | Role |
|---------|-----|---------|-------|------|
| **Tauri** | `@tauri-apps/api` + `@tauri-apps/cli` | 2.10.1 | ~100k | Desktop shell, IPC, native plugins (fs, shell, dialog, SQL, updater, deep-link) |

Tauri 2.x key improvements: Channel API for Rust→JS streaming, Raw Request for binary/protobuf, ACL-based security per-window, Swift/Kotlin mobile bindings. Plugin ecosystem covers everything we need (fs, shell, dialog, clipboard, HTTP, WebSocket, updater, deep-link, SQL, store).

## Cross-Platform Concept Mapping

Research across 12+ agent platforms reveals convergent patterns. Our contract system must support these universal abstractions.

### Universal Patterns (found in 3+ platforms)

| Pattern | Platforms | Our Contract |
|---------|-----------|-------------|
| Plan-first workflow | Copilot Workspace, Cursor, Devin, Jules, Amazon Q | `ResearchDocContract` (role: `plan`) + `TaskContract` |
| Self-correction loop | Copilot, Cursor, Windsurf, Devin, Codex | `HookContract` (post-tool verification) |
| Editable plans | Copilot Workspace, Cursor, Devin, Jules | `ResearchDocContract` with edit affordance |
| Slash commands | Claude, Cursor, Amazon Q, Continue, Aider | `CommandContract` |
| Rules/instruction files | Claude (CLAUDE.md), Copilot (AGENTS.md), Cursor (.cursor/rules) | `ResearchDocContract` (role: `rules`) |
| Background/async agents | Cursor, Devin, Jules, Copilot | `TaskContract` + `SessionContract` with async status |
| MCP integration | Claude, Cursor, Codex, Continue, Windsurf, OpenHands | `McpContract` |
| Streaming structured output | Claude (stream-json), Codex (NDJSON), OpenHands (events) | AG-UI event stream |
| Multi-model routing | Aider (architect/editor), Cursor (plan/build), Continue (chat/edit) | `WorkflowPhase` with model config |
| Parallel agent execution | Claude, Cursor (8 agents), Devin, Jules (15-60) | Multi-session + `WorktreeContract` |
| Hooks/lifecycle events | Claude, Cursor, Codex | `HookContract` |
| Context providers | Continue (@mentions), Aider (repo map), Windsurf (RAG) | `McpContract` (resources) |
| Auto-activating knowledge | Claude (Skills), Copilot (Agent Skills) | `SkillContract` (autoDiscoverable: true) |

### Innovative Patterns to Adopt

| Pattern | Source | Priority | Implementation |
|---------|--------|----------|----------------|
| **Timeline scrub + checkpoint restore** | Devin | High | Event-sourced session log with scrub UI (replay any point, restore state) |
| **Agent sidebar with context pills** | Cursor | High | Visual indicators showing what files/context each agent is using |
| **Architect/editor model split** | Aider | Medium | `WorkflowPhase` supports different model configs per phase |
| **Typed activity events** | Jules API | High | Already covered by AG-UI event types (`planGenerated`, `progressUpdated`, etc.) |
| **Event-sourcing with replay** | OpenHands | High | Immutable event log as foundation — enables debugging, replay, time-travel |
| **Work log with quality grades** | Devin | Medium | `TaskContract` extended with `grade: 'A' \| 'B' \| 'C'` per step |
| **Session sleep/wake** | Devin | Low | Session hibernation for long-lived agent contexts |
| **Select element in preview** | Lovable | Low | Click UI elements to reference them in agent chat (future: preview mode) |
| **ACI design** | SWE-Agent | Medium | Custom agent-computer interface > raw shell (influences tool contract design) |
| **Skills as auto-activating knowledge** | Claude Code | High | `SkillContract` with LLM-driven activation (not just explicit invocation) |

### Agent Output Normalization

Every agent's output must normalize to AG-UI events. Here's how existing formats map:

| Agent Format | Our Normalization |
|-------------|-------------------|
| Claude Code `stream-json` (system/assistant/user/result) | `system.init` → `RunStartEvent`, `assistant.text` → `TextDeltaEvent`, `assistant.tool_use` → `ToolCallStartEvent`+`ToolCallArgsEvent`, `user.tool_result` → `ToolCallResultEvent`, `result` → `RunEndEvent` |
| OpenAI Codex NDJSON | Same pattern — map content blocks to AG-UI events |
| OpenHands event stream (immutable events) | Direct mapping: Action → `ToolCallStartEvent`, Observation → `ToolCallResultEvent` |
| Jules activity events | `planGenerated` → `StateDeltaEvent`, `progressUpdated` → `StateDeltaEvent`, `sessionCompleted` → `RunEndEvent` |
| A2A task updates (SSE) | `working` → `RunStartEvent`, `input-required` → `CustomEvent`, `completed` → `RunEndEvent` |
| Anthropic SDK raw stream | `content_block_start(text)` → `TextDeltaEvent`, `content_block_start(tool_use)` → `ToolCallStartEvent`, `content_block_delta` → `TextDeltaEvent`/`ToolCallArgsEvent` |

### Claude Code Concept Mapping

Claude Code CLI is our primary adapter. Its concepts map to our contracts:

| Claude Code Concept | Our Contract | Notes |
|-------------------|-------------|-------|
| Slash commands (`/commit`, `/review-pr`) | `CommandContract` | Auto-discoverable via CLI introspection |
| Skills (auto-activating knowledge packages) | `SkillContract` | `autoDiscoverable: true`, `source: 'autodiscovered'` |
| Hooks (`SessionStart`, `PreToolUse`, etc.) | `HookContract` | Map hook events to contract events |
| MCP servers + tools | `McpContract` | Direct MCP SDK integration |
| Subagents (`.claude/agents/`) | Nested `SessionContract` | Agent-within-agent, own context |
| Worktrees | `WorktreeContract` | Git worktree isolation for parallel work |
| Todos (`TodoWrite`) | `TaskContract` | Map todo items to task subtasks |
| Plugins (bundles of commands/hooks/skills) | `WorkflowPlugin` or adapter extension | Distributable configuration bundles |
| CLAUDE.md | `ResearchDocContract` (role: `rules`) | Project-level agent instructions |
| `--output-format stream-json` | AG-UI event stream | NDJSON → AG-UI normalization in adapter |

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
| **assistant-ui** | Composable chat primitives (Thread, Message, Composer). Radix-style API, shadcn theme, Vercel AI SDK integration |
| **Vercel AI SDK** | `useChat`/`useCompletion` hooks, streaming state management, provider abstraction |
| **cmdk** | Command palette (via shadcn `<Command>`), fuzzy search, keyboard nav |
| **React Flow** | Workflow graph visualization, pipeline DAGs (`@xyflow/react`) |
| **Monaco Editor** | Full code editor with diff support (`@monaco-editor/react`) |
| **xterm.js** | Terminal emulation for agent command display (`@xterm/xterm`) |
| **Shiki** | Syntax highlighting (VS Code engine, streaming-friendly, `react-shiki`) |

**Why TanStack Router over React Router:** Type-safe route params, search params, and loaders. Every `useParams()`, `useSearch()`, `Link to=` is validated at compile time.

**Why Zustand over context:** Zustand stores are plain JS objects testable without React. No provider wrapping. Selectors prevent unnecessary re-renders. Works with React 19.

**Why assistant-ui over CopilotKit:** CopilotKit is a full-stack framework (opinionated runtime + UI). We want only the UI primitives (assistant-ui) + the wire protocol (AG-UI). assistant-ui's composable primitives align with our contract-driven architecture — we control the runtime, it provides the chat rendering layer.

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
| **Tauri 2.10** | Rust backend, OS webview, ~600KB binaries, SQLite-friendly, ~100k GitHub stars |

Tauri 2.x capabilities:
- **Channel API** for Rust→JS streaming (perfect for agent event relay)
- **Raw Request** support for binary/protobuf payloads (AG-UI proto events)
- **ACL-based security** — per-window command access (restrict agent sessions per window)
- **Plugin ecosystem** — `@tauri-apps/plugin-{fs,shell,dialog,clipboard,http,websocket,updater,deep-link,sql,store}`
- SQLite via `@tauri-apps/plugin-sql` (ships as single file)
- Shell spawning via `@tauri-apps/plugin-shell` (replaces Bun.spawn in desktop mode)
- All backend logic in pure TS/Bun (portable to Tauri sidecar)
- **bore** Rust binary as Tauri sidecar for self-hosted tunneling

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

## Open Questions

### Architecture & Protocol

1. **ACP client implementation timing.** We chose Option 2 (ACP + our extensions) as the strategy. When do we prototype our ACP client? Do we build it as a generic adapter that wraps any ACP agent, or replace our adapter interface entirely with ACP types? The risk: building too much custom adapter code now that we later throw away once ACP is the transport.

2. **ACP ↔ CommandContract bridging.** Our `invocation` field (immediate/prompt/form) is a richer superset of ACP's `AvailableCommand.input?`. When we receive `AvailableCommandsUpdate` from an ACP agent, how do we map? Proposal: `input` absent → `immediate`, `input` present → `prompt` with `hint`. But ACP has no equivalent to our `form` kind — is that only for our own adapters?

3. **ACP Registry vs. our adapter registry.** The ACP Registry (live in Zed + JetBrains) solves agent discovery. Should we consume it directly? Or maintain our own registry that can pull from ACP Registry as one source among others (for non-ACP agents like GSD, MetaMorph)?

4. **AG-UI ↔ ACP event mapping.** We plan to use AG-UI as our internal event wire format. ACP has its own streaming events. If we're an ACP client, we receive ACP events — do we normalize ACP → AG-UI → UI? Or does ACP replace AG-UI as our wire format? This is a two-protocol-or-one decision.

### Authentication & Billing

5. **Claude auth path: CLI vs SDK.** Our adapter uses CLI wrapping (`claude --output-format stream-json`), which supports subscription auth natively. The ACP adapter uses the SDK. If we're also an ACP client, we'd receive Claude's events via ACP (SDK path). Do we maintain both? Do we prefer one? The CLI path is better for subscription users; the ACP/SDK path is better for ecosystem compatibility.

6. **OAuth for personal use.** The Claude Agent SDK technically supports OAuth via `CLAUDE_CODE_OAUTH_TOKEN` for individual use, but Anthropic officially says SDK = API key only. If a user sets up OAuth personally, it works. Do we document this as a supported path? Or acknowledge it as "works but unsupported"? Risk: Anthropic could break it at any time.

7. **Auth method declaration in AdapterManifest.** We noted the manifest should declare supported auth methods. What's the schema? Proposal: `authMethods: ('api_key' | 'oauth' | 'browser_login' | 'token' | 'none')[]` on the manifest, plus per-method configuration hints.

### UI & UX

8. **Context-aware suggestions model & billing.** The v2 LLM-powered action suggestion system needs its own model call. Which model? Whose API key? Is it the same key as the agent's? Or a separate "shell intelligence" key? If the user only has a Claude subscription (no API key), can we still offer suggestions?

9. **Feature parity communication.** Tier 2 ACP adapters (SDK wrappers like claude-code-acp) don't support all features — no hooks, missing slash commands, partial Plan mode. How do we communicate this in the UI? Grayed-out nav sections? A "capabilities" badge? A "some features unavailable via ACP" warning?

10. **Command palette vs. landing view actions.** Commands appear in two places: the command palette (Cmd+K) and the landing view action grid. Are they the same data source? The palette shows all commands; the landing view shows curated/suggested ones. How do we handle the overlap without confusing users?

### Ecosystem

11. **Non-ACP agents.** Some agents we want to support (GSD, MetaMorph, custom CLI tools) don't speak ACP. Our adapter interface handles these. But if ACP becomes our primary transport, these become second-class citizens. How do we ensure parity? Proposal: our adapter interface IS the abstraction, with an ACP adapter being one implementation. Non-ACP agents use native adapters with the same interface.

12. **ACP version compatibility.** ACP is evolving (v0.14.x currently). How do we handle breaking changes? Do we pin to a specific ACP version? Support multiple versions? The TypeScript SDK publishes frequently.

13. **Multi-agent with mixed ACP/non-ACP.** If Claude runs via ACP and GSD runs via our native adapter, can they coexist in the same session? The shell groups by adapter, so this should work — but do we need to reconcile different event formats at the event bus level?
