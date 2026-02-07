// Workflow-oriented types grounded in real dev workflows.
// An issue from Jira/DevOps/Linear gets analyzed → planned → broken into tasks →
// tasks are executed by agents → verified through a multi-stage pipeline →
// PRs created and reviewed → shipped.

// ---------------------------------------------------------------------------
// Project & Repo
// ---------------------------------------------------------------------------

/** A project is the top-level container. It can span multiple repos. */
export interface Project {
  id: string;
  name: string;
  repos: Repo[];
  externalLinks: ExternalProjectLink[];
}

export interface Repo {
  id: string;
  name: string;
  path: string;                     // local path, e.g. ~/code/agent-runtime
  remoteUrl: string;                // git remote
  defaultBranch: string;            // main, master, develop
}

export interface ExternalProjectLink {
  system: ExternalSystem;
  projectKey: string;               // e.g. "UAH" in Jira, org/repo in GitHub
  baseUrl: string;                  // e.g. https://acme.atlassian.net
}

export type ExternalSystem = 'jira' | 'azure_devops' | 'github' | 'linear' | 'manual';

// ---------------------------------------------------------------------------
// Issue
// ---------------------------------------------------------------------------

/** An issue is the work item from an external system (or created manually). */
export interface Issue {
  id: string;
  externalId?: string;              // e.g. "UAH-42", "#123"
  externalUrl?: string;             // full URL to the issue
  source: ExternalSystem;
  type: 'epic' | 'story' | 'bug' | 'task' | 'subtask' | 'idea';
  title: string;
  description: string;
  status: IssueStatus;
  priority: 'critical' | 'high' | 'medium' | 'low';
  labels: string[];
  parentIssueId?: string;           // for subtasks/children
  tasks: Task[];
  plan?: Plan;                      // analysis output
  createdAt: number;
  updatedAt: number;
}

export type IssueStatus =
  | 'backlog'
  | 'analysis'
  | 'planning'
  | 'in_progress'
  | 'review'
  | 'done'
  | 'blocked';

// ---------------------------------------------------------------------------
// Plan (analysis output)
// ---------------------------------------------------------------------------

/** A plan is the output of analyzing an issue. It describes the approach. */
export interface Plan {
  summary: string;                  // high-level approach
  steps: PlanStep[];
  estimatedComplexity: 'trivial' | 'small' | 'medium' | 'large' | 'epic';
  affectedRepos: string[];          // repo IDs
  risks: string[];
  createdAt: number;
}

export interface PlanStep {
  id: string;
  title: string;
  description: string;
  repoIds: string[];                // which repos this step touches
  status: 'pending' | 'in_progress' | 'done' | 'skipped';
  taskId?: string;                  // links to a Task once created
}

// ---------------------------------------------------------------------------
// Task (unit of agent work)
// ---------------------------------------------------------------------------

/** A task is the unit of work dispatched to an agent. */
export interface Task {
  id: string;
  issueId: string;
  title: string;
  description: string;
  status: TaskStatus;
  repos: TaskRepo[];                // repos this task touches, with branch info
  assignedAgent?: string;           // agent ID
  verification: VerificationPipeline;
  log: TaskLogEntry[];
  costUsd: number;
  tokensUsed: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

export type TaskStatus =
  | 'planning'
  | 'queued'
  | 'running'
  | 'verifying'
  | 'review'
  | 'done'
  | 'failed'
  | 'blocked';

export interface TaskRepo {
  repoId: string;
  branch: string;                   // e.g. "feat/UAH-42-file-watcher"
  baseBranch: string;               // e.g. "main"
  filesChanged: string[];           // paths relative to repo root
  additions: number;
  deletions: number;
}

// ---------------------------------------------------------------------------
// Verification Pipeline
// ---------------------------------------------------------------------------

/**
 * 4-stage verification pipeline. Each stage is a meaningful gate:
 *
 * 1. Prechecks  (auto)   — lint, types, tests, build bundled as one gate
 * 2. AI Review  (auto)   — an agent reviews the diff for correctness/architecture
 * 3. PR         (auto)   — branch pushed, pull request created
 * 4. Approval   (manual) — human reviews and approves
 */
export interface VerificationPipeline {
  stages: VerificationStage[];
}

export interface VerificationStage {
  id: string;
  type: VerificationStageType;
  label: string;
  auto: boolean;
  status: VerificationStageStatus;
  summary?: string;                 // one-line status, e.g. "8/8 tests, 91% cov"
  output?: string;                  // full output / details
  startedAt?: number;
  completedAt?: number;
  metadata?: VerificationMetadata;
}

/**
 * Prechecks — all automated quality gates (lint, types, tests, build).
 * AI Review — agent code review of the diff.
 * PR — branch pushed, pull request created.
 * Approval — human review and merge.
 */
export type VerificationStageType =
  | 'prechecks'
  | 'ai_review'
  | 'pr'
  | 'approval';

export type VerificationStageStatus =
  | 'pending'
  | 'running'
  | 'passed'
  | 'failed'
  | 'warning'
  | 'skipped';

export interface VerificationMetadata {
  // Prechecks
  lintOk?: boolean;
  typecheckOk?: boolean;
  testsPassed?: number;
  testsFailed?: number;
  testsTotal?: number;
  coverage?: number;
  buildOk?: boolean;
  // AI Review
  reviewSeverity?: 'clean' | 'minor' | 'major' | 'critical';
  reviewFindings?: string[];        // list of findings
  reviewSuggestions?: string[];     // suggested improvements
  // PR
  prUrl?: string;
  prNumber?: number;
  prStatus?: 'draft' | 'open' | 'merged' | 'closed';
  // Approval
  reviewers?: string[];
  approvals?: number;
  changesRequested?: boolean;
}

// ---------------------------------------------------------------------------
// Task Log
// ---------------------------------------------------------------------------

export interface TaskLogEntry {
  timestamp: number;
  type: 'text' | 'tool_call' | 'tool_result' | 'error' | 'thinking' | 'milestone';
  content: string;
  toolName?: string;
  repoId?: string;                  // which repo this action targeted
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export interface Agent {
  id: string;
  name: string;
  model: string;
  status: 'idle' | 'running' | 'paused' | 'errored';
  currentTaskId?: string;
  costUsd: number;
  tokensUsed: number;
  capabilities: string[];           // e.g. ["code", "review", "plan"]
}
