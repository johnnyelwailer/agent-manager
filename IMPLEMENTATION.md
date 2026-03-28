# Implementation Plan — TDD Workstream

> **Scope:** Phase 2 completion + Phase 3 rework (sidebar-tree shell) + Phase 4 (end-to-end flow)
>
> **Method:** Test-Driven Development — every task starts with failing tests, then implementation to green, then refactor.
>
> **Starting state:** Monorepo scaffolded. Shared schemas + contracts exist. Server (Hono + WS) works with 84 passing tests. Web app has basic React shell with stores, router, and layout components. UI package has chat + concept components.

---

## Conventions

- **Test file location mirrors source:** `src/foo/bar.ts` → `tests/foo/bar.test.ts`
- **Test runner:** `bun test` everywhere
- **Component tests:** `@testing-library/react` + `bun test` (no Jest, no Vitest)
- **Store tests:** Pure function tests on Zustand stores (no React needed)
- **Naming:** `describe('ModuleName')` → `it('does specific thing')`
- **Assertions:** `expect` from `bun:test`. Zod `.safeParse` for schema tests.
- **Mocks:** Inline mocks via `bun:test`'s `mock()`. No jest.mock magic.

---

## Step 0: Dev Tooling Setup

**Goal:** Testing infrastructure for the web package, which currently has no unit tests.

### 0.1 — Add testing deps to `apps/web`

```bash
bun add -d @testing-library/react @testing-library/dom happy-dom
```

Add to `bunfig.toml` (apps/web section):
```toml
[test]
preload = ["happy-dom/global"]
```

### 0.2 — Verify test runner works

Write a trivial test in `apps/web/tests/smoke.test.ts`:
```typescript
import { describe, it, expect } from 'bun:test';
describe('smoke', () => {
  it('runs', () => expect(1 + 1).toBe(2));
});
```

Run `bun test` in `apps/web/` — must pass.

### 0.3 — Add testing deps to `packages/ui`

```bash
bun add -d @testing-library/react @testing-library/dom happy-dom
```

**Exit criteria:** `bun test` passes in all three packages (`shared`, `server`, `web`).

---

## Step 1: Navigation Store

**Goal:** A Zustand store that models the sidebar tree selection state and drives what the content pane renders.

### 1.1 — Write tests: `apps/web/tests/stores/navigation.test.ts`

```
describe('NavigationStore')
  describe('initial state')
    it('starts with selection = null (landing view)')
    it('has sections: sessions, board, adapters, projects, settings')
    it('sessions section expanded by default')
    it('other sections collapsed by default')

  describe('selectNode')
    it('selecting a session node sets selection to { type: "session", id }')
    it('selecting sessions header sets selection to { type: "sessions-inbox" }')
    it('selecting board sets selection to { type: "board" }')
    it('selecting an adapter sets selection to { type: "adapter", id }')
    it('selecting adapters header sets selection to { type: "adapters-overview" }')
    it('selecting a project sets selection to { type: "project", id }')
    it('selecting projects header sets selection to { type: "projects-overview" }')
    it('selecting an MCP sets selection to { type: "mcp", id }')
    it('selecting MCPs header sets selection to { type: "mcps-overview" }')
    it('selecting settings sets selection to { type: "settings" }')
    it('selecting null returns to landing view')

  describe('toggleSection')
    it('toggles a collapsed section to expanded')
    it('toggles an expanded section to collapsed')
    it('does not affect other sections')

  describe('derived state')
    it('contentPaneType returns "landing" when selection is null')
    it('contentPaneType returns "session" when a session is selected')
    it('contentPaneType returns "session-inbox" for sessions header')
    it('contentPaneType returns "board" for board')
    it('contentPaneType returns "settings" for settings')
```

### 1.2 — Implement: `apps/web/src/stores/navigation.ts`

