# Autonomous Remote Orchestration (ARO) — Architecture Design

> Intent-driven, multi-agent remote machine management built on Agent Manager's
> adapter/event-bus/contract infrastructure.

---

## 1. Design Principles

| # | Principle | Rationale |
|---|-----------|-----------|
| 1 | **Semantic over pixel** | Stream Regions of Interest (ROI), not full desktops. |
| 2 | **Security-by-default** | Every execution plan passes through a dedicated Security Auditor agent before it reaches a shell. |
| 3 | **Adapter-native** | ARO agents are regular `Adapter` implementations — they plug into `SessionManager`, emit `AgentEvent`, and reuse the existing event bus + WebSocket layer. |
| 4 | **Human-in-the-loop** | High-risk operations require explicit mobile approval; low-risk ops auto-execute within a configurable policy. |
| 5 | **Transport-agnostic** | The host daemon speaks a local WebSocket protocol; the tunnel layer (Tailscale/WireGuard) is pluggable. |

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Mobile App (React Native / Expo)          │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────┐     │
│  │ Chat UI  │  │ ROI Viewer   │  │ Approval Drawer    │     │
│  └────┬─────┘  └──────┬───────┘  └────────┬───────────┘     │
│       │               │                    │                 │
│       └───────────────┴────────────────────┘                 │
│                        │ HTTPS / WSS                         │
└────────────────────────┼─────────────────────────────────────┘
                         │
              ┌──────────▼──────────┐
              │   Agent Manager     │  (existing Hono server)
              │   Server            │
              │  ┌───────────────┐  │
              │  │ SessionManager│  │  ← manages ARO sessions like any other
              │  │ EventBus      │  │
              │  │ WsHandler     │  │
              │  └───────┬───────┘  │
              │          │          │
              │  ┌───────▼───────┐  │
              │  │ ARO Adapter   │  │  ← new adapter: orchestrates the 4-agent DAG
              │  └───────┬───────┘  │
              └──────────┼──────────┘
                         │ Tailscale / WireGuard mesh
              ┌──────────▼──────────┐
              │   ARO Host Daemon   │  (runs on each target machine)
              │  ┌────────────────┐ │
              │  │ Task Executor  │ │  ← shell / file / process ops
              │  │ Visual Observer│ │  ← screenshot + ROI extraction
              │  │ Monitor Loops  │ │  ← background watchers
              │  └────────────────┘ │
              └─────────────────────┘
```

---

## 3. Multi-Agent DAG

ARO uses four cooperating agents arranged in a Directed Acyclic Graph. Each
agent is modeled as a session within the existing `SessionManager` using the
`subagent_start` / `subagent_end` event types already defined in `events.ts`.

```
          User NL Request
                │
        ┌───────▼────────┐
        │  Orchestrator   │  Decomposes intent → execution plan
        └───────┬────────┘
                │ plan
        ┌───────▼────────┐
        │ Security        │  Validates plan against policy
        │ Auditor         │  (blocks / modifies / approves)
        └───────┬────────┘
                │ approved plan
        ┌───────▼────────┐         ┌───────────────────┐
        │ Task Executor   │────────►│ Visual Observer    │
        │ (on host)       │  ROI    │ (on host)          │
        └───────┬────────┘  req    └────────┬──────────┘
                │                            │
                │ results + ROI images       │
                └────────────┬───────────────┘
                             │
                     ┌───────▼────────┐
                     │  Orchestrator   │  Summarizes → user
                     └────────────────┘
```

### 3.1 Agent Responsibilities

| Agent | Runs on | Purpose |
|-------|---------|---------|
| **Orchestrator** | Server | Parses NL intent, builds execution plan (DAG of steps), delegates to sub-agents, aggregates results, generates user-facing summary. |
| **Security Auditor** | Server | Receives the execution plan, evaluates each step against `SecurityPolicy`, emits `security_verdict` event. Blocks dangerous ops, flags medium-risk for human approval. |
| **Task Executor** | Host daemon | Runs approved shell commands, file operations, process signals. Streams stdout/stderr as `text_delta` events. |
| **Visual Observer** | Host daemon | Captures screenshots, extracts ROI bounding boxes, compresses to JPEG/WebP, streams as `roi_frame` events. |

---

## 4. Integration with Existing Codebase

ARO is designed to slot into the existing agent-manager monorepo without
disrupting current adapters (Claude CLI, etc.).

### 4.1 New Adapter: `AroAdapter`

Lives at `apps/server/src/adapters/aro.ts`. Implements the existing `Adapter`
interface from `adapters/adapter.ts`:

```typescript
// Pseudocode — full implementation in Phase 2
import type { Adapter, SessionHandle } from './adapter.js';

