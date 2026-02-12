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

Design the plan artifact as a **multi-block document** where each block has
a type and a typed payload. The core ships renderers for common types (flow
graphs, text). Extensions register renderers for additional types (wireframes,
ER diagrams, etc.).

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

// Flow block payload (core renderer via @xyflow/react)
interface FlowBlockPayload {
  nodes: { id: string; label: string; status?: string }[];
  edges: { source: string; target: string; label?: string }[];
}

// Wireframe block payload (extension renderer)
interface WireframeBlockPayload {
  screens: { id: string; name: string; elements: WireframeElement[] }[];
}

// The plan itself
interface Plan {
  id: string;
  issueId: string;
  blocks: PlanBlock[];             // ordered, multi-modal
  complexity: 'trivial' | 'simple' | 'moderate' | 'complex';
  risks: string[];
  createdAt: string;
}
```

The block renderer registry is the extension point:

```typescript
// Core registers built-in renderers
registerPlanBlockRenderer('flow', FlowBlockRenderer);    // @xyflow/react
registerPlanBlockRenderer('text', TextBlockRenderer);    // markdown

// Extensions register additional renderers
registerPlanBlockRenderer('wireframe', WireframeBlockRenderer);  // TLDraw, etc.
registerPlanBlockRenderer('er_diagram', ERDiagramBlockRenderer);
```

Unknown block types fall back to a raw JSON viewer. This keeps the core lean
while making the plan artifact genuinely multi-modal.

---

## Part 2: "Living Blueprint" Ideas — Critical Analysis

### Idea 1: "Intent-Based Editor" (Drag = Prompt)

**The claim:** Dragging a UI element generates a semantic action log. The
agent consumes the log and rewrites the spec.

**Criticism:**

- This conflates two problems: visual editing and agent prompting. The
  indirection (drag → action log → agent reasoning → JSON rewrite → re-render)
  is a Rube Goldberg machine for what could be a direct edit. If the user
  knows they want the login button in the sidebar, they can just tell the
  agent. The drag gesture adds a translation layer that the agent then has to
  reverse-translate.

- The "agent infers intent from action" step is where this breaks. Moving a
  button from header to sidebar doesn't reliably mean "make login less
  prominent." It might mean "the sidebar has more space" or "our designer
  said so." Intent inference from spatial manipulation is an unsolved UX
  research problem, not a feature you can ship.

- Agent-manager's contract system already provides the right abstraction.
  The `ResearchDocContract` is the spec. The agent edits it through the
  session. The human reviews via the `ResearchDocViewer`. Adding a visual
  drag layer on top of this adds complexity without clear value.

**Verdict:** Not relevant. The problem it solves (making agent specs editable)
is already handled by the ResearchDocContract + inline editing. The spatial
manipulation → intent inference step is an unsolved research problem that
would eat significant development time for unreliable results.

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

**Criticism:**

- This is the most practically useful idea in the document, but it's
  **already how agent-manager's chat interaction works**, just with text
  instead of spatial pins. The user sees the agent's output, provides feedback
  in the session, and the agent revises. The "proposal" framing doesn't
  change the underlying loop.

- The spatial annotation part (click on a specific rendered element) is
  interesting but only makes sense for visual outputs. Agent-manager deals
  primarily with code, plans, and structured data — not rendered UIs. For
  code, the equivalent is "click on a line in the diff view and comment" which
  is what GitHub PRs already do, and what the verification pipeline's AI
  review step could surface.

- The "no chat window" framing is a false dichotomy. The chat is the
  feedback channel. Replacing it with contextual pins doesn't eliminate
  the chat — it distributes it spatially, which is harder to follow for
  multi-turn interactions.

**What's actually extractable:** The concept of **contextual feedback on
rendered plan artifacts**. If a plan is rendered as a flow graph
(see Part 1 takeaway), allowing the user to click a specific node and say
"this step is wrong" — then passing that node context to the agent — is a
useful interaction pattern. This maps to:

1. Render plan as flow graph (PlanFlowView component)
2. Node click → opens contextual input
3. Input + node context → new agent prompt
4. Agent revises plan JSON → re-render

This is a UI feature on top of the existing session/chat system, not a new
architecture.

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

### 1. Multi-block plan artifacts with pluggable renderers (High value, medium effort)

- Redesign `Plan` from flat step list to ordered block array
- Each block has a `type` + typed `payload`
- Core ships `flow` renderer (`@xyflow/react`) and `text` renderer (markdown)
- Extension point: `registerPlanBlockRenderer(type, component)`
- Enables wireframes, ER diagrams, etc. without core changes
- The unified artifact is the real win — one plan file, multiple visual facets

### 2. Contextual feedback on rendered artifacts (Medium value, medium effort)

- When viewing a rendered plan/flow, allow clicking a node to provide
  targeted feedback
- Pass node context + user comment as a new prompt to the agent session
- Natural extension of the existing session interaction model

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

1. **Building a visual drag-and-drop plan editor.** The agent edits the plan.
   The human reviews and comments. Adding a visual editor creates a parallel
   editing path that the agent then has to reconcile with.

2. **Multi-agent document editing.** Multiple agents on one document creates
   coordination hell. Use the existing multi-session + worktree pattern for
   parallel agent work.

3. **Block editor / Notion clone.** Enormous implementation effort for a
   feature that's tangential to agent orchestration. Render artifacts
   read-only with annotation capability.

4. **Intent inference from spatial manipulation.** Unsolved research problem.
   Don't try to guess what a drag gesture "means."

5. **Building wireframe renderers in core.** The plan artifact should *support*
   wireframe blocks, but the renderer is an extension, not a core feature.

---

## Summary Table

| Idea | Source | Relevant? | Already Exists? | Action |
|------|--------|-----------|-----------------|--------|
| Multi-modal plan artifact | Flowy | Yes | Partial (Plan schema + React Flow in deps) | Redesign Plan as block array + renderer registry |
| Lofi wireframe rendering | Flowy | Yes (as extension) | No | Extension renderer, not core — plan schema supports it |
| Intent-based drag editor | Part 2, #1 | No | N/A | Avoid |
| Multi-agent chapters | Part 2, #2 | Partial | Yes (WorkflowPhase) | Already covered by workflow plugins |
| Contextual pin comments | Part 2, #3 | Yes | Partial (session chat exists) | Build as UI feature on plan renderer |
| Notebook blocks | Part 2, #4 | Partial | Yes (ResearchDocContract) | Don't build editor; enhance viewer |
| Time-travel slider | Part 2, #5 | Yes | Yes (event-sourcing planned) | Implement as plan version nav |
