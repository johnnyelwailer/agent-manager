// Workflow mapper — converts engine sessions + AgentEvents into the workflow
// types (Issue, Task, Agent, etc.) that the UI components expect.
//
// Mapping model:
//   Engine Session  →  Task (1:1)
//   Group of tasks  →  Issue (created by user or auto-grouped)
//   Adapter         →  Agent
//   AgentEvents     →  TaskLogEntry[]
//
// This lets the Ops/Kanban/Brief views render live session data using
// the same component structure they use for mock data.

import type { AgentEvent, SessionInfo, AdapterManifest } from './engine-types.ts';
import type {
  Task,
  TaskStatus,
  TaskLogEntry,
  TaskRepo,
  VerificationPipeline,
  Issue,
  IssueStatus,
  Agent,
  Project,
  Repo,
} from '../types/workflow.ts';

// ---------------------------------------------------------------------------
// Session → Task mapping
// ---------------------------------------------------------------------------

/** Map a session's status to a TaskStatus */
function mapSessionStatus(status: SessionInfo['status']): TaskStatus {
  switch (status) {
    case 'starting': return 'queued';
    case 'running': return 'running';
    case 'completed': return 'done';
    case 'failed': return 'failed';
    case 'interrupted': return 'blocked';
  }
}

/** Map AgentEvents from a session into TaskLogEntry[] */
export function mapEventsToLog(events: AgentEvent[]): TaskLogEntry[] {
  const log: TaskLogEntry[] = [];

  for (const event of events) {
    const timestamp = new Date(event.timestamp).getTime();

    switch (event.type) {
      case 'session_start':
        log.push({
          timestamp,
          type: 'milestone',
          content: `Session started (model: ${event.model})`,
        });
        break;

      case 'text_delta':
        // Accumulate text deltas — for now, push each as a text entry.
        // A real implementation might batch consecutive deltas.
        log.push({
          timestamp,
          type: 'text',
          content: event.text,
        });
        break;

      case 'thinking':
        log.push({
          timestamp,
          type: 'thinking',
          content: event.text,
        });
        break;

      case 'tool_call':
        log.push({
          timestamp,
          type: 'tool_call',
          content: summarizeToolInput(event.toolName, event.input),
          toolName: event.toolName,
        });
        break;

      case 'tool_result':
        log.push({
          timestamp,
          type: event.isError ? 'error' : 'tool_result',
          content: truncate(event.output, 200),
          toolName: event.toolName,
        });
        break;

      case 'error':
        log.push({
          timestamp,
          type: 'error',
          content: event.message,
        });
        break;

      case 'session_end':
        log.push({
          timestamp,
          type: 'milestone',
          content: `Session ended: ${event.result} ($${event.costUsd.toFixed(2)})`,
        });
        break;

      // subagent_start and subagent_end are informational
      case 'subagent_start':
        log.push({
          timestamp,
          type: 'milestone',
          content: `Sub-agent started: ${event.subagentSessionId}`,
        });
        break;

      case 'subagent_end':
        log.push({
          timestamp,
          type: 'milestone',
          content: `Sub-agent finished: ${event.result}`,
        });
        break;
    }
  }

  return log;
}

/** Create a Task from a SessionInfo */
export function sessionToTask(session: SessionInfo, events: AgentEvent[]): Task {
  const log = mapEventsToLog(events);

  // Extract repo info from tool calls (file paths from Edit/Write/Read tools)
  const repos = extractRepoInfo(events, session.cwd);

  // Determine task status
  const status = mapSessionStatus(session.status);

  // Build a basic verification pipeline (stages are pending until we detect them)
  const verification = buildVerificationPipeline(session, events);

  return {
    id: `task-${session.sessionId}`,
    issueId: '', // will be set when assigned to an issue
    title: truncate(session.prompt, 80),
    description: session.prompt,
    status,
    repos,
    assignedAgent: session.adapterId,
    verification,
    log,
    costUsd: session.costUsd,
    tokensUsed: session.tokensIn + session.tokensOut,
    createdAt: new Date(session.startedAt).getTime(),
    startedAt: new Date(session.startedAt).getTime(),
    completedAt: session.endedAt ? new Date(session.endedAt).getTime() : undefined,
  };
}