Types:
```typescript
type TreeNodeSelection =
  | null                                          // landing
  | { type: 'sessions-inbox' }                    // sessions header
  | { type: 'session'; id: string }               // specific session
  | { type: 'board' }                             // kanban
  | { type: 'adapters-overview' }                 // adapters header
  | { type: 'adapter'; id: string }               // specific adapter
  | { type: 'projects-overview' }                 // projects header
  | { type: 'project'; id: string }               // specific project
  | { type: 'mcps-overview' }                     // MCPs header
  | { type: 'mcp'; id: string }                   // specific MCP
  | { type: 'settings' };                         // settings

type TreeSection = 'sessions' | 'board' | 'adapters' | 'projects' | 'mcps' | 'settings';

interface NavigationState {
  selection: TreeNodeSelection;
  expandedSections: Record<TreeSection, boolean>;
  selectNode: (node: TreeNodeSelection) => void;
  toggleSection: (section: TreeSection) => void;
}
```

### 1.3 — Run tests, verify green

**Exit criteria:** All navigation store tests pass. Store is a pure Zustand store testable without React.

---

## Step 2: Sidebar Tree Component

**Goal:** The `<SidebarTree>` component that renders the expandable/collapsible tree and drives the navigation store.

### 2.1 — Write tests: `apps/web/tests/components/sidebar-tree.test.tsx`

```
describe('SidebarTree')
  describe('rendering')
    it('renders Sessions section header')
    it('renders Board section header')
    it('renders Adapters section header')
    it('renders Projects section header')
    it('renders Settings at the bottom')
    it('does NOT render MCPs section when no adapters have MCP capability')
    it('renders MCPs section when at least one adapter has MCP capability')

  describe('sessions section')
    it('renders session nodes with status badges')
    it('shows green dot for running sessions')
    it('shows yellow dot for sessions needing input')
    it('shows gray dot for idle sessions')
    it('shows blue checkmark for completed sessions')
    it('shows session title, time, and cost')
    it('highlights the currently selected session')

  describe('interaction')
    it('clicking a session node calls selectNode with { type: "session", id }')
    it('clicking Sessions header calls selectNode with { type: "sessions-inbox" }')
    it('clicking Board calls selectNode with { type: "board" }')
    it('clicking Settings calls selectNode with { type: "settings" }')
    it('clicking section chevron toggles that section')
    it('collapsed section hides its children')
    it('expanded section shows its children')

  describe('sidebar header')
    it('renders "+ New Session" button')
    it('renders Cmd+K button')
    it('clicking "+ New Session" triggers onNewSession callback')

  describe('status bar')
    it('renders connection status indicator')
    it('renders active agent count')
    it('renders total cost')
```

### 2.2 — Implement: `apps/web/src/components/layout/sidebar-tree.tsx`

Replaces the existing `sidebar.tsx`. Reads from:
- `useNavigationStore()` for selection + section state
- `useSessionsStore()` for session list
- `useAdaptersStore()` for adapter list + capabilities
- `useConnectionStore()` for connection status

Sub-components:
- `TreeSection` — collapsible group with header + children
- `TreeNode` — clickable leaf node with icon + label + badge
- `SessionNode` — specialized TreeNode with status dot + title + cost
- `SidebarHeader` — [+ New] + [Cmd+K] buttons
- `SidebarStatusBar` — connection + agent count + cost

### 2.3 — Run tests, verify green

**Exit criteria:** SidebarTree renders correctly with mock data, interactions update the navigation store.

---

## Step 3: Content Pane Router

**Goal:** A `<ContentPane>` component that reads the navigation store and renders the appropriate content.

### 3.1 — Write tests: `apps/web/tests/components/content-pane.test.tsx`

```
describe('ContentPane')
  it('renders LandingView when selection is null')
  it('renders SessionInbox when selection is { type: "sessions-inbox" }')
  it('renders SessionView when selection is { type: "session", id: "s1" }')
  it('renders KanbanBoard when selection is { type: "board" }')
  it('renders AdaptersOverview when selection is { type: "adapters-overview" }')
  it('renders AdapterDetail when selection is { type: "adapter", id: "a1" }')
  it('renders ProjectsOverview when selection is { type: "projects-overview" }')
  it('renders ProjectDetail when selection is { type: "project", id: "p1" }')
  it('renders McpsOverview when selection is { type: "mcps-overview" }')
  it('renders McpDetail when selection is { type: "mcp", id: "m1" }')
  it('renders SettingsView when selection is { type: "settings" }')
  it('passes session id to SessionView')
  it('passes adapter id to AdapterDetail')
```