export class AroAdapter implements Adapter {
  readonly manifest = {
    id: 'aro',
    name: 'Autonomous Remote Orchestration',
    version: '0.1.0',
    runtime: 'aro-daemon',
  };

  async startSession(config, onEvent): Promise<SessionHandle> {
    // 1. Connect to host daemon via tunnel
    // 2. Spawn Orchestrator sub-session
    // 3. Orchestrator emits plan → Security Auditor sub-session
    // 4. Approved steps → Task Executor on host
    // 5. Visual Observer streams ROI on demand
    // 6. All events normalized to AgentEvent and forwarded via onEvent()
  }

  async checkAvailability(): Promise<string | null> {
    // Verify at least one host daemon is reachable
  }
}
```

### 4.2 New Event Types

Extend the existing `agentEventSchema` discriminated union in
`packages/shared/src/schemas/events.ts` with ARO-specific events:

| Event type | Payload | Purpose |
|---|---|---|
| `execution_plan` | `{ steps: PlanStep[], hostId: string }` | Orchestrator publishes its plan for UI display & audit. |
| `security_verdict` | `{ stepId: string, verdict: 'approved' \| 'blocked' \| 'needs_approval', reason: string }` | Auditor result per plan step. |
| `human_approval_request` | `{ stepId: string, command: string, riskLevel: string, expiresAt: string }` | Pushed to mobile for user decision. |
| `human_approval_response` | `{ stepId: string, approved: boolean }` | User response from mobile. |
| `roi_frame` | `{ hostId: string, region: BoundingBox, imageBase64: string, format: string, capturedAt: string }` | Visual Observer sends cropped region. |
| `host_alert` | `{ hostId: string, alertType: string, message: string, severity: string }` | Background monitor push notification. |

### 4.3 New Contracts

Extend the contract system in `packages/shared/src/contracts/`:

- **`host.ts`** — Host machine registration, connection status, capabilities.
- **`security-policy.ts`** — Allowlists, blocklists, risk classification rules.

### 4.4 New WebSocket Commands

Extend `packages/shared/src/schemas/ws.ts`:

| Command | Direction | Purpose |
|---|---|---|
| `subscribe_host` | client → server | Subscribe to events from a specific host. |
| `approve_step` | client → server | User approves/rejects a `human_approval_request`. |
| `request_roi` | client → server | Request an on-demand screenshot ROI from a host. |

### 4.5 Session Config Extension

The existing `SessionConfig.extra` field (already `z.record(z.unknown())`)
carries ARO-specific parameters without schema changes:

```typescript
extra: {
  aro: {
    hostId: string;
    securityPolicyId: string;
    roiEnabled: boolean;
    monitorLoops: string[];   // e.g. ['cpu_spike', 'process_crash']
  }
}
```

---

## 5. Security Architecture

### 5.1 Defense in Depth

```
Layer 1: Transport     │ Tailscale/WireGuard — zero-trust encrypted mesh
Layer 2: Auth          │ Mutual TLS between server ↔ host daemon
Layer 3: Policy Engine │ Security Auditor agent evaluates every plan step
Layer 4: Human Gate    │ High-risk ops require mobile approval
Layer 5: Sandboxing    │ Host daemon runs commands in namespaced/cgroup sandbox
```

### 5.2 Security Policy Schema

```typescript
// packages/shared/src/schemas/aro.ts
const riskLevelSchema = z.enum(['low', 'medium', 'high', 'critical']);

const securityRuleSchema = z.object({
  id: z.string(),
  pattern: z.string(),           // regex matching command text
  riskLevel: riskLevelSchema,
  action: z.enum(['allow', 'block', 'require_approval']),
  reason: z.string(),
});

const securityPolicySchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  rules: z.array(securityRuleSchema),
  defaultRiskLevel: riskLevelSchema,
  defaultAction: z.enum(['allow', 'block', 'require_approval']),
  allowedPaths: z.array(z.string()),    // glob patterns
  blockedCommands: z.array(z.string()), // exact matches
  maxConcurrentCommands: z.number(),
  sessionTimeoutMs: z.number(),
});
```

### 5.3 Approval Flow

```
Orchestrator builds plan
        │