// ---------------------------------------------------------------------------
// Task → Issue grouping
// ---------------------------------------------------------------------------

/** Group tasks into a single auto-generated issue (for ungrouped sessions) */
export function tasksToIssue(tasks: Task[], issueId: string, title: string): Issue {
  // Derive issue status from task statuses
  const status = deriveIssueStatus(tasks);

  return {
    id: issueId,
    source: 'manual',
    type: 'task',
    title,
    description: `Auto-created issue grouping ${tasks.length} agent session(s)`,
    status,
    priority: 'medium',
    labels: ['agent-session'],
    tasks: tasks.map((t) => ({ ...t, issueId })),
    createdAt: Math.min(...tasks.map((t) => t.createdAt)),
    updatedAt: Date.now(),
  };
}

function deriveIssueStatus(tasks: Task[]): IssueStatus {
  if (tasks.length === 0) return 'backlog';

  const hasRunning = tasks.some((t) => t.status === 'running');
  const hasFailed = tasks.some((t) => t.status === 'failed');
  const hasBlocked = tasks.some((t) => t.status === 'blocked');
  const allDone = tasks.every((t) => t.status === 'done');
  const hasVerifying = tasks.some((t) => t.status === 'verifying');
  const hasReview = tasks.some((t) => t.status === 'review');

  if (allDone) return 'done';
  if (hasBlocked) return 'blocked';
  if (hasReview || hasVerifying) return 'review';
  if (hasRunning) return 'in_progress';
  if (hasFailed) return 'in_progress'; // still in progress if some failed
  return 'planning';
}

// ---------------------------------------------------------------------------
// Adapter → Agent mapping
// ---------------------------------------------------------------------------

export function adapterToAgent(
  manifest: AdapterManifest,
  sessions: SessionInfo[],
): Agent {
  const activeSessions = sessions.filter(
    (s) => s.adapterId === manifest.id && (s.status === 'running' || s.status === 'starting'),
  );
  const adapterSessions = sessions.filter((s) => s.adapterId === manifest.id);

  const totalCost = adapterSessions.reduce((sum, s) => sum + s.costUsd, 0);
  const totalTokens = adapterSessions.reduce((sum, s) => sum + s.tokensIn + s.tokensOut, 0);
  const currentTask = activeSessions.length > 0 ? `task-${activeSessions[0].sessionId}` : undefined;

  return {
    id: `agent-${manifest.id}`,
    name: manifest.name,
    model: manifest.runtime,
    status: activeSessions.length > 0 ? 'running' : 'idle',
    currentTaskId: currentTask,
    costUsd: totalCost,
    tokensUsed: totalTokens,
    capabilities: ['code'],
  };
}

// ---------------------------------------------------------------------------
// Project scaffolding
// ---------------------------------------------------------------------------

export function buildDefaultProject(sessions: SessionInfo[]): Project {
  // Extract unique working directories as repos
  const cwds = new Set(sessions.map((s) => s.cwd));
  const repos: Repo[] = Array.from(cwds).map((cwd, idx) => ({
    id: `repo-${idx}`,
    name: cwd.split('/').pop() || cwd,
    path: cwd,
    remoteUrl: '',
    defaultBranch: 'main',
  }));

  return {
    id: 'project-live',
    name: 'Agent Manager',
    repos,
    externalLinks: [],
  };
}

// ---------------------------------------------------------------------------
// Complete state mapping
// ---------------------------------------------------------------------------

export interface MappedWorkflowState {
  project: Project;
  repos: Repo[];
  issues: Issue[];
  tasks: Task[];
  agents: Agent[];
  totalCost: number;
}

/**
 * Map all engine state (sessions + adapters) into the workflow types
 * used by the UI components.
 */
