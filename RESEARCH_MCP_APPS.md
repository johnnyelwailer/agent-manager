# MCP Apps — Research Document

> **Last Updated:** 2026-02-11
> **Status:** Complete
> **Purpose:** Understand MCP Apps (the first official MCP extension) and assess its implications for agent-manager's architecture.

---

## Executive Summary

**MCP Apps** is the first official extension to the Model Context Protocol, launched January 26, 2026. It enables MCP servers to deliver **interactive UI components** (HTML/JS) that render inline within AI conversations — dashboards, forms, visualizations, multi-step workflows — instead of returning plain text.

This is directly relevant to agent-manager because:
1. We already have a `McpContract` schema and `McpBrowser` UI component
2. MCP Apps adds a **UI rendering dimension** to MCP tools that our shell should display
3. Our architecture is uniquely positioned to be an MCP Apps host — we're building exactly the kind of rich rendering surface that MCP Apps targets
4. The spec uses the same JSON-RPC + postMessage patterns we're already familiar with from MCP

---

## What Are MCP Apps?

MCP tools traditionally return text and structured data. MCP Apps extends this by letting tools declare **UI resources** — bundled HTML/JS that renders in a sandboxed iframe inline in the conversation.

**Key insight:** MCP Apps solve the "context gap" — where tools can provide data but users lack natural ways to explore it without additional prompts. Instead of getting a wall of JSON, users see an interactive chart, form, or dashboard.

### How It Works (4-Step Flow)

```
1. Tool Definition    — Tool declares `_meta.ui.resourceUri: "ui://charts/interactive"`
2. Tool Call          — LLM invokes the tool on the MCP server
3. Host Renders       — Host fetches the `ui://` resource and displays it in a sandboxed iframe
4. Bidirectional Comm — Host passes data via notifications; UI calls tools through the host
```

### Two Key Primitives

**1. Tools with UI Metadata**

Tools declare UI capabilities by including a `_meta.ui.resourceUri` field:

```json
{
  "name": "visualize_data",
  "description": "Visualize data as an interactive chart",
  "inputSchema": { "..." },
  "_meta": {
    "ui": {
      "resourceUri": "ui://charts/interactive"
    }
  }
}
```

**2. UI Resources**

Server-side resources served via the `ui://` scheme containing bundled HTML/JavaScript. The host fetches and renders these in sandboxed iframes.

### Data Flow: `content` vs `structuredContent`

MCP Apps tool responses have two return paths:
- **`content`** — sent back to the LLM (text, for reasoning)
- **`structuredContent`** — hidden from the LLM, passed to the UI (like a React prop)

This separation is elegant: the LLM gets what it needs for reasoning, the UI gets what it needs for rendering.

---

## Technical Architecture

### Communication Protocol

MCP Apps uses **JSON-RPC 2.0 over `postMessage`** for iframe↔host communication. This reuses MCP's existing protocol with the browser's `postMessage` API as the transport layer.

Key design decision: rather than inventing a new protocol, MCP Apps extends the existing MCP JSON-RPC dialect. MCP hosts can reuse the MCP TypeScript SDK for the communication layer.

#### Protocol Methods

| Method | Direction | Purpose |
|--------|-----------|---------|
| `tools/call` | App → Host | Request tool call execution (proxied to MCP server) |
| `ui/message` | App → Host | Send a message to the host model |
| `ui/open-link` | App → Host | Ask host to open an external link |
| `ui/initialize` | Host → App | Initialize the app with context |
| `ui/resource-teardown` | Host → App | Warn the app the iframe will be destroyed |

### Security Model

MCP Apps run in a **double iframe** architecture for security:

```
Host Application
  └── Outer Sandboxed Iframe (initialized by Host)
        └── Inner Iframe (contains MCP server UI resources)
```

#### Sandbox Restrictions

The sandbox prevents the app from:
- Accessing the parent window's DOM
- Reading the host's cookies or local storage
- Navigating the parent page
- Executing scripts in the parent context

#### Multi-Layer Security

| Layer | Mechanism |
|-------|-----------|
| **Iframe sandboxing** | Restricted permissions on the iframe element |
| **Pre-declared templates** | Hosts can review HTML content before rendering |
| **Auditable messages** | All UI↔host communication goes through loggable JSON-RPC |
| **User consent** | Hosts can require explicit approval for UI-initiated tool calls |
| **Content Security Policy** | Resource `_meta.ui` can include `csp` and `permissions` |