Security Auditor classifies each step:
        │
        ├── low risk    → auto-approve
        ├── medium risk → require_approval → push to mobile
        ├── high risk   → block (can be overridden with 2FA)
        └── critical    → block (no override)
        │
User taps Approve/Reject in mobile drawer
        │
        ▼
Task Executor proceeds or aborts
```

---

## 6. Host Daemon Architecture

The ARO Host Daemon is a lightweight process running on each managed machine.
It exposes a local WebSocket server (bound to `127.0.0.1`) that the Agent
Manager server reaches through the encrypted tunnel.

### 6.1 Daemon Components

```
┌─────────────────────────────────────────────┐
│              ARO Host Daemon                 │
│                                              │
│  ┌──────────────┐   ┌───────────────────┐   │
│  │ Command       │   │ Visual Capture    │   │
│  │ Executor      │   │ Engine            │   │
│  │               │   │                   │   │
│  │ • spawn shell │   │ • screenshot      │   │
│  │ • stream I/O  │   │ • ROI extraction  │   │
│  │ • timeout     │   │ • JPEG/WebP enc   │   │
│  │ • sandbox     │   │ • delta diffing   │   │
│  └──────┬───────┘   └────────┬──────────┘   │
│         │                    │               │
│  ┌──────▼────────────────────▼──────────┐   │
│  │         Local WebSocket Server        │   │
│  │         (127.0.0.1:9741)              │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │         Monitor Loop Engine           │   │
│  │  • CPU/mem/disk watchers              │   │
│  │  • Process crash detection            │   │
│  │  • Log tail pattern matching          │   │
│  │  • Custom user-defined monitors       │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

### 6.2 Daemon Protocol

The daemon accepts JSON-RPC 2.0 messages over its local WebSocket:

| Method | Params | Description |
|--------|--------|-------------|
| `exec` | `{ command, cwd, env, timeout, sandbox }` | Execute a shell command |
| `exec.stream` | `{ commandId }` | Stream stdout/stderr for running command |
| `exec.kill` | `{ commandId, signal }` | Send signal to running command |
| `capture.screenshot` | `{ display, region? }` | Full or partial screenshot |
| `capture.roi` | `{ selector }` | Smart ROI (find terminal, error dialog, etc.) |
| `monitor.start` | `{ type, config }` | Start a background monitor loop |
| `monitor.stop` | `{ monitorId }` | Stop a running monitor |
| `monitor.list` | `{}` | List active monitors |
| `host.info` | `{}` | OS, arch, hostname, uptime, resource usage |

### 6.3 ROI (Region of Interest) Streaming

Instead of full-screen video, the Visual Observer returns targeted crops:

1. **On-demand** — Orchestrator requests ROI after a command completes
2. **Selector-based** — `capture.roi({ selector: 'active_terminal' })` finds
   the terminal window, crops it, and returns JPEG at ~50KB
3. **Delta encoding** — Subsequent frames only transmit changed regions
4. **Bandwidth target** — <10% of equivalent 1080p RDP stream

```typescript
const roiFrameSchema = z.object({
  hostId: z.string(),
  region: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  }),
  imageBase64: z.string(),
  format: z.enum(['jpeg', 'webp', 'png']),
  sizeBytes: z.number(),
  capturedAt: z.string(),
  isDelta: z.boolean(),
});
```

---

## 7. Network & Transport Layer

### 7.1 Recommended Stack

```
┌────────────────────────────────────────┐
│  Layer 4: Application Protocol         │
│  JSON-RPC 2.0 over WebSocket           │
├────────────────────────────────────────┤
│  Layer 3: Local Transport              │
│  WebSocket (127.0.0.1:9741)            │
├────────────────────────────────────────┤
│  Layer 2: Encrypted Tunnel             │
│  Tailscale (WireGuard) mesh network    │
├────────────────────────────────────────┤
│  Layer 1: Internet                     │
│  Any connectivity (LTE, WiFi, etc.)    │
└────────────────────────────────────────┘
```

### 7.2 Connection Lifecycle

```
1. Host daemon starts → registers with Tailscale → gets stable IP (100.x.y.z)
2. Agent Manager server discovers host via Tailscale API or manual config
3. Server connects to host's local WS via Tailscale tunnel
4. mTLS handshake validates both sides
5. Persistent WebSocket maintained with heartbeat (30s interval)
6. On disconnect → exponential backoff reconnect (2s, 4s, 8s, 16s, max 60s)
```

