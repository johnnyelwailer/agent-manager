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
| **Primitive** | One of 4 abstract data types: Context, Strategy, Execution, Verification. |
| **Cartridge** | Informal name for an external agent tool (Claude Code, SpecKit, MetaMorph, etc.). |
| **Sidecar** | A co-process (TypeScript) that runs alongside the Tauri Rust backend to handle SDK interaction. |
| **BYOK** | Bring Your Own Key — users provide their own API keys for Claude/OpenAI. |
| **Normalization Layer** | Thin shim that converts vendor-specific SDK events into the Host's unified `AgentEvent` schema. |
| **Advisory Lock** | A lockfile indicating an agent is working on a file. Not enforced by the OS — participants check voluntarily. |

---

## Next Steps (Immediate)

1. **Week 1:** Run Experiments A and B in parallel. Validate the two hardest unknowns: FS→UI pipeline and SDK→Event pipeline.
2. **Week 2:** Run Experiment C. Validate bidirectional file sync.
3. **Week 3:** Attempt Milestone M1 (integrate A + B into one app). First "it moves" demo.
4. **Week 4:** Run Experiments D and E. Address generative UI and multi-agent isolation.
5. **Ongoing:** Maintain this document as a living research log. Update with findings from each experiment.
