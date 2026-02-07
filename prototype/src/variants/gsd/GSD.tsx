import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import styles from './GSD.module.css';

// ---------------------------------------------------------------------------
// GSD Mock Data — models the actual glittercowboy/get-shit-done system
// ---------------------------------------------------------------------------

type PhaseStatus = 'not_started' | 'discussing' | 'planning' | 'executing' | 'verifying' | 'complete' | 'deferred';
type TaskType = 'auto' | 'checkpoint:human-verify' | 'checkpoint:decision' | 'checkpoint:human-action';
type AgentRole = 'planner' | 'executor' | 'debugger' | 'phase-researcher' | 'project-researcher' | 'research-synthesizer' | 'roadmapper' | 'codebase-mapper' | 'verifier' | 'plan-checker' | 'integration-checker';
type AgentStatus = 'idle' | 'spawning' | 'running' | 'done' | 'errored';
type MessageRole = 'user' | 'assistant' | 'system' | 'checkpoint';

interface GsdConfig {
  mode: 'interactive' | 'yolo';
  depth: 'quick' | 'standard' | 'comprehensive';
  modelProfile: 'quality' | 'balanced' | 'budget';
  features: { research: boolean; planCheck: boolean; verifier: boolean };
  parallel: { enabled: boolean; maxAgents: number };
  branchingStrategy: 'none' | 'phase' | 'milestone';
}

interface Milestone {
  id: string;
  name: string;
  version: string;
  phases: Phase[];
  status: 'active' | 'complete' | 'archived';
}

interface Phase {
  id: string;
  number: string;
  title: string;
  status: PhaseStatus;
  plans: Plan[];
  successCriteria: string[];
  context?: string;
}

interface Plan {
  id: string;
  name: string;
  wave: number;
  type: 'execute' | 'tdd';
  tasks: GsdTask[];
  status: 'pending' | 'executing' | 'done' | 'failed';
  autonomous: boolean;
}

interface GsdTask {
  id: string;
  title: string;
  type: TaskType;
  files: string[];
  status: 'pending' | 'running' | 'done' | 'failed' | 'checkpoint';
  verify?: string;
  commitMsg?: string;
}

interface SubAgent {
  id: string;
  role: AgentRole;
  model: string;
  status: AgentStatus;
  phase?: string;
  plan?: string;
  tokensUsed: number;
  contextPct: number;
}

interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  command?: string;
  agentRole?: AgentRole;
  checkpoint?: { type: 'verify' | 'decision' | 'action'; options?: string[] };
}

interface Todo {
  id: string;
  title: string;
  area: string;
  status: 'pending' | 'done';
}

// Mock data
const config: GsdConfig = {
  mode: 'interactive',
  depth: 'standard',
  modelProfile: 'balanced',
  features: { research: true, planCheck: true, verifier: true },
  parallel: { enabled: true, maxAgents: 3 },
  branchingStrategy: 'phase',
};