### 3.2 — Implement: `apps/web/src/components/layout/content-pane.tsx`

Simple switch on `selection.type`. Each case renders the corresponding view component (stub components initially — just render a div with `data-testid`).

```typescript
function ContentPane() {
  const selection = useNavigationStore((s) => s.selection);
  if (!selection) return <LandingView />;
  switch (selection.type) {
    case 'session': return <SessionView sessionId={selection.id} />;
    case 'sessions-inbox': return <SessionInbox />;
    case 'board': return <KanbanBoard />;
    // ...
  }
}
```

### 3.3 — Run tests, verify green

**Exit criteria:** ContentPane dispatches to the correct sub-view for every selection type.

---

## Step 4: Landing View

**Goal:** The content pane when nothing is selected — prompt input + action grid + recent sessions.

### 4.1 — Write tests: `apps/web/tests/components/views/landing.test.tsx`

```
describe('LandingView')
  describe('prompt input')
    it('renders a text input with placeholder "Describe your task..."')
    it('renders adapter selector dropdown')
    it('only shows adapters with available=true in dropdown')
    it('calls onSubmit with { adapterId, prompt, cwd } when Enter is pressed')
    it('disables submit when prompt is empty')
    it('disables submit when no adapter is selected')

  describe('action grid')
    it('renders featured commands as action buttons')
    it('renders max 9 action buttons')
    it('shows "Show all" link when more than 9 commands exist')
    it('clicking an action button executes the command')
    it('renders empty state when no commands available')

  describe('recent sessions')
    it('renders last 5 sessions')
    it('shows session title, time ago, and cost')
    it('clicking a recent session selects it in navigation store')
    it('renders empty state when no sessions exist')
```

### 4.2 — Implement: `apps/web/src/components/views/landing.tsx`

Reads from:
- `useAdaptersStore()` for adapter list + featured commands
- `useSessionsStore()` for recent sessions + `startSession` action
- `useNavigationStore()` for `selectNode` (when clicking recent session)

### 4.3 — Run tests, verify green

**Exit criteria:** Landing view renders prompt, actions, and recent sessions. Interactions work.

---

## Step 5: Session View (Conversation + Review Panel)

**Goal:** The primary working view when a session is selected — split into conversation (left) and review panel (right).

### 5.1 — Write tests: `apps/web/tests/components/views/session-view.test.tsx`

```
describe('SessionView')
  describe('layout')
    it('renders conversation panel on the left')
    it('renders review panel on the right')
    it('review panel is collapsible')
    it('Cmd+\\ toggles review panel visibility')

  describe('conversation panel')
    it('renders agent events as messages')
    it('renders text_delta events as assistant text')
    it('renders tool_call events as collapsible tool call blocks')
    it('renders thinking events as collapsible thinking blocks')
    it('renders error events with error styling')
    it('renders cost_update events as cost tickers')
    it('auto-scrolls to bottom on new events')
    it('renders composer input at the bottom')
    it('composer supports / slash commands')

  describe('review panel')
    it('renders diff section when session has file changes')
    it('renders artifacts section with plans and research docs')
    it('diff scope selector shows: unstaged, staged, all branch, last turn')
    it('renders empty state when no changes or artifacts')

  describe('session header')
    it('shows session title / prompt')
    it('shows adapter name')
    it('shows status badge')
    it('shows cost')
    it('shows duration')
    it('shows "Pop Out" button')

  describe('approval flow')
    it('renders approval prompt when agent requests confirmation')
    it('Approve button sends approval')
    it('Approve All button sends approval for session')
    it('Reject button sends rejection')
```

### 5.2 — Implement: `apps/web/src/components/views/session-view.tsx`

Sub-components:
- `SessionHeader` — title, adapter, status, cost, actions
- `ConversationPanel` — event stream rendering + composer
- `ReviewPanel` — diff viewer + artifacts list
- `EventRenderer` — dispatches AgentEvent to the right UI element

