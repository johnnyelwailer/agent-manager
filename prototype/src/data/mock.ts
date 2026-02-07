import type {
  ContextPrimitive,
  StrategyPrimitive,
  ExecutionPrimitive,
  VerificationPrimitive,
  AgentInfo,
} from '../types/primitives';

const now = Date.now();
const mins = (n: number) => now - n * 60_000;

// --- Agents ---

export const agents: AgentInfo[] = [
  {
    id: 'agent-1',
    name: 'Claude Sonnet',
    model: 'claude-sonnet-4-5-20250929',
    status: 'running',
    sessionId: 'sess-abc-123',
    currentTask: 'exec-2',
    costUsd: 0.42,
    tokensUsed: 128_400,
  },
  {
    id: 'agent-2',
    name: 'Claude Opus',
    model: 'claude-opus-4-6',
    status: 'idle',
    sessionId: 'sess-def-456',
    costUsd: 1.87,
    tokensUsed: 52_300,
  },
  {
    id: 'agent-3',
    name: 'Claude Haiku',
    model: 'claude-haiku-4-5-20251001',
    status: 'errored',
    sessionId: 'sess-ghi-789',
    currentTask: 'exec-5',
    costUsd: 0.03,
    tokensUsed: 9_800,
  },
];

// --- Context ---

export const contexts: ContextPrimitive[] = [
  {
    id: 'ctx-1',
    title: 'Architecture Overview',
    content:
      'The Universal Agent Host is a desktop GUI that orchestrates and observes existing AI agent runtimes. It renders generic primitives: Kanban, Tree, Wiki views.',
    sourceFile: 'RESEARCH_PLAN.md',
    tags: ['architecture', 'overview'],
    lastModified: mins(120),
  },
  {
    id: 'ctx-2',
    title: 'Claude Agent SDK Reference',
    content:
      'TypeScript SDK v0.2.34 — query() function with streaming, hooks system (12 event types), session management, tool permission control.',
    sourceFile: 'docs/claude-sdk.md',
    tags: ['sdk', 'claude', 'reference'],
    lastModified: mins(60),
  },
  {
    id: 'ctx-3',
    title: 'Adapter Protocol Spec',
    content:
      'Native TS modules (v1). Adapters declare capabilities via manifest, handle lifecycle hooks (activate/deactivate), process file and agent events.',
    sourceFile: 'docs/adapter-protocol.md',
    tags: ['protocol', 'adapter', 'spec'],
    lastModified: mins(45),
  },
  {
    id: 'ctx-4',
    title: 'File Locking Strategy',
    content:
      'Advisory file-level locking using .agent-lock/ directory. Agents check lock before writing. FS watcher + debounced re-parse for user-editable files.',
    sourceFile: 'docs/file-locking.md',
    tags: ['concurrency', 'locking'],
    lastModified: mins(30),
  },
];

// --- Strategy ---