const milestone: Milestone = {
  id: 'ms-1',
  name: 'v1.0 MVP',
  version: '1.0.0',
  status: 'active',
  phases: [
    {
      id: 'ph-1', number: '1', title: 'Project scaffold & auth', status: 'complete',
      plans: [
        { id: 'pl-1-1', name: 'PLAN-1-scaffold.md', wave: 1, type: 'execute', autonomous: true, status: 'done', tasks: [
          { id: 't-1', title: 'Initialize Next.js project', type: 'auto', files: ['package.json', 'next.config.js'], status: 'done', commitMsg: 'feat(1-1): initialize Next.js 15 project scaffold' },
          { id: 't-2', title: 'Set up Tailwind CSS', type: 'auto', files: ['tailwind.config.ts', 'globals.css'], status: 'done', commitMsg: 'feat(1-1): configure Tailwind CSS' },
        ]},
        { id: 'pl-1-2', name: 'PLAN-2-auth.md', wave: 2, type: 'execute', autonomous: true, status: 'done', tasks: [
          { id: 't-3', title: 'Add NextAuth.js with Google provider', type: 'checkpoint:human-verify', files: ['auth.ts', 'api/auth/[...nextauth]/route.ts'], status: 'done', verify: 'User can sign in via Google', commitMsg: 'feat(1-2): add NextAuth.js with Google OAuth' },
        ]},
      ],
      successCriteria: ['User can sign in via Google', 'Project builds without errors', 'Tailwind classes render correctly'],
      context: 'Decided on NextAuth over Clerk for cost. Using App Router.',
    },
    {
      id: 'ph-2', number: '2', title: 'Database & core models', status: 'complete',
      plans: [
        { id: 'pl-2-1', name: 'PLAN-1-db-setup.md', wave: 1, type: 'execute', autonomous: true, status: 'done', tasks: [
          { id: 't-4', title: 'Set up Prisma with PostgreSQL', type: 'auto', files: ['prisma/schema.prisma', 'lib/db.ts'], status: 'done', commitMsg: 'feat(2-1): initialize Prisma with PostgreSQL' },
          { id: 't-5', title: 'Create User and Workspace models', type: 'auto', files: ['prisma/schema.prisma'], status: 'done', commitMsg: 'feat(2-1): add User and Workspace models' },
        ]},
      ],
      successCriteria: ['Prisma migrations run', 'CRUD operations work', 'Relations validated'],
    },
    {
      id: 'ph-3', number: '3', title: 'API routes & CRUD', status: 'executing',
      plans: [
        { id: 'pl-3-1', name: 'PLAN-1-api-routes.md', wave: 1, type: 'execute', autonomous: true, status: 'executing', tasks: [
          { id: 't-6', title: 'Create workspace CRUD endpoints', type: 'auto', files: ['api/workspaces/route.ts', 'api/workspaces/[id]/route.ts'], status: 'done', commitMsg: 'feat(3-1): add workspace CRUD API routes' },
          { id: 't-7', title: 'Add input validation with Zod', type: 'auto', files: ['lib/validators.ts', 'api/workspaces/route.ts'], status: 'running', verify: 'npm test -- --grep "validation"' },
          { id: 't-8', title: 'Error handling middleware', type: 'auto', files: ['middleware.ts', 'lib/errors.ts'], status: 'pending' },
        ]},
        { id: 'pl-3-2', name: 'PLAN-2-member-api.md', wave: 2, type: 'execute', autonomous: true, status: 'pending', tasks: [
          { id: 't-9', title: 'Create member invitation system', type: 'checkpoint:human-verify', files: ['api/members/invite/route.ts', 'lib/email.ts'], status: 'pending', verify: 'User receives invitation email' },
        ]},
      ],
      successCriteria: ['All CRUD endpoints return correct responses', 'Input validation rejects malformed data', 'Member invitations send emails'],
      context: 'Using Zod for validation. RESTful over tRPC for simplicity. Email via Resend.',
    },
    {
      id: 'ph-4', number: '4', title: 'Dashboard UI', status: 'planning',
      plans: [],
      successCriteria: ['Dashboard renders workspace list', 'Navigation works', 'Responsive on mobile'],
    },
    {
      id: 'ph-5', number: '5', title: 'Real-time notifications', status: 'not_started',
      plans: [],
      successCriteria: ['WebSocket connection established', 'Notifications appear in real-time'],
    },
    {
      id: 'ph-6', number: '6', title: 'Deployment & polish', status: 'not_started',
      plans: [],
      successCriteria: ['Deployed to Vercel', 'Performance audit passes', 'Error tracking active'],
    },
  ],
};

const subAgents: SubAgent[] = [
  { id: 'sa-1', role: 'planner', model: 'Opus', status: 'done', phase: '3', contextPct: 42, tokensUsed: 38200 },
  { id: 'sa-2', role: 'executor', model: 'Sonnet', status: 'running', phase: '3', plan: 'PLAN-1', contextPct: 31, tokensUsed: 52800 },
  { id: 'sa-3', role: 'plan-checker', model: 'Sonnet', status: 'done', phase: '3', contextPct: 18, tokensUsed: 12400 },
  { id: 'sa-4', role: 'phase-researcher', model: 'Sonnet', status: 'idle', contextPct: 0, tokensUsed: 0 },
  { id: 'sa-5', role: 'verifier', model: 'Sonnet', status: 'idle', contextPct: 0, tokensUsed: 0 },
];