Reads from:
- `useSessionsStore()` for active session + events
- Existing `packages/ui` components: `CodeBlock`, `ToolCallViewer`, `CostTicker`, `DiffView`, `ProgressIndicator`

### 5.3 — Run tests, verify green

**Exit criteria:** SessionView renders conversation and review panel. Events display correctly. Approval flow works.

---

## Step 6: Session Inbox

**Goal:** Two-column inbox view when "Sessions" header is selected — filterable list + detail panel.

### 6.1 — Write tests: `apps/web/tests/components/views/session-inbox.test.tsx`

```
describe('SessionInbox')
  describe('session list')
    it('renders all sessions as rows')
    it('each row shows: status badge, title, adapter, time, cost')
    it('sorts sessions: running first, then blocked, then idle, then completed')
    it('clicking a row shows its detail in the right panel')

  describe('filters')
    it('filter by status: running, blocked, idle, completed, all')
    it('filter by adapter')
    it('search by title text')
    it('filters compose (status + adapter + text)')

  describe('detail panel')
    it('shows session metadata: adapter, model, cost, duration')
    it('shows artifacts list')
    it('shows "Open Session" button')
    it('shows "Archive" button')
    it('"Open Session" button navigates to the session in the tree')
    it('shows empty state when no session is selected')
```

### 6.2 — Implement: `apps/web/src/components/views/session-inbox.tsx`

Two-column split within the content pane. Left: filterable list. Right: selected detail.

### 6.3 — Run tests, verify green

---

## Step 7: Settings View

**Goal:** Categorized settings panels.

### 7.1 — Write tests: `apps/web/tests/components/views/settings.test.tsx`

```
describe('SettingsView')
  it('renders General section')
  it('renders Adapters section with adapter list')
  it('each adapter shows name, status, auth config')
  it('renders Appearance section with theme toggle')
  it('renders Git section')
  it('renders MCP section')
  it('renders Autonomy section with mode presets')
  it('renders Keyboard shortcuts section')
```

### 7.2 — Implement: `apps/web/src/components/views/settings.tsx`

Reads from `useAdaptersStore()`. Settings are local state (persisted to localStorage initially, SQLite later).

### 7.3 — Run tests, verify green

---

## Step 8: App Shell Rework

**Goal:** Replace the current router + navbar layout with sidebar-tree + content-pane architecture.

### 8.1 — Write tests: `apps/web/tests/components/layout/app-shell.test.tsx`

```
describe('AppShell (reworked)')
  it('renders sidebar tree on the left')
  it('renders content pane on the right')
  it('does NOT render a top navbar with tabs')
  it('sidebar tree is 256px wide by default')
  it('Cmd+B toggles sidebar visibility')
  it('renders status bar at the bottom of sidebar')

  describe('initialization')
    it('connects WebSocket on mount')
    it('fetches sessions on mount')
    it('fetches adapters on mount')
    it('subscribes to agent events')

  describe('responsive')
    it('sidebar visible on desktop (≥1280px)')
    it('sidebar collapsed to icon rail on tablet (768-1279px)')
    it('sidebar hidden (drawer) on mobile (<768px)')
```

### 8.2 — Implement: Rework `apps/web/src/router.tsx`

Replace the multi-route TanStack Router setup with a single-route architecture:

```typescript
// Root = AppShell with SidebarTree + ContentPane
const rootRoute = createRootRoute({
  component: function AppShell() {
    // init: connect WS, fetch sessions, fetch adapters
    return (
      <div className="flex h-screen">
        <SidebarTree />
        <ContentPane />
      </div>
    );
  },
});

// Single index route — everything is sidebar-driven
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => null, // content pane handles rendering
});
```

### 8.3 — Run tests, verify green

### 8.4 — Delete dead code

Remove:
- Old `sidebar.tsx` (replaced by `sidebar-tree.tsx`)
- Old route-specific views in `router.tsx` (opsRoute, sessionsRoute, settingsRoute)
- `ShellNavbar` component (no more top navbar)

**Exit criteria:** App loads with sidebar tree on left, content pane on right. Clicking tree nodes changes content. No tabs anywhere.

