# Universal Agent Host — Research & Prototyping Plan

> **Status:** DRAFT v0.1
> **Last Updated:** 2026-02-07
> **Purpose:** Move from Vision to validated Proof of Concept

---

## Architectural North Star

The Universal Agent Host is a **desktop GUI that orchestrates and observes existing AI agent runtimes**. It does not reinvent tool-calling. It is a "control plane with a beautiful face."

```
┌─────────────────────────────────────────────────────┐
│                  HOST APPLICATION                    │
│  (Renders generic primitives: Kanban, Tree, Wiki)    │
│                                                      │
│   ┌─────────┐  ┌─────────┐  ┌─────────┐            │
│   │ Context │  │Strategy │  │Execution│  Verification│
│   │  View   │  │  View   │  │  View   │    View     │
│   └────┬────┘  └────┬────┘  └────┬────┘  ──────┘   │
│        └─────────────┴───────────┘                   │
│                      │                               │
│            Adapter Protocol (Bridge)                 │
│                      │                               │
└──────────────────────┼───────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
   ┌────▼────┐   ┌────▼────┐   ┌────▼────┐
   │ Claude  │   │ OpenAI  │   │  Any    │
   │ Agent   │   │ Agent   │   │ Future  │
   │  SDK    │   │  SDK    │   │ Runtime │
   └─────────┘   └─────────┘   └─────────┘
   (User's key)   (User's key)
```

### Hard Constraints

1. **No custom tool-calling harness.** Agents use their native capabilities (Claude Code's full toolset, OpenAI's code interpreter, etc.)
2. **BYOK (Bring Your Own Key).** Users reuse existing Claude/OpenAI subscriptions via API keys. No proxy billing.
3. **Local-First.** The file system (Markdown, JSON, lockfiles) IS the database. No mandatory cloud sync.
4. **Push, not Poll.** Event-driven architecture. FS watchers + process stream subscriptions → semantic UI events.

---

## Phase 0: Foundational Decisions

### 0.1 — The Execution Model Question

> **Research Question:** How do we spawn and observe agent work without building our own harness?

There are three viable execution models:

| Model | How It Works | Pros | Cons |
|-------|-------------|------|------|
| **A. SDK Embedding** | Import Claude Agent SDK / OpenAI Agents SDK as libraries. Spawn agent runs in-process (or child process). Stream events via SDK callbacks. | Full control over lifecycle. Rich event stream (tool calls, thoughts, artifacts). | Tight coupling to each SDK. Must handle SDK updates. |
| **B. CLI Wrapping** | Spawn `claude` CLI (Claude Code) or equivalent as a child process. Parse stdout/stderr. Watch the filesystem for side effects. | Zero coupling. Works with any CLI agent. | Lossy — stdout is a presentation format, not a data contract. Fragile parsing. |
| **C. MCP as Bridge** | Use Model Context Protocol. The Host exposes MCP servers (tools/resources). The agent runtime connects as an MCP client. | Protocol-level interop. Anthropic-blessed standard. | MCP defines tool *provision*, not agent *observation*. May need extension. |

**Recommended starting point:** Model A (SDK Embedding) with Model B as fallback for unsupported runtimes.

**Experiment 0.1:** Spawn a Claude Agent SDK session programmatically, stream its tool-call events, and log them to a JSON file. Measure: latency of event delivery, richness of event data.

**Experiment 0.2:** Spawn `claude --print` as a child process, capture stdout in real-time, and attempt to extract structured events. Measure: what information is lost vs. SDK embedding.

### 0.2 — Claude Agent SDK Deep Dive (Primary Execution Layer)

> **Decision:** Focus on Claude Agent SDK as the sole execution layer for v1. OpenAI can be added later behind the same normalization interface.

#### Package Lineage

| Old Name | New Name | Status |
|----------|----------|--------|
| `claude-code-sdk` (PyPI) | `claude-agent-sdk` (PyPI) | **Use new name** |
| `@anthropic-ai/claude-code` (npm) | `@anthropic-ai/claude-agent-sdk` (npm) | **Use new name** |

Related but different: `@anthropic-ai/sdk` is the low-level Anthropic API client (no agent loop).

#### TypeScript SDK (v0.2.34) — Our Primary Interface

**Why TypeScript over Python:** The TS SDK is more mature (0.2.34 vs 0.1.30), supports all 12 hook events (Python only has 6), has runtime control methods (`setModel`, `setPermissionMode`), and has 1.75M+ npm downloads. For a Tauri sidecar, it's the natural choice.

**V1 API — `query()` function:**
```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

const q = query({
  prompt: "Fix the auth bug in src/auth.ts",
  options: {
    allowedTools: ["Read", "Edit", "Grep", "Glob"],
    model: "claude-sonnet-4-5-20250929",
    includePartialMessages: true,  // CRITICAL: enables streaming
    maxBudgetUsd: 1.00,
  }
});

for await (const message of q) {
  // message: SDKMessage (see taxonomy below)
}
```

Additional methods on the `Query` object:
- `q.interrupt()` — stop agent mid-execution
- `q.rewindFiles(userMessageUuid)` — restore files to checkpoint
- `q.setModel(model)` — change model mid-session
- `q.setPermissionMode(mode)` — change permissions mid-session
- `q.supportedModels()` — list available models
- `q.accountInfo()` — billing/account info
- `q.mcpServerStatus()` — MCP connection health

**V2 API (unstable preview) — Session-based:**
```typescript
import { unstable_v2_createSession, unstable_v2_resumeSession } from '@anthropic-ai/claude-agent-sdk';

// Create
await using session = unstable_v2_createSession({ model: 'claude-opus-4-6' });
await session.send('Fix the auth bug');
for await (const msg of session.stream()) { ... }

// Resume after crash
await using resumed = unstable_v2_resumeSession(savedSessionId, { model: 'claude-opus-4-6' });
```

#### Message Type Taxonomy

```typescript
type SDKMessage =
  | SDKAssistantMessage           // Complete response with ContentBlocks
  | SDKUserMessage                // User input
  | SDKUserMessageReplay          // Replayed during session resume
  | SDKResultMessage              // Terminal: success/error + cost data
  | SDKSystemMessage              // Session init, compact boundary
  | SDKPartialAssistantMessage    // Streaming deltas (only with includePartialMessages)
  | SDKCompactBoundaryMessage     // Context window compaction marker

// ContentBlock types inside AssistantMessage.content:
type ContentBlock =
  | TextBlock          // { type: "text", text: string }
  | ThinkingBlock      // { type: "thinking", thinking: string, signature: string }
  | ToolUseBlock       // { type: "tool_use", id: string, name: string, input: object }
  | ToolResultBlock    // { type: "tool_result", tool_use_id: string, content: any, is_error: boolean }
```

**ResultMessage subtypes** (for our error-handling):
`'success'` | `'error_max_turns'` | `'error_during_execution'` | `'error_max_budget_usd'` | `'error_max_structured_output_retries'`

**ResultMessage includes:** `total_cost_usd`, `duration_ms`, `usage` (tokens), `session_id`

#### Streaming Event Sequence (Tool-Call Cycle)

When `includePartialMessages: true`, here's the exact event sequence:

```
 1. SDKPartialAssistantMessage (message_start)
 2. SDKPartialAssistantMessage (content_block_start)         — text block begins
 3. SDKPartialAssistantMessage (content_block_delta, text_delta) × N  — reasoning streams
 4. SDKPartialAssistantMessage (content_block_stop)          — text done
 5. SDKPartialAssistantMessage (content_block_start, tool_use)— tool call begins (name visible!)
 6. SDKPartialAssistantMessage (content_block_delta, input_json_delta) × N — input streams
 7. SDKPartialAssistantMessage (content_block_stop)          — tool definition complete
 8. SDKPartialAssistantMessage (message_stop)
 9. SDKAssistantMessage                                      — COMPLETE message with all blocks
10. --- PreToolUse hook fires → tool executes → PostToolUse hook fires ---
11. SDKPartialAssistantMessage (message_start)               — response to tool result
12. SDKPartialAssistantMessage (content_block_delta, text_delta) × N
13. SDKPartialAssistantMessage (message_stop)
14. SDKAssistantMessage                                      — complete follow-up
15. SDKResultMessage                                         — final result + cost
```

**Key insight:** Step 5 gives us the tool name BEFORE execution. Step 9 gives us the complete tool input. Steps 10's hooks give us interception. This is sufficient for real-time UI updates.

**Caveat:** When `maxThinkingTokens` is set, `SDKPartialAssistantMessage` events are NOT emitted. You only get complete messages. Thinking and streaming are mutually exclusive.

#### Hooks System (12 Event Types in TypeScript)

| Hook Event | When | Can Modify? | Can Block? |
|------------|------|-------------|------------|
| **PreToolUse** | Before tool execution | YES (modify input) | YES (deny) |
| **PostToolUse** | After tool execution | Add context | No |
| **PostToolUseFailure** | After tool failure | Add context | No |
| **UserPromptSubmit** | User sends prompt | YES (modify prompt) | No |
| **Stop** | Agent stops | No | No |
| **SubagentStart** | Subagent spawned | No | No |
| **SubagentStop** | Subagent finished | No | No |
| **PreCompact** | Before context compaction | No | No |
| **PermissionRequest** | Permission dialog would show | YES (auto-approve) | No |
| **SessionStart** | Session begins | No | No |
| **SessionEnd** | Session ends | No | No |
| **Notification** | Status messages | No | No |

**For our normalization layer, we care most about:**
- `PreToolUse` → emit `TOOL_CALLED` event to UI
- `PostToolUse` → emit `TOOL_RESULT` event to UI
- `PostToolUseFailure` → emit `TOOL_FAILED` event to UI
- `SessionStart` / `SessionEnd` → emit `TASK_STARTED` / `TASK_COMPLETED`
- `SubagentStart` / `SubagentStop` → track parallel agent work

**Hook configuration:**
```typescript
const q = query({
  prompt: "...",
  options: {
    hooks: {
      PreToolUse: [{ matcher: '.*', callback: onToolCall, timeout: 30 }],
      PostToolUse: [{ matcher: '.*', callback: onToolResult, timeout: 30 }],
      SessionStart: [{ callback: onSessionStart }],
      SessionEnd: [{ callback: onSessionEnd }],
    }
  }
});
```

#### Built-in Tools (Complete List)

| Tool | Purpose | Notes |
|------|---------|-------|
| `Read` | Read files | |
| `Write` | Create new files | |
| `Edit` | String replacements in files | |
| `Bash` | Run terminal commands | Most powerful, most dangerous |
| `BashOutput` | Get background bash output | |
| `KillBash` | Kill background bash | |
| `Glob` | Find files by pattern | |
| `Grep` | Search file contents | |
| `WebSearch` | Web search | |
| `WebFetch` | Fetch web pages | |
| `NotebookEdit` | Edit Jupyter notebooks | |
| `TodoWrite` | Task management | |
| `Task` | Spawn subagents | Parallel execution |
| `AskUserQuestion` | Ask user for input | **Critical for HITL** |
| `ExitPlanMode` | Exit planning | |
| `ListMcpResources` | List MCP resources | |
| `ReadMcpResource` | Read MCP resources | |

Custom MCP tools follow the naming pattern: `mcp__<server>__<tool>` (e.g., `mcp__myserver__deploy`).

#### Tool Permission Control

```typescript
// Whitelist (read-only agent)
options: { allowedTools: ["Read", "Glob", "Grep"] }

// Blacklist (no destructive ops)
options: { disallowedTools: ["Bash", "Write"] }

// Custom permission callback (fine-grained)
options: {
  canUseTool: async (toolName, input, context) => {
    if (toolName === "Write" && input.filePath?.startsWith("/etc/"))
      return { type: "deny", message: "Protected path" };
    return { type: "allow" };
  }
}

// Permission modes
options: { permissionMode: "default" | "acceptEdits" | "bypassPermissions" | "plan" }
```

#### Session Management

- **Persistence:** Sessions persist to `~/.claude/projects/`. Survive process restart.
- **Resume:** Pass `resume: sessionId` in options. Full conversation history restored.
- **Fork:** Pass `resume: sessionId, forkSession: true` to branch from a point.
- **Session ID capture:** Available in `SDKSystemMessage` (subtype `'init'`) and in `SDKResultMessage`.
- **Concurrent sessions:** YES — each is a separate subprocess (~50-100MB each).

#### Billing / Auth Model

| Method | How | Cost |
|--------|-----|------|
| **API Key (BYOK)** | `ANTHROPIC_API_KEY` env var | Pay-per-token (Sonnet: $3/$15 per 1M tokens) |
| **Bedrock** | `CLAUDE_CODE_USE_BEDROCK=1` | AWS pricing |
| **Vertex AI** | `CLAUDE_CODE_USE_VERTEX=1` | GCP pricing |
| **Azure Foundry** | `CLAUDE_CODE_USE_FOUNDRY=1` | Azure pricing |

**Critical:** Anthropic explicitly forbids third-party apps from using Claude Pro/Max subscription auth without prior approval. Our Host MUST use API key auth (BYOK).

Cost guardrail: `maxBudgetUsd` per session, `total_cost_usd` in ResultMessage for tracking.

#### Known Gaps for Our Architecture

1. **No multi-session file locking** — we must implement advisory locks in the Host.
2. **MCP concurrent tool call bug** — in-process MCP servers can hit "Stream closed" under concurrency. Use stdio MCP servers for concurrent scenarios.
3. **Streaming + Thinking mutually exclusive** — if extended thinking is enabled, partial messages stop. Must choose per-session.
4. **~50-100MB per concurrent agent** — each session is a subprocess. Budget memory accordingly.
5. **SDK evolving weekly** — pin versions, abstract behind normalization layer.

#### Normalization Layer Mapping

The Claude Agent SDK maps cleanly to our unified event schema:

