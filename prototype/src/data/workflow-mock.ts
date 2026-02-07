import type {
  Project,
  Repo,
  Issue,
  Agent,
  Task,
  VerificationPipeline,
  VerificationStage,
  VerificationStageStatus,
  VerificationMetadata,
  TaskLogEntry,
} from '../types/workflow';

const now = Date.now();
const mins = (n: number) => now - n * 60_000;
const hours = (n: number) => now - n * 3_600_000;
const days = (n: number) => now - n * 86_400_000;

// ---------------------------------------------------------------------------
// Repos
// ---------------------------------------------------------------------------

export const repos: Repo[] = [
  {
    id: 'repo-frontend',
    name: 'agent-manager',
    path: '~/code/agent-manager',
    remoteUrl: 'git@github.com:acme/agent-manager.git',
    defaultBranch: 'main',
  },
  {
    id: 'repo-runtime',
    name: 'agent-runtime',
    path: '~/code/agent-runtime',
    remoteUrl: 'git@github.com:acme/agent-runtime.git',
    defaultBranch: 'main',
  },
  {
    id: 'repo-sdk',
    name: 'agent-sdk',
    path: '~/code/agent-sdk',
    remoteUrl: 'git@github.com:acme/agent-sdk.git',
    defaultBranch: 'main',
  },
];

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

export const project: Project = {
  id: 'proj-1',
  name: 'Universal Agent Host',
  repos,
  externalLinks: [
    {
      system: 'jira',
      projectKey: 'UAH',
      baseUrl: 'https://acme.atlassian.net',
    },
    {
      system: 'github',
      projectKey: 'acme/agent-manager',
      baseUrl: 'https://github.com',
    },
  ],
};

// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------

export const agents: Agent[] = [
  {
    id: 'agent-sonnet',
    name: 'Claude Sonnet',
    model: 'claude-sonnet-4-5-20250929',
    status: 'running',
    currentTaskId: 'task-1',
    costUsd: 0.42,
    tokensUsed: 128_400,
    capabilities: ['code', 'review', 'plan'],
  },
  {
    id: 'agent-opus',
    name: 'Claude Opus',
    model: 'claude-opus-4-6',
    status: 'running',
    currentTaskId: 'task-6',
    costUsd: 1.87,
    tokensUsed: 52_300,
    capabilities: ['code', 'review', 'plan', 'architect'],
  },
  {
    id: 'agent-haiku',
    name: 'Claude Haiku',
    model: 'claude-haiku-4-5-20251001',
    status: 'idle',
    costUsd: 0.08,
    tokensUsed: 31_200,
    capabilities: ['code', 'lint', 'test'],
  },
];

// ---------------------------------------------------------------------------
// Verification pipeline builder
// ---------------------------------------------------------------------------

interface PipelineSpec {
  prechecks: {
    status: VerificationStageStatus;
    summary?: string;
    metadata?: VerificationMetadata;
  };
  aiReview: {
    status: VerificationStageStatus;
    summary?: string;
    metadata?: VerificationMetadata;
  };
  pr: {
    status: VerificationStageStatus;
    summary?: string;
    metadata?: VerificationMetadata;
  };
  approval: {
    status: VerificationStageStatus;
    summary?: string;
    metadata?: VerificationMetadata;
  };
}

function makePipeline(spec: PipelineSpec): VerificationPipeline {
  const stages: VerificationStage[] = [
    {
      id: 'vs-prechecks',
      type: 'prechecks',
      label: 'Prechecks',
      auto: true,
      status: spec.prechecks.status,
      summary: spec.prechecks.summary,
      metadata: spec.prechecks.metadata,
      startedAt: spec.prechecks.status !== 'pending' ? mins(8) : undefined,
      completedAt: ['passed', 'failed', 'warning'].includes(spec.prechecks.status) ? mins(6) : undefined,
    },
    {
      id: 'vs-ai-review',
      type: 'ai_review',
      label: 'AI Review',
      auto: true,
      status: spec.aiReview.status,
      summary: spec.aiReview.summary,
      metadata: spec.aiReview.metadata,
      startedAt: spec.aiReview.status !== 'pending' ? mins(5) : undefined,
      completedAt: ['passed', 'failed', 'warning'].includes(spec.aiReview.status) ? mins(4) : undefined,
    },
    {
      id: 'vs-pr',
      type: 'pr',
      label: 'PR',
      auto: true,
      status: spec.pr.status,
      summary: spec.pr.summary,
      metadata: spec.pr.metadata,
      startedAt: spec.pr.status !== 'pending' ? mins(3) : undefined,
      completedAt: ['passed', 'failed'].includes(spec.pr.status) ? mins(2) : undefined,
    },
    {
      id: 'vs-approval',
      type: 'approval',
      label: 'Approval',
      auto: false,
      status: spec.approval.status,
      summary: spec.approval.summary,
      metadata: spec.approval.metadata,
      startedAt: spec.approval.status !== 'pending' ? mins(1) : undefined,
      completedAt: ['passed', 'failed'].includes(spec.approval.status) ? now : undefined,
    },
  ];
  return { stages };
}