export function mapEngineState(
  sessions: SessionInfo[],
  sessionEvents: Map<string, AgentEvent[]>,
  adapters: AdapterManifest[],
): MappedWorkflowState {
  // Map sessions → tasks
  const tasks = sessions.map((session) => {
    const events = sessionEvents.get(session.sessionId) ?? [];
    return sessionToTask(session, events);
  });

  // Group tasks into issues (one issue per session for now)
  // In the future, this could use metadata to group related sessions
  const issues: Issue[] = [];
  for (const task of tasks) {
    const issueId = `issue-${task.id}`;
    const issue = tasksToIssue([task], issueId, task.title);
    issues.push(issue);
  }

  // Map adapters → agents
  const agents = adapters.map((a) => adapterToAgent(a, sessions));

  // Build project
  const project = buildDefaultProject(sessions);

  const totalCost = sessions.reduce((sum, s) => sum + s.costUsd, 0);

  return {
    project,
    repos: project.repos,
    issues,
    tasks,
    agents,
    totalCost,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '...';
}

function summarizeToolInput(toolName: string, input: Record<string, unknown>): string {
  // Provide a human-readable summary of tool usage
  if (toolName === 'Read' || toolName === 'read') {
    return String(input.file_path ?? input.path ?? '');
  }
  if (toolName === 'Edit' || toolName === 'edit') {
    return `Editing ${input.file_path ?? input.path ?? 'file'}`;
  }
  if (toolName === 'Write' || toolName === 'write') {
    return `Writing ${input.file_path ?? input.path ?? 'file'}`;
  }
  if (toolName === 'Bash' || toolName === 'bash') {
    return truncate(String(input.command ?? ''), 100);
  }
  if (toolName === 'Glob' || toolName === 'glob') {
    return `Pattern: ${input.pattern ?? ''}`;
  }
  if (toolName === 'Grep' || toolName === 'grep') {
    return `Searching: ${input.pattern ?? ''}`;
  }
  // Generic fallback
  const keys = Object.keys(input);
  if (keys.length === 0) return '';
  return truncate(JSON.stringify(input), 100);
}

function extractRepoInfo(events: AgentEvent[], sessionCwd: string): TaskRepo[] {
  // Extract file paths from tool calls to build a rough repo picture
  const filesChanged = new Set<string>();

  for (const event of events) {
    if (event.type === 'tool_call') {
      const path = String(event.input.file_path ?? event.input.path ?? '');
      if (path) {
        // Normalize to relative path
        const relative = path.startsWith(sessionCwd)
          ? path.slice(sessionCwd.length).replace(/^\//, '')
          : path;
        if (relative && !relative.startsWith('/')) {
          filesChanged.add(relative);
        }
      }
    }
  }

  if (filesChanged.size === 0) return [];

  const repoName = sessionCwd.split('/').pop() || 'workspace';
  return [{
    repoId: `repo-${repoName}`,
    branch: 'agent-session',
    baseBranch: 'main',
    filesChanged: Array.from(filesChanged),
    additions: 0,
    deletions: 0,
  }];
}

function buildVerificationPipeline(
  session: SessionInfo,
  _events: AgentEvent[],
): VerificationPipeline {
  // Build a default pipeline. In the future, stages will be updated
  // based on actual verification tool results from the agent.
  const baseStatus = session.status === 'completed' ? 'passed' as const
    : session.status === 'running' ? 'pending' as const
    : session.status === 'failed' ? 'failed' as const
    : 'pending' as const;

  return {
    stages: [
      {
        id: `vs-${session.sessionId}-prechecks`,
        type: 'prechecks',
        label: 'Prechecks',
        auto: true,
        status: session.status === 'completed' ? 'passed' : baseStatus,
      },
      {
        id: `vs-${session.sessionId}-ai-review`,
        type: 'ai_review',
        label: 'AI Review',
        auto: true,
        status: 'pending',
      },
      {
        id: `vs-${session.sessionId}-pr`,
        type: 'pr',
        label: 'Pull Request',
        auto: true,
        status: 'pending',
      },
      {
        id: `vs-${session.sessionId}-approval`,
        type: 'approval',
        label: 'Approval',
        auto: false,
        status: 'pending',
      },
    ],
  };
}