| Our Event | SDK Source | How to Capture |
|-----------|-----------|----------------|
| `TASK_STARTED` | `SessionStart` hook | Hook fires on session init |
| `TOOL_CALLED` | `PreToolUse` hook OR `SDKPartialAssistantMessage` (step 5: `content_block_start, tool_use`) | Hook gives tool name + input; streaming gives it earlier (before execution) |
| `TOOL_RESULT` | `PostToolUse` hook OR `SDKAssistantMessage` containing `ToolResultBlock` | Hook fires immediately after execution |
| `TOOL_FAILED` | `PostToolUseFailure` hook | TS-only hook |
| `ARTIFACT_CHANGED` | `PostToolUse` hook on `Write`/`Edit` tools — extract `filePath` from input | We know exactly which files changed and how |
| `TEXT_DELTA` | `SDKPartialAssistantMessage` (`content_block_delta, text_delta`) | Real-time token stream |
| `TASK_COMPLETED` | `SDKResultMessage` (subtype `'success'`) | Includes cost, duration, usage |
| `TASK_FAILED` | `SDKResultMessage` (subtype `'error_*'`) | 4 error subtypes for granular handling |
| `AGENT_THINKING` | `SDKAssistantMessage` containing `ThinkingBlock` | Only in complete messages (not streamed) |
| `SUBAGENT_STARTED` | `SubagentStart` hook | Parallel work tracking |
| `SUBAGENT_COMPLETED` | `SubagentStop` hook | Parallel work tracking |
| `BUDGET_UPDATE` | `SDKResultMessage.total_cost_usd` | Per-session cost tracking |

**Assessment:** The mapping is direct. Estimated normalization shim: **~200-300 LOC** (well under the 500 LOC threshold). The hooks system does most of the heavy lifting — we essentially register 6-8 hooks and translate their payloads.

**One design choice:** We can use EITHER hooks OR streaming events for tool observation. Hooks are cleaner (structured, typed) but fire synchronously. Streaming events are lower-latency but require accumulation logic. **Recommendation:** Use hooks for the normalization layer, streaming for the live text display.

---

## Phase 1: Tech Stack Feasibility

### 1.1 — Host Shell: Desktop Runtime

> **Research Question:** What renders the GUI and manages OS-level concerns (file watchers, child processes, system tray)?

| Option | Language | Bundle Size | Memory | FS Watching | Process Spawning | Plugin System |
|--------|----------|-------------|--------|-------------|------------------|---------------|
| **Tauri 2.x** | Rust backend + Web frontend | ~3-8 MB | ~30-80 MB | Built-in (`notify` crate) | Full Rust `Command` API | Tauri plugins (Rust) |
| **Electron** | Node.js + Chromium | ~150-200 MB | ~150-300 MB | `chokidar` / `fs.watch` | Node `child_process` | Node modules |
| **Wails 3.x** | Go backend + Web frontend | ~8-15 MB | ~40-100 MB | `fsnotify` | Go `os/exec` | Go plugins |
| **Neutralinojs** | C++ backend + Web frontend | ~2-5 MB | ~20-50 MB | Limited | Limited | REST-based extensions |

**Analysis:**

- **Tauri 2.x** is the strongest candidate. Rust gives us safe concurrency for file-watching + process-streaming without GC pauses. Tauri 2 added mobile support, multi-window, and a mature plugin ecosystem. The main risk: Rust has a steep learning curve for UI-adjacent logic.
- **Electron** is the safe bet. Massive ecosystem, battle-tested (VS Code, Cursor, Slack). But the resource overhead is real — and if we're running multiple agent processes alongside the host, memory matters.
- **Wails** is interesting for Go shops. Lighter than Electron, heavier than Tauri. Go's concurrency (goroutines) is excellent for our use case. Less mature plugin ecosystem.
- **Neutralinojs** is too limited for our process-management needs.

