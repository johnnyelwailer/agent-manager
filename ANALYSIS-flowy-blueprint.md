# Critical Analysis: Flowy & "Living Blueprint" Ideas vs. Agent Manager

## TL;DR

Most of Part 2 is speculative product design that overlaps heavily with what
agent-manager already architects (contracts, workflow plugins, event-sourced
sessions). The genuinely useful extractions are narrow but sharp:
**multi-modal plan artifacts** (one JSON carrying both flow graphs and
wireframes, rendered by pluggable viewers), **time-travel over event-sourced
state** (already planned), and Flowy's iteration loop pattern. The "Council
of Chapters" and "Intent-Based Editor" ideas sound exciting but would
introduce massive complexity for marginal gain over what the contract +
workflow plugin system already provides.

---

## Part 1: Flowy — What's Actually There

### What Flowy does well

Flowy solves one narrow problem cleanly: **AI plans are text, text is hard to
verify visually, so render plans as interactive flowcharts and iterate on them
before writing code.** The workflow is:

1. Agent produces JSON (not prose)
2. Tool renders JSON as a node graph or wireframe
3. Human spots logic errors visually
4. Human asks agent to fix specific connections
5. Verified plan becomes the build spec

This is a tight feedback loop. The key insight is not the rendering (React
Flow can do that) — it's **making the agent's output machine-readable and
visually verifiable before committing to implementation**.

### What's relevant to agent-manager

**Directly relevant:**

- The `Plan` schema (`packages/shared/src/schemas/workflow.ts:57-73`)
  already captures steps, but steps are flat text descriptions. If plan steps
  had **edges/dependencies** (step A blocks step B), they could be rendered as
  a DAG via the React Flow dependency already in the tech stack. This is a
  small schema extension, not a new system.

- The `ResearchDocContract` with `role: 'plan'` and `format: 'json'` is
  already the container for this. An agent that outputs a structured JSON plan
  can already be stored here. What's missing is a **renderer component** that
  takes a JSON plan doc and renders it as a flow graph. This is a UI component
  task, not an architecture task.

**Not core, but worth supporting as an extension:**

- Flowy's lofi wireframe rendering. Agent-manager shouldn't build a wireframe
  renderer itself, but the real insight from Flowy is the **unified plan
  artifact**: one JSON file that carries both logic flows AND visual layouts.
  The value is that an agent can produce a single plan containing flow graphs
  for user journeys *and* wireframes for key screens, and different viewers
  render different facets of the same artifact. This means the plan schema
  should be **multi-modal and extensible** — the core defines the structure,
  extensions provide renderers for block types the core doesn't know about.

- If CJ open-sources Flowy, it could plug in as a plan block renderer
  extension. Similarly, a TLDraw-based wireframe renderer, a Mermaid renderer,
  or an ER diagram renderer could all consume blocks from the same plan file.
  Agent-manager's job is to define the envelope and extension point, not every
  renderer.

### Concrete takeaway

Design the plan artifact as a **multi-block document** with interactive,
bidirectional block editors. The core provides two things every block gets
for free: **commenting** (anchored to any element) and a **structured edit
protocol** (editors emit change events, the host routes them to the agent).

#### The plan artifact

```typescript
// Current PlanStep — flat, text-only
{ id, description, completed }

// Revised: Plan as multi-block artifact
interface PlanBlock {
  id: string;
  type: string;                    // 'flow' | 'wireframe' | 'text' | 'schema' | custom
  title?: string;
  payload: unknown;                // typed per block type
}

// The plan itself
interface Plan {
  id: string;
  issueId: string;
  blocks: PlanBlock[];             // ordered, multi-modal
  comments: PlanComment[];         // core concern — lives on the plan, not per-block
  complexity: 'trivial' | 'simple' | 'moderate' | 'complex';
  risks: string[];
  createdAt: string;
}
```

#### Core: the comment system

Comments are a **host-level primitive**, not something each editor rebuilds.
The host manages the comment store; each block editor receives its relevant
comments and renders anchors contextually (a pin on a flow node, a margin
note on a text block, a callout on a wireframe element).