### 7.3 Host Registration Schema

```typescript
const hostConnectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  hostname: z.string(),
  os: z.enum(['linux', 'darwin', 'windows']),
  arch: z.string(),
  tailscaleIp: z.string().optional(),
  directAddress: z.string().optional(),
  daemonPort: z.number().default(9741),
  status: z.enum(['online', 'offline', 'connecting', 'error']),
  lastSeenAt: z.string(),
  version: z.string(),            // daemon version
  capabilities: z.array(z.string()), // ['shell', 'screenshot', 'monitor']
});
```

---

## 8. Mobile App Architecture

### 8.1 Tech Choice: React Native (Expo)

Aligns with the existing React 19 web frontend — shared TypeScript types from
`@agent-manager/shared`, same Zod schemas for validation, reusable UI patterns.

### 8.2 Key Screens

| Screen | Purpose |
|--------|---------|
| **Host Dashboard** | List connected hosts with status badges, resource sparklines. |
| **Agent Chat** | Conversational interface for NL commands. Shows streaming `text_delta` events. |
| **Execution Plan** | Visual DAG of plan steps with security verdicts. Tap to approve/reject. |
| **ROI Viewer** | Pinch-to-zoom image viewer for ROI frames. Auto-refreshes on new frames. |
| **Alert Feed** | Chronological feed of `host_alert` events with severity coloring. |
| **Settings** | Host management, security policy editor, notification preferences. |

### 8.3 Push Notifications

```
Monitor Loop (host daemon)
    │ detects condition (e.g., process crash)
    ▼
host_alert event → Agent Manager server
    │
    ▼
FCM / APNs push → mobile app
    │
    ▼
User taps notification → opens Alert Feed or Agent Chat
```

---

## 9. Data Flow — Complete Request Lifecycle

```
1. USER types "Check why the Node server is spiking CPU" in mobile chat

2. MOBILE APP sends POST /api/sessions
   {
     adapterId: "aro",
     prompt: "Check why the Node server is spiking CPU",
     cwd: "/",
     extra: { aro: { hostId: "prod-web-01", securityPolicyId: "default" } }
   }

3. SESSION MANAGER creates session, passes to AroAdapter

4. ORCHESTRATOR agent decomposes intent:
   Step 1: exec("top -bn1 -o %CPU | head -20")
   Step 2: exec("ps aux | grep node")
   Step 3: capture.roi({ selector: "active_terminal" })
   Step 4: Analyze results, summarize

5. SECURITY AUDITOR evaluates plan:
   Step 1: low risk → approved (read-only system command)
   Step 2: low risk → approved (read-only)
   Step 3: low risk → approved (screenshot, no side effects)
   Step 4: N/A (analysis, no host interaction)

   Emits: security_verdict events per step

6. TASK EXECUTOR on host runs Step 1:
   Emits: text_delta events with top output
   Runs Step 2:
   Emits: text_delta events with ps output

7. VISUAL OBSERVER captures ROI:
   Emits: roi_frame event with cropped terminal JPEG

8. ORCHESTRATOR aggregates:
   "Your Node process (PID 4821) is consuming 94% CPU.
    The event loop appears blocked by a synchronous file read
    in /app/src/sync-loader.js. Top 3 processes shown in the
    attached screenshot."

9. USER sees summary + ROI image in mobile chat (< 3 second target)
```

---

## 10. File Structure — New & Modified Files

### New files

```
packages/shared/src/schemas/aro.ts          ← Security policy, ROI, host schemas
packages/shared/src/contracts/host.ts       ← Host machine contract
packages/shared/src/contracts/security-policy.ts  ← Security policy contract
apps/server/src/adapters/aro.ts             ← AroAdapter implementation
apps/server/src/aro/                        ← ARO-specific server logic
  ├── orchestrator.ts                       ← Orchestrator agent logic
  ├── security-auditor.ts                   ← Security Auditor agent logic
  ├── host-connector.ts                     ← Manages connections to host daemons
  └── plan-builder.ts                       ← Execution plan construction
apps/server/src/routes/hosts.ts             ← Host CRUD REST endpoints
apps/server/src/routes/approvals.ts         ← Approval flow endpoints
apps/aro-daemon/                            ← Host daemon (separate deployable)
  ├── src/
  │   ├── main.ts                           ← Daemon entry point
  │   ├── executor.ts                       ← Command sandbox + execution
  │   ├── visual.ts                         ← Screenshot + ROI engine
  │   ├── monitor.ts                        ← Background monitor loops
  │   └── protocol.ts                       ← JSON-RPC handler
  ├── package.json
  └── tsconfig.json
```