const chatHistory: ChatMessage[] = [
  { id: 'm-1', role: 'user', content: '/gsd:progress', timestamp: Date.now() - 600000, command: '/gsd:progress' },
  { id: 'm-2', role: 'system', content: `\u2501\u2501\u2501 GSD > PROJECT PROGRESS \u2501\u2501\u2501

Milestone: v1.0 MVP
Phase 3 of 6: API routes & CRUD

\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591 35% complete

Phase 1: Project scaffold & auth  \u2713
Phase 2: Database & core models   \u2713
Phase 3: API routes & CRUD        \u25C6 In progress
Phase 4: Dashboard UI              Planned
Phase 5: Real-time notifications   Not started
Phase 6: Deployment & polish       Not started

Next up: Continue executing Phase 3
\u276F /gsd:execute-phase 3`, timestamp: Date.now() - 595000 },
  { id: 'm-3', role: 'user', content: '/gsd:execute-phase 3', timestamp: Date.now() - 500000, command: '/gsd:execute-phase 3' },
  { id: 'm-4', role: 'system', content: `\u2501\u2501\u2501 GSD > EXECUTING PHASE 3 \u2501\u2501\u2501

Phase 3: API routes & CRUD
2 plans discovered, 2 waves

Wave 1: PLAN-1-api-routes.md (3 tasks)
Wave 2: PLAN-2-member-api.md (1 task, depends on Wave 1)

Spawning gsd-executor for Wave 1...`, timestamp: Date.now() - 495000 },
  { id: 'm-5', role: 'assistant', content: `[gsd-executor] Starting PLAN-1-api-routes.md

Task 1/3: Create workspace CRUD endpoints
  \u25B6 Writing api/workspaces/route.ts
  \u25B6 Writing api/workspaces/[id]/route.ts
  \u25C0 Tests: 4/4 passing
  \u2713 Committed: feat(3-1): add workspace CRUD API routes`, timestamp: Date.now() - 400000, agentRole: 'executor' },
  { id: 'm-6', role: 'assistant', content: `[gsd-executor] Task 2/3: Add input validation with Zod
  \u25C6 Thinking: Need schema definitions for create/update payloads...
  \u25B6 Writing lib/validators.ts
  \u25B6 Editing api/workspaces/route.ts
  Running verification: npm test -- --grep "validation"...`, timestamp: Date.now() - 120000, agentRole: 'executor' },
  { id: 'm-7', role: 'system', content: `\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502  \u26A0  DEVIATION: Rule 2 Auto-Applied            \u2502
\u2502  Added rate limiting to CRUD endpoints        \u2502
\u2502  (Critical functionality: abuse prevention)    \u2502
\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518`, timestamp: Date.now() - 60000 },
  { id: 'm-8', role: 'checkpoint', content: `Verification checkpoint for Task 2:

"User can submit workspace creation form with invalid data and see proper error messages"

Test this and report:`, timestamp: Date.now() - 30000,
    checkpoint: { type: 'verify', options: ['approved', 'issue: error messages not showing'] }
  },
];

const todos: Todo[] = [
  { id: 'td-1', title: 'Add rate limiting to public endpoints', area: 'api', status: 'pending' },
  { id: 'td-2', title: 'Consider WebSocket vs SSE for notifications', area: 'architecture', status: 'pending' },
  { id: 'td-3', title: 'Set up error tracking with Sentry', area: 'infra', status: 'pending' },
  { id: 'td-4', title: 'Write E2E tests for auth flow', area: 'testing', status: 'done' },
];

// ---------------------------------------------------------------------------
// GSD Commands Registry
// ---------------------------------------------------------------------------

interface GsdCommand {
  name: string;
  label: string;
  category: 'workflow' | 'milestone' | 'phase' | 'todo' | 'session' | 'debug' | 'config';
  description: string;
  args?: string;
  hot?: boolean;
}