export const strategies: StrategyPrimitive[] = [
  {
    id: 'strat-1',
    title: 'Phase 1: Core Infrastructure',
    status: 'active',
    sourceFile: 'PLAN.md',
    metadata: { priority: 'high' },
    children: [
      {
        id: 'strat-1a',
        title: 'Set up Tauri 2.x shell',
        status: 'completed',
        sourceFile: 'PLAN.md',
        sourceRange: { start: 10, end: 25 },
        metadata: {},
        children: [],
      },
      {
        id: 'strat-1b',
        title: 'Implement FS watcher pipeline',
        status: 'active',
        sourceFile: 'PLAN.md',
        sourceRange: { start: 26, end: 40 },
        metadata: { assignee: 'agent-1' },
        children: [
          {
            id: 'strat-1b-i',
            title: 'File change detection',
            status: 'completed',
            sourceFile: 'PLAN.md',
            metadata: {},
            children: [],
          },
          {
            id: 'strat-1b-ii',
            title: 'Debounced re-parse logic',
            status: 'active',
            sourceFile: 'PLAN.md',
            metadata: {},
            children: [],
          },
        ],
      },
      {
        id: 'strat-1c',
        title: 'Build normalization layer',
        status: 'draft',
        sourceFile: 'PLAN.md',
        sourceRange: { start: 41, end: 55 },
        metadata: { estimatedLoc: 300 },
        children: [],
      },
    ],
  },
  {
    id: 'strat-2',
    title: 'Phase 2: Agent Integration',
    status: 'draft',
    sourceFile: 'PLAN.md',
    metadata: { priority: 'high' },
    children: [
      {
        id: 'strat-2a',
        title: 'Claude SDK adapter',
        status: 'draft',
        sourceFile: 'PLAN.md',
        metadata: {},
        children: [],
      },
      {
        id: 'strat-2b',
        title: 'Session management',
        status: 'draft',
        sourceFile: 'PLAN.md',
        metadata: {},
        children: [],
      },
      {
        id: 'strat-2c',
        title: 'Multi-agent orchestration',
        status: 'draft',
        sourceFile: 'PLAN.md',
        metadata: {},
        children: [],
      },
    ],
  },
  {
    id: 'strat-3',
    title: 'Phase 3: UI Polish',
    status: 'draft',
    sourceFile: 'PLAN.md',
    metadata: { priority: 'medium' },
    children: [
      {
        id: 'strat-3a',
        title: 'Generative widget system',
        status: 'draft',
        sourceFile: 'PLAN.md',
        metadata: {},
        children: [],
      },
      {
        id: 'strat-3b',
        title: 'Theme and accessibility',
        status: 'draft',
        sourceFile: 'PLAN.md',
        metadata: {},
        children: [],
      },
    ],
  },
];

// --- Executions ---