---

## Step 9: Command Palette

**Goal:** `Cmd+K` overlay for fuzzy-searching all commands.

### 9.1 — Write tests: `apps/web/tests/components/command-palette.test.tsx`

```
describe('CommandPalette')
  it('is hidden by default')
  it('opens on Cmd+K keydown')
  it('closes on Escape')
  it('renders all commands from adapters store')
  it('groups commands by adapter')
  it('filters commands by fuzzy text match')
  it('highlights matching characters')
  it('Enter on selected command executes it')
  it('shows command keybinding when present')
  it('shows command category when present')
  it('immediate commands execute on Enter')
  it('prompt commands show input field after selection')
  it('closes after command execution')
```

### 9.2 — Implement: `apps/web/src/components/command-palette.tsx`

Uses `cmdk` (already in deps). Reads from `useAdaptersStore()` for commands.

### 9.3 — Run tests, verify green

---

## Step 10: Adapter Capability Routes + Store

**Goal:** Server routes for querying adapter capabilities. Store for discovered commands, skills, MCPs.

### 10.1 — Write tests: `apps/server/tests/routes/capabilities.test.ts`

```
describe('GET /api/adapters/:id/capabilities')
  it('returns capabilities for a registered adapter')
  it('returns 404 for unknown adapter')
  it('capabilities include: commands, skills, mcps, hooks flags')

describe('GET /api/adapters/:id/commands')
  it('returns discovered commands as CommandContract[]')
  it('returns empty array for adapter with no commands')

describe('GET /api/adapters/:id/skills')
  it('returns discovered skills as SkillContract[]')

describe('GET /api/adapters/:id/mcps')
  it('returns discovered MCPs as McpContract[]')
```

### 10.2 — Implement: `apps/server/src/routes/capabilities.ts`

New Hono route group: `/api/adapters/:id/capabilities`, `/api/adapters/:id/commands`, etc.

Adapter interface extension — add optional discovery methods:
```typescript
interface Adapter {
  // existing
  startSession(config: SessionConfig): SessionHandle;
  checkAvailability(): Promise<boolean>;
  manifest: AdapterManifest;
  // new — optional discovery
  discoverCommands?(): Promise<CommandContract[]>;
  discoverSkills?(): Promise<SkillContract[]>;
  discoverMcps?(): Promise<McpContract[]>;
  discoverHooks?(): Promise<HookContract[]>;
}
```

### 10.3 — Write tests: `apps/web/tests/stores/adapters.test.ts`

```
describe('AdaptersStore (extended)')
  it('fetchCapabilities populates commands for an adapter')
  it('fetchCapabilities populates skills for an adapter')
  it('allCommands returns commands from all adapters merged')
  it('featuredCommands returns only commands with featured=true')
  it('commandsByAdapter groups commands by adapterId')
```

### 10.4 — Implement: Extend `apps/web/src/stores/adapters.ts`

Add `commands`, `skills`, `mcps`, `hooks` arrays. Add `fetchCapabilities(adapterId)` action. Add computed selectors.

### 10.5 — Run tests, verify green

---

## Step 11: Claude CLI Discovery

**Goal:** The Claude CLI adapter discovers commands, skills, and MCPs from the actual CLI.

### 11.1 — Write tests: `apps/server/tests/adapters/claude-discovery.test.ts`

```
describe('ClaudeCliAdapter.discoverCommands')
  it('returns CommandContract[] for known Claude slash commands')
  it('each command has adapterId = "claude-cli"')
  it('commit command has invocation = immediate')
  it('plan command has invocation = prompt with hint')
  it('source is "autodiscovered"')

describe('ClaudeCliAdapter.discoverSkills')
  it('reads .claude/skills/ directory')
  it('returns SkillContract[] for each discovered skill file')
  it('skills have autoDiscoverable = true')

describe('ClaudeCliAdapter.discoverMcps')
  it('reads .claude/settings.json for MCP servers')
  it('returns McpContract[] for each configured server')
  it('each MCP has status "configured" (not yet connected)')
```

### 11.2 — Implement discovery methods on `ClaudeCliAdapter`