**Tauri 2.x Sidecar Details (from research):**
- Use `@tauri-apps/plugin-shell` with `Command.sidecar()` and `spawn()` (not `execute()`) for real-time stdout streaming.
- Grant `shell:allow-spawn` permission in `capabilities/default.json`.
- **Buffering caveat:** Child processes may buffer stdout. The process itself must flush explicitly (e.g., Python's `-u` flag, Node's auto-flush) for real-time streaming to work.
- Community crate `tauri-sidecar-manager` handles lifecycle management, health checks, auto-restart, and provides `listen("sidecar-stdout", ...)` API for React.
- **Refs:** [Tauri Sidecar Docs](https://v2.tauri.app/develop/sidecar/), [tauri-sidecar-manager](https://github.com/radical-data/tauri-sidecar-manager)

**Experiment 1.1a:** Build a Tauri 2.x app that watches a directory and streams file-change events to the frontend. Measure: event latency, CPU usage with 1000+ files.

**Experiment 1.1b:** Same experiment in Electron. Compare memory footprint and event throughput.

**Experiment 1.1c:** Spawn a TypeScript sidecar from Tauri that runs `ClaudeSDKClient`, stream events over stdout back to the Rust host. Measure: end-to-end latency from SDK event to UI render.

**Recommendation:** Start with **Tauri 2.x**. Fall back to Electron only if Rust backend complexity becomes a blocker for iteration speed.

### 1.2 — UI Engine: Frontend Framework

> **Research Question:** What renders the adaptive, widget-based interface inside the webview?

| Option | Reactivity Model | Bundle Size | Ecosystem | Dynamic Component Loading | Real-time Perf |
|--------|-----------------|-------------|-----------|--------------------------|----------------|
| **React 19** | Virtual DOM, concurrent rendering | ~40 KB | Massive | `React.lazy`, module federation | Good (with memoization) |
| **SolidJS** | Fine-grained signals, no VDOM | ~7 KB | Growing | Dynamic imports | Excellent |
| **Svelte 5** | Runes (signals), compiled | ~2 KB runtime | Moderate | Dynamic components | Excellent |
| **Web Components** | Native browser APIs | 0 KB runtime | Universal | Custom Elements registry | Native |

**Analysis:**

- **React 19** has the largest component ecosystem (we'll want off-the-shelf Kanban boards, tree views, diff viewers). Server Components don't apply to us, but concurrent rendering helps with heavy streaming updates.
- **SolidJS** is architecturally ideal — fine-grained reactivity means only the specific DOM node bound to a changing signal re-renders. For a dashboard receiving 100+ events/sec from agent streams, this matters. Smaller ecosystem is the risk.
- **Svelte 5** with Runes is similar to Solid in perf characteristics. Smaller ecosystem than React but growing.
- **Web Components** are interesting for the *plugin* layer (adapters providing custom widgets), but painful as a primary framework. Good as a compilation target.

**Experiment 1.2a:** Build a streaming log viewer in React 19 and SolidJS. Pipe 500 events/sec and measure: DOM update latency, memory growth over 10 minutes, jank frames.

**Experiment 1.2b:** Prototype a "Generative UI" mechanism: load a component definition from a JSON schema and render it dynamically. Test in React (via `React.createElement`) and Solid.

**Recommendation:** **React 19** for the primary UI (ecosystem wins), with a Web Components escape hatch for adapter-provided widgets. Revisit SolidJS if React perf becomes a bottleneck.

### 1.3 — Backend Language for Host Logic

> **Research Question:** What language handles the "brain" of the Host — adapter lifecycle, event routing, state reconciliation?

This depends on the desktop runtime choice:

| Runtime | Backend Language | Agent SDK Interop | Notes |
|---------|-----------------|-------------------|-------|
| Tauri | **Rust** (or sidecar) | Call Python/TS SDK via sidecar process or FFI | Rust is fast but verbose. Sidecar adds IPC overhead. |
| Tauri | **Rust + TypeScript sidecar** | TS sidecar runs SDK logic, communicates via IPC | Best of both: Rust for OS, TS for SDK glue |
| Electron | **TypeScript (Node.js)** | Direct — both SDKs have TS/JS bindings | Simplest path. Single language stack. |
| Wails | **Go** | Call Python SDK via subprocess | Go concurrency is great but SDK interop is harder |

**Key Insight:** The Agent SDKs (Claude, OpenAI) are primarily Python and TypeScript. This means:
- If we pick Tauri (Rust), we need a sidecar process in TS/Python to run the SDK.
- If we pick Electron (Node.js), we can call the SDK directly from the main process.

This is the central trade-off: **Tauri's performance vs. Electron's SDK ergonomics.**

**Recommended Hybrid:** Tauri shell + TypeScript sidecar. The sidecar handles all SDK interaction and emits normalized events over a local IPC channel (Unix socket or WebSocket). Tauri handles windowing, FS watching, and system integration.

---

## Phase 2: Protocol Definition

### 2.1 — The Adapter Protocol ("Bridge")

> **Research Question:** How does an Adapter (plugin) declare its capabilities, subscribe to events, and push UI updates?

#### Protocol Requirements

1. **Declarative Capability Manifest.** An adapter declares what primitives it maps to (e.g., "I provide Strategy views from `PLAN.md`").
2. **Bidirectional Event Streaming.** Host → Adapter: user actions, FS events. Adapter → Host: semantic events, UI updates.
3. **Schema-Driven UI.** An adapter can send a JSON schema describing a custom widget the Host should render.
4. **Lifecycle Hooks.** `onActivate`, `onDeactivate`, `onFileChanged`, `onAgentEvent`.

#### Protocol Options

| Option | Transport | Schema | Hot-Reload | Sandboxing | Complexity |
|--------|-----------|--------|------------|------------|------------|
| **A. JSON-RPC over stdio** | stdin/stdout pipes | JSON Schema | Process restart | OS-level (process) | Low |
| **B. JSON-RPC over WebSocket** | Local WS server | JSON Schema | Reconnect | OS-level (process) | Medium |
| **C. WASM Plugins** | In-process | Wit/Component Model | Module reload | WASM sandbox | High |
| **D. MCP Extension** | stdio or SSE | MCP schema + extensions | Process restart | OS-level | Medium |
| **E. Native SDK (TS modules)** | Direct import | TypeScript types | HMR | None (trusted) | Low |

**Analysis:**

- **Option A (JSON-RPC/stdio)** is the Unix philosophy approach. Each adapter is a separate process. Language-agnostic. Battle-tested (LSP, MCP use this pattern). Downside: serialization overhead, harder to share state.
- **Option B (JSON-RPC/WebSocket)** adds connection multiplexing. Better for adapters that need to push events asynchronously. Slightly more infrastructure.
- **Option C (WASM)** is the dream for sandboxed, portable plugins. But the Component Model is still maturing. Poor support for network I/O and FS access from within WASM. Not ready for our use case yet.
- **Option D (MCP Extension)** is tempting because MCP already defines tool/resource schemas. But MCP is designed for *providing tools to an LLM*, not for *observing an LLM's behavior*. We'd need significant extensions.
- **Option E (Native TS)** is fastest to prototype. Adapters are npm packages loaded at runtime. No sandboxing — but for a v1 where we control all adapters, this is fine.

**Recommendation:** Start with **Option E (Native TS modules)** for rapid prototyping. Design the interface contract so it can be promoted to **Option A or B** later when third-party adapters become a concern.

#### Proposed Adapter Interface (TypeScript)

```typescript
interface Adapter {
  manifest: AdapterManifest;

  // Lifecycle
  activate(host: HostAPI): Promise<void>;
  deactivate(): Promise<void>;

  // Event handlers
  onFileChanged?(event: FileChangeEvent): Promise<AdapterEvent[]>;
  onAgentEvent?(event: NormalizedAgentEvent): Promise<AdapterEvent[]>;
  onUserAction?(action: UserAction): Promise<void>;
}

interface AdapterManifest {
  id: string;
  name: string;
  version: string;
  provides: PrimitiveType[];       // ['strategy', 'execution', ...]
  filePatterns: string[];           // ['**/PLAN.md', '**/spec.md']
  agentPatterns?: string[];         // ['claude:*', 'openai:gpt-4*']
}

interface HostAPI {
  // Read state
  readFile(path: string): Promise<string>;
  glob(pattern: string): Promise<string[]>;
  getState(primitiveType: PrimitiveType): Promise<PrimitiveState>;

  // Push to UI
  emitEvent(event: SemanticEvent): void;
  registerWidget(schema: WidgetSchema): void;
  updatePrimitive(type: PrimitiveType, data: PrimitiveUpdate): void;

  // Agent control
  spawnAgent(config: AgentConfig): AgentHandle;
  listAgents(): AgentHandle[];
}
```

**Experiment 2.1:** Implement 2 adapters against this interface:
- **PlanAdapter:** Watches `PLAN.md`, parses headings into a tree, maps to Strategy primitive.
- **ClaudeAdapter:** Wraps Claude Agent SDK, normalizes events, maps to Execution primitive.

### 2.2 — The Primitive Data Model

> **Research Question:** What is the minimal schema for each of the 4 primitives?

```typescript
// === CONTEXT (Static knowledge) ===
interface ContextPrimitive {
  id: string;
  title: string;
  content: string;           // Markdown
  sourceFile: string;
  tags: string[];
  lastModified: number;
}

// === STRATEGY (Hierarchical plans) ===
interface StrategyPrimitive {
  id: string;
  title: string;
  status: 'draft' | 'active' | 'completed' | 'abandoned';
  children: StrategyPrimitive[];    // Tree structure
  sourceFile: string;
  sourceRange?: { start: number; end: number };  // Line range in file
  metadata: Record<string, unknown>;
}

// === EXECUTION (Atomic tasks) ===
interface ExecutionPrimitive {
  id: string;
  title: string;
  status: 'queued' | 'running' | 'paused' | 'completed' | 'failed';
  assignedAgent?: string;           // 'claude:session-xyz' | 'openai:run-abc'
  parentStrategyId?: string;        // Links back to Strategy tree
  log: ExecutionLogEntry[];         // Streaming agent output
  artifacts: string[];              // Files created/modified
  startedAt?: number;
  completedAt?: number;
}

interface ExecutionLogEntry {
  timestamp: number;
  type: 'tool_call' | 'tool_result' | 'text' | 'error' | 'thinking';
  content: string;
  metadata?: Record<string, unknown>;
}

// === VERIFICATION (Quality gates) ===
interface VerificationPrimitive {
  id: string;
  executionId: string;              // What is being verified
  type: 'diff_review' | 'test_run' | 'lint' | 'human_approval';
  status: 'pending' | 'passed' | 'failed' | 'needs_review';
  details: string;
  sourceFile?: string;
}
```

**Experiment 2.2:** Populate these primitives from a real project directory (with `PLAN.md`, `spec.md`, etc.). Validate that the schema is sufficient to render a meaningful Tree View + Kanban Board.

### 2.3 — Workflow Data Model (Evolution from Primitives)

> **Insight:** The abstract primitives (Context, Strategy, Execution, Verification) are useful as a rendering abstraction but don't map to how developers think about their work. A second data model bridges this gap.

The **Workflow Model** introduces concrete concepts from real development workflows:

```
Project (multi-repo container)
  └── Repo[] (git repositories)
  └── Issue[] (external work items linked to Jira/GitHub/Linear/Azure DevOps)
        └── Plan (step-by-step breakdown)
              └── PlanStep[]
        └── Task[] (local agent tasks — one issue can have MANY tasks)
              └── VerificationPipeline (4-stage quality gate)
```

#### Critical Distinction: External Work Items vs. Local Agent Tasks

This is a fundamental modeling decision:

| Concept | What It Is | Cardinality | Examples |
|---------|-----------|-------------|---------|
| **Issue** (external) | A work item from an external system. Could be a Jira epic, story, subtask, GitHub issue, or even a local idea. Represents the *what* — the business intent. | One per work request | `UAH-42: Add WebSocket reconnection`, a Jira subtask, a GitHub issue |
| **Task** (local) | A discrete unit of agent work. Represents the *how* — the technical execution. Assigned to one agent, targets specific repos. | Many per Issue | "Update reconnection logic in `agent-runtime`", "Add retry tests in `agent-sdk`", "Update types in `agent-manager`" |

**Why this matters:**
- A single Jira subtask (e.g., "Add retry logic to WebSocket client") may spawn 3 agent tasks if the change touches 3 repos.
- Each agent task has its own verification pipeline (prechecks, AI review, PR, approval).
- The Issue tracks aggregate progress; individual Tasks track execution detail.
- Users think in Issues; agents work in Tasks. The UI must bridge both mental models.

**One Issue → Many Tasks example:**
```
Issue: UAH-42 "Add WebSocket reconnection with exponential backoff"
  ├── Task 1: "Implement reconnection logic" → agent-runtime repo → Agent: Sonnet
  │     └── Pipeline: ✅ Prechecks → ✅ AI Review → ✅ PR #87 → ⏳ Approval
  ├── Task 2: "Add reconnection config types" → agent-sdk repo → Agent: Haiku
  │     └── Pipeline: ✅ Prechecks → ✅ AI Review → ✅ PR #34 → ✅ Approved
  └── Task 3: "Update WebSocket hook in UI" → agent-manager repo → Agent: Sonnet
        └── Pipeline: 🔄 Prechecks → ⏸ AI Review → ⏸ PR → ⏸ Approval
```

#### Issue Lifecycle

```
backlog → analysis → planning → in_progress → review → done
                                    │                    ↑
                                    └── blocked ─────────┘
```

- **backlog**: Raw idea or unanalyzed external issue
- **analysis**: Agent or human analyzing scope and requirements
- **planning**: Breaking down into concrete plan steps
- **in_progress**: Tasks are being executed by agents
- **review**: All tasks done, awaiting final issue-level review
- **done**: Shipped / merged / closed
- **blocked**: Impediment identified (can transition back to in_progress when resolved)

#### Task Lifecycle

```
planning → queued → running → verifying → review → done
                       │                            ↑
                       └── failed ──────────────────┘
                       └── blocked ─────────────────┘
```

### 2.4 — Verification Pipeline (4-Stage Model)

> **Evolution:** Earlier designs had 7 granular verification types (lint, typecheck, test, build, security scan, PR review, manual approval). This was refined to 4 meaningful gates.

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Prechecks   │───▶│  AI Review   │───▶│      PR      │───▶│   Approval   │
│   (auto)     │    │   (auto)     │    │   (auto)     │    │   (manual)   │
├──────────────┤    ├──────────────┤    ├──────────────┤    ├──────────────┤
│ lint         │    │ agent reviews│    │ branch push  │    │ human review │
│ typecheck    │    │ the diff for │    │ PR creation  │    │ approve or   │
│ tests        │    │ correctness  │    │ CI pipeline  │    │ request      │
│ build        │    │ & architecture│   │              │    │ changes      │
│ coverage     │    │              │    │              │    │              │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
```

**Why 4 stages, not 7:**
1. **Prechecks** bundles lint/types/tests/build. Individually, these are implementation details — the meaningful question is "does the code meet automated quality standards?" One gate, one answer.
2. **AI Review** is the novel stage. An AI agent reviews the diff for correctness, architecture concerns, and potential issues. This catches problems before human reviewers invest time.
3. **PR** makes the transition from "code on a branch" to "code visible to the team" explicit. Branch push + PR creation + CI are one logical gate.
4. **Approval** is the final human checkpoint. After all automated gates pass, a human makes the judgment call. Keeps humans in the loop for what matters.

**Stage metadata:**
```typescript
interface VerificationMetadata {
  // Prechecks
  lintOk?: boolean;
  typecheckOk?: boolean;
  testsPassed?: number; testsFailed?: number; testsTotal?: number;
  coverage?: number;
  buildOk?: boolean;
  // AI Review
  reviewSeverity?: 'clean' | 'minor' | 'major' | 'critical';
  reviewFindings?: string[];
  reviewSuggestions?: string[];
  // PR
  prUrl?: string; prNumber?: number;
  prStatus?: 'draft' | 'open' | 'merged' | 'closed';
  // Approval
  reviewers?: string[];
  approvals?: number;
  changesRequested?: boolean;
}
```

### 2.5 — External System Integration

> **Research Question:** How does the Host connect to external project management and code hosting systems?

#### Supported External Systems

| System | What We Get | Integration Method | Priority |
|--------|------------|-------------------|----------|
| **Jira** | Issues, epics, subtasks, status, priority, sprint | REST API v3 + webhooks | High |
| **GitHub** | Issues, PRs, reviews, CI status, repo metadata | GraphQL API v4 + webhooks | High |
| **Azure DevOps** | Work items, boards, repos, pipelines | REST API + service hooks | Medium |
| **Linear** | Issues, projects, cycles, labels | GraphQL API + webhooks | Medium |
| **GitLab** | Issues, MRs, pipelines | REST API v4 + webhooks | Low (v2) |

#### Integration Architecture

```
External System (Jira, GitHub, etc.)
      │
      ▼ (REST/GraphQL API + webhooks)
┌─────────────────┐
│ External System  │  ← Adapter per system
│    Adapter       │  ← Maps external work items → Issue type
└────────┬────────┘
         │
         ▼ (normalized Issue objects)
┌─────────────────┐
│   Issue Store    │  ← Maintains link: externalId ↔ localIssueId
│                  │  ← Syncs status bidirectionally
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Task Manager   │  ← Creates local agent Tasks from Issues
│  (Ops / Kanban) │  ← Each Task independently verified
└─────────────────┘
```

#### External Link Model

```typescript
interface ExternalProjectLink {
  system: 'jira' | 'github' | 'azure_devops' | 'linear' | 'gitlab';
  baseUrl: string;         // e.g., "https://mycompany.atlassian.net"
  projectKey?: string;     // e.g., "UAH" for Jira
  org?: string;            // e.g., "anthropics" for GitHub
}

// On each Issue:
interface Issue {
  // ...
  externalId?: string;     // "UAH-42" (Jira), "#123" (GitHub), etc.
  externalUrl?: string;    // Direct link to the external item
  externalSystem?: ExternalProjectLink['system'];
}
```

#### Sync Strategy

1. **Pull on startup**: Fetch open issues from configured external systems.
2. **Webhook for real-time**: Register webhooks for status changes, comments, PR events.
3. **Push on completion**: When all Tasks for an Issue complete and verification passes, optionally update the external system (close Jira ticket, merge PR, etc.).
4. **Conflict resolution**: External system is source of truth for issue metadata (title, description, priority). Local system is source of truth for agent tasks and verification status.

#### Multi-Repo Project Model

Real projects often span multiple repositories. The `Project` type is a container:

```typescript
interface Project {
  id: string;
  name: string;
  repos: Repo[];              // Multiple git repositories
  externalLinks: ExternalProjectLink[];  // Connected external systems
  issues: Issue[];            // Work items (may span repos)
}

interface Repo {
  id: string;
  name: string;
  path: string;               // Local filesystem path
  remoteUrl?: string;         // git remote URL
  defaultBranch: string;      // "main" | "master" | etc.
}
```

**Multi-repo task example:** A single issue ("Add shared auth types") might produce:
- Task 1 in `agent-sdk` repo: Define the types
- Task 2 in `agent-runtime` repo: Use the types in the backend
- Task 3 in `agent-manager` repo: Use the types in the frontend

Each task gets its own verification pipeline, its own PR, and its own approval cycle. The Issue tracks whether ALL tasks are complete.

---

## Phase 3: State Management

### 3.1 — The Concurrent Edit Problem

> **Research Question:** When both the user (in VS Code) and the agent (via SDK) edit files simultaneously, how do we avoid corruption and present coherent state?

#### Scenarios

| Scenario | Frequency | Severity | Solution Space |
|----------|-----------|----------|---------------|
| User edits `PLAN.md` while agent reads it | High | Low | FS watcher debounce + agent reads latest |
| Agent writes `foo.ts` while user has it open in VS Code | Medium | Medium | VS Code auto-reloads. Agent should lock or warn. |
| Two agents edit the same file | Low (but catastrophic) | High | Agent-level locking / task isolation |
| User edits `PLAN.md` while Host has parsed it into memory | High | Medium | Re-parse on FS event. Diff against in-memory state. |

#### Strategies

1. **File-Level Locking (Simple).** The Host maintains a lockfile (`.agent-lock/foo.ts.lock`) when an agent is actively writing. Other agents queue. Users see a "being edited by agent" indicator. **Recommended for v1.**

2. **Optimistic Concurrency (Medium).** No locks. On conflict, the system keeps both versions and presents a merge UI. Similar to git's approach. Good for plan files.

3. **CRDT-Based Sync (Complex).** Use Yjs or Automerge to represent files as CRDTs. Both user and agent edits merge automatically. **Overkill for v1** — CRDTs work best when both sides use the same CRDT library, which VS Code does not.

4. **Server-Centric Rebasing (Emerging).** Matthew Weidner's 2025 approach — collaborative text editing *without* CRDTs or OT. Uses a central server with "rebasing" where clients send operations and the server interprets them. Lighter than full CRDT but handles concurrent edits correctly. Our Host process could act as that central server. **Worth studying for v2.** ([mattweidner.com/2025/05/21/text-without-crdts](https://mattweidner.com/2025/05/21/text-without-crdts.html))

5. **Event Sourcing (Architectural).** Don't sync files directly. Instead, maintain an event log of all changes. The file on disk is a materialized view. This is elegant but requires all participants to go through the event system. **Not practical when agents write directly to disk.**

**Recommendation for v1:**
- **File-level advisory locking** for agent-written files.
- **FS watcher + debounced re-parse** for user-editable planning files.
- **Git as the safety net.** Auto-commit snapshots on a shadow branch before agent runs. Users can always `git diff` to see what changed.

**Experiment 3.1:** Simulate concurrent edits: Start a FS watcher on a directory. Have one script append to a file every 100ms (simulating an agent). Have another script (simulating VS Code) occasionally overwrite the same file. Measure: Do we miss events? Do we get corrupt reads? What debounce window is safe?

### 3.2 — In-Memory State Architecture

> **Research Question:** How does the Host maintain derived state (parsed trees, kanban columns) from raw files?

```
Filesystem (source of truth)
      │
      ▼ (FS watcher events)
┌─────────────┐
│  File Cache  │  ← Debounced reads, content hash dedup
└──────┬──────┘
       │
       ▼ (raw content)
┌─────────────┐
│  Adapters   │  ← Parse, transform, normalize
└──────┬──────┘
       │
       ▼ (semantic events)
┌──────────────┐
│ Primitive    │  ← Reactive store (Zustand / Nanostores / Signals)
│   Store      │
└──────┬───────┘
       │
       ▼ (subscriptions)
┌──────────────┐
│    UI        │  ← Only re-renders affected components
└──────────────┘
```

**State Library Options:**

| Library | Reactivity | Size | Framework | Suitability |
|---------|-----------|------|-----------|-------------|
| **Zustand** | Selector-based | 1 KB | React | Good. Simple. Supports middleware. |
| **Nanostores** | Atom-based signals | 0.5 KB | Any | Great for multi-framework. |
| **Jotai** | Atom-based | 2 KB | React | Good. Bottom-up composition. |
| **XState** | State machines | 15 KB | Any | Excellent for lifecycle modeling (agent states). |
| **Legend State** | Signal-based, persistence built-in | 5 KB | React | Interesting for local-first sync. |

**Recommendation:** **Zustand** for UI state (simple, React-native) + **XState** for agent lifecycle state machines (agent states are inherently state-machine-shaped: idle → running → paused → completed/failed).

---

## Phase 4: Prototyping Roadmap

### Isolated Experiments (2-3 days each)

Each experiment validates one architectural assumption in isolation.

#### Experiment A: "Live Markdown Tree"
> Validate: FS watcher → Parser → Reactive UI pipeline

- Watch a `PLAN.md` file for changes.
- Parse Markdown headings into a tree structure.
- Render as an interactive Tree View that updates in real-time.
- **Success:** Edit the file in VS Code, see the tree update within 100ms.
- **Tech:** Tauri + React + `unified`/`remark` parser.

#### Experiment B: "Agent Event Stream"
> Validate: SDK embedding → Normalized events → Live log

- Use Claude Agent SDK to run a simple coding task.
- Intercept all tool-call events, normalize them into `AgentEvent` schema.
- Render as a streaming log with syntax-highlighted code blocks.
- **Success:** See tool calls appear in the UI as they happen, not after completion.
- **Tech:** TypeScript sidecar + WebSocket → React log component.

#### Experiment C: "Kanban from Lockfile"
> Validate: File-driven state → Kanban rendering → Bidirectional sync

- Parse a `tasks.json` or lockfile into Kanban columns (queued/running/done).
- Render draggable Kanban board.
- When user drags a card, write back to the file.
- When the file changes externally, update the board.
- **Success:** Bidirectional sync between file and UI without loops or corruption.
- **Tech:** Tauri + React + `@dnd-kit` or similar.

#### Experiment D: "Generative Widget"
> Validate: JSON Schema → Dynamic component rendering

- Define a widget schema (JSON) that describes a "Constitution Review" panel.
- Host receives the schema from an adapter and renders it dynamically.
- Widget has interactive elements (approve/reject buttons) that fire events back.
- **Success:** A new widget type appears without any Host code changes.
- **Tech:** React + JSON Schema → `react-jsonschema-form` or custom renderer.

#### Experiment E: "Multi-Agent Orchestration"
> Validate: Multiple concurrent agent sessions with isolation

- Spawn 2 Claude Agent SDK sessions working on separate tasks.
- Route their events to separate Kanban cards.
- Demonstrate that they don't interfere with each other's file writes.
- **Success:** Both agents complete successfully, UI shows parallel progress.
- **Tech:** TS sidecar managing agent lifecycle + advisory file locks.

#### Experiment F: "Process Resurrection"
> Validate: Crash recovery and session persistence

- Start an agent task. Kill the host process mid-execution.
- Restart the host. Reconstruct state from filesystem artifacts (lockfiles, partial outputs).
- **Success:** UI shows the task as "interrupted" with last known state. User can retry.
- **Tech:** Lockfile-based state persistence + FS scan on startup.

### Integration Milestones

| Milestone | Combines | Target |
|-----------|----------|--------|
| **M1: "It Moves"** | Experiments A + B | FS watcher + Agent stream rendering in one window |
| **M2: "It Works"** | M1 + C + D | Full primitive loop: file → adapter → primitive → UI → file |
| **M3: "It's Useful"** | M2 + E + F | Multi-agent, crash-resilient, generative UI |

---

## Phase 5: Existing Art Analysis

### Must-Study Projects

| Project | Why Study It | What to Extract |
|---------|-------------|-----------------|
| **Claude Code** | Reference implementation of an agentic CLI. Uses Claude Agent SDK internally. | Event model, tool-call patterns, how it handles file writes. |
| **Cursor / Windsurf** | Commercially successful "agentic IDEs." | UX patterns for showing agent work. How they handle the "agent is typing" experience. |
| **CopilotKit** | React framework for building AI copilot UIs. | Their `useCoAgent` hook pattern. How they bridge agent state to React state. |
| **Model Context Protocol (MCP)** | Anthropic's standard for tool integration. | Resource/tool schema patterns. Transport layer design. Could be our adapter manifest format. |
| **Zed Editor (GPUI)** | High-performance GPU-rendered UI framework. | If Tauri webview becomes a bottleneck, GPUI is an alternative rendering approach. |
| **VS Code Extension API** | The most successful plugin architecture for dev tools. | Activation events, contribution points, webview panels. Our adapter system should be at least as ergonomic. |

| **AG-UI Protocol** | CopilotKit's open standard for agent-frontend communication. Adopted by Google, AWS, Microsoft, LangChain. | Event format, shared state patterns, human-in-the-loop protocol. Could become our adapter transport standard. |
| **Aide IDE** | Open-source AI-native IDE (VS Code fork) by CodeStory AI. Proactive agents that use LSP for context. | Checkpoint/rollback UX without git. Combined chat+edit flow. How they handle multi-file agent edits. [GitHub](https://github.com/codestoryai/aide) |

### Study-but-Don't-Fork Projects

| Project | Why Not Fork | What to Learn |
|---------|-------------|---------------|
| **LangGraph** | Too opinionated about agent architecture. We're runtime-agnostic. | Graph-based workflow modeling. State checkpointing. |
| **Open Interpreter** | Focused on a single agent, not orchestration. | How they capture and stream terminal output. |
| **Autogen (Microsoft)** | Multi-agent framework, but Python-only and cloud-first. | Agent-to-agent communication patterns. |
| **CrewAI** | Similar to Autogen. | Role-based agent specialization. Task decomposition patterns. |

### Ignore (For Now)

| Project | Why |
|---------|-----|
| **LXC / Docker for agent sandboxing** | Premature. File-level locking is sufficient for v1. Containerization adds massive complexity. |
| **Kubernetes-based orchestration** | We're building a desktop app, not a cloud platform. |
| **Custom LLM hosting** | Out of scope. We use managed APIs (Claude, OpenAI). |

---

## Phase 6: Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Agent SDK APIs change frequently | High | Medium | Thin adapter shim. Pin SDK versions. Abstract behind our event interface. |
| FS watching misses events under load | Medium | High | Experiment 3.1 validates this. Fallback: periodic reconciliation scan. |
| Users hit API rate limits | Medium | Medium | Queue agent requests. Show backpressure in UI. |
| Tauri's webview has rendering inconsistencies | Low | Medium | Test on Windows/Mac/Linux early. Electron fallback. |
| BYOK model means no revenue from API usage | High (business) | High | Host value is in orchestration/UI, not API access. Potential: paid adapter marketplace. |
| Agent writes garbage to user's project | Medium | High | Git snapshot before every agent run. One-click revert. Mandatory for v1. |

---

## Appendix A: Technology Decision Matrix

Weights: Performance (25%), SDK Ergonomics (25%), Ecosystem (20%), Bundle Size (15%), Learning Curve (15%)

### Desktop Runtime

| Criterion | Tauri 2.x | Electron | Wails |
|-----------|-----------|----------|-------|
| Performance | 9 | 6 | 8 |
| SDK Ergonomics | 5 (needs sidecar) | 9 (native TS) | 4 (Go ↔ Python FFI) |
| Ecosystem | 7 | 10 | 5 |
| Bundle Size | 9 | 3 | 7 |
| Learning Curve | 4 (Rust) | 8 | 6 |
| **Weighted Score** | **6.85** | **7.35** | **5.95** |

> **Note:** Electron wins on the weighted score primarily due to SDK ergonomics. But if we commit to the TypeScript sidecar pattern, Tauri's score rises to ~7.5. The decision depends on how much Rust we're willing to write in the backend.

### Recommended Stack (Starting Point)

```
Desktop Shell:     Tauri 2.x (Rust)    — OR Electron if Rust is a blocker
Frontend:          React 19 + Zustand + XState
Sidecar:           TypeScript (Bun or Node) — runs SDK logic, emits normalized events
Agent Runtime A:   Claude Agent SDK (ClaudeSDKClient) — full streaming + hooks
Agent Runtime B:   OpenAI Agents SDK (Runner.run_streamed) — streaming events
Agent Runtime C:   Claude Code CLI (--output-format stream-json) — NDJSON fallback
Adapter Protocol:  Native TS modules (v1) → JSON-RPC/WebSocket (v2)
                   Study AG-UI for compatibility/adoption in v2
File Watching:     Tauri notify / chokidar
State Persistence: Filesystem (Markdown + JSON lockfiles)
Safety Net:        Git auto-snapshots before every agent run
```

---

## Appendix B: Glossary

| Term | Definition |
|------|-----------|
| **Host** | The desktop application (GUI shell). Renders primitives. Does not understand domain-specific tools. |
| **Adapter** | A plugin that bridges a specific tool/workflow to the Host's primitive model. |
| **Primitive** | One of 4 abstract data types: Context, Strategy, Execution, Verification. Used by the rendering layer. |
| **Issue** | An external work item (Jira ticket, GitHub issue, idea). Represents business intent (*what* to do). One issue can produce many agent tasks. |
| **Task** | A local unit of agent work. Represents technical execution (*how* to do it). Assigned to one agent, targets specific repos. Has its own verification pipeline. |
| **Verification Pipeline** | A 4-stage quality gate: Prechecks (auto) → AI Review (auto) → PR (auto) → Approval (manual). Each Task has its own pipeline. |
| **Project** | A multi-repo container. Groups repositories, external system links, and issues under one umbrella. |
| **Repo** | A git repository within a Project. Tasks target specific repos; one issue may span multiple repos. |
| **External System** | A third-party tool that provides work items (Jira, GitHub, Azure DevOps, Linear). Connected via adapters. |
| **Cartridge** | Informal name for an external agent tool (Claude Code, SpecKit, MetaMorph, etc.). |
| **Sidecar** | A co-process (TypeScript) that runs alongside the Tauri Rust backend to handle SDK interaction. |
| **BYOK** | Bring Your Own Key — users provide their own API keys for Claude/OpenAI. |
| **Normalization Layer** | Thin shim that converts vendor-specific SDK events into the Host's unified `AgentEvent` schema. |
| **Advisory Lock** | A lockfile indicating an agent is working on a file. Not enforced by the OS — participants check voluntarily. |

---

## Phase 7: App Shell Architecture Decisions

> **Status:** Decided (2026-02-14)
> **Context:** Designing the layout shell — the outermost chrome that frames all adapter content.

### 7.1 — Shell Responsibility Model

> **Research Question:** How much intelligence should the shell have? Should it interpret adapter content, or just render it?

| Model | Description | Pros | Cons |
|-------|------------|------|------|
| **A. Smart shell** | Shell understands adapter concepts, routes between views, manages focus | Consistent UX, can enforce patterns | Tight coupling, hard to extend, adapter innovation constrained |
| **B. Dumb shell** | Shell provides layout + grouping only. Adapters drive all content. | Maximally extensible, adapters can innovate freely | Shell can't enforce UX consistency, adapters must handle more |
| **C. Hybrid** | Shell provides layout + grouping + default renderers. Adapters can override. | Best of both — predictable defaults, adapter override when useful | More API surface to maintain |

**Decision: C (Hybrid).** The shell provides:
- Layout chrome (navbar, sidebar nav tree, status bar, panel arrangement)
- Default renderers for standard content types (sessions → chat thread, files → viewer)
- Grouping of all content by owning adapter

Adapters can optionally provide richer views. A file opens as you'd expect (default renderer), but an adapter with a specialized diff viewer or workflow phase renderer can override.

### 7.2 — Multi-Adapter Concurrency

> **Research Question:** Can multiple workflow extensions / adapters run simultaneously? How do conflicts resolve?

| Model | Description | Pros | Cons |
|-------|------------|------|------|
| **A. Fully concurrent** | Multiple adapters run simultaneously. Shell groups by adapter. | Maximum flexibility, no artificial constraints | Potential UI clutter if many adapters active |
| **B. Isolated scopes** | Multiple adapters coexist but each gets its own session scope | Clean isolation | Prevents cross-adapter workflows |
| **C. One active at a time** | Only one workflow extension active. User switches explicitly. | Simple, no conflicts | Too restrictive, doesn't match how agents actually work |

**Decision: A (Fully concurrent).** Key rationale:

1. **GSD runs within Claude.** A workflow like GSD that layers on top of Claude Code is handled entirely by Claude's adapter. The shell doesn't need to arbitrate between Claude and GSD — Claude manages that internally. This eliminates the most common "conflict" scenario.

2. **Primary vs. background is per-adapter.** Each adapter tracks whether it's the primary active adapter (user initiated a session through it) or backgrounded (another adapter took focus). This is mainly for **action display** — the primary adapter shows its full action set, backgrounded adapters show minimal actions.

3. **Shell just renders both.** If two adapters both surface suggested actions, the shell renders both sets, grouped under their respective adapter headers. No merging, no conflict resolution at the shell level. Users disambiguate by visual grouping.

### 7.3 — Capability-Driven Nav Tree

> **Research Question:** How should the sidebar navigation adapt to different adapter capabilities?

**Decision:** The nav tree is driven entirely by `AgentCapabilities`. Each adapter section only shows subsections for capabilities the adapter actually declares.

This means:
- Claude Code (full capabilities) shows: Sessions, Workflows, Skills, MCP Servers, Hooks
- A minimal adapter (streaming + interruptible only) shows: Sessions
- A custom adapter that supports MCP but not skills shows: Sessions, MCP Servers

This keeps the UI honest — nothing appears that can't actually be used.

### 7.4 — File Rendering Strategy

> **Research Question:** When a user opens a file (plan doc, code, config), who decides how to render it?

| Model | Description |
|-------|------------|
| **A. Always adapter** | Adapter always provides the renderer |
| **B. Always default** | Shell has built-in renderers, adapters can't override |
| **C. Default with adapter override** | Shell provides sensible default, adapter can offer richer view |

**Decision: C (Default with adapter override).** A file opens predictably — the shell picks the renderer based on file type (markdown → viewer, code → syntax-highlighted, JSON → tree view). But if an adapter has something better to offer (e.g., a specialized constitution editor for GSD's constitution.md, or an interactive plan editor that understands task structure), the adapter's renderer takes precedence.

This is progressive enhancement: the baseline experience is always good, and adapters make it better when they can.

### 7.5 — Session Context Display

> **Research Question:** What should the sidebar show for each session beyond "adapter-id"?

**Decision:** Each session in the nav tree shows:
- **Status dot** — color-coded (running=blue pulse, completed=green, failed=red, starting=amber)
- **Prompt snippet** — truncated first line of the task prompt (this is the most meaningful identifier)
- **Adapter** — shown at the group level, not per-session
- **Model** — in the session detail header, not the nav tree (too noisy)

The adapter ID is shown as the parent group label, not repeated on every session. This is cleaner and matches how users think — "these are my Claude sessions" not "this session uses claude-code".

---

## Phase 8: Execution Model Landscape & Adapter Impact

> **Status:** Research complete (2026-02-14)
> **Context:** What agent execution models exist beyond CLI wrapping, and how do they affect our adapter contracts, event system, and UI?

### 8.1 — Execution Model Taxonomy

The 2026 agent landscape has five distinct execution models. Our adapter architecture must handle all of them without becoming a lowest-common-denominator system.

#### Model 1: Local CLI Process

What we support today. Agent runs as a child process on the user's machine.

| Aspect | Detail |
|--------|--------|
| **Examples** | Claude Code CLI, Aider, Cline CLI, Roo Code CLI |
| **Execution** | `child_process.spawn()` on user's machine |
| **Communication** | stdout/stderr, NDJSON streaming |
| **State** | Local filesystem, process memory |
| **Observation** | Rich (Claude Agent SDK stream) to lossy (stdout parsing) |
| **Adapter complexity** | LOW — spawn process, parse output |
| **Latency** | Immediate — events stream in real-time |

#### Model 2: Local SDK / In-Process

Agent runs as a library call within our process (or a tightly coupled sidecar).

| Aspect | Detail |
|--------|--------|
| **Examples** | Claude Agent SDK (TS `query()` / V2 `createSession()`), OpenAI Agents SDK (`Runner.run_streamed()`), LangGraph, CrewAI, PydanticAI |
| **Execution** | In-process async iterator or subprocess with IPC |
| **Communication** | Direct callbacks, async generators, event emitters |
| **State** | In-memory, with optional persistence (LangGraph checkpointers, Claude session resume) |
| **Observation** | RICH — full streaming: text deltas, tool calls, agent handoffs, cost updates |
| **Adapter complexity** | LOW-MEDIUM — import library, register callbacks, normalize events |

Key systems:
- **Claude Agent SDK V2** — `createSession()` / `resumeSession()` with `send()` / `stream()` cycle. Session persistence via Anthropic servers. Fork support. Hooks system (12 event types in TS).
- **OpenAI Agents SDK** — `Runner.run_streamed()` emits 3 event types: `RawResponsesStreamEvent` (token deltas), `RunItemStreamEvent` (tool calls, outputs), `AgentUpdatedStreamEvent` (handoffs). Provider-agnostic, supports 100+ LLMs.
- **LangGraph 1.0** — DAG-based execution with automatic checkpointing at every superstep. Backends: in-memory, SQLite, PostgreSQL, MongoDB. Streaming: LLM tokens, tool calls, state updates, node transitions. Time-travel debugging. Human-in-the-loop pauses with durable state.
- **CrewAI** — Dual model: **Crews** (autonomous agent teams with role-based delegation) + **Flows** (event-driven orchestration with conditional branching). Sequential, parallel, and hierarchical execution modes.

#### Model 3: Container / Sandbox

Agent runs inside an isolated container or microVM. The host manages the container lifecycle.

| Aspect | Detail |
|--------|--------|
| **Examples** | OpenHands, SWE-Agent/SWE-ReX, E2B, Daytona |
| **Execution** | Docker container, Firecracker microVM, or namespace isolation |
| **Communication** | REST API inside container (OpenHands), WebSocket from host, or command output |
| **State** | Container filesystem (ephemeral), optional persistent volumes, forkable snapshots |
| **Observation** | MEDIUM — event stream (OpenHands) or command output (SWE-ReX) |
| **Adapter complexity** | MEDIUM — container lifecycle management + event bridge |

Key systems:
- **OpenHands V1 SDK** — Event-sourced architecture: all interactions are immutable events appended to a log. Docker sandbox runs REST API server internally. `BaseWorkspace` abstraction: `LocalWorkspace` (in-process) or `RemoteWorkspace` (Docker/API) — same agent code, different environments. REST/WebSocket server for remote execution. Built-in VSCode IDE, VNC desktop, Chromium browser for human inspection.
- **E2B** — Firecracker microVMs, ~150ms startup. Python & TS SDKs. `Sandbox` class with `run_code()`, `install_pkg()`, `create_file()`. Streaming stdout/stderr. Desktop sandbox variant for computer-use agents (Manus). Long-running sandboxes up to 24h with pause/resume.
- **Daytona** — 27ms sandbox startup (fastest). Declarative image builders — agent describes dependencies, Daytona builds Docker image on the fly. **Fork/branch execution**: agent hits decision point, forks sandbox into parallel branches, evaluates alternatives, snapshots promising branches. Python & TS SDKs. Apache 2 licensed.
- **SWE-ReX** — Platform abstraction layer: same agent code runs on Docker, AWS Fargate, Modal, or local. Massively parallel. Powers SWE-agent. Interactive shell sessions (ipython, gdb) alongside bash.

#### Model 4: Cloud VM (Remote, Async)

Agent runs on a vendor-managed VM in the cloud. Results arrive asynchronously, often as a PR.

| Aspect | Detail |
|--------|--------|
| **Examples** | OpenAI Codex Cloud, Google Jules, Devin, Cursor Background Agents, GitHub Copilot Coding Agent |
| **Execution** | Vendor-managed VM/container in the cloud |
| **Communication** | REST API + polling/webhooks, limited streaming |
| **State** | Vendor-managed, session-scoped, often git-backed |
| **Observation** | LIMITED-MEDIUM — poll for status, traces (Codex), session logs, final PR |
| **Adapter complexity** | MEDIUM-HIGH — polling, async results, latency, plan approval flows |

Key systems:
- **OpenAI Codex Cloud** — Isolated containers, internet disabled during execution. gpt-5.3-codex model. Traces capture every prompt, tool call, handoff. Max 6 sub-agents per run. Network sandbox proxy with policy enforcement. Steering APIs for active turns. Results delivered as code changes + terminal logs.
- **Google Jules** — Cloud VMs **with internet access**. Plan-then-execute flow: analyzes codebase → generates plan → user approves → implements → creates PR. [Jules API](https://developers.google.com/jules/api) with Session (block of work) and Activity (individual events) concepts. Async by design. CLI tool (`jules-tools`) for terminal-based interaction.
- **Devin** — Full VM with shell, code editor, and browser. Agent Compute Units (ACUs) as billing metric. API for batch sessions. Interactive planning, codebase search (Devin Search), auto-generated wikis (DeepWiki). Senior at understanding code, junior at execution.
- **Cursor Background Agents** — Ubuntu VMs with internet access, per-task Docker support. Subagent system for parallel specialized work. CLI-to-cloud handoff (push local chat to cloud agent). [Background Agents API](https://docs.cursor.com) for programmatic lifecycle management. Token-based pricing.
- **GitHub Copilot Coding Agent** — GitHub Actions-powered environment. Triggered by issue assignment or chat. Pushes to `copilot/` branches only. Draft PR as output. Session logs for tracking. GA for all paid Copilot plans.
- **Amazon Q Developer** — IDE/CLI-integrated, cloud-assisted. Plan-then-execute with approval. Self-healing test loops. Multi-repo awareness. Built on Amazon Bedrock (multi-FM routing). 1000 agentic requests/month on Pro tier.

#### Model 5: Multi-Agent Orchestration Frameworks

Framework manages a topology of agents, not just one. Adapters must surface the topology, not just individual sessions.

| Aspect | Detail |
|--------|--------|
| **Examples** | LangGraph subgraphs, CrewAI Crews, AutoGen, Mastra, AWS CLI Agent Orchestrator |
| **Execution** | Framework manages multiple agent lifecycles |
| **Communication** | Framework event system (streaming + checkpoints) |
| **State** | Framework-managed with graph-level checkpointing |
| **Observation** | RICH — per-agent and per-graph events, state snapshots |
| **Adapter complexity** | MEDIUM — bridge framework events + surface agent topology |

---

### 8.2 — Impact on Adapter Contracts

Our current `Adapter` interface assumes Model 1 (local CLI process). To support the full landscape without bloating the base contract, we should use **optional extension interfaces**.

#### Current interface (sufficient for Models 1 & 2):
```typescript
interface Adapter {
  readonly manifest: AdapterManifest;
  startSession(config: SessionConfig, onEvent: (event: AgentEvent) => void): Promise<SessionHandle>;
  checkAvailability(): Promise<string | null>;
}
```

#### Proposed extension interfaces:

```typescript
// For container/sandbox adapters (Model 3)
interface SandboxedAdapter extends Adapter {
  provisionEnvironment(config: EnvironmentConfig): Promise<EnvironmentHandle>;
  snapshotEnvironment(envId: string): Promise<SnapshotId>;
  forkEnvironment(envId: string): Promise<EnvironmentHandle>;
  destroyEnvironment(envId: string): Promise<void>;
}

// For cloud/async adapters (Model 4)
interface AsyncAdapter extends Adapter {
  pollSession(sessionId: string): Promise<SessionStatus>;
  getSessionResult(sessionId: string): Promise<SessionResult>;
  getSessionLogs(sessionId: string): Promise<string>;
}

// For plan-then-execute adapters (Models 3 & 4)
interface PlanningAdapter extends Adapter {
  approvePlan(sessionId: string, planId: string): Promise<void>;
  rejectPlan(sessionId: string, planId: string, reason?: string): Promise<void>;
}

// For multi-agent frameworks (Model 5)
interface OrchestrationAdapter extends Adapter {
  getTopology(sessionId: string): Promise<AgentTopology>;
  getSubagentStatus(sessionId: string, agentId: string): Promise<SubagentStatus>;
}
```

#### New execution model field in manifest:

```typescript
interface AdapterManifest {
  // ... existing fields ...
  capabilities: AgentCapabilities;
  executionModel: {
    type: 'local-cli' | 'local-sdk' | 'container' | 'cloud-vm' | 'orchestration';
    sandbox: boolean;          // runs in isolated environment
    remote: boolean;           // executes on a different machine
    async: boolean;            // results delivered asynchronously
    forking: boolean;          // can fork execution state
    planApproval: boolean;     // proposes plans before executing
    producesArtifacts: boolean; // output is a PR/diff, not just an event stream
  };
}
```

---

### 8.3 — Impact on Event System

New event types needed for Models 3-5:

| Event | When | Model |
|-------|------|-------|
| `environment_provisioning` | Sandbox/VM is being created | 3, 4 |
| `environment_ready` | Sandbox/VM is up and ready | 3, 4 |
| `environment_destroyed` | Sandbox/VM torn down | 3, 4 |
| `plan_proposed` | Agent proposes a plan for approval | 3, 4 |
| `plan_approved` | User approved the plan | 3, 4 |
| `plan_rejected` | User rejected the plan | 3, 4 |
| `checkpoint_created` | State snapshot saved | 3, 5 |
| `fork_created` | Execution branched | 3 |
| `pr_created` | Pull request opened | 4 |
| `pr_updated` | PR received new commits | 4 |
| `agent_topology_changed` | Sub-agents added/removed/handoff | 5 |

These extend the existing `AgentEvent` discriminated union. The UI can handle them progressively — unknown event types are simply not rendered.

---

### 8.4 — Impact on UI

#### New UI surfaces needed per execution model:

**Container/Sandbox (Model 3):**
- Environment status indicator (provisioning → ready → destroyed)
- Container logs viewer (separate from agent event stream)
- Fork/branch visualization (Daytona: parallel execution paths)
- Environment resource usage (CPU, memory, disk)

**Cloud VM / Async (Model 4):**
- Plan approval flow — agent proposes plan, user reviews + approves/rejects
- Async notification system — agent takes minutes/hours, user gets notified on completion
- PR integration panel — diff view, CI status, review state, merge button
- Session log viewer — full terminal output from the remote VM

**Orchestration (Model 5):**
- Agent topology diagram — which agents are active, how they're connected
- Per-agent event streams — drill into individual agents within a crew/graph
- Checkpoint timeline — visualize execution checkpoints, enable time-travel

#### Mapping to AppShell design decisions:

All these surfaces fit within the existing AppShell architecture:
- **Sidebar nav tree**: Environment status, plan approval badges, PR counts all appear as metadata on adapter/session nodes
- **Default renderers**: Event stream renderer handles new event types progressively
- **Adapter override renderers**: OpenHands could provide its own embedded VSCode/VNC viewer. Devin could show its interactive planning UI. These use the "default renderer with adapter override" pattern from §7.4.
- **Multi-adapter concurrency**: A local Claude Code session and a cloud Codex session run simultaneously. Shell groups them under their respective adapter headers per §7.2.

---

### 8.5 — Protocol Alignment

Three emerging protocols are relevant to our architecture:

#### AG-UI (Agent-User Interaction Protocol)
CopilotKit's open standard for agent-frontend communication. Event-based, uses SSE or WebSocket. ~16 event types in 5 categories. Integrates with LangGraph, CrewAI, Mastra, PydanticAI.

**Our alignment**: Our `AgentEvent` system is conceptually similar. We should ensure our event types can map to/from AG-UI events, enabling framework adapters to bridge directly. AG-UI's transport layer (SSE/WebSocket) matches our existing WebSocket transport.

#### A2UI (Agent-to-User Interface Protocol)
Google's declarative UI protocol (v0.8 preview). Agent sends JSON describing UI components, client renders them natively. Security-first: no executable code, only trusted component catalog. Framework-agnostic.

**Our alignment**: This maps directly to our "adapter override renderer" concept. An adapter could send A2UI-style component specs for custom UI (e.g., Devin's planning view), and our shell renders them using its React component catalog. A2UI's catalog model = our UI component library.

#### MCP (Model Context Protocol)
Already in our plan for tool provision. Relevant here because container/cloud agents often expose MCP servers inside their environments (OpenHands, Codex).

**Our alignment**: When an adapter manages a sandbox that runs MCP servers internally, our shell's "MCP Servers" nav section should show those remote MCP servers alongside local ones.

---

### 8.6 — Prioritization for Adapter Support

Based on ecosystem maturity, user demand, and adapter complexity:

| Priority | Execution Model | First Adapters | Rationale |
|----------|----------------|----------------|-----------|
| **P0** (have it) | Local CLI | Claude Code CLI | Working today |
| **P1** (next) | Local SDK | Claude Agent SDK V2, OpenAI Agents SDK | Richest event streams, lowest adapter complexity |
| **P2** (soon) | Container | OpenHands, E2B | Growing demand for sandbox safety, good APIs |
| **P3** (planned) | Cloud VM | Codex Cloud, Jules, Cursor BG Agents | Async model requires new UI patterns (plan approval, notifications) |
| **P4** (future) | Orchestration | LangGraph, CrewAI | Complex topology visualization, niche demand |

---

### 8.7 — Key Findings Summary

1. **The adapter base contract holds.** `startSession()` + `onEvent()` works for all 5 models. Extension interfaces add capabilities without breaking the base.

2. **Execution model is a manifest property, not a capability flag.** Whether an agent runs locally vs. in a cloud VM changes the entire interaction pattern. This deserves its own manifest field, not just a boolean.

3. **Plan-then-execute is the dominant cloud pattern.** Jules, Codex, Cursor BG agents, and Amazon Q all propose plans before executing. Our UI needs a first-class plan approval flow.

4. **PRs are the primary output of cloud agents, not event streams.** Cloud agents produce pull requests. Our shell needs PR integration as a core surface, not an afterthought.

5. **Fork/snapshot is the killer feature for sandboxes.** Daytona's 27ms fork and LangGraph's checkpoint time-travel enable entirely new workflows (speculative execution, A/B testing of approaches). Worth designing for even if we don't build it immediately.

6. **AG-UI is the emerging interop standard.** Our event system should stay compatible. If we ever want adapters written by third parties, AG-UI compatibility reduces their integration burden.

---

## Phase 9: Cross-Adapter Handoff — The Artifact Bus

> **Status:** Design analysis (2026-02-14)
> **Context:** User creates a plan in GSD (Claude Code), wants to hand it off to OpenHands/Codex/Jules for autonomous execution. GSD has no knowledge of other adapters. How does this work seamlessly within one conversation?

### 9.1 — The Problem

The core tension: **GSD doesn't know about OpenHands. OpenHands doesn't know about GSD. But the user wants plan→execute to feel like one fluid motion within the same shell.**

This is a **cross-adapter composition** problem. It's fundamentally different from multi-agent orchestration (where one framework manages multiple agents). Here, independent adapters need to pass work products between each other without direct coupling.

### 9.2 — Three Complementary Layers (Not Competing Approaches)

Initial analysis treated agent-native tools, shell injection, and artifact detection as mutually exclusive approaches. On further consideration, **they're complementary layers** that serve different interaction styles and can all coexist. All three ultimately do the same thing: take a work product from session A and create session B with it. They differ only in *who extracts the context* and *who initiates the action*.

```
Layer 3 (Contextual UI):    Artifact bus detects plans → shows execute buttons
Layer 2 (Conversational):   User says "run this in a sandbox" → agent packages context → shell routes
Layer 1 (Direct command):   User types /execute-in-openhands → shell grabs context → routes
```

#### Layer 1: Direct Shell Actions (slash commands / command palette)

User triggers a shell-level action. No agent involvement.

```
User types: /execute-in-openhands
Shell: grabs conversation context from current session → creates OpenHands session
```

- **How context is extracted:** Shell takes the full conversation history (or last N turns) and passes it to the target adapter. The target adapter's agent figures out what to do with it.
- **When it works:** Power users who know what they want. Quick, no ambiguity.
- **Adapter contract:** Adapters register shell actions in their manifest. Shell shows them in command palette when that adapter is available.

#### Layer 2: Conversation-Driven Handoff (agent-assisted)

User asks the agent conversationally. Agent helps package context. Shell mediates the actual routing.

```
User: "now execute this plan in a sandbox"
Agent: [understands what "this plan" means — it just wrote it]
       [calls generic handoff tool with structured plan content]
Shell: intercepts tool call → creates target session with packaged context
```

**Key insight: the LLM is the best artifact extractor.** The agent just wrote the plan. It knows exactly what's relevant, what the dependencies are, what the success criteria are. Asking a heuristic to extract this is strictly worse than asking the agent that produced it.

The tool doesn't need to be adapter-specific. A single generic tool works:

```typescript
// Generic — not "execute_in_openhands", just "handoff"
interface HandoffTool {
  name: 'handoff_to_environment';
  params: {
    intent: string;              // "execute this implementation plan"
    content: string;             // the plan, diff, analysis, etc.
    context?: {
      repository?: string;
      branch?: string;
      files?: string[];
    };
  };
}
```

The agent never knows *where* this goes. The shell decides routing based on available adapters, user preference, or a follow-up prompt ("which environment?").

**Critical insight:** Execute is always user-initiated. The user says "run this in a sandbox" — the agent doesn't autonomously decide to ship work elsewhere. This eliminates the "agent calls tool at wrong time" concern from the earlier analysis. The earlier rejection of this approach was based on the assumption that the agent would autonomously decide to hand off — but in practice, handoff is a response to a user request, mediated by the agent's context-packaging intelligence.

**How to inject the tool:** For agents that support it (Claude Code via MCP, OpenAI via tools), the shell provides a lightweight MCP server or tool definition. For agents that don't, Layer 1 (slash commands) covers the same use case. The tool description is minimal — one tool, ~50 tokens of context window. Not "polluting" — comparable to any other MCP tool the agent has access to.

#### Layer 3: Contextual Artifact Detection (automatic UI affordances)

Shell automatically detects work products and shows relevant actions, without the agent or user doing anything explicit.

```
Agent writes a plan → Adapter pattern-matches → Shell shows [▶ Execute] buttons
Agent produces a diff → Adapter detects → Shell shows [▶ Review] [▶ Create PR] buttons
```

- **How context is extracted:** Adapter-specific heuristics (file patterns, tool use patterns, structured output conventions). See §9.4 for strategies.
- **When it works:** Discoverability — user might not know that sandbox execution is available until they see the button. Also works when the user didn't ask for handoff but the shell recognizes the opportunity.
- **Adapter contract:** Adapters declare `produces` and `consumes` artifact types in their manifest. Shell matches at runtime.

#### How the Three Layers Interact

```
┌─ GSD Session ──────────────────────────────────────────────┐
│                                                            │
│  User: "Create a plan to refactor the auth module"         │
│  Claude: [produces detailed plan]                          │
│                                                            │
│  ┌─ Layer 3: Artifact Detection ───────────────────────┐   │
│  │ Shell detected plan artifact → showing actions      │   │
│  │ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │   │
│  │ │▶ Execute in  │ │▶ Execute in  │ │▶ Execute in  │ │   │
│  │ │  OpenHands   │ │  Codex Cloud │ │  Jules       │ │   │
│  │ └──────────────┘ └──────────────┘ └──────────────┘ │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                            │
│  OR — Layer 2: Conversational                              │
│  User: "execute this in a sandbox"                         │
│  Claude: [calls handoff_to_environment tool with plan]     │
│  Shell: "Which environment?" → [OpenHands] [E2B] [Codex]  │
│                                                            │
│  OR — Layer 1: Direct command                              │
│  User: /execute-in-openhands                               │
│  Shell: [grabs conversation, creates OpenHands session]    │
│                                                            │
│  All three paths → same outcome:                           │
│  New session created, linked in sidebar, artifact passed   │
└────────────────────────────────────────────────────────────┘
```

Each layer has a strength:

| Layer | Strength | Limitation |
|-------|----------|------------|
| **1 — Slash command** | Zero ambiguity, power users, always works | User must know the command exists |
| **2 — Conversational** | Natural flow, agent packages context perfectly | Requires tool injection support in the agent |
| **3 — Artifact detection** | Discoverability, zero effort from user | Requires extraction heuristics, may miss or false-positive |

**Implementation priority:** Layer 1 first (cheapest, always works), Layer 3 next (best UX for discoverability), Layer 2 last (most natural but needs tool injection plumbing per agent type).

### 9.3 — The Artifact Contract

```typescript
// ─── Artifact Types ───────────────────────────────────────

type ArtifactType =
  | 'implementation-plan'   // structured plan with steps, files, dependencies
  | 'diff'                  // code changes (unified diff, patch)
  | 'pr-spec'               // pull request specification (title, body, branch)
  | 'test-suite'            // test cases to run
  | 'codebase-analysis'     // analysis of codebase structure, issues, etc.
  | 'review'                // code review with comments
  | string;                 // extensible — adapters can define custom types

interface Artifact {
  id: string;
  type: ArtifactType;
  title: string;                                    // human-readable label
  content: unknown;                                 // typed per artifact type
  source: {
    adapterId: string;
    sessionId: string;
  };
  context?: {
    repository?: string;                            // repo path or URL
    branch?: string;
    files?: string[];                               // relevant file paths
  };
  createdAt: number;
}

// ─── Adapter Manifest Extensions ──────────────────────────

interface AdapterManifest {
  // ... existing fields ...

  /** Artifact types this adapter's sessions may produce */
  produces?: ArtifactType[];

  /** Artifact types this adapter can consume, and how */
  consumes?: ArtifactConsumption[];
}

interface ArtifactConsumption {
  artifactType: ArtifactType;
  action: string;                   // "Execute plan", "Review diff", "Run tests"
  description: string;              // shown in tooltip
  inputMapping: 'structured' | 'prompt';
  // 'structured' = adapter expects the artifact as structured data
  // 'prompt' = adapter expects the artifact serialized into a text prompt
}

// ─── New Event Type ───────────────────────────────────────

interface ArtifactProducedEvent {
  type: 'artifact_produced';
  artifact: Artifact;
}
// Added to the AgentEvent discriminated union.
// When the shell sees this event, it runs artifact matching.

// ─── Shell Artifact Registry ──────────────────────────────

interface ArtifactRegistry {
  register(artifact: Artifact): void;
  getConsumers(artifactType: ArtifactType): ArtifactConsumption[];
  getArtifact(id: string): Artifact | undefined;
  getArtifactsForSession(sessionId: string): Artifact[];
}
```

### 9.4 — How Artifacts Get Extracted

The hardest sub-problem: **how does the shell know an agent produced a plan?**

The agent (e.g., Claude Code) is just generating text. It doesn't know it's producing an "artifact." Four extraction strategies, in order of reliability:

#### Strategy 1: Adapter-Recognized Patterns (primary)

Each adapter knows its own agent's output patterns. The Claude Code adapter knows that when Claude writes to `PLAN.md` or uses TodoWrite with a structured plan format, that's a plan artifact. The OpenHands adapter knows that when its agent produces a `.patch` file, that's a diff artifact.

```typescript
// Inside ClaudeCodeAdapter.startSession():
onEvent(event) {
  if (event.type === 'tool_use' && event.tool === 'Write' && event.path.endsWith('PLAN.md')) {
    // Extract plan content, emit artifact
    this.emitArtifact({
      type: 'implementation-plan',
      title: 'Implementation Plan',
      content: parsePlan(event.content),
      context: { repository: this.repoPath }
    });
  }
}
```

**Pro:** Adapter-specific, high precision, no agent changes needed.
**Con:** Heuristic — might miss some plans, might false-positive on others.

#### Strategy 2: Structured Output Convention

Define a lightweight convention that agents can optionally follow. For Claude Code, this could be a specific YAML frontmatter format or a code fence with a special language tag:

````
```artifact:implementation-plan
title: Refactor auth module
steps:
  - file: src/auth/handler.ts
    action: modify
    description: Extract token validation into middleware
...
```
````

The adapter watches for this pattern and extracts it.

**Pro:** Explicit, reliable, agent remains in control of content.
**Con:** Requires agent to know the convention (but this is just a prompt instruction, not tool coupling).

#### Strategy 3: User-Initiated Extraction

User selects a portion of the conversation and says "use this as a plan." Shell captures the selection as an artifact.

**Pro:** Works with any agent, zero extraction logic needed.
**Con:** Manual, breaks the seamless flow.

#### Strategy 4: Post-Hoc LLM Extraction

After the agent finishes (or at any pause), shell runs a lightweight model over the conversation to extract structured artifacts.

**Pro:** Works retroactively, catches things the adapter missed.
**Con:** Latency, cost, reliability concerns.

**Recommended approach:** Strategy 1 as the primary mechanism, with Strategy 3 as a universal fallback. Strategy 2 as an optional enhancement for adapters that want high-precision extraction. Strategy 4 as a future enhancement.

### 9.5 — The Full Handoff Flow (Concrete Example)

**Scenario:** User plans in GSD, executes in OpenHands, reviews result back in GSD.

```
Step 1: Planning (GSD / Claude Code session)
─────────────────────────────────────────────
User: "Create a comprehensive plan to refactor the auth module to use JWTs"
Claude: [analyzes codebase, produces detailed plan]
       → Adapter detects plan artifact
       → Shell shows: [▶ Execute in OpenHands] [▶ Execute in Codex]

Step 2: Handoff (Shell-mediated)
────────────────────────────────
User clicks [▶ Execute in OpenHands]
Shell:
  1. Retrieves artifact from registry
  2. Creates OpenHands session with:
     - artifact.content as structured input (or serialized prompt)
     - artifact.context.repository → mounted into container
     - metadata.originSessionId → links back to GSD session
  3. OpenHands adapter provisions sandbox, starts execution
  4. New session appears in sidebar, visually linked to GSD session

Step 3: Autonomous Execution (OpenHands session)
────────────────────────────────────────────────
OpenHands agent executes the plan step-by-step in sandbox
Events stream into the shell: file edits, test runs, etc.
User can observe but doesn't need to intervene

Step 4: Result (OpenHands → artifact)
────────────────────────────────────
OpenHands finishes → adapter emits artifact: { type: 'diff', content: unifiedDiff }
Shell shows: [▶ Review in GSD] [▶ Create PR]

Step 5: Review (back in GSD session)
──────────────────────────────────
User clicks [▶ Review in GSD]
Shell sends diff artifact into the *original* GSD session as context
Claude: "Here's my review of the changes produced by the sandbox execution..."

Full circle. Three sessions. Zero adapter coupling.
```

### 9.6 — Sidebar & UI Implications

Artifact handoffs create **session chains**. The sidebar should visualize these:

```
Sidebar:
├─ Claude Code (GSD)
│  ├─ ● "Refactor auth plan"         ← original session
│  │  └─ artifacts: [📋 JWT Auth Plan]
│  └─ ● "Review sandbox changes"      ← spawned from artifact
│
├─ OpenHands
│  └─ ● "Execute: JWT Auth Plan"      ← spawned from artifact
│     ├─ origin: "Refactor auth plan" ← linked back
│     └─ artifacts: [📄 Implementation Diff]
```

When an artifact has consumers, the event stream renderer shows **action chips** inline:

```
┌─────────────────────────────────────────────────┐
│ 📋 Implementation Plan: JWT Auth Refactor       │
│                                                 │
│ 1. Extract token validation to middleware...    │
│ 2. Replace session cookies with JWT...          │
│ 3. Add token refresh endpoint...                │
│                                                 │
│ ┌────────────────┐ ┌──────────────┐             │
│ │ ▶ OpenHands    │ │ ▶ Codex      │             │
│ │   Execute      │ │   Execute    │             │
│ └────────────────┘ └──────────────┘             │
└─────────────────────────────────────────────────┘
```

### 9.7 — Agent Awareness: How Much Should the Agent Know?

The question: "should we inject special tools or instructions into agents, or keep them fully unaware of the shell's routing capabilities?"

**Answer: it depends on the layer, and both approaches are valid at different levels.**

#### What the agent SHOULD know (Layer 2 tool)

For agents that support tool injection (Claude Code via MCP, OpenAI via tools), the shell can provide a single generic `handoff_to_environment` tool. This is justified because:

1. **Execute is always user-initiated.** The user says "run this in a sandbox." The agent responds by packaging context and calling the tool. It doesn't autonomously decide to ship work. The earlier concern about "agent calls tool at wrong time" doesn't apply when handoff is a direct response to a user request.

2. **The LLM is the best context packager.** The agent just wrote the plan. It knows what's relevant — dependencies, success criteria, risk areas. A heuristic extraction system is strictly worse at this. Letting the agent call a handoff tool with structured content means the receiving adapter gets well-packaged input.

3. **One generic tool, minimal context cost.** Not "execute_in_openhands" — just "handoff_to_environment". ~50 tokens of tool description. Comparable to any MCP tool. The agent never sees adapter names, pricing, or availability.

4. **Shell still controls routing.** The agent says "hand this off." The shell decides *where* based on available adapters and user preference. The agent is a context packager, not a router.

#### What the agent SHOULD NOT know

- Which specific adapters/environments are available
- Whether those environments are currently running or healthy
- Pricing, quotas, or resource constraints
- Implementation details of the target environment

These remain shell-level concerns. The agent's tool is a generic "I have packaged work for handoff" signal. The shell handles everything else.

#### What about agents that DON'T support tool injection?

Layer 1 (slash commands) covers them. `/execute-in-openhands` works regardless of whether the agent has any awareness. The shell grabs the conversation context directly.

#### Optional: Awareness hint for better artifact formatting

Adapters can optionally include a single-line hint in the agent's system context:

> "When you produce a structured implementation plan, the user's environment can route it to sandboxed execution environments for autonomous implementation."

This makes the agent format plans more carefully (clear steps, file paths, success criteria) without any tool coupling. It improves Layer 3 artifact detection AND Layer 2 context packaging.

### 9.8 — Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Who orchestrates handoffs? | **Shell** (not agents) | Agents don't know about each other. Shell controls routing. |
| How are artifacts extracted? | **Three layers** | L1: slash commands (always works), L2: agent tool call (best quality), L3: adapter heuristics (discoverability) |
| How are consumers discovered? | **Manifest declarations** | Static metadata, no runtime coupling |
| Who initiates handoff? | **Always the user** | Even in L2, agent only packages context in response to user request |
| Can agents know about handoff? | **Generic tool + optional hint** | One abstract `handoff_to_environment` tool, no adapter specifics. Hint improves formatting. |
| How are sessions linked? | **Artifact provenance chain** | Each artifact records source session, consuming session links back |
| Are handoffs reversible? | **Yes** — artifacts are immutable, sessions can be abandoned | No destructive state changes |
| What does the agent route to? | **Nothing — shell decides** | Agent says "hand this off." Shell picks target based on availability + user choice. |

### 9.9 — Relationship to AG-UI Protocol

AG-UI defines 5 event categories. Our `artifact_produced` event maps cleanly to AG-UI's "state" event category (shared state between agent and UI). The action buttons map to AG-UI's "tool" event category (UI-initiated actions).

If we emit artifacts as AG-UI-compatible state events, third-party frontends that speak AG-UI could render the same handoff actions. This keeps our system open.

---

## Phase 10: Emerging Standards & Protocol Landscape

> **Status:** Research complete (2026-02-14)
> **Context:** What protocols and standards are shaping the agent ecosystem? Which should we build on, which should we stay compatible with, and which can we ignore?

### 10.1 — The Protocol Stack

The 2026 agent ecosystem has converged around a layered protocol stack. Each layer solves a different communication problem:

**Note:** "ACP" is an overloaded acronym. Two entirely different protocols share it:
- **Agent Client Protocol** (Zed/Google) — editor↔agent communication. The "LSP for AI agents." **This one is critical for us.**
- **Agent Communication Protocol** (IBM/BeeAI) — agent↔agent messaging. REST-based. Less directly relevant.

This document uses "ACP" to mean the **Zed Agent Client Protocol** unless explicitly stated otherwise. IBM's protocol is referred to as "IBM ACP" where mentioned.

```
┌──────────────────────────────────────────────────────────────┐
│  Layer 7: ANP (Agent Network Protocol)                       │
│  Internet-scale agent discovery via W3C DIDs                 │
│  Status: Early/niche — W3C Community Group stage             │
├──────────────────────────────────────────────────────────────┤
│  Layer 6: A2A (Agent-to-Agent Protocol)                      │
│  Enterprise agent coordination via Agent Cards               │
│  Status: Production — Linux Foundation, Google-led           │
├──────────────────────────────────────────────────────────────┤
│  Layer 5: IBM ACP (Agent Communication Protocol)             │
│  Agent↔agent messaging — REST-based, no SDK required         │
│  Status: Pre-alpha → Alpha — Linux Foundation, IBM/BeeAI     │
├──────────────────────────────────────────────────────────────┤
│  Layer 4: AG-UI (Agent-User Interaction Protocol)            │
│  Agent-to-frontend event streaming                           │
│  Status: Production — CopilotKit, adopted by many frameworks │
├──────────────────────────────────────────────────────────────┤
│  Layer 3: ACP (Agent Client Protocol) ★ MOST RELEVANT       │
│  Editor↔agent communication — "LSP for AI agents"            │
│  Status: Production — Zed + Google + JetBrains, registry live│
├──────────────────────────────────────────────────────────────┤
│  Layer 2: MCP (Model Context Protocol) + Extensions          │
│  Agent-to-tool connections, MCP Apps (UI), Elicitation        │
│  Status: De facto standard — AAIF/Linux Foundation            │
├──────────────────────────────────────────────────────────────┤
│  Layer 1: A2UI (Agent-to-User Interface)                     │
│  Declarative UI components from agents                       │
│  Status: Preview (v0.8) — Google                             │
├──────────────────────────────────────────────────────────────┤
│  Layer 0: AGENTS.md                                          │
│  Per-repo agent instructions (Markdown)                      │
│  Status: Widely adopted (60K+ repos) — AAIF                  │
└──────────────────────────────────────────────────────────────┘
```

Not all layers compete. They solve different problems and compose:
- **MCP** connects agents to tools/data
- **ACP** (Zed) connects editors/shells to agents ← **our layer**
- **IBM ACP** connects agents to agents via messaging
- **A2A** connects agents for coordination and discovery
- **AG-UI** connects agents to frontends
- **A2UI** lets agents declare UI components
- **ANP** connects agents across the open internet
- **AGENTS.md** gives agents per-repo instructions

### 10.2 — MCP: The Foundation (and Its New Extensions)

MCP is now the de facto standard for agent-tool integration, with 97M+ monthly SDK downloads and governance under the Agentic AI Foundation (AAIF) at the Linux Foundation.

**What we already planned for:** MCP server connections, tool discovery, tool use events.

**What's new and critical:**

#### MCP Apps (January 2026) — VERY HIGH IMPACT

MCP Apps let tools return **interactive UI components** that render directly in the conversation. Dashboards, forms, charts, multi-step workflows — all rendered in sandboxed iframes with bidirectional JSON-RPC communication via `postMessage`.

How it works:
1. MCP tool declares `_meta.ui.resourceUri` pointing to a `ui://` resource
2. Host fetches the resource (bundled HTML/JS)
3. Host renders it in a sandboxed iframe
4. UI communicates back via JSON-RPC: calling tools, updating model context

Launch partners: Amplitude, Asana, Box, Canva, Clay, Figma, Hex, monday.com, Slack, Salesforce.
Client support: Claude, ChatGPT, VS Code, Goose — developed jointly by Anthropic + OpenAI.

**Impact on our shell:** This is our "adapter override renderer" from §7.4 — but standardized. Instead of each adapter providing custom React components, MCP Apps provide cross-platform interactive UIs via a standard protocol. **Our shell must be an MCP Apps host.** This means:
- Rendering sandboxed iframes in the event stream
- Implementing the JSON-RPC postMessage bridge
- Supporting `callServerTool()` and `updateModelContext()` APIs from the iframe
- Security: iframe sandboxing, user consent for UI-initiated tool calls

#### MCP Elicitation (Draft) — HIGH IMPACT

MCP servers can now **request user input mid-execution**. Two modes:
- **Form mode:** Server sends a JSON schema, client renders a form, user fills it, response flows back
- **URL mode:** Server directs user to an external URL for sensitive input (credentials, OAuth)

This means: during a tool call, the MCP server can pause execution and ask the user for information. The client displays the UI, collects input, and returns it.

**Impact on our shell:** We need a generic "MCP elicitation renderer" that can display form-mode schemas as dynamic forms and handle URL-mode redirects. This is a new UI surface we hadn't explicitly planned. It maps to a specialized event renderer in the event stream.

#### MCP Streamable HTTP (March 2025, stable)

Replaced the old HTTP+SSE dual-endpoint transport with a single HTTP endpoint supporting both POST and GET, with optional SSE upgrade. Better security (no always-on connection), resumable streams, session management.

**Impact on our shell:** When we connect to remote MCP servers (inside containers, cloud VMs), we use Streamable HTTP. No architectural impact — this is a transport detail handled by the MCP SDK.

#### AAIF Governance

MCP is now governed by the Agentic AI Foundation under the Linux Foundation, co-founded by Anthropic, Block, and OpenAI. Platinum members include AWS, Bloomberg, Cloudflare, Google, Microsoft. Gold: Docker, IBM, JetBrains, Salesforce, Shopify, etc.

**Impact:** MCP is a safe standard to build on. It won't disappear or fragment. We should treat it as foundational, not optional.

### 10.3 — ACP (Agent Client Protocol) — Zed/Google ★ CRITICAL

**This is the most directly relevant protocol to our project.** The Agent Client Protocol is essentially doing what our adapter layer does — it's the **"LSP for AI coding agents."** Pioneered by Zed, co-developed with Google (Gemini CLI was the reference implementation), now adopted by JetBrains.

**What it does:** Standardizes bidirectional communication between code editors and AI coding agents. Any agent that speaks ACP can plug into any ACP-compatible editor. Any editor that speaks ACP can use any ACP-compatible agent.

**Technical architecture:**
- **Transport:** JSON-RPC 2.0 over stdio (newline-delimited JSON). Editor spawns agent as subprocess.
- **Protocol layers:** Transport (NDJSON/stdio) → Protocol (JSON-RPC 2.0) → Connection (init, auth, sessions) → Session (conversation contexts) → Application (agent/client logic)
- **Initialization:** Client sends `initialize` with `protocolVersion`, `clientCapabilities`, `clientInfo`. Agent responds with its capabilities.
- **MCP integration:** On session start, the editor passes available MCP server endpoints and credentials to the agent, giving it a toolkit of capabilities.
- **Libraries:** TypeScript (`@zed-industries/agentic-coding-protocol`) and Rust
- **License:** Apache 2.0

**Agents with ACP support (as of early 2026):**
Claude Code, Codex CLI, Gemini CLI, GitHub Copilot CLI, Goose, OpenHands, Augment Code, Blackbox AI, Docker cagent, Kimi CLI, Mistral Vibe, OpenCode, Qoder CLI, Qwen Code, and more.

**Editors with ACP support:**
Zed (native), JetBrains (all IDEs), Neovim (CodeCompanion, avante.nvim), Emacs (agent-shell), marimo notebooks, Kiro.

**ACP Registry (January 2026):**
A centralized registry where agent developers register once and every ACP client can discover and install. Built-in to Zed and JetBrains IDEs. Deprecates Zed's older agent server extensions.

**How Claude Code integrates via ACP:**
Zed built an open-source adapter (`claude-code-acp`) that wraps the Claude Code SDK and translates its interactions into ACP's JSON-RPC format. The adapter bridges between Claude Code and ACP's standardized interface, allowing Claude Code to run as an independent process while the editor provides the UI.

**The fundamental question this raises for our project:**

Our `Adapter` interface is conceptually identical to ACP:
```
Our Adapter                          ACP
─────────────                        ───
AdapterManifest                  ≈   Agent capabilities (init response)
startSession(config, onEvent)    ≈   ACP session creation + streaming
SessionHandle.interrupt()        ≈   ACP cancellation
checkAvailability()              ≈   ACP initialization handshake
onEvent callback                 ≈   JSON-RPC notifications (streaming)
```

**Three strategic options:**

1. **Our shell IS an ACP client.** We implement the ACP client protocol. Every ACP-compatible agent works in our shell automatically. We get Claude Code, Codex, Gemini, Goose, etc. for free via the existing ACP adapters. Our `Adapter` interface becomes a thin wrapper over ACP.

2. **Our shell speaks ACP + our own extensions.** ACP handles the editor↔agent basics. We add our own extensions for: artifact bus (§9), execution model metadata (§8), multi-adapter coordination. ACP becomes our transport layer; our adapter interface adds the orchestration layer.

3. **Our shell has its own adapter interface, with an ACP bridge adapter.** One of our adapters is a generic "ACP Agent" adapter that wraps any ACP-compliant agent. Other adapters (SDK-based, container-based, cloud-based) use our native interface.

**Recommendation:** Option 2. ACP is battle-tested for the editor↔agent communication pattern. We don't need to reinvent that. But ACP doesn't cover: multi-adapter orchestration, artifact handoff between sessions, execution model metadata, sandbox/cloud lifecycle management. Those are our extensions on top.

**Impact on our adapter interface:**

```typescript
// Our adapter interface maps to ACP concepts:
interface Adapter {
  readonly manifest: AdapterManifest;     // ≈ ACP agent capabilities
  startSession(config, onEvent): Promise<SessionHandle>;  // ≈ ACP session + streaming
  checkAvailability(): Promise<string | null>;  // ≈ ACP initialize handshake
}

// Plus our extensions that ACP doesn't cover:
interface AdapterManifest {
  // ... standard fields (mappable to ACP capabilities) ...
  executionModel: ExecutionModelDescriptor;  // §8 — not in ACP
  produces?: ArtifactType[];                 // §9 — not in ACP
  consumes?: ArtifactConsumption[];          // §9 — not in ACP
}
```

**Relevance level:** VERY HIGH. This is the closest existing standard to what we're building. We should build on it, not beside it.

### 10.3a — ACP Integration Quality Tiers

**Not all ACP integrations are created equal.** ACP support falls into distinct quality tiers based on how the agent implements the protocol:

#### Tier 1: Native ACP (Built-In)

The agent implements ACP directly in its codebase. No external adapter needed.

| Agent | Notes |
|-------|-------|
| **OpenCode** | Clean native implementation. ACP sessions map directly to internal sessions. All features work, though some slash commands (`/undo`, `/redo`) are unsupported. Works identically to terminal mode. |
| **GitHub Copilot CLI** | Public preview. `copilot --acp` starts an ACP server (stdio or TCP). Full session/prompt/streaming support. Known issue: YOLO mode (`--yolo`) doesn't suppress permission prompts over ACP. |
| **Goose** | Native ACP. Open-source, first integration alongside Gemini CLI when ACP launched. |
| **Gemini CLI** | The original reference implementation. ACP was born from Zed + Google's collaboration to integrate Gemini CLI. |
| **Kiro CLI** | Native `kiro acp` command. |

#### Tier 2: External Adapter (SDK Wrapper)

An adapter process wraps the agent's SDK and translates to ACP. Extra moving part, but still first-party supported.

| Agent | Adapter | Caveats |
|-------|---------|---------|
| **Claude Code** | `@zed-industries/claude-code-acp` (Zed, Apache 2.0) | **Uses the Claude Agent SDK, NOT the CLI directly.** See auth caveat below. Not all features supported: Plan mode being added, hooks not supported, some built-in slash commands missing. Subagents work. |
| **Codex CLI** | `@zed-industries/codex-acp` (Zed) | Community adapter also exists (`codex-acp`). |

#### Tier 3: Community Adapter (Third-Party Wrapper)

Community-built adapters of varying quality and maintenance.

| Agent | Adapter | Notes |
|-------|---------|-------|
| **Cursor** | `cursor-agent-acp-npm` | Unofficial bridge. |
| **Qodo** | `qodo-acp-adapter` | Experimental. |
| **OpenCode** (alt) | `opencode-acp` (josephschmitt) | Community wrapper; OpenCode now has native ACP so this is redundant. |

#### The Claude Code ACP Authentication Caveat

**This is a real-world example of why integration tier matters.**

Zed's `claude-code-acp` adapter wraps the **Claude Agent SDK** (formerly Claude Code SDK). There's a critical distinction:

- **The Claude Agent SDK officially requires an API key** (`ANTHROPIC_API_KEY`). It is designed for programmatic use.
- **The Claude Code CLI** supports both API keys AND Claude Pro/Max subscription auth (via browser login).
- These are **two different tools with different auth models** — the SDK is API-only, the CLI is either.

This caused real user pain:
1. Users expected ACP to use their existing Claude subscription (browser login)
2. Instead, ACP was consuming their API key directly, even when they'd logged in via `/login`
3. Issue tracked at [zed-industries/claude-code-acp#29](https://github.com/zed-industries/claude-code-acp/issues/29)
4. **Fixed in v0.202.7** — the adapter now stops providing the API key from Zed settings and removes `ANTHROPIC_API_KEY` from the environment, so `/login` auth is properly respected
5. But the UX is still rough — subscription users must open a thread, run `/login`, authenticate via browser, then use Claude. Not welcoming.

**Lesson for our project:** When we implement ACP as our transport layer, we must be aware that:
- SDK-based adapters (Tier 2) may have different auth constraints than native agents (Tier 1)
- Our shell should surface auth configuration clearly per-adapter, not assume one auth model fits all
- The `AdapterManifest` should declare supported auth methods so the UI can guide users appropriately

#### ACP Slash Commands & Input Requirements

ACP's `AvailableCommand` type already addresses the "does this command need input?" question:

```typescript
// From @agentclientprotocol/sdk — the actual ACP schema types
type AvailableCommand = {
  name: string;                       // e.g. "create_plan", "compact"
  description: string;                // Human-readable description
  input?: AvailableCommandInput;      // OPTIONAL — if present, command needs input
};

type AvailableCommandInput = UnstructuredCommandInput;

type UnstructuredCommandInput = {
  hint: string;   // Placeholder text, e.g. "What should I plan?"
};

// Session update that advertises available commands
type AvailableCommandsUpdate = {
  availableCommands: Array<AvailableCommand>;
};
```

**Key design decision:** If `input` is present, the command requires user input before invocation. If `input` is absent, it's a one-off action (fire-and-forget). The `hint` field provides placeholder text for the input field (e.g. "What should I plan?" for `/plan`, "Search query" for `/search`).

**How our shell should handle this:**
- Commands without `input` → render as a single-click button/chip. One tap = execute.
- Commands with `input` → render as a chip that expands to show an input field with the `hint` as placeholder. User types, then submits.
- VS Code does something similar: some commands are immediate (Toggle Word Wrap), some open an input box (Go to Line).

### 10.3b — IBM ACP (Agent Communication Protocol) — IBM/BeeAI

**Note:** Different protocol, same acronym. IBM's ACP is for agent-to-agent messaging, not editor-to-agent communication.

REST-based messaging protocol for agent-to-agent communication. Created by IBM's BeeAI project, now under the Linux Foundation.

Key characteristics: pure REST (no SDK required), MIME-typed multipart messages, sync + async modes with task IDs, offline/dynamic discovery, OpenTelemetry observability, lifecycle management.

**Relevance level:** MEDIUM. Useful for building adapters to BeeAI ecosystem agents. The REST simplicity makes adapters trivial. But this is an agent-to-agent protocol — our shell-to-agent communication is better served by Zed's ACP.

### 10.4 — A2A (Agent-to-Agent Protocol) — Google

A2A enables peer-to-peer agent coordination using **Agent Cards** — JSON descriptors of an agent's capabilities, endpoints, and authentication requirements.

**Key concepts:**
- **Agent Cards** — JSON published at `/.well-known/agent.json` describing what the agent can do
- **Task lifecycle** — create, query, cancel tasks across agents
- **Streaming** — SSE-based real-time updates
- **Push notifications** — for async task completion
- Now under Linux Foundation governance (donated by Google, June 2025)

**How A2A relates to our architecture:**

Agent Cards are conceptually identical to our `AdapterManifest`. An A2A Agent Card describes:
- `name`, `description`, `url`
- `capabilities` (streaming, pushNotifications, stateTransitionHistory)
- `skills` — what the agent can do
- `authentication` — how to connect

**Impact on our shell:**

1. **Manifest compatibility.** Our `AdapterManifest` should be mappable to/from A2A Agent Cards. This means an adapter registered in our shell could also be discoverable via A2A, and vice versa.

2. **Cross-shell agent discovery.** If our shell supports A2A, it can discover agents running in other systems — not just locally registered adapters.

3. **Task delegation.** A2A's task model maps to our artifact handoff (§9). An agent in our shell could delegate a task to an A2A-compliant agent elsewhere, without needing a custom adapter.

**Relevance level:** MEDIUM. A2A matters for enterprise multi-agent scenarios. Not critical for v1, but we should keep our manifest format compatible.

### 10.5 — AG-UI (Agent-User Interaction Protocol)

Already covered in §8.5. CopilotKit's open standard for agent-to-frontend event streaming. ~16 event types in 5 categories. Supports SSE and WebSocket. Integrations with LangGraph, CrewAI, Mastra, PydanticAI.

**Updated assessment:** AG-UI is the closest existing standard to our event bus architecture. Our `AgentEvent` types should be mappable to AG-UI events. This is the protocol third-party adapters would most likely speak.

### 10.6 — A2UI (Agent-to-User Interface) — Google

Declarative UI protocol where agents send JSON describing UI components, and the client renders them natively. Preview (v0.8).

**Key design choices:**
- No executable code — agents cannot send JavaScript
- Trusted component catalog — client only renders known components
- Framework-agnostic — works with any frontend stack
- Security-first by construction

**Impact on our shell:** A2UI's component catalog model maps to our UI component library. An adapter could translate A2UI component specs into our React components. This is complementary to MCP Apps — MCP Apps use iframes (sandboxed but opaque), A2UI uses declarative specs (transparent but limited).

**Relevance level:** LOW-MEDIUM for now. V0.8 preview, still evolving. Worth staying compatible but not building on yet.

### 10.7 — ANP (Agent Network Protocol)

Internet-scale agent communication protocol using W3C Decentralized Identifiers (DIDs). Three-layer architecture:
1. Identity & encrypted communication (W3C DID)
2. Meta-protocol (protocol negotiation between agents)
3. Application protocol (semantic web, JSON-LD capability descriptions)

Agent discovery uses RFC 8615 (`.well-known`), with Agent Description Protocol (ADP) documents in JSON-LD.

**Relevance level:** LOW. Ambitious vision (the "HTTP of the Agentic Web"), but very early stage. W3C Community Group only. Relevant for future internet-scale agent discovery, not for our current shell architecture.

### 10.8 — AGENTS.md

OpenAI-originated, now under AAIF. A Markdown file placed at the root of a repository providing agent-specific instructions — setup commands, testing workflows, coding style, PR guidelines. Adopted by 60,000+ projects.

**Key features:**
- Just Markdown — no schema, no validation
- Nested support — monorepos can have per-package AGENTS.md files
- Closest file wins — directory-tree precedence
- Cross-tool — supported by Codex, Jules, Cursor, Copilot, Gemini CLI, and more

**Relationship to CLAUDE.md:** Same concept, different filename. Claude Code uses CLAUDE.md. Codex/Jules use AGENTS.md. Both are now under AAIF. Likely to converge or coexist with reader support for both.

**Impact on our shell:** When initializing a session in a repository context, the shell should:
1. Look for AGENTS.md and/or CLAUDE.md (and any adapter-specific variants)
2. Pass the content to the adapter as part of session config
3. Let the adapter decide how to inject it (system prompt, file context, etc.)

This is trivial to implement and high-value — ensures agents in our shell respect the repo's conventions.

### 10.9 — Agentic AI Foundation (AAIF)

The governance umbrella that matters most. Under Linux Foundation. Co-founded by Anthropic, Block, OpenAI.

**Projects under AAIF:**
- MCP (Model Context Protocol) — from Anthropic
- goose (agent framework) — from Block
- AGENTS.md — from OpenAI

**Members:** AWS, Bloomberg, Cloudflare, Google, Microsoft (platinum). Docker, IBM, JetBrains, Oracle, Salesforce, SAP, Shopify, Snowflake, Temporal (gold).

**Also under Linux Foundation (separate from AAIF):**
- A2A (Agent-to-Agent) — from Google
- IBM ACP (Agent Communication Protocol) — from IBM/BeeAI

**Also notable (not yet under a foundation):**
- ACP (Agent Client Protocol) — from Zed, co-developed with Google, adopted by JetBrains

**What this means:** The major protocols (MCP, A2A, Zed ACP) are either under Linux Foundation governance or have multi-company backing. They will converge rather than fragment. Building on these is a safe long-term bet.

### 10.10 — The E2B Agent Protocol (Historical)

E2B/AI Engineer Foundation's early attempt (2023) at a standard REST API for agents. Simple OpenAPI spec: create tasks, execute steps, manage artifacts. ~834 GitHub stars.

**Status:** Largely stale since mid-2024. Superseded by MCP + A2A + ACP. E2B pivoted to sandbox infrastructure.

**Relevance level:** NONE. Historical interest only. The ecosystem moved to richer protocols.

---

### 10.11 — Impact on Our Architecture: What to Build On

#### Must Build On (foundational):

| Standard | Why | How |
|----------|-----|-----|
| **ACP** (Zed) | Our adapter layer ≈ ACP. Battle-tested. 20+ agents, 5+ editors. | **Our shell is an ACP client.** Every ACP agent works automatically. Extend with our own capabilities (artifacts, execution models). |
| **MCP** | De facto standard for tools, universal adoption | Our shell is an MCP client. MCP servers passed to agents on session init (per ACP convention). |
| **MCP Apps** | Interactive UI from tools, joint Anthropic+OpenAI spec | Shell must be an MCP Apps host (iframe rendering, JSON-RPC bridge) |
| **AGENTS.md / CLAUDE.md** | 60K+ repos, trivial to support | Read on session init, pass to adapter |

#### Should Stay Compatible With (interop):

| Standard | Why | How |
|----------|-----|-----|
| **AG-UI** | Closest match to our event bus, framework interop | Our AgentEvent types should map to/from AG-UI events |
| **A2A Agent Cards** | Our manifest ≈ Agent Cards | Ensure AdapterManifest can round-trip to Agent Card JSON |
| **MCP Elicitation** | User input mid-execution, draft spec | Build form renderer for elicitation requests |
| **IBM ACP** | REST adapter for BeeAI ecosystem | Build a bridge adapter if needed |

#### Watch But Don't Build On Yet:

| Standard | Why | When to Revisit |
|----------|-----|-----------------|
| **A2UI** | Google preview v0.8, still evolving | When it reaches v1 and has client implementations |
| **ANP** | Very early, W3C Community Group | When there's real adoption beyond the spec authors |

### 10.12 — MCP Apps vs. Our Adapter Override Renderers

This deserves special attention because MCP Apps directly overlaps with our §7.4 "adapter override renderer" design.

**Our original design (§7.4):** Each adapter can optionally provide custom React components that override the default event renderer. The shell renders these components directly.

**MCP Apps approach:** Tools return interactive UI as sandboxed HTML/JS in iframes. Cross-platform (works in Claude, ChatGPT, VS Code, etc.). Communication via JSON-RPC postMessage.

**Resolution — both are needed, at different layers:**

```
┌────────────────────────────────────────────────────────────┐
│  Adapter Override Renderers (React components)             │
│  For: adapter-specific visualization of events             │
│  e.g., custom diff viewer, agent topology diagram,         │
│       plan approval flow, checkpoint timeline              │
│  Runs in our process — full access to shell state          │
├────────────────────────────────────────────────────────────┤
│  MCP Apps (sandboxed iframes)                              │
│  For: tool-provided interactive UIs                        │
│  e.g., Figma preview, Jira board, Amplitude dashboard,     │
│       database explorer, API tester                        │
│  Runs in iframe — isolated, cross-platform                 │
└────────────────────────────────────────────────────────────┘
```

Adapter override renderers handle shell-level concerns (event visualization, workflow UI). MCP Apps handle tool-level concerns (external service UIs). Our shell renders both.

### 10.13 — Key Findings Summary

1. **Zed's ACP (Agent Client Protocol) is the most directly relevant standard.** It's literally "LSP for AI coding agents" — the exact problem our adapter layer solves. 20+ agents already speak it. Zed, JetBrains, Neovim, Emacs support it. **Our shell should be an ACP client**, extended with our own capabilities (artifact bus, execution models, multi-adapter orchestration).

2. **Our adapter interface maps cleanly to ACP.** `AdapterManifest` ≈ ACP capabilities. `startSession()` ≈ ACP session creation. `onEvent` ≈ ACP streaming notifications. `checkAvailability()` ≈ ACP initialization. We add: artifact types, execution model metadata, extension interfaces (sandbox, async, planning).

3. **MCP is the tool-layer foundation.** Under AAIF/Linux Foundation governance with every major AI company as a member. Build on it with confidence.

4. **MCP Apps is the biggest UI implication.** Tools can now return interactive UIs in sandboxed iframes. Our shell must host these. This partially solves the "adapter override renderer" problem via a cross-platform standard.

5. **MCP Elicitation is a new UI surface.** Mid-execution user input requests need form rendering. Plan for this in the event stream renderer.

6. **ACP + MCP are complementary.** ACP handles editor↔agent communication. MCP handles agent↔tool connections. ACP sessions pass MCP server endpoints to agents on init. Our shell implements both.

7. **AG-UI ≈ our event bus.** Keep our event types mappable. This gives us free interop with CopilotKit and the LangGraph/CrewAI frontend ecosystem.

8. **AGENTS.md is table stakes.** Trivial to read, high value. Support it alongside CLAUDE.md on session init.

9. **The ACP Registry is agent discovery solved.** Instead of building our own adapter discovery, we can leverage the ACP Registry (already live in Zed + JetBrains). Users install agents once, they work everywhere.

10. **"ACP" is a confusingly overloaded acronym.** Zed's Agent Client Protocol (editor↔agent) ≠ IBM's Agent Communication Protocol (agent↔agent). Both are legitimate. Context matters.

11. **The E2B Agent Protocol is dead.** Don't build on it.

12. **ANP and A2UI are worth watching, not building on.** Too early.

---

## Next Steps (Immediate)

1. **Week 1:** Run Experiments A and B in parallel. Validate the two hardest unknowns: FS→UI pipeline and SDK→Event pipeline.
2. **Week 2:** Run Experiment C. Validate bidirectional file sync.
3. **Week 3:** Attempt Milestone M1 (integrate A + B into one app). First "it moves" demo.
4. **Week 4:** Run Experiments D and E. Address generative UI and multi-agent isolation.
5. **Ongoing:** Maintain this document as a living research log. Update with findings from each experiment.