### Modified files

```
packages/shared/src/schemas/events.ts       ← Add ARO event types to union
packages/shared/src/schemas/ws.ts           ← Add ARO WebSocket commands
packages/shared/src/contracts/index.ts      ← Export new contracts
packages/shared/src/schemas/index.ts        ← Export new schemas
apps/server/src/main.ts                     ← Register AroAdapter
apps/server/src/routes/ws.ts                ← Handle new WS command types
package.json                                ← Add apps/aro-daemon workspace
```

---

## 11. Technology Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Execution harness | Custom harness (tight scope) | Maximum security control; fits the existing adapter pattern. OpenClaw's security layer is insufficient. Scale to Claude Computer Use for GUI-heavy tasks in v2. |
| Transport | Tailscale + local WebSocket | Zero-trust mesh eliminates port forwarding; local WS gives fast bidirectional comms. |
| Mobile framework | React Native (Expo) | Shared TS/Zod types with existing web frontend; fast iteration for chat + image UIs. |
| Daemon language | TypeScript (Bun) | Consistent with monorepo; Bun's native `child_process` and `sharp` bindings handle exec + image processing. |
| ROI capture | OS-native screenshot + server-side crop | `screencapture` (macOS), `scrot`/`gnome-screenshot` (Linux), `nircmd` (Windows). |
| Push notifications | Firebase Cloud Messaging (FCM) | Cross-platform, well-supported in Expo, free tier sufficient for alerts. |
| Agent LLM | Claude via existing Claude CLI adapter | Orchestrator and Security Auditor use Claude sessions through the adapter system already in place. |

---

## 12. Success Metrics Alignment

| PRD Metric | Architecture Support |
|---|---|
| **Latency < 3s** (request → plan) | Orchestrator runs locally on server, no round-trip to host for planning. Security Auditor is rule-based (sub-ms). Only execution hits the network. |
| **0% blocked command execution** | Security Auditor is a mandatory pipeline stage; `execution_plan` event must have all steps at `approved` verdict before Task Executor starts. The DAG enforces ordering. |
| **ROI < 10% RDP bandwidth** | ROI crops average ~50KB JPEG vs ~500KB/frame for 1080p. Delta encoding further reduces to ~5KB for static terminals. Background monitors send text-only alerts (< 1KB). |

---

## 13. Phased Implementation Roadmap

### Phase 1 — Foundation (Weeks 1-3)
- [ ] `aro.ts` schemas (security policy, host connection, ROI frame)
- [ ] Host and security-policy contracts
- [ ] `AroAdapter` skeleton with `startSession` / `checkAvailability`
- [ ] Host connection manager (WebSocket client to daemon)
- [ ] Extend `agentEventSchema` with ARO events

### Phase 2 — Host Daemon (Weeks 4-6)
- [ ] `apps/aro-daemon` workspace scaffolding
- [ ] JSON-RPC protocol handler
- [ ] Command executor with namespace/cgroup sandboxing
- [ ] Screenshot capture + ROI extraction engine
- [ ] Basic monitor loops (CPU, process crash)

### Phase 3 — Agent Pipeline (Weeks 7-9)
- [ ] Orchestrator agent (NL → execution plan)
- [ ] Security Auditor (policy evaluation engine)
- [ ] Human approval flow (WS commands + REST endpoints)
- [ ] Task Executor ↔ Host Daemon integration
- [ ] Visual Observer ↔ ROI capture integration

### Phase 4 — Mobile App (Weeks 10-13)
- [ ] Expo project setup with shared `@agent-manager/shared` types
- [ ] Host dashboard screen
- [ ] Agent chat screen with streaming
- [ ] Execution plan viewer with approval drawer
- [ ] ROI image viewer
- [ ] FCM push notification integration

### Phase 5 — Hardening (Weeks 14-16)
- [ ] End-to-end encryption audit
- [ ] Penetration testing of daemon protocol
- [ ] Performance profiling (latency, bandwidth)
- [ ] Monitor loop reliability testing
- [ ] Documentation and deployment guides