For commands: hardcoded list of known Claude slash commands (from `claude --help` parsing or static knowledge). Normalizes to `CommandContract[]`.

For skills: reads `.claude/skills/` directory, parses YAML/MD files, normalizes to `SkillContract[]`.

For MCPs: reads `.claude/settings.json` → `mcpServers` key, normalizes to `McpContract[]`.

### 11.3 — Run tests, verify green

---

## Step 12: WebSocket Event Flow (End-to-End)

**Goal:** Events flow from adapter → event bus → WS → connection store → sessions store → UI.

### 12.1 — Write tests: `apps/server/tests/routes/ws-events.test.ts`

```
describe('WebSocket event relay')
  it('client subscribes to a session and receives events')
  it('client subscribes to * and receives all events')
  it('text_delta events are relayed with correct shape')
  it('tool_call events are relayed')
  it('session_end event is relayed')
  it('cost_update event is relayed')
  it('unsubscribe stops event delivery')
  it('multiple clients can subscribe to same session')
  it('events for other sessions are not delivered')
```

### 12.2 — Write tests: `apps/web/tests/stores/sessions.test.ts` (extend existing)

```
describe('SessionsStore.handleEvent')
  it('appends text_delta event to active session events')
  it('appends tool_call event')
  it('updates costUsd on cost_update event')
  it('updates status to completed on session_end with success')
  it('updates status to failed on session_end with error')
  it('updates session list summary on cost_update')
  it('updates session list summary on session_end')
  it('ignores events for non-active sessions (list still updates)')
```

### 12.3 — Verify/fix implementations

The WS route and session store event handler already exist. This step verifies they work correctly and fixes any gaps found by the tests.

### 12.4 — Run tests, verify green

---

## Step 13: Session Lifecycle (Start → Stream → End)

**Goal:** Full end-to-end: user creates session via UI → server spawns adapter → events stream to UI → session completes.

### 13.1 — Write integration tests: `apps/server/tests/integration/session-lifecycle.test.ts`

```
describe('Session lifecycle (integration)')
  it('POST /api/sessions starts a session and returns sessionId')
  it('WS subscription receives session_start event')
  it('WS subscription receives text_delta events')
  it('WS subscription receives session_end event')
  it('GET /api/sessions/:id returns session with events after completion')
  it('session status transitions: starting → running → completed')
  it('cost accumulates across cost_update events')
  it('interrupting a session sends interrupt to adapter')

describe('Session lifecycle with fake Claude')
  it('spawns fake claude binary and streams events')
  it('handles non-zero exit code as failed session')
  it('handles empty output gracefully')
```

Uses the existing `createFakeClaude()` test helper pattern from `session-manager.test.ts`.

### 13.2 — Fix any gaps found

### 13.3 — Run tests, verify green

---

## Step 14: Persistence (SQLite)

**Goal:** Sessions and events survive server restart.

### 14.1 — Write tests: `apps/server/tests/db/persistence.test.ts`

```
describe('SQLite persistence')
  describe('sessions table')
    it('saves a new session')
    it('retrieves a session by id')
    it('lists all sessions ordered by startedAt desc')
    it('updates session status')
    it('updates session cost')

  describe('events table')
    it('saves an event linked to a session')
    it('retrieves events for a session in order')
    it('handles large event payloads (tool call output)')

  describe('adapters table')
    it('saves adapter manifest')
    it('lists registered adapters')

  describe('server restart')
    it('sessions from previous run are available after restart')
    it('event history is preserved')
```

### 14.2 — Implement: `apps/server/src/db/`

- `schema.ts` — SQL CREATE TABLE statements, run on startup
- `queries.ts` — typed query functions using `bun:sqlite`
- Integration into `SessionManager` — save events as they arrive, load on startup

### 14.3 — Run tests, verify green

---

## Step 15: Kanban Board

**Goal:** Basic kanban view for the Board tree node.

### 15.1 — Write tests: `apps/web/tests/components/views/kanban.test.tsx`