const commands: GsdCommand[] = [
  { name: 'new-project', label: 'New Project', category: 'workflow', description: 'Initialize project: questioning \u2192 research \u2192 requirements \u2192 roadmap' },
  { name: 'discuss-phase', label: 'Discuss Phase', category: 'workflow', description: 'Gather decisions before planning', args: '[N]' },
  { name: 'plan-phase', label: 'Plan Phase', category: 'workflow', description: 'Research + plan + verify', args: '[N]' },
  { name: 'execute-phase', label: 'Execute Phase', category: 'workflow', description: 'Wave-based parallel execution', args: '<N>', hot: true },
  { name: 'verify-work', label: 'Verify Work', category: 'workflow', description: 'User acceptance testing', args: '[N]' },
  { name: 'quick', label: 'Quick Task', category: 'workflow', description: 'Ad-hoc task with GSD structure' },
  { name: 'new-milestone', label: 'New Milestone', category: 'milestone', description: 'Start new milestone cycle', args: '[name]' },
  { name: 'complete-milestone', label: 'Complete', category: 'milestone', description: 'Archive + tag release' },
  { name: 'audit-milestone', label: 'Audit', category: 'milestone', description: 'Validate completion' },
  { name: 'plan-milestone-gaps', label: 'Plan Gaps', category: 'milestone', description: 'Group gaps into phases' },
  { name: 'add-phase', label: 'Add Phase', category: 'phase', description: 'Append phase to milestone' },
  { name: 'insert-phase', label: 'Insert Phase', category: 'phase', description: 'Insert as decimal (e.g. 2.1)' },
  { name: 'remove-phase', label: 'Remove Phase', category: 'phase', description: 'Remove unstarted phase', args: '<N>' },
  { name: 'research-phase', label: 'Research', category: 'phase', description: 'Standalone research', args: '[N]' },
  { name: 'list-phase-assumptions', label: 'Assumptions', category: 'phase', description: 'Surface Claude\'s assumptions', args: '[N]' },
  { name: 'add-todo', label: 'Add Todo', category: 'todo', description: 'Capture task/idea' },
  { name: 'check-todos', label: 'Check Todos', category: 'todo', description: 'Filter + work on todos' },
  { name: 'pause-work', label: 'Pause', category: 'session', description: 'Handoff docs + WIP commit' },
  { name: 'resume-work', label: 'Resume', category: 'session', description: 'Restore from STATE.md' },
  { name: 'progress', label: 'Progress', category: 'session', description: 'Status + next action', hot: true },
  { name: 'debug', label: 'Debug', category: 'debug', description: 'Scientific-method debugging' },
  { name: 'map-codebase', label: 'Map Codebase', category: 'debug', description: 'Analyze into 7 docs' },
  { name: 'settings', label: 'Settings', category: 'config', description: '5-question config wizard' },
  { name: 'set-profile', label: 'Set Profile', category: 'config', description: 'Switch model profile', args: '<profile>' },
  { name: 'update', label: 'Update GSD', category: 'config', description: 'Update to latest version' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function roleLabel(r: AgentRole): string {
  const map: Record<AgentRole, string> = {
    'planner': 'Planner', 'executor': 'Executor', 'debugger': 'Debugger',
    'phase-researcher': 'Researcher', 'project-researcher': 'Project Researcher',
    'research-synthesizer': 'Synthesizer', 'roadmapper': 'Roadmapper',
    'codebase-mapper': 'Mapper', 'verifier': 'Verifier',
    'plan-checker': 'Plan Checker', 'integration-checker': 'Integ. Checker',
  };
  return map[r] || r;
}

function ctxColor(pct: number): string {
  if (pct < 50) return styles.ctxGreen;
  if (pct < 65) return styles.ctxYellow;
  if (pct < 80) return styles.ctxOrange;
  return styles.ctxRed;
}

function phaseIcon(s: PhaseStatus): string {
  switch (s) {
    case 'complete': return '\u2713';
    case 'executing': return '\u25C6';
    case 'planning': return '\u25CB';
    case 'discussing': return '\u2026';
    case 'verifying': return '\u2234';
    case 'deferred': return '\u2192';
    default: return '\u2022';
  }
}

function formatTs(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ---------------------------------------------------------------------------
// Sub: Chat Panel (center)
// ---------------------------------------------------------------------------

function ChatPanel({ messages, onSend }: { messages: ChatMessage[]; onSend: (msg: string) => void }) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSend(input.trim());
    setInput('');
  };

  return (
    <div className={styles.chatPanel} data-testid="gsd-chat">
      <div className={styles.chatScroll} ref={scrollRef}>
        {messages.map(msg => (
          <div key={msg.id} className={`${styles.chatMsg} ${styles[`msg${msg.role.charAt(0).toUpperCase() + msg.role.slice(1)}`]}`}>
            {msg.command && <div className={styles.msgCommand}>{msg.command}</div>}
            {msg.agentRole && <span className={styles.msgAgentBadge}>gsd-{msg.agentRole}</span>}
            {msg.checkpoint && (
              <div className={styles.checkpointBox}>
                <div className={styles.checkpointHeader}>
                  {msg.checkpoint.type === 'verify' ? '\u2611 Verification Required' :
                   msg.checkpoint.type === 'decision' ? '\u2753 Decision Required' :
                   '\u270B Action Required'}
                </div>
                {msg.checkpoint.options && (
                  <div className={styles.checkpointOptions}>
                    {msg.checkpoint.options.map((opt, i) => (
                      <button key={i} className={styles.checkpointBtn} onClick={() => onSend(opt)}>{opt}</button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <pre className={styles.msgContent}>{msg.content}</pre>
            <span className={styles.msgTime}>{formatTs(msg.timestamp)}</span>
          </div>
        ))}
      </div>
      <form className={styles.chatInputArea} onSubmit={handleSubmit}>
        <span className={styles.chatPrompt}>\u276F</span>
        <input
          className={styles.chatInput}
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="/gsd:command or type a message..."
        />
        <button type="submit" className={styles.chatSendBtn}>Send</button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub: Phase Pipeline (left sidebar)
// ---------------------------------------------------------------------------

function PhasePipeline({ ms, activePhase, onSelectPhase }: { ms: Milestone; activePhase: string; onSelectPhase: (id: string) => void }) {
  const completedCount = ms.phases.filter(p => p.status === 'complete').length;
  const pct = Math.round((completedCount / ms.phases.length) * 100);

  return (
    <div className={styles.pipelineSidebar} data-testid="gsd-pipeline">
      <div className={styles.pipelineHeader}>
        <div className={styles.milestoneName}>{ms.name}</div>
        <div className={styles.milestoneVersion}>{ms.version}</div>
      </div>
      <div className={styles.progressSection}>
        <div className={styles.progressBarWrap}>
          <div className={styles.progressBarFill} style={{ width: `${pct}%` }} />
        </div>
        <span className={styles.progressLabel}>{completedCount}/{ms.phases.length} phases \u2022 {pct}%</span>
      </div>

      <div className={styles.phaseList}>
        {ms.phases.map(phase => {
          const isActive = phase.id === activePhase;
          const tasksDone = phase.plans.reduce((s, p) => s + p.tasks.filter(t => t.status === 'done').length, 0);
          const tasksTotal = phase.plans.reduce((s, p) => s + p.tasks.length, 0);
          return (
            <div
              key={phase.id}
              className={`${styles.phaseItem} ${isActive ? styles.phaseActive : ''} ${styles[`ph${phase.status.charAt(0).toUpperCase() + phase.status.replace(/_/g, '').slice(1)}`] || ''}`}
              onClick={() => onSelectPhase(phase.id)}
            >
              <span className={styles.phaseIcon}>{phaseIcon(phase.status)}</span>
              <div className={styles.phaseInfo}>
                <div className={styles.phaseTitle}>
                  <span className={styles.phaseNum}>{phase.number}</span>
                  {phase.title}
                </div>
                <div className={styles.phaseMeta}>
                  <span className={styles.phaseStatusLabel}>{phase.status.replace(/_/g, ' ')}</span>
                  {tasksTotal > 0 && <span className={styles.phaseTaskCount}>{tasksDone}/{tasksTotal}</span>}
                  {phase.plans.length > 0 && <span className={styles.phasePlanCount}>{phase.plans.length} plans</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles.todoSection} data-testid="gsd-todos">
        <div className={styles.todoHeader}>
          <span>Todos</span>
          <span className={styles.todoBadge}>{todos.filter(t => t.status === 'pending').length}</span>
        </div>
        {todos.filter(t => t.status === 'pending').map(td => (
          <div key={td.id} className={styles.todoItem}>
            <span className={styles.todoCheck}>\u25CB</span>
            <span className={styles.todoText}>{td.title}</span>
            <span className={styles.todoArea}>{td.area}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub: Right Panel — Agent Fleet + Phase Detail + Commands
// ---------------------------------------------------------------------------

function AgentFleet({ agents: ags }: { agents: SubAgent[] }) {
  return (
    <div className={styles.agentFleet} data-testid="gsd-agents">
      <div className={styles.fleetHeader}>Agent Fleet</div>
      <div className={styles.fleetSubtext}>11 agent types \u2022 Balanced profile (Opus/Sonnet)</div>
      {ags.map(a => (
        <div key={a.id} className={`${styles.agentRow} ${styles[`as${a.status.charAt(0).toUpperCase() + a.status.slice(1)}`]}`}>
          <span className={`${styles.agentDot} ${styles[`dot${a.status.charAt(0).toUpperCase() + a.status.slice(1)}`]}`} />
          <span className={styles.agentRoleName}>gsd-{a.role}</span>
          <span className={styles.agentModelTag}>{a.model}</span>
          {a.status === 'running' && (
            <span className={styles.agentCtx}>
              <span className={styles.ctxBarOuter}>
                {Array.from({ length: 10 }, (_, i) => (
                  <span key={i} className={`${styles.ctxSeg} ${i < Math.ceil(a.contextPct / 10) ? ctxColor(a.contextPct) : styles.ctxEmpty}`} />
                ))}
              </span>
              <span className={styles.ctxPct}>{a.contextPct}%</span>
            </span>
          )}
          {a.phase && <span className={styles.agentPhaseTag}>P{a.phase}</span>}
          <span className={`${styles.agentStatusLabel} ${styles[`sl${a.status}`]}`}>{a.status}</span>
        </div>
      ))}
      <div className={styles.fleetIdleList}>
        <div className={styles.fleetIdleLabel}>Available agents (not spawned)</div>
        {(['debugger', 'project-researcher', 'research-synthesizer', 'roadmapper', 'codebase-mapper', 'integration-checker'] as AgentRole[]).map(role => (
          <div key={role} className={styles.agentRowIdle}>
            <span className={`${styles.agentDot} ${styles.dotIdle}`} />
            <span className={styles.agentRoleName}>gsd-{role}</span>
            <span className={styles.agentModelTag}>{role === 'codebase-mapper' ? 'Haiku' : 'Sonnet'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PhaseDetail({ phase }: { phase: Phase | undefined }) {
  if (!phase) return null;
  return (
    <div className={styles.phaseDetail} data-testid="gsd-phase-detail">
      <div className={styles.phaseDetailHeader}>
        <span className={styles.phaseDetailNum}>Phase {phase.number}</span>
        <span className={styles.phaseDetailTitle}>{phase.title}</span>
        <span className={`${styles.phaseDetailStatus} ${styles[`pds${phase.status.replace(/_/g, '')}`]}`}>{phase.status.replace(/_/g, ' ')}</span>
      </div>
      {phase.context && (
        <div className={styles.contextBlock}>
          <div className={styles.contextLabel}>CONTEXT.md</div>
          <div className={styles.contextText}>{phase.context}</div>
        </div>
      )}
      {phase.successCriteria.length > 0 && (
        <div className={styles.criteriaBlock}>
          <div className={styles.criteriaLabel}>Success Criteria</div>
          {phase.successCriteria.map((c, i) => (
            <div key={i} className={styles.criteriaItem}>
              <span className={styles.criteriaCheck}>{phase.status === 'complete' ? '\u2713' : '\u25CB'}</span>
              {c}
            </div>
          ))}
        </div>
      )}
      {phase.plans.length > 0 && (
        <div className={styles.plansBlock}>
          <div className={styles.plansLabel}>Plans</div>
          {phase.plans.map(plan => (
            <div key={plan.id} className={styles.planCard}>
              <div className={styles.planHeader}>
                <span className={styles.planName}>{plan.name}</span>
                <span className={styles.planWave}>W{plan.wave}</span>
                <span className={`${styles.planStatus} ${styles[`ps${plan.status}`]}`}>{plan.status}</span>
              </div>
              <div className={styles.taskList}>
                {plan.tasks.map(task => (
                  <div key={task.id} className={`${styles.taskRow} ${styles[`tr${task.status}`]}`}>
                    <span className={styles.taskDot}>
                      {task.status === 'done' ? '\u2713' : task.status === 'running' ? '\u25C6' : task.status === 'failed' ? '\u2716' : '\u25CB'}
                    </span>
                    <span className={styles.taskTitle}>{task.title}</span>
                    {task.type !== 'auto' && <span className={styles.taskTypeTag}>{task.type.replace('checkpoint:', '\u2611 ')}</span>}
                    {task.commitMsg && <span className={styles.taskCommit} title={task.commitMsg}>\u2713</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {phase.plans.length === 0 && phase.status !== 'complete' && (
        <div className={styles.noPlansMsg}>
          No plans yet. Run <code>/gsd:plan-phase {phase.number}</code> to create plans.
        </div>
      )}
    </div>
  );
}

function CommandPalette({ onRunCommand }: { onRunCommand: (cmd: string) => void }) {
  const [open, setOpen] = useState(true);
  const categories = useMemo(() => {
    const map = new Map<string, GsdCommand[]>();
    for (const cmd of commands) {
      const list = map.get(cmd.category) || [];
      list.push(cmd);
      map.set(cmd.category, list);
    }
    return map;
  }, []);

  const catLabels: Record<string, string> = {
    workflow: 'Workflow', milestone: 'Milestone', phase: 'Phase',
    todo: 'Todos', session: 'Session', debug: 'Debug', config: 'Config',
  };

  return (
    <div className={styles.cmdPalette} data-testid="gsd-commands">
      <button className={styles.cmdToggle} onClick={() => setOpen(!open)}>
        {open ? '\u2715 Hide Commands' : '\u276F Commands (25)'}
      </button>
      {open && (
        <div className={styles.cmdGrid}>
          {Array.from(categories.entries()).map(([cat, cmds]) => (
            <div key={cat} className={styles.cmdCategory}>
              <div className={styles.cmdCatLabel}>{catLabels[cat] || cat}</div>
              <div className={styles.cmdBtnGroup}>
                {cmds.map(cmd => (
                  <button
                    key={cmd.name}
                    className={`${styles.cmdBtn} ${cmd.hot ? styles.cmdHot : ''}`}
                    onClick={() => { onRunCommand(`/gsd:${cmd.name}`); }}
                    title={cmd.description}
                  >
                    {cmd.label}
                    {cmd.hot && <span className={styles.cmdHotDot} />}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub: Status Bar
// ---------------------------------------------------------------------------

function StatusBar({ cfg }: { cfg: GsdConfig }) {
  const activeAgent = subAgents.find(a => a.status === 'running');
  const ctxPct = activeAgent?.contextPct ?? 0;
  return (
    <div className={styles.statusBar} data-testid="gsd-statusbar">
      <span className={styles.sbModel}>
        {cfg.modelProfile === 'quality' ? 'Opus' : cfg.modelProfile === 'balanced' ? 'Opus / Sonnet' : 'Sonnet / Haiku'}
      </span>
      <span className={styles.sbSep}>\u2022</span>
      <span className={styles.sbTask}>
        {activeAgent ? `gsd-${activeAgent.role}: Phase ${activeAgent.phase || '?'}` : 'Idle'}
      </span>
      <span className={styles.sbSep}>\u2022</span>
      <span className={styles.sbDir}>~/code/my-saas-app</span>
      <span className={styles.sbSep}>\u2022</span>
      <span className={styles.sbCtx}>
        CTX{' '}
        <span className={styles.ctxBarOuter}>
          {Array.from({ length: 10 }, (_, i) => (
            <span key={i} className={`${styles.ctxSeg} ${i < Math.ceil(ctxPct / 10) ? ctxColor(ctxPct) : styles.ctxEmpty}`} />
          ))}
        </span>
        {' '}{ctxPct}%
      </span>
      <span className={styles.sbRight}>
        <span className={styles.sbProfile}>{cfg.modelProfile}</span>
        <span className={styles.sbMode}>{cfg.mode}</span>
        <span className={styles.sbBranch}>gsd/phase-3-api-routes</span>
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main: GSD
// ---------------------------------------------------------------------------

export default function GSD() {
  const [messages, setMessages] = useState(chatHistory);
  const [activePhaseId, setActivePhaseId] = useState('ph-3');
  const [rightTab, setRightTab] = useState<'detail' | 'agents'>('detail');

  const activePhase = useMemo(
    () => milestone.phases.find(p => p.id === activePhaseId),
    [activePhaseId]
  );

  const handleSend = useCallback((text: string) => {
    const userMsg: ChatMessage = {
      id: `m-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
      command: text.startsWith('/gsd:') ? text : undefined,
    };
    setMessages(prev => [...prev, userMsg]);

    setTimeout(() => {
      const response: ChatMessage = {
        id: `m-${Date.now() + 1}`,
        role: 'assistant',
        content: text.startsWith('/gsd:')
          ? `Processing ${text}...\n\nThis is a UI mockup \u2014 in the real system, this would spawn the appropriate GSD subagent with a fresh 200k context window.`
          : `I understand. In the real GSD system, I would process this within the current workflow context.`,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, response]);
    }, 300);
  }, []);

  return (
    <div className={styles.shell} data-testid="gsd-shell">
      <div className={styles.topbar} data-testid="gsd-topbar">
        <div className={styles.topLeft}>
          <span className={styles.gsdLogo}>GSD</span>
          <span className={styles.gsdVersion}>v1.12</span>
          <span className={styles.topSep} />
          <span className={styles.topMilestone}>{milestone.name}</span>
          <span className={styles.topPhaseLabel}>Phase {milestone.phases.find(p => p.status === 'executing')?.number || '?'}/{milestone.phases.length}</span>
        </div>
        <div className={styles.topCenter}>
          <span className={styles.topChip}><span className={styles.chipDotRun} /> {subAgents.filter(a => a.status === 'running').length} running</span>
          <span className={styles.topChip}><span className={styles.chipDotDone} /> {milestone.phases.filter(p => p.status === 'complete').length} phases done</span>
        </div>
        <div className={styles.topRight}>
          <button className={styles.topBtn} onClick={() => handleSend('/gsd:progress')}>Progress</button>
          <button className={styles.topBtn} onClick={() => handleSend('/gsd:pause-work')}>Pause</button>
          <button className={styles.topBtnPrimary} onClick={() => handleSend('/gsd:quick')}>Quick Task</button>
        </div>
      </div>

      <div className={styles.body}>
        <PhasePipeline ms={milestone} activePhase={activePhaseId} onSelectPhase={setActivePhaseId} />
        <ChatPanel messages={messages} onSend={handleSend} />
        <div className={styles.rightPanel} data-testid="gsd-right">
          <div className={styles.rightTabs}>
            <button className={`${styles.rightTab} ${rightTab === 'detail' ? styles.rightTabActive : ''}`} onClick={() => setRightTab('detail')}>Phase</button>
            <button className={`${styles.rightTab} ${rightTab === 'agents' ? styles.rightTabActive : ''}`} onClick={() => setRightTab('agents')}>Agents ({subAgents.length})</button>
          </div>
          <div className={styles.rightContent}>
            {rightTab === 'detail' ? <PhaseDetail phase={activePhase} /> : <AgentFleet agents={subAgents} />}
          </div>
          <CommandPalette onRunCommand={handleSend} />
        </div>
      </div>

      <StatusBar cfg={config} />
    </div>
  );
}