```typescript
interface PlanComment {
  id: string;
  blockId: string;                 // which block
  anchor?: string;                 // element within the block (node id, line number, element id)
  content: string;                 // the comment text
  author: 'human' | 'agent';
  resolvedAt?: string;             // null = open, timestamp = resolved
  createdAt: string;
}
```

This means you can drop a comment on a specific node in a flow graph, on a
specific screen in a wireframe, on a specific line in a text block — all
using the same comment model. The "Proposal Button" idea (Part 2, #3) falls
out naturally: open comments become the agent's revision instructions.

#### The block editor contract (bidirectional)

Block extensions are **editors, not renderers**. Each editor receives its
payload and comments, and emits two kinds of events back to the host:

```typescript
interface PlanBlockEditorProps {
  block: PlanBlock;
  readOnly?: boolean;

  // --- Host → Editor (data down) ---
  comments: PlanComment[];         // comments anchored to this block

  // --- Editor → Host (events up) ---
  onEdit: (event: BlockEditEvent) => void;
  onComment: (anchor: string | undefined, content: string) => void;
}

// Structured edit events — facts, not inferred intent
interface BlockEditEvent {
  blockId: string;
  action: string;                  // domain-specific: 'node_added', 'edge_deleted',
                                   // 'element_moved', 'text_changed', etc.
  description: string;             // human-readable: "Deleted edge between Login and Dashboard"
  patch: JsonPatch;                // RFC 6902 — the actual payload mutation
}
```

**Why this works where the "Intent-Based Editor" (Idea #1) doesn't:**
The editor knows its own domain. A flow editor emitting `edge_deleted` between
nodes A and B is reporting a **fact**, not inferring intent. The agent receives
structured facts and reasons about them. No ambiguous gesture interpretation.

#### The edit → agent loop

The host collects `BlockEditEvent`s and batches them into an agent prompt:

```
The user made the following changes to the plan:
- [flow block "User Journey"] Deleted edge between "Login" and "Dashboard"
- [flow block "User Journey"] Added node "MFA Challenge" between "Login" and "Dashboard"
- [wireframe block "Login Screen"] Moved "Remember Me" checkbox below password field

Open comments:
- [flow block "User Journey", node "MFA Challenge"] "Should this be optional for SSO users?"

Update the plan to reflect these changes.
```

The agent then produces a new plan version (new JSON), which the host diffs
against the current version and hot-swaps. This is Flowy's iteration loop,
but generalized across block types.

#### The registry

```typescript
// Core registers built-in editors
registerPlanBlockEditor('flow', FlowBlockEditor);        // @xyflow/react
registerPlanBlockEditor('text', TextBlockEditor);        // markdown + inline comments

// Extensions register additional editors
registerPlanBlockEditor('wireframe', WireframeBlockEditor);  // TLDraw, etc.
registerPlanBlockEditor('er_diagram', ERDiagramBlockEditor);
```

Unknown block types fall back to a raw JSON viewer with comment support
(comments still work — they just anchor to the block, not to elements within
it). This keeps the core lean while making the plan artifact genuinely
interactive and multi-modal.

---

## Part 2: "Living Blueprint" Ideas — Critical Analysis

### Idea 1: "Intent-Based Editor" (Drag = Prompt)

**The claim:** Dragging a UI element generates a semantic action log. The
agent consumes the log and rewrites the spec.

**Criticism of the original framing:**

- The original Idea #1 asks the agent to *infer intent* from spatial gestures
  ("user moved button, therefore they want login to be less prominent"). That
  inference step is unreliable and should be avoided.

**What's actually valuable — reframed as the block editor contract:**

- If you scope this down to **editors emit structured facts, not inferred
  intent**, the core mechanic is sound. A flow editor emitting "edge deleted
  between A and B" is a fact. A wireframe editor emitting "button moved from
  header to sidebar" is a fact. The agent receives facts and reasons about
  them — that's what agents are good at.

- The key design rule: **the editor describes what changed, never why.** The
  "why" comes from the human via comments, or the agent infers it from the
  full context of all changes + open comments together. No single gesture
  carries intent.

- This is formalized in the `BlockEditEvent` contract (see Part 1 concrete
  takeaway). Each editor emits `{ action, description, patch }` — a
  domain-specific action name, a human-readable description, and the actual
  JSON patch. The host batches these into agent prompts.

**Verdict:** The original "intent inference from gestures" framing is still
wrong. But the underlying mechanic — **visual edits produce structured change
events that feed agent prompts** — is the right interaction model. It's the
foundation of the bidirectional block editor contract.

### Idea 2: "Council of Chapters" (Sub-Agents per Section)

**The claim:** Structure a PRD as chapters, each owned by a specialized
sub-agent. Changes in one chapter trigger cross-chapter notifications.

**Criticism:**

- This is literally the workflow plugin system already designed in PLAN.md.
  The `WorkflowPhase` concept maps directly to "chapters." The
  `PrimitiveMapping` controls what each phase renders. The phase transition
  system handles cross-phase coordination. Calling them "chapters" instead of
  "phases" doesn't add anything.

- The "sub-agent per chapter" idea is where it gets dubious. Running multiple
  specialized agents (ArchitectAgent, DBAgent, DesignAgent) simultaneously on
  the same document introduces coordination overhead that dwarfs the benefit.
  Who resolves conflicts between the ArchitectAgent's flow and the DBAgent's
  schema? You need a meta-agent or human arbiter, which brings you back to a
  single-agent-with-context pattern.

- Agent-manager already supports multi-session parallel execution with
  worktree isolation. That's the right level for multi-agent work: separate
  repos or separate concerns with clean boundaries. Not multiple agents
  editing different sections of the same JSON document.

- The "self-healing document" (DBAgent notifies DesignAgent) sounds good in
  a demo but creates cascading update loops in practice. Delete a field →
  notify design → design updates wireframe → notify architect → architect
  adjusts flow → notify DB... This is the same problem as bidirectional data
  binding, which the frontend world abandoned for unidirectional flow for
  good reasons.

**Verdict:** The core concept (structured multi-section specs) already exists
as WorkflowPhases. The multi-agent-per-section idea is architecturally
dangerous and should be avoided. If cross-concern coordination is needed,
it should be one agent with full context, not multiple agents with partial
context trying to negotiate.

### Idea 3: "Proposal Button" (Pin Comments on Rendered Output)

**The claim:** Click an element in a rendered mockup, drop a comment, hit
"Revise" — the agent updates just that section.

**Revised assessment:** This idea is now **absorbed into the core plan
architecture** rather than being a separate feature. The `PlanComment` model
with block + anchor targeting (see Part 1 concrete takeaway) is exactly this:
click any element in any block editor, drop a comment, and those comments
become the agent's revision instructions.

The original criticism that "the chat already does this" was too dismissive.
Spatially-anchored comments are fundamentally better than chat for plan
review because:

- They survive across agent turns (a comment on node X stays there even as
  the surrounding plan evolves)
- They can be resolved/reopened, giving the agent clear signal on what's done
  vs. what still needs attention
- They carry context automatically (the anchor identifies what the comment
  is about without the human having to describe it)

The "Revise" button is just: collect all open comments + pending edits →
format as agent prompt → agent produces new plan version.

**Verdict:** Absorbed into the core comment system. Not a separate feature.

### Idea 4: "Multimodal Living Blocks" (Notebook-Style Layout)

**The claim:** Use a Notion-style block layout mixing text, live spec
renderers, and inline conversation.

**Criticism:**

- This is essentially the `ResearchDocContract` with multiple format types
  rendered inline. The contract already supports `markdown`, `json`, `yaml`,
  and `plain_text` formats. Adding block-level rendering is a UI decision, not
  an architectural one.

- The "conversation block" (inline chat history next to a diagram) is
  genuinely useful for preserving decision context. Agent-manager's event
  system already captures the full session transcript. The question is whether
  to render relevant conversation snippets alongside specific artifacts. This
  is a UI enhancement to `ResearchDocViewer` — link events to artifacts by
  timestamp or explicit reference.

- The risk is building a Notion clone. Block editors are notoriously complex
  (see: Notion's years of development, ProseMirror/TipTap complexity,
  Plate.js). Agent-manager should not become a document editor. The right
  approach is read-only rendered views of agent artifacts with lightweight
  annotation.

**Verdict:** The concept of rendering different artifact types inline is sound
and already supported by the contract system. The "conversation block" idea
(showing why a decision was made next to the artifact) is worth considering as
a UI enhancement. Do NOT build a block editor.

### Idea 5: "Time-Travel Sliders"

**The claim:** Since plans are JSON state, add a scrubber to view previous
iterations.

**Criticism:**

- This is the strongest idea in the document, and **agent-manager already
  plans for it**. From PLAN.md line 648: "Timeline scrub + checkpoint restore
  — Event-sourced session log with scrub UI (replay any point, restore state)"
  and line 652: "Event-sourcing with replay — Immutable event log as
  foundation."

- The event bus (`apps/server/src/core/event-bus.ts`) already streams all
  events. Sessions already capture ordered event lists. The infrastructure for
  time-travel is the event-sourced architecture itself.

- The only new idea here is applying time-travel specifically to **plan
  artifacts** (not just sessions). If plans are versioned (each agent revision
  creates a new version), a slider over plan versions is trivial — it's just
  an index into an array of JSON snapshots.

**Verdict:** Already planned. The plan-specific application (slider over plan
revisions) is a minor UI feature on top of the existing event-sourced
architecture. No new systems needed.

---

## What's Actually Worth Taking

Ranked by value-to-effort ratio:

### 1. Interactive multi-block plan artifacts (High value, medium-high effort)

- Redesign `Plan` from flat step list to ordered `PlanBlock[]`
- Each block has a `type` + typed `payload`
- Block editors are **bidirectional**: render payload, emit `BlockEditEvent`s
- Core ships `flow` editor (`@xyflow/react`) and `text` editor (markdown)
- Extension point: `registerPlanBlockEditor(type, component)`
- Enables wireframes, ER diagrams, etc. without core changes
- The unified artifact is the real win — one plan file, multiple visual facets

### 2. Native comment system anchored to plan elements (High value, medium effort)

- `PlanComment` as a core primitive on the plan, not per-block
- Comments anchor to a block + optional element within (node, line, screen)
- Each block editor receives its comments and renders contextual anchors
- Open comments feed directly into agent revision prompts
- Comments persist across plan revisions (re-anchor by element ID)
- Replaces the need for a separate chat-based feedback loop on plans

### 3. Plan versioning with comparison (Medium value, low effort)

- Store plan revisions as an array of snapshots
- Simple prev/next navigation (not a fancy slider — YAGNI)
- Show diff between versions
- Already have diff viewing components (`DiffView`)

### 4. Decision context linking (Low value, medium effort)

- Link specific events in the session transcript to specific plan artifacts
- Show "why was this changed?" alongside rendered plans
- Useful for team workflows but not critical for single-user agent operation

---

## What to Explicitly Avoid

1. **Intent inference from spatial manipulation.** Editors emit facts
   ("edge deleted"), never intent ("user wants simpler flow"). The agent
   reasons about intent from facts + comments together.

2. **Multi-agent document editing.** Multiple agents on one document creates
   coordination hell. Use the existing multi-session + worktree pattern for
   parallel agent work.

3. **Building a full block/document editor (Notion clone).** The plan is a
   structured artifact with typed blocks, not a freeform document. Users
   interact through block editors and comments, not by restructuring the
   document itself. Keep the block *structure* agent-controlled.

4. **Building wireframe renderers in core.** The plan artifact *supports*
   wireframe blocks, but the renderer is an extension, not a core feature.

---

## Summary Table

| Idea | Source | Relevant? | Already Exists? | Action |
|------|--------|-----------|-----------------|--------|
| Multi-modal plan artifact | Flowy | Yes | Partial (Plan schema + React Flow in deps) | Redesign Plan as block array + bidirectional editor registry |
| Lofi wireframe rendering | Flowy | Yes (as extension) | No | Extension editor, not core — plan schema supports it |
| Edits → structured events | Part 2, #1 | Yes (reframed) | No | Core of `BlockEditEvent` contract — facts not intent |
| Multi-agent chapters | Part 2, #2 | Partial | Yes (WorkflowPhase) | Already covered by workflow plugins |
| Contextual pin comments | Part 2, #3 | Yes | No | Absorbed into core `PlanComment` system |
| Notebook blocks | Part 2, #4 | Partial | Yes (ResearchDocContract) | Block editors are the typed version of this |
| Time-travel slider | Part 2, #5 | Yes | Yes (event-sourcing planned) | Implement as plan version nav |