### Developer SDK

**Package:** `@modelcontextprotocol/ext-apps`

**For App Developers:**
- Core SDK: `@modelcontextprotocol/ext-apps`
- React hooks: `@modelcontextprotocol/ext-apps/react`

**For Host Developers:**
- Host SDK: `@modelcontextprotocol/ext-apps/app-bridge`
- Reference host implementation included in examples

**App class API:**

```typescript
import { App } from '@modelcontextprotocol/ext-apps';

const app = new App();

// Receive tool results from host
app.ontoolresult = (result) => {
  renderChart(result.data);
};

// Call server tools through the host
await app.callServerTool({
  name: "fetch_details",
  arguments: { id: "123" }
});

// Update the model's context
await app.updateModelContext({
  content: [...]
});
```

### Supported Frameworks

The SDK provides starter templates for:
- React
- Vue
- Svelte
- Preact
- Solid JS
- Vanilla JavaScript

### Content Type

The MVP supports only `text/html;profile=mcp-app` (raw HTML). Other content types (external URLs, remote DOM, native widgets) are explicitly deferred to future iterations.

---

## Ecosystem & Adoption

### Spec Versions

| Version | Status |
|---------|--------|
| `2026-01-26` | Stable (production-ready) |
| Draft | Development (emerging features) |

### Supported Clients

MCP Apps are currently supported by:
- **Claude** (web + desktop)
- **Claude Desktop**
- **Visual Studio Code** (Insiders)
- **Goose**
- **Postman**
- **MCPJam**
- **ChatGPT** (rolling out — supports the same JSON-RPC 2.0 over postMessage standard)

### Connectors Directory (Claude)