```
describe('KanbanBoard')
  it('renders 4 columns: Backlog, In Progress, In Review, Done')
  it('renders task cards in the correct column based on status')
  it('task card shows: title, adapter icon, status badge, cost')
  it('clicking a task card navigates to its session')
  it('renders empty columns with placeholder text')
```

### 15.2 — Implement: `apps/web/src/components/views/kanban.tsx`

Simple column layout with task cards. No drag-and-drop yet (add in polish phase).

### 15.3 — Run tests, verify green

---

## Step 16: Adapters/Projects/MCP Detail Views

**Goal:** Content pane renderers for remaining tree node types.

### 16.1 — Write tests for each view

**`adapters-overview.test.tsx`:**
```
  it('renders grid of adapter cards')
  it('each card shows name, status (connected/not found), capabilities count')
  it('clicking a card navigates to adapter detail')
```

**`adapter-detail.test.tsx`:**
```
  it('shows adapter name and version')
  it('shows auth config form based on adapter.auth.methods')
  it('shows capabilities list (commands, skills, MCPs, hooks)')
  it('shows sessions using this adapter')
```

**`projects-overview.test.tsx`:**
```
  it('renders project list with session counts')
```

**`mcps-overview.test.tsx`:**
```
  it('renders MCP server list with tools counts')
  it('each MCP shows status (connected/error/configured)')
```

### 16.2 — Implement all views as simple data-driven components

### 16.3 — Run tests, verify green

---

## Step 17: End-to-End Smoke Test

**Goal:** Playwright test that exercises the full flow.

### 17.1 — Write E2E test: `apps/web/e2e/sidebar-navigation.spec.ts`

```
test('sidebar tree navigation')
  - app loads with landing view (prompt input visible)
  - sidebar shows Sessions section
  - click "+ New Session" → landing view shows session form
  - create a session → session appears in tree
  - click the session → session view renders (conversation + review panel)
  - click "Sessions" header → inbox view renders
  - click "Board" → kanban renders
  - click "Settings" → settings view renders
  - click session in tree again → back to session view
  - Cmd+K → command palette opens
  - Escape → command palette closes
  - Cmd+B → sidebar toggles
```

### 17.2 — Run E2E tests

**Exit criteria:** Full navigation flow works in browser.

---

## Execution Order Summary

| Step | Package | What | Tests First | Depends On |
|------|---------|------|-------------|------------|
| 0 | web, ui | Test tooling setup | — | — |
| 1 | web | Navigation store | Yes | — |
| 2 | web | SidebarTree component | Yes | Step 1 |
| 3 | web | ContentPane router | Yes | Step 1 |
| 4 | web | LandingView | Yes | Step 3 |
| 5 | web | SessionView | Yes | Step 3 |
| 6 | web | SessionInbox | Yes | Step 3 |
| 7 | web | SettingsView | Yes | Step 3 |
| 8 | web | AppShell rework | Yes | Steps 2+3 |
| 9 | web | CommandPalette | Yes | Step 10 |
| 10 | server+web | Capability routes + store | Yes | — |
| 11 | server | Claude CLI discovery | Yes | Step 10 |
| 12 | server+web | WS event flow | Yes | — |
| 13 | server | Session lifecycle integration | Yes | Step 12 |
| 14 | server | SQLite persistence | Yes | — |
| 15 | web | KanbanBoard | Yes | Step 3 |
| 16 | web | Detail views (adapters, projects, MCPs) | Yes | Step 3+10 |
| 17 | web | E2E smoke test | Yes | All above |

**Parallelizable work:**
- Steps 1-3 (navigation core) can be done independently of Steps 10-14 (server work)
- Steps 4-7 (content views) are independent of each other after Step 3
- Step 9 (command palette) depends on Step 10 (capability store) for real data
- Steps 12-14 are server-only and independent of frontend steps

**Critical path:** Step 0 → Step 1 → Step 2+3 → Step 8 → Step 17

---

## Test Count Estimate

| Package | Existing | New (est.) | Total |
|---------|----------|------------|-------|
| shared | 64 | 0 | 64 |
| server | 20 | ~45 | ~65 |
| web | 0 | ~120 | ~120 |
| **Total** | **84** | **~165** | **~249** |