// Shorthand for an all-pending pipeline
function pendingPipeline(): VerificationPipeline {
  return makePipeline({
    prechecks: { status: 'pending' },
    aiReview: { status: 'pending' },
    pr: { status: 'pending' },
    approval: { status: 'pending' },
  });
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

const task1Log: TaskLogEntry[] = [
  { timestamp: mins(15), type: 'text', content: 'Starting file watcher debounce implementation...' },
  { timestamp: mins(14), type: 'tool_call', toolName: 'Read', repoId: 'repo-runtime', content: 'Reading src/watchers/index.ts' },
  { timestamp: mins(13), type: 'tool_result', content: 'File read: 45 lines, existing watcher fires on every FS event' },
  { timestamp: mins(12), type: 'thinking', content: 'Need debounce logic. Current impl fires on every FS event causing excessive re-parsing. Using 150ms window.' },
  { timestamp: mins(10), type: 'tool_call', toolName: 'Edit', repoId: 'repo-runtime', content: 'Adding debounce wrapper to onFileChange handler' },
  { timestamp: mins(9), type: 'tool_result', content: 'Edit applied: src/watchers/file-watcher.ts' },
  { timestamp: mins(5), type: 'tool_call', toolName: 'Bash', repoId: 'repo-runtime', content: 'npm test -- --grep "file-watcher"' },
  { timestamp: mins(4), type: 'tool_result', content: '3 tests passed, 1 failing: "should coalesce rapid events"' },
  { timestamp: mins(2), type: 'tool_call', toolName: 'Edit', repoId: 'repo-runtime', content: 'Fixing debounce timer reset logic' },
];

const tasks: Task[] = [
  // --- UAH-42: File watcher pipeline ---
  {
    id: 'task-1',
    issueId: 'issue-1',
    title: 'Add debounce logic to file watcher',
    description: 'Implement 150ms debounce window for FS events to prevent excessive re-parsing',
    status: 'running',
    repos: [{
      repoId: 'repo-runtime',
      branch: 'feat/UAH-42-file-watcher-debounce',
      baseBranch: 'main',
      filesChanged: ['src/watchers/file-watcher.ts', 'src/watchers/index.ts'],
      additions: 47,
      deletions: 12,
    }],
    assignedAgent: 'agent-sonnet',
    verification: makePipeline({
      prechecks: {
        status: 'warning',
        summary: '3/4 tests, lint ok, types ok',
        metadata: { lintOk: true, typecheckOk: true, testsPassed: 3, testsFailed: 1, testsTotal: 4, coverage: 78, buildOk: true },
      },
      aiReview: { status: 'pending' },
      pr: { status: 'pending' },
      approval: { status: 'pending' },
    }),
    log: task1Log,
    costUsd: 0.42,
    tokensUsed: 128_400,
    createdAt: mins(20),
    startedAt: mins(15),
  },
  {
    id: 'task-2',
    issueId: 'issue-1',
    title: 'Update SDK event types for file change events',
    description: 'Add FileChangeEvent to agent-sdk and update runtime to emit typed events',
    status: 'queued',
    repos: [
      { repoId: 'repo-sdk', branch: 'feat/UAH-42-file-change-types', baseBranch: 'main', filesChanged: [], additions: 0, deletions: 0 },
      { repoId: 'repo-runtime', branch: 'feat/UAH-42-file-change-types', baseBranch: 'main', filesChanged: [], additions: 0, deletions: 0 },
    ],
    verification: pendingPipeline(),
    log: [],
    costUsd: 0,
    tokensUsed: 0,
    createdAt: mins(18),
  },

  // --- UAH-38: File locking (failed) ---
  {
    id: 'task-3',
    issueId: 'issue-2',
    title: 'Create advisory lock directory mechanism',
    description: 'Implement .agent-lock/ directory for advisory file-level locking',
    status: 'failed',
    repos: [{
      repoId: 'repo-runtime',
      branch: 'feat/UAH-38-advisory-locks',
      baseBranch: 'main',
      filesChanged: ['src/locking/advisory-lock.ts'],
      additions: 89,
      deletions: 0,
    }],
    assignedAgent: 'agent-haiku',
    verification: makePipeline({
      prechecks: {
        status: 'failed',
        summary: '0/3 tests, EACCES error',
        metadata: { lintOk: true, typecheckOk: true, testsPassed: 0, testsFailed: 3, testsTotal: 3, buildOk: false },
      },
      aiReview: { status: 'skipped' },
      pr: { status: 'skipped' },
      approval: { status: 'skipped' },
    }),
    log: [
      { timestamp: mins(90), type: 'text', content: 'Implementing advisory file locks...' },
      { timestamp: mins(88), type: 'tool_call', toolName: 'Write', repoId: 'repo-runtime', content: 'Creating src/locking/advisory-lock.ts' },
      { timestamp: mins(80), type: 'tool_call', toolName: 'Bash', repoId: 'repo-runtime', content: 'npm test -- --grep "advisory-lock"' },
      { timestamp: mins(78), type: 'error', content: 'Error: EACCES permission denied, mkdir \'.agent-lock\'' },
      { timestamp: mins(75), type: 'error', content: 'Task failed: unable to create lock directory in project root' },
    ],
    costUsd: 0.03,
    tokensUsed: 9_800,
    createdAt: hours(2),
    startedAt: mins(90),
    completedAt: mins(75),
  },

  // --- UAH-51: Git snapshot (in review — all checks passed, PR open, awaiting human) ---
  {
    id: 'task-4',
    issueId: 'issue-3',
    title: 'Create git snapshot before agent writes',
    description: 'Auto-create a git branch snapshot before any agent modification run for safety rollback',
    status: 'review',
    repos: [{
      repoId: 'repo-runtime',
      branch: 'feat/UAH-51-git-snapshot',
      baseBranch: 'main',
      filesChanged: ['src/safety/git-snapshot.ts', 'src/safety/index.ts', 'test/safety/git-snapshot.test.ts'],
      additions: 156,
      deletions: 8,
    }],
    assignedAgent: 'agent-opus',
    verification: makePipeline({
      prechecks: {
        status: 'passed',
        summary: '8/8 tests, 91% cov, build ok',
        metadata: { lintOk: true, typecheckOk: true, testsPassed: 8, testsFailed: 0, testsTotal: 8, coverage: 91, buildOk: true },
      },
      aiReview: {
        status: 'passed',
        summary: 'Clean — no issues found',
        metadata: { reviewSeverity: 'clean', reviewFindings: [], reviewSuggestions: ['Consider adding a max-snapshots limit to avoid branch proliferation'] },
      },
      pr: {
        status: 'passed',
        summary: 'PR #87 open',
        metadata: { prUrl: 'https://github.com/acme/agent-runtime/pull/87', prNumber: 87, prStatus: 'open' },
      },
      approval: {
        status: 'pending',
        summary: 'Awaiting review from alice, bob',
        metadata: { reviewers: ['alice', 'bob'], approvals: 0 },
      },
    }),
    log: [
      { timestamp: hours(1), type: 'text', content: 'Setting up git snapshot system...' },
      { timestamp: mins(55), type: 'tool_call', toolName: 'Write', repoId: 'repo-runtime', content: 'Creating src/safety/git-snapshot.ts' },
      { timestamp: mins(50), type: 'tool_result', content: 'File created: 112 lines' },
      { timestamp: mins(45), type: 'tool_call', toolName: 'Write', repoId: 'repo-runtime', content: 'Creating test/safety/git-snapshot.test.ts' },
      { timestamp: mins(42), type: 'tool_call', toolName: 'Bash', repoId: 'repo-runtime', content: 'npm test -- --grep "git-snapshot"' },
      { timestamp: mins(40), type: 'tool_result', content: '8/8 tests passed' },
      { timestamp: mins(35), type: 'milestone', content: 'All checks passed. PR #87 created.' },
    ],
    costUsd: 0.65,
    tokensUsed: 41_200,
    createdAt: hours(1.5),
    startedAt: hours(1),
    completedAt: mins(30),
  },

  // --- UAH-55: Claude SDK adapter (planning phase, no work started) ---
  {
    id: 'task-5',
    issueId: 'issue-4',
    title: 'Implement Claude SDK adapter core',
    description: 'Build the adapter that translates Claude Agent SDK events into normalized host events',
    status: 'planning',
    repos: [
      { repoId: 'repo-runtime', branch: 'feat/UAH-55-claude-adapter', baseBranch: 'main', filesChanged: [], additions: 0, deletions: 0 },
      { repoId: 'repo-sdk', branch: 'feat/UAH-55-claude-adapter', baseBranch: 'main', filesChanged: [], additions: 0, deletions: 0 },
    ],
    verification: pendingPipeline(),
    log: [],
    costUsd: 0,
    tokensUsed: 0,
    createdAt: mins(10),
  },

  // --- UAH-61: Widget system (actively running, prechecks in progress) ---
  {
    id: 'task-6',
    issueId: 'issue-5',
    title: 'Build generative widget framework',
    description: 'Create the extensible widget system for the dashboard, allowing agents to render custom UI',
    status: 'running',
    repos: [{
      repoId: 'repo-frontend',
      branch: 'feat/UAH-61-widget-system',
      baseBranch: 'main',
      filesChanged: ['src/widgets/WidgetHost.tsx', 'src/widgets/registry.ts', 'src/widgets/types.ts'],
      additions: 234,
      deletions: 0,
    }],
    assignedAgent: 'agent-opus',
    verification: makePipeline({
      prechecks: {
        status: 'running',
        summary: 'Running typecheck...',
        metadata: { lintOk: true },
      },
      aiReview: { status: 'pending' },
      pr: { status: 'pending' },
      approval: { status: 'pending' },
    }),
    log: [
      { timestamp: mins(30), type: 'text', content: 'Designing widget host architecture...' },
      { timestamp: mins(28), type: 'thinking', content: 'Need a registry pattern. Widgets register via manifest, host renders them in sandboxed containers.' },
      { timestamp: mins(25), type: 'tool_call', toolName: 'Write', repoId: 'repo-frontend', content: 'Creating src/widgets/types.ts' },
      { timestamp: mins(22), type: 'tool_call', toolName: 'Write', repoId: 'repo-frontend', content: 'Creating src/widgets/registry.ts' },
      { timestamp: mins(18), type: 'tool_call', toolName: 'Write', repoId: 'repo-frontend', content: 'Creating src/widgets/WidgetHost.tsx' },
      { timestamp: mins(15), type: 'tool_result', content: 'All files created. Running type check...' },
    ],
    costUsd: 1.22,
    tokensUsed: 38_900,
    createdAt: mins(35),
    startedAt: mins(30),
  },

  // --- UAH-47: Completed task (entire pipeline passed, PR merged) ---
  {
    id: 'task-7',
    issueId: 'issue-6',
    title: 'Set up Tauri 2.x project scaffold',
    description: 'Initialize the Tauri desktop app with React frontend and Rust backend',
    status: 'done',
    repos: [{
      repoId: 'repo-frontend',
      branch: 'feat/UAH-47-tauri-scaffold',
      baseBranch: 'main',
      filesChanged: ['src-tauri/Cargo.toml', 'src-tauri/src/main.rs', 'tauri.conf.json', 'src-tauri/src/lib.rs'],
      additions: 342,
      deletions: 0,
    }],
    assignedAgent: 'agent-opus',
    verification: makePipeline({
      prechecks: {
        status: 'passed',
        summary: '12/12 tests, 87% cov, build ok',
        metadata: { lintOk: true, typecheckOk: true, testsPassed: 12, testsFailed: 0, testsTotal: 12, coverage: 87, buildOk: true },
      },
      aiReview: {
        status: 'passed',
        summary: 'Minor — 1 suggestion',
        metadata: { reviewSeverity: 'minor', reviewFindings: [], reviewSuggestions: ['Consider extracting Tauri config into a shared constants file'] },
      },
      pr: {
        status: 'passed',
        summary: 'PR #82 merged',
        metadata: { prUrl: 'https://github.com/acme/agent-manager/pull/82', prNumber: 82, prStatus: 'merged' },
      },
      approval: {
        status: 'passed',
        summary: 'Approved by alice',
        metadata: { reviewers: ['alice'], approvals: 1 },
      },
    }),
    log: [
      { timestamp: hours(5), type: 'text', content: 'Scaffolding Tauri project...' },
      { timestamp: hours(4.8), type: 'milestone', content: 'All checks passed. PR #82 merged.' },
    ],
    costUsd: 0.23,
    tokensUsed: 14_100,
    createdAt: hours(6),
    startedAt: hours(5),
    completedAt: hours(3),
  },
];

// ---------------------------------------------------------------------------
// Issues
// ---------------------------------------------------------------------------

export const issues: Issue[] = [
  {
    id: 'issue-1',
    externalId: 'UAH-42',
    externalUrl: 'https://acme.atlassian.net/browse/UAH-42',
    source: 'jira',
    type: 'story',
    title: 'Implement file watcher pipeline',
    description: 'Build a file system watcher that detects changes, debounces rapid events, and emits typed events through the SDK.',
    status: 'in_progress',
    priority: 'high',
    labels: ['core', 'infrastructure'],
    tasks: tasks.filter(t => t.issueId === 'issue-1'),
    plan: {
      summary: 'Implement in two phases: first add debounce logic to the existing watcher in agent-runtime, then update the SDK types to expose FileChangeEvent.',
      steps: [
        { id: 'ps-1', title: 'Add debounce logic to file watcher', description: 'Wrap the existing onFileChange handler with a 150ms debounce window', repoIds: ['repo-runtime'], status: 'in_progress', taskId: 'task-1' },
        { id: 'ps-2', title: 'Update SDK event types', description: 'Add FileChangeEvent to agent-sdk and update runtime to emit typed events', repoIds: ['repo-sdk', 'repo-runtime'], status: 'pending', taskId: 'task-2' },
        { id: 'ps-3', title: 'Integration test across repos', description: 'Verify SDK consumers receive correctly typed file events', repoIds: ['repo-sdk', 'repo-runtime'], status: 'pending' },
      ],
      estimatedComplexity: 'medium',
      affectedRepos: ['repo-runtime', 'repo-sdk'],
      risks: ['Cross-repo dependency ordering', 'Debounce timing sensitivity'],
      createdAt: mins(25),
    },
    createdAt: days(3),
    updatedAt: mins(5),
  },
  {
    id: 'issue-2',
    externalId: 'UAH-38',
    externalUrl: 'https://acme.atlassian.net/browse/UAH-38',
    source: 'jira',
    type: 'bug',
    title: 'Advisory file locking fails with EACCES',
    description: 'The .agent-lock/ directory cannot be created in the project root due to permission issues. Agents that attempt concurrent writes may corrupt files.',
    status: 'blocked',
    priority: 'critical',
    labels: ['bug', 'concurrency'],
    tasks: tasks.filter(t => t.issueId === 'issue-2'),
    createdAt: days(5),
    updatedAt: mins(75),
  },
  {
    id: 'issue-3',
    externalId: 'UAH-51',
    externalUrl: 'https://acme.atlassian.net/browse/UAH-51',
    source: 'jira',
    type: 'story',
    title: 'Add git auto-snapshot safety net',
    description: 'Automatically create a git branch snapshot before any agent modification run, enabling safe rollback.',
    status: 'review',
    priority: 'high',
    labels: ['safety', 'infrastructure'],
    tasks: tasks.filter(t => t.issueId === 'issue-3'),
    plan: {
      summary: 'Create a lightweight git branching mechanism that snapshots the current state before agent writes.',
      steps: [
        { id: 'ps-4', title: 'Create git snapshot module', description: 'Implement branch creation and checkout logic', repoIds: ['repo-runtime'], status: 'done', taskId: 'task-4' },
      ],
      estimatedComplexity: 'small',
      affectedRepos: ['repo-runtime'],
      risks: ['Branch name collisions', 'Performance with large repos'],
      createdAt: hours(2),
    },
    createdAt: days(2),
    updatedAt: mins(30),
  },
  {
    id: 'issue-4',
    externalId: 'UAH-55',
    externalUrl: 'https://acme.atlassian.net/browse/UAH-55',
    source: 'jira',
    type: 'story',
    title: 'Implement Claude SDK adapter',
    description: 'Build the adapter layer that translates Claude Agent SDK events (tool calls, results, thinking) into the normalized host event system.',
    status: 'planning',
    priority: 'high',
    labels: ['adapter', 'sdk'],
    tasks: tasks.filter(t => t.issueId === 'issue-4'),
    plan: {
      summary: 'Create an adapter implementing the AdapterProtocol interface that wraps the Claude Agent SDK query() function.',
      steps: [
        { id: 'ps-5', title: 'Define adapter manifest', description: 'Declare capabilities and lifecycle hooks', repoIds: ['repo-runtime'], status: 'pending' },
        { id: 'ps-6', title: 'Implement event normalization', description: 'Map Claude SDK events to host event types', repoIds: ['repo-runtime', 'repo-sdk'], status: 'pending', taskId: 'task-5' },
        { id: 'ps-7', title: 'Session management', description: 'Handle agent session lifecycle', repoIds: ['repo-runtime'], status: 'pending' },
        { id: 'ps-8', title: 'Tool permission control', description: 'Implement per-tool approval/deny policies', repoIds: ['repo-runtime'], status: 'pending' },
      ],
      estimatedComplexity: 'large',
      affectedRepos: ['repo-runtime', 'repo-sdk'],
      risks: ['SDK version compatibility', 'Streaming event ordering', 'Session state recovery'],
      createdAt: mins(15),
    },
    createdAt: days(1),
    updatedAt: mins(10),
  },
  {
    id: 'issue-5',
    externalId: 'UAH-61',
    externalUrl: 'https://acme.atlassian.net/browse/UAH-61',
    source: 'jira',
    type: 'story',
    title: 'Dashboard generative widget system',
    description: 'Build the extensible widget framework that allows agents to render custom interactive UI components in the dashboard.',
    status: 'in_progress',
    priority: 'medium',
    labels: ['ui', 'widgets'],
    tasks: tasks.filter(t => t.issueId === 'issue-5'),
    createdAt: days(1),
    updatedAt: mins(15),
  },
  {
    id: 'issue-6',
    externalId: 'UAH-47',
    externalUrl: 'https://acme.atlassian.net/browse/UAH-47',
    source: 'jira',
    type: 'story',
    title: 'Set up Tauri 2.x project scaffold',
    description: 'Initialize the desktop application using Tauri 2.x with a React frontend and Rust backend.',
    status: 'done',
    priority: 'high',
    labels: ['setup', 'infrastructure'],
    tasks: tasks.filter(t => t.issueId === 'issue-6'),
    plan: {
      summary: 'Use create-tauri-app to scaffold, then configure for our stack.',
      steps: [
        { id: 'ps-9', title: 'Scaffold Tauri project', description: 'Run create-tauri-app and configure', repoIds: ['repo-frontend'], status: 'done', taskId: 'task-7' },
      ],
      estimatedComplexity: 'small',
      affectedRepos: ['repo-frontend'],
      risks: [],
      createdAt: days(4),
    },
    createdAt: days(5),
    updatedAt: hours(3),
  },
  {
    id: 'issue-7',
    source: 'manual',
    type: 'idea',
    title: 'Explore multi-agent collaboration patterns',
    description: 'Research and prototype patterns for multiple agents working on related tasks simultaneously, with conflict detection.',
    status: 'backlog',
    priority: 'low',
    labels: ['research', 'multi-agent'],
    tasks: [],
    createdAt: days(1),
    updatedAt: days(1),
  },
];

// Re-export tasks for direct access
export { tasks };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getAgent(agentId: string): Agent | undefined {
  return agents.find(a => a.id === agentId);
}

export function getRepo(repoId: string): Repo | undefined {
  return repos.find(r => r.id === repoId);
}

export function getIssueForTask(taskId: string): Issue | undefined {
  return issues.find(i => i.tasks.some(t => t.id === taskId));
}

export function getTasksByStatus(status: Task['status']): Task[] {
  return tasks.filter(t => t.status === status);
}

export function totalCost(): number {
  return agents.reduce((sum, a) => sum + a.costUsd, 0);
}