export const executions: ExecutionPrimitive[] = [
  {
    id: 'exec-1',
    title: 'Set up Tauri project scaffold',
    status: 'completed',
    assignedAgent: 'agent-2',
    parentStrategyId: 'strat-1a',
    artifacts: ['src-tauri/Cargo.toml', 'src-tauri/src/main.rs', 'tauri.conf.json'],
    startedAt: mins(180),
    completedAt: mins(160),
    costUsd: 0.23,
    log: [
      { timestamp: mins(180), type: 'text', content: 'Analyzing project requirements...' },
      {
        timestamp: mins(178),
        type: 'tool_call',
        toolName: 'Bash',
        content: 'npm create tauri-app@latest',
      },
      {
        timestamp: mins(177),
        type: 'tool_result',
        content: 'Project scaffolded successfully',
      },
      {
        timestamp: mins(170),
        type: 'tool_call',
        toolName: 'Edit',
        content: 'Configuring tauri.conf.json with app metadata',
      },
      {
        timestamp: mins(165),
        type: 'tool_result',
        content: 'Configuration updated',
      },
      { timestamp: mins(160), type: 'text', content: 'Tauri scaffold complete. All files written.' },
    ],
  },
  {
    id: 'exec-2',
    title: 'Implement file watcher with debounce',
    status: 'running',
    assignedAgent: 'agent-1',
    parentStrategyId: 'strat-1b-ii',
    artifacts: ['src/watchers/file-watcher.ts'],
    startedAt: mins(15),
    costUsd: 0.42,
    log: [
      { timestamp: mins(15), type: 'text', content: 'Starting file watcher implementation...' },
      {
        timestamp: mins(14),
        type: 'tool_call',
        toolName: 'Read',
        content: 'Reading existing watcher code at src/watchers/index.ts',
      },
      { timestamp: mins(13), type: 'tool_result', content: 'File read: 45 lines' },
      {
        timestamp: mins(12),
        type: 'thinking',
        content:
          'Need to add debounce logic. The current implementation fires on every FS event which causes excessive re-parsing. Using a 150ms debounce window.',
      },
      {
        timestamp: mins(10),
        type: 'tool_call',
        toolName: 'Edit',
        content: 'Adding debounce wrapper to onFileChange handler',
      },
      {
        timestamp: mins(9),
        type: 'tool_result',
        content: 'Edit applied: src/watchers/file-watcher.ts',
      },
      {
        timestamp: mins(5),
        type: 'tool_call',
        toolName: 'Bash',
        content: 'npm test -- --grep "file-watcher"',
      },
      {
        timestamp: mins(4),
        type: 'tool_result',
        content: '3 tests passed, 1 failing: "should coalesce rapid events"',
      },
      {
        timestamp: mins(2),
        type: 'tool_call',
        toolName: 'Edit',
        content: 'Fixing debounce timer reset logic',
      },
    ],
  },
  {
    id: 'exec-3',
    title: 'Write adapter protocol types',
    status: 'queued',
    parentStrategyId: 'strat-1c',
    artifacts: [],
    log: [],
  },
  {
    id: 'exec-4',
    title: 'Implement Claude SDK event normalization',
    status: 'queued',
    parentStrategyId: 'strat-2a',
    artifacts: [],
    log: [],
  },
  {
    id: 'exec-5',
    title: 'Set up advisory file locking',
    status: 'failed',
    assignedAgent: 'agent-3',
    parentStrategyId: 'strat-1b',
    artifacts: ['src/locking/advisory-lock.ts'],
    startedAt: mins(90),
    completedAt: mins(75),
    costUsd: 0.03,
    log: [
      { timestamp: mins(90), type: 'text', content: 'Implementing advisory file locks...' },
      {
        timestamp: mins(88),
        type: 'tool_call',
        toolName: 'Write',
        content: 'Creating src/locking/advisory-lock.ts',
      },
      { timestamp: mins(85), type: 'tool_result', content: 'File created' },
      {
        timestamp: mins(80),
        type: 'tool_call',
        toolName: 'Bash',
        content: 'npm test -- --grep "advisory-lock"',
      },
      {
        timestamp: mins(78),
        type: 'error',
        content: 'Error: EACCES permission denied, mkdir \'.agent-lock\'',
      },
      {
        timestamp: mins(75),
        type: 'error',
        content: 'Task failed: unable to create lock directory in project root',
      },
    ],
  },
  {
    id: 'exec-6',
    title: 'Add git auto-snapshot before agent runs',
    status: 'paused',
    assignedAgent: 'agent-2',
    parentStrategyId: 'strat-1b',
    artifacts: ['src/safety/git-snapshot.ts'],
    startedAt: mins(50),
    costUsd: 0.15,
    log: [
      { timestamp: mins(50), type: 'text', content: 'Setting up git snapshot system...' },
      {
        timestamp: mins(48),
        type: 'tool_call',
        toolName: 'Bash',
        content: 'git branch --list "agent-snapshot-*"',
      },
      { timestamp: mins(47), type: 'tool_result', content: 'No existing snapshot branches' },
      { timestamp: mins(45), type: 'text', content: 'Paused: waiting for file locking to be resolved first.' },
    ],
  },
];

// --- Verifications ---

export const verifications: VerificationPrimitive[] = [
  {
    id: 'ver-1',
    executionId: 'exec-1',
    type: 'test_run',
    status: 'passed',
    details: '12/12 tests passed. Coverage: 87%.',
    sourceFile: 'test-results/exec-1.json',
  },
  {
    id: 'ver-2',
    executionId: 'exec-1',
    type: 'diff_review',
    status: 'passed',
    details: '+342 -0 lines across 4 files. Clean scaffold, no issues.',
  },
  {
    id: 'ver-3',
    executionId: 'exec-2',
    type: 'test_run',
    status: 'needs_review',
    details: '3/4 tests passed. 1 failing: "should coalesce rapid events".',
    sourceFile: 'test-results/exec-2.json',
  },
  {
    id: 'ver-4',
    executionId: 'exec-2',
    type: 'lint',
    status: 'passed',
    details: '0 errors, 2 warnings (unused import, any type).',
  },
  {
    id: 'ver-5',
    executionId: 'exec-5',
    type: 'test_run',
    status: 'failed',
    details: 'EACCES: permission denied. Lock directory cannot be created.',
    sourceFile: 'test-results/exec-5.json',
  },
  {
    id: 'ver-6',
    executionId: 'exec-6',
    type: 'human_approval',
    status: 'pending',
    details: 'Awaiting review: git snapshot strategy before agent modification runs.',
  },
];