Anthropic hosts an MCP connectors directory at [claude.com/partners/mcp](https://www.claude.com/partners/mcp) where third-party developers publish MCP servers with interactive UI.

**Launch Partners:**
- Amplitude
- Asana
- Box
- Canva
- Clay
- Figma
- Hex
- monday.com
- Slack
- Salesforce (upcoming)

**Pricing:** MCP connectors require a paid Claude plan (Pro, Max, Team, or Enterprise) but have no additional charge.

### Repository Stats

- **GitHub:** [modelcontextprotocol/ext-apps](https://github.com/modelcontextprotocol/ext-apps)
- **Stars:** ~1.4k
- **Forks:** 168
- **Commits:** 495
- **Open Issues:** 50

### Example Apps in the Repo

| Category | Examples |
|----------|---------|
| **Visualization** | Map viewer, Three.js 3D renderer, ShaderToy GLSL shaders, sheet music notation, Wikipedia link graphs, cohort heatmaps |
| **Data/Business** | Budget allocator, customer segmentation, scenario modeler, system monitor |
| **Media** | PDF viewer, QR code generator, video player, live transcription |
| **Utility** | Text-to-speech, basic host reference implementation |

---

## MCP Apps vs. OpenAI Apps SDK

Both Anthropic and OpenAI are building app ecosystems for AI chat, but with different strategies:

| Dimension | MCP Apps (Anthropic) | OpenAI Apps SDK |
|-----------|---------------------|-----------------|
| **Philosophy** | Open standard, many hosts can implement | Centralized marketplace for ChatGPT |
| **Protocol** | Extension to existing MCP (JSON-RPC) | Custom SDK with MCP server support |
| **Distribution** | Any MCP-compatible client | ChatGPT app directory (review process) |
| **Rendering** | Sandboxed iframes with HTML resources | Similar iframe approach |
| **Cross-platform** | Yes — Claude, VS Code, Goose, ChatGPT, Postman | Primarily ChatGPT |
| **MCP Interop** | Native (IS MCP) | Supports MCP servers as a concept |

**Key takeaway:** MCP Apps is positioned as the open standard that multiple platforms adopt. OpenAI supports the spec but also has its own proprietary layer. For agent-manager, targeting MCP Apps means compatibility with the broadest set of tools.

---

## Implications for Agent-Manager

### Current State

Agent-manager already has:
- **`McpContract`** schema (`packages/shared/src/contracts/mcp.ts`) — tracks MCP servers, tools, resources, prompts, connection status
- **`McpBrowser`** UI component (`packages/ui/src/concepts/mcp-browser.tsx`) — displays connected servers and their tools
- **MCP referenced as first-class concept** in PLAN.md alongside AG-UI and A2A

### What MCP Apps Adds

MCP Apps introduces a **new dimension** to our MCP integration: tools can now return interactive UIs, not just text. This means:

1. **Our McpBrowser needs to evolve** — it currently shows tools as text (name, description, schema). With MCP Apps, tools can declare `_meta.ui.resourceUri`, indicating they have interactive UI. The browser should indicate which tools have UI capabilities.

2. **We need an MCP App renderer** — when an agent calls an MCP tool that returns a UI resource, our shell should render it inline (sandboxed iframe). This is exactly the kind of rich rendering that differentiates us from terminal-based tools.

3. **Bidirectional tool calling from UI** — MCP Apps can call back to the MCP server through the host. Our shell sits between the iframe and the server, proxying these calls.

4. **The `structuredContent` pattern aligns with our contracts** — MCP Apps separate LLM-facing content from UI-facing content. Our contract system already separates agent data from UI representation.

### Architecture Integration Plan

```
Agent Session (Claude/Goose/etc.)
  │
  ├── Calls MCP tool with `_meta.ui.resourceUri`
  │
  ▼
Agent Adapter (normalizes events)
  │
  ├── ToolCallEvent includes UI resource URI
  │
  ▼
Session Manager
  │
  ├── Detects UI resource in tool result
  ├── Fetches `ui://` resource from MCP server
  │
  ▼
WebSocket → Frontend
  │
  ▼
Chat Element: McpAppFrame
  ├── Renders sandboxed iframe with HTML resource
  ├── Proxies JSON-RPC postMessage to/from MCP server
  ├── Passes `structuredContent` as initial props
  └── Handles `tools/call`, `ui/message`, `ui/open-link`
```

### Specific Changes Needed

#### 1. McpContract Schema Extension

```typescript
// Add to McpContract tool definition
interface McpTool {
  name: string;
  description?: string;
  inputSchema?: object;
  // NEW: MCP Apps UI metadata
  ui?: {
    resourceUri: string;      // e.g., "ui://charts/interactive"
    permissions?: string[];   // requested capabilities (mic, camera, etc.)
    csp?: string;             // Content Security Policy directives
  };
}
```

#### 2. New ChatElement: McpAppFrame

Add a new `ChatElementContract` variant for rendering MCP App iframes inline:

```typescript
interface McpAppElement {
  type: 'mcp_app';
  resourceUri: string;
  htmlContent: string;          // fetched HTML from ui:// resource
  structuredContent?: unknown;  // data passed to the app (hidden from LLM)
  toolCallId: string;           // link back to the tool call
  serverId: string;             // which MCP server this app belongs to
  sandbox: {
    permissions: string[];
    csp: string;
  };
}
```

#### 3. App Bridge Integration

Use `@modelcontextprotocol/ext-apps/app-bridge` in our frontend to:
- Render MCP Apps in sandboxed iframes
- Handle JSON-RPC postMessage communication
- Proxy tool calls back to the MCP server via our backend
- Enforce security policies

#### 4. McpBrowser Enhancement

Update the MCP browser to:
- Show a visual indicator for tools that have UI capabilities (`_meta.ui`)
- Allow previewing/launching MCP Apps from the browser
- Show app connection status (loaded, communicating, error)

### Priority Assessment

| Change | Priority | Rationale |
|--------|----------|-----------|
| McpContract schema extension | **P1** | Foundation — all other changes depend on this |
| McpAppFrame ChatElement | **P1** | Core rendering capability |
| App Bridge integration | **P2** | Requires McpAppFrame first |
| McpBrowser enhancement | **P2** | UX improvement, not blocking |
| Bidirectional tool proxying | **P2** | Needed for interactive apps |
| Security policy enforcement | **P2** | Important for production, not for MVP |

### Strategic Positioning

MCP Apps strengthens agent-manager's value proposition significantly:

1. **Terminal tools can't render MCP Apps** — Agent Deck, Conduit, and other TUI tools have no way to display interactive iframes. This is a clear differentiator for our graphical shell.

2. **Conductor doesn't support MCP Apps (yet)** — Their MCP integration is tool-calling only, not UI rendering. Being an early MCP Apps host gives us a feature advantage.

3. **We become a universal MCP Apps host** — Not just for Claude's tools, but for any agent that connects to MCP servers with UI capabilities. Goose, OpenHands, Codex — any agent's MCP tools get rich rendering in our shell.

4. **Aligns with our "operating environment" metaphor** — MCP Apps are like windowed applications in a desktop OS. Our shell is the window manager that renders them.

---

## Relationship to Other Protocols

### MCP Apps + AG-UI

MCP Apps handles **tool → UI rendering**. AG-UI handles **agent → frontend streaming**. They're complementary:

```
AG-UI:     Agent output streaming → text deltas, tool calls, state, run lifecycle
MCP Apps:  Tool output rendering  → interactive UI iframes, bidirectional data
```

In our architecture: AG-UI carries the ToolCallEvent that triggers MCP App rendering. The agent streams via AG-UI; the tool result renders via MCP Apps.

### MCP Apps + A2A

A2A handles agent-to-agent discovery. MCP Apps handles tool-to-UI rendering. Less direct overlap, but:
- An agent discovered via A2A might expose MCP tools with UI resources
- Our shell would render those UIs regardless of which agent called the tool

### MCP Apps + CopilotKit

CopilotKit has announced native MCP Apps support, using AG-UI as the synchronization layer. Their approach: CopilotKit renders the MCP App iframe, AG-UI keeps agent state and UI events synchronized.

This validates our architecture choice: AG-UI for streaming + MCP Apps for tool UI is the emerging standard pattern.

---

## Key Technical Decisions for Implementation

### 1. Where to render MCP App iframes

**Option A: Inline in chat stream** — render as a ChatElement alongside text and tool calls.
**Option B: Dedicated panel** — render in a side panel when a tool returns UI.
**Option C: Both** — small apps inline, large apps in a panel (user configurable).

**Recommendation:** Option C. Small visualizations (charts, QR codes) inline. Complex apps (dashboards, forms) in a dedicated panel. This matches our responsive design strategy — inline on desktop, panel on mobile.

### 2. How to proxy tool calls from MCP App back to server

The MCP App iframe sends `tools/call` via postMessage. Our host must proxy this to the MCP server. Two paths:

**Option A: Frontend proxies directly** — our web app's App Bridge sends the tool call to the MCP server.
**Option B: Backend proxies** — frontend sends to our backend via WebSocket, backend routes to MCP server.

**Recommendation:** Option B. Keeps the MCP server connection on the backend (where it already lives for the agent adapter). Frontend is a pure rendering layer.

### 3. Security policy for third-party MCP Apps

MCP Apps run arbitrary HTML/JS in iframes. We need:
- Strict sandbox attributes on the iframe
- CSP enforcement based on the resource's declared `_meta.ui.csp`
- User consent dialog before rendering apps from untrusted servers
- Logging of all JSON-RPC messages for auditability

---

## References

### Official Sources
- [MCP Apps Blog Post (2026-01-26)](http://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/)
- [MCP Apps Official Docs](https://modelcontextprotocol.io/docs/extensions/apps)
- [ext-apps GitHub Repository](https://github.com/modelcontextprotocol/ext-apps)
- [ext-apps API Quickstart](https://modelcontextprotocol.github.io/ext-apps/api/documents/Quickstart.html)

### Coverage & Analysis
- [Anthropic extends MCP with a UI framework — The New Stack](https://thenewstack.io/anthropic-extends-mcp-with-an-app-framework/)
- [Anthropic launches interactive Claude apps — TechCrunch](https://techcrunch.com/2026/01/26/anthropic-launches-interactive-claude-apps-including-slack-and-other-workplace-tools/)
- [AINews: Anthropic launches MCP Apps open spec — Latent Space](https://www.latent.space/p/ainews-anthropic-launches-the-mcp)
- [Claude supports MCP Apps — The Register](https://www.theregister.com/2026/01/26/claude_mcp_apps_arrives)
- [MCP Apps: how it works and comparison to ChatGPT Apps — Alpic AI](https://alpic.ai/blog/mcp-apps-how-it-works-and-how-it-compares-to-chatgpt-apps)

### Related Ecosystem
- [Connectors Directory — Claude](https://www.claude.com/partners/mcp)
- [OpenAI Apps SDK — MCP Server](https://developers.openai.com/apps-sdk/concepts/mcp-server/)
- [CopilotKit MCP Apps + AG-UI integration](https://www.copilotkit.ai/blog/bring-mcp-apps-into-your-own-app-with-copilotkit-and-ag-ui)
- [MCP Apps SEP-1865 proposal](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/1865)
- [MCP Clients Directory (513+ clients)](https://www.pulsemcp.com/clients)
