import { useState } from 'react';
import s from './Kanban.module.css';
import { useWorkflowData, useConnectionStatus } from '../../lib/EngineProvider.tsx';
import type { Issue, Task, VerificationStage, TaskLogEntry } from '../../types/workflow';

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

interface ColumnDef {
  key: string;
  label: string;
  testId: string;
  headerClass: string;
  statusFilter: (issue: Issue) => boolean;
}

const COLUMNS: ColumnDef[] = [
  {
    key: 'backlog',
    label: 'Backlog',
    testId: 'kanban-col-backlog',
    headerClass: s.columnHeaderBacklog,
    statusFilter: (i) => i.status === 'backlog',
  },
  {
    key: 'planning',
    label: 'Planning',
    testId: 'kanban-col-planning',
    headerClass: s.columnHeaderPlanning,
    statusFilter: (i) => i.status === 'analysis' || i.status === 'planning',
  },
  {
    key: 'progress',
    label: 'In Progress',
    testId: 'kanban-col-progress',
    headerClass: s.columnHeaderProgress,
    statusFilter: (i) => i.status === 'in_progress',
  },
  {
    key: 'blocked',
    label: 'Blocked',
    testId: 'kanban-col-blocked',
    headerClass: s.columnHeaderBlocked,
    statusFilter: (i) => i.status === 'blocked',
  },
  {
    key: 'review',
    label: 'Review',
    testId: 'kanban-col-review',
    headerClass: s.columnHeaderReview,
    statusFilter: (i) => i.status === 'review',
  },
  {
    key: 'done',
    label: 'Done',
    testId: 'kanban-col-done',
    headerClass: s.columnHeaderDone,
    statusFilter: (i) => i.status === 'done',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTypeIcon(type: Issue['type']): string {
  switch (type) {
    case 'epic': return '\u25C6';      // diamond
    case 'story': return '\u25B7';     // triangle right
    case 'bug': return '\u25CF';       // filled circle
    case 'task': return '\u2610';      // ballot box
    case 'subtask': return '\u2514';   // box drawing L
    case 'idea': return '\u2605';      // star
    default: return '\u25CB';          // circle
  }
}

function getPriorityClass(priority: Issue['priority']): string {
  switch (priority) {
    case 'critical': return s.priorityCritical;
    case 'high': return s.priorityHigh;
    case 'medium': return s.priorityMedium;
    case 'low': return s.priorityLow;
    default: return s.priorityLow;
  }
}

function getCardStateClass(issue: Issue): string {
  const hasRunningTask = issue.tasks.some((t) => t.status === 'running');
  if (issue.status === 'blocked') return s.cardBlocked;
  if (issue.status === 'review') return s.cardReview;
  if (issue.status === 'done') return s.cardDone;
  if (issue.status === 'planning' || issue.status === 'analysis') return s.cardPlanning;
  if (hasRunningTask) return s.cardRunning;
  return '';
}

function getTaskSummary(issueTasks: Task[]): string {
  if (issueTasks.length === 0) return 'No tasks';
  const counts: Record<string, number> = {};
  for (const t of issueTasks) {
    counts[t.status] = (counts[t.status] || 0) + 1;
  }
  const parts: string[] = [];
  if (counts.running) parts.push(`${counts.running} running`);
  if (counts.queued) parts.push(`${counts.queued} queued`);
  if (counts.planning) parts.push(`${counts.planning} planning`);
  if (counts.verifying) parts.push(`${counts.verifying} verifying`);
  if (counts.review) parts.push(`${counts.review} review`);
  if (counts.done) parts.push(`${counts.done} done`);
  if (counts.failed) parts.push(`${counts.failed} failed`);
  if (counts.blocked) parts.push(`${counts.blocked} blocked`);
  return `${issueTasks.length} task${issueTasks.length !== 1 ? 's' : ''}: ${parts.join(', ')}`;
}

function getIssueRepoIds(issue: Issue): string[] {
  const ids = new Set<string>();
  for (const task of issue.tasks) {
    for (const tr of task.repos) {
      ids.add(tr.repoId);
    }
  }
  if (issue.plan) {
    for (const repoId of issue.plan.affectedRepos) {
      ids.add(repoId);
    }
  }
  return Array.from(ids);
}

function getIssueCost(issue: Issue): number {
  return issue.tasks.reduce((sum, t) => sum + t.costUsd, 0);
}

function getRunningAgent(
  issue: Issue,
  agentLookup: (id: string) => { id: string; name: string } | undefined,
): { name: string; initials: string } | null {
  for (const task of issue.tasks) {
    if (task.status === 'running' && task.assignedAgent) {
      const agent = agentLookup(task.assignedAgent);
      if (agent) {
        const initials = agent.name
          .split(' ')
          .map((w) => w[0])
          .join('')
          .toUpperCase()
          .slice(0, 2);
        return { name: agent.name, initials };
      }
    }
  }
  return null;
}

function getPrInfo(issue: Issue): { number: number; url: string } | null {
  for (const task of issue.tasks) {
    for (const stage of task.verification.stages) {
      if (
        stage.type === 'pr' &&
        stage.metadata?.prNumber
      ) {
        return {
          number: stage.metadata.prNumber as number,
          url: (stage.metadata.prUrl as string) || '#',
        };
      }
    }
  }
  return null;
}

function hasVerificationData(issue: Issue): boolean {
  return issue.tasks.some((t) => t.verification.stages.length > 0);
}

function getVerificationDotClass(status: VerificationStage['status']): string {
  switch (status) {
    case 'passed': return s.verificationDotPassed;
    case 'failed': return s.verificationDotFailed;
    case 'warning': return s.verificationDotWarning;
    case 'running': return s.verificationDotRunning;
    case 'pending': return s.verificationDotPending;
    case 'skipped': return s.verificationDotSkipped;
    default: return s.verificationDotPending;
  }
}

function getVerificationDotSymbol(status: VerificationStage['status']): string {
  switch (status) {
    case 'passed': return '\u2713';
    case 'failed': return '\u2717';
    case 'warning': return '!';
    case 'running': return '\u2022';
    case 'pending': return '\u25CB';
    case 'skipped': return '-';
    default: return '\u25CB';
  }
}

function getStageAbbrev(type: VerificationStage['type']): string {
  switch (type) {
    case 'prechecks': return 'checks';
    case 'ai_review': return 'AI';
    case 'pr': return 'PR';
    case 'approval': return 'rev';
    default: return '?';
  }
}

function getTaskStatusClass(status: Task['status']): string {
  switch (status) {
    case 'running': return s.taskStatusRunning;
    case 'queued': return s.taskStatusQueued;
    case 'planning': return s.taskStatusPlanning;
    case 'review': return s.taskStatusReview;
    case 'done': return s.taskStatusDone;
    case 'failed': return s.taskStatusFailed;
    case 'blocked': return s.taskStatusBlocked;
    case 'verifying': return s.taskStatusVerifying;
    default: return s.taskStatusQueued;
  }
}

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function getLogContentClass(entry: TaskLogEntry): string {
  if (entry.type === 'error') return s.logContentError;
  if (entry.type === 'milestone') return s.logContentMilestone;
  if (entry.type === 'tool_call') return s.logContentToolCall;
  return '';
}

// ---------------------------------------------------------------------------
// MiniVerification
// ---------------------------------------------------------------------------

function MiniVerification({ issue }: { issue: Issue }) {
  if (!hasVerificationData(issue)) return null;

  // Collect the best stages across all tasks (first task with meaningful stages)
  const primaryTask = issue.tasks.find((t) => t.verification.stages.length > 0);
  if (!primaryTask) return null;

  return (
    <div className={s.verificationRow}>
      {primaryTask.verification.stages.map((stage) => (
        <span
          key={stage.id}
          className={`${s.verificationDot} ${getVerificationDotClass(stage.status)}`}
          title={`${stage.label}: ${stage.status}`}
        >
          {getVerificationDotSymbol(stage.status)}
        </span>
      ))}
      <span className={s.verificationLabel}>
        {primaryTask.verification.stages
          .map((st) => getStageAbbrev(st.type))
          .join(' ')}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// IssueCardExpanded
// ---------------------------------------------------------------------------

function IssueCardExpanded({ issue, getRepo }: {
  issue: Issue;
  getRepo: (id: string) => { id: string; name: string } | undefined;
}) {
  const prInfo = getPrInfo(issue);

  // Collect last 3 log entries from the most active task
  const activeLogs: TaskLogEntry[] = [];
  for (const task of issue.tasks) {
    if (task.log.length > 0) {
      activeLogs.push(...task.log);
    }
  }
  activeLogs.sort((a, b) => b.timestamp - a.timestamp);
  const recentLogs = activeLogs.slice(0, 3);

  // Files changed
  const filesChanged: { path: string; additions: number; deletions: number; repoName: string }[] = [];
  for (const task of issue.tasks) {
    for (const tr of task.repos) {
      const repo = getRepo(tr.repoId);
      for (const f of tr.filesChanged) {
        filesChanged.push({
          path: f,
          additions: tr.additions,
          deletions: tr.deletions,
          repoName: repo?.name || tr.repoId,
        });
      }
    }
  }

  return (
    <div className={s.expandedDetail} data-testid={`kanban-detail-${issue.id}`}>
      {/* Plan steps */}
      {issue.plan && issue.plan.steps.length > 0 && (
        <div className={s.expandedSection}>
          <div className={s.expandedSectionTitle}>Plan</div>
          {issue.plan.steps.map((step) => (
            <div key={step.id} className={s.planStep}>
              <span
                className={`${s.planStepCheck} ${
                  step.status === 'done'
                    ? s.planStepCheckDone
                    : step.status === 'in_progress'
                    ? s.planStepCheckActive
                    : ''
                }`}
              >
                {step.status === 'done' ? '\u2713' : ''}
              </span>
              <span
                className={`${s.planStepText} ${
                  step.status === 'done' ? s.planStepTextDone : ''
                }`}
              >
                {step.title}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Task list with verification */}
      {issue.tasks.length > 0 && (
        <div className={s.expandedSection}>
          <div className={s.expandedSectionTitle}>Tasks</div>
          {issue.tasks.map((task) => (
            <div key={task.id} className={s.taskListItem}>
              <span className={`${s.taskStatusBadge} ${getTaskStatusClass(task.status)}`}>
                {task.status}
              </span>
              <span className={s.taskTitle} title={task.title}>
                {task.title}
              </span>
              {task.verification.stages.length > 0 && (
                <span className={s.taskVerificationDots}>
                  {task.verification.stages.map((stage) => (
                    <span
                      key={stage.id}
                      className={`${s.verificationDot} ${getVerificationDotClass(stage.status)}`}
                      title={`${stage.label}: ${stage.status}`}
                    >
                      {getVerificationDotSymbol(stage.status)}
                    </span>
                  ))}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Agent logs */}
      {recentLogs.length > 0 && (
        <div className={s.expandedSection}>
          <div className={s.expandedSectionTitle}>Recent Activity</div>
          {recentLogs.map((entry, idx) => (
            <div key={idx} className={s.logEntry}>
              <span className={s.logTimestamp}>{formatTimeAgo(entry.timestamp)}</span>
              <span className={`${s.logContent} ${getLogContentClass(entry)}`}>
                {entry.content}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Files changed */}
      {filesChanged.length > 0 && (
        <div className={s.expandedSection}>
          <div className={s.expandedSectionTitle}>Files Changed</div>
          {filesChanged.map((f, idx) => (
            <div key={idx} className={s.fileRow}>
              <span>{f.path}</span>
            </div>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className={s.expandedActions}>
        <button className={`${s.btnAction} ${s.btnActionPrimary}`}>Dispatch Agent</button>
        {issue.tasks.some((t) => t.status === 'failed') && (
          <button className={`${s.btnAction} ${s.btnActionDanger}`}>Retry</button>
        )}
        {prInfo && (
          <button
            className={s.btnAction}
            onClick={(e) => {
              e.stopPropagation();
              window.open(prInfo.url, '_blank');
            }}
          >
            View PR #{prInfo.number}
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// IssueCard
// ---------------------------------------------------------------------------

function IssueCard({
  issue,
  expanded,
  onToggle,
  getAgent,
  getRepo,
}: {
  issue: Issue;
  expanded: boolean;
  onToggle: () => void;
  getAgent: (id: string) => { id: string; name: string } | undefined;
  getRepo: (id: string) => { id: string; name: string } | undefined;
}) {
  const stateClass = getCardStateClass(issue);
  const repoIds = getIssueRepoIds(issue);
  const cost = getIssueCost(issue);
  const runningAgent = getRunningAgent(issue, getAgent);
  const prInfo = getPrInfo(issue);
  const isShimmering =
    (issue.status === 'analysis' || issue.status === 'planning') && issue.tasks.length > 0;

  return (
    <div data-testid={`kanban-card-${issue.id}`}>
      <div
        className={[
          s.card,
          stateClass,
          expanded ? s.cardSelected : '',
          isShimmering ? s.shimmer : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={onToggle}
      >
        {/* Header row */}
        <div className={s.cardHeaderRow}>
          <span className={s.typeIcon}>{getTypeIcon(issue.type)}</span>
          {issue.externalId && <span className={s.externalId}>{issue.externalId}</span>}
          <span className={`${s.priorityDot} ${getPriorityClass(issue.priority)}`} />
        </div>

        {/* Title */}
        <div className={s.cardTitle}>{issue.title}</div>

        {/* Labels */}
        {issue.labels.length > 0 && (
          <div className={s.labels}>
            {issue.labels.map((label) => (
              <span key={label} className={s.label}>
                {label}
              </span>
            ))}
          </div>
        )}

        {/* Task summary */}
        {issue.tasks.length > 0 && (
          <div className={s.taskSummary}>{getTaskSummary(issue.tasks)}</div>
        )}

        {/* Repo badges */}
        {repoIds.length > 0 && (
          <div className={s.repoBadges}>
            {repoIds.map((repoId) => {
              const repo = getRepo(repoId);
              return (
                <span key={repoId} className={s.repoBadge}>
                  {repo?.name || repoId}
                </span>
              );
            })}
          </div>
        )}

        {/* Verification summary */}
        <MiniVerification issue={issue} />

        {/* Agent indicator */}
        {runningAgent && (
          <div className={s.agentIndicator}>
            <span className={s.agentAvatar}>{runningAgent.initials}</span>
            <span className={s.agentName}>{runningAgent.name}</span>
          </div>
        )}

        {/* PR link */}
        {prInfo && (
          <span
            className={s.prBadge}
            onClick={(e) => {
              e.stopPropagation();
              window.open(prInfo.url, '_blank');
            }}
          >
            PR #{prInfo.number}
          </span>
        )}

        {/* Cost */}
        {cost > 0 && <div className={s.cardCost}>${cost.toFixed(2)}</div>}
      </div>

      {/* Expanded detail panel */}
      {expanded && <IssueCardExpanded issue={issue} getRepo={getRepo} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// KanbanColumn
// ---------------------------------------------------------------------------

function KanbanColumn({
  column,
  issues: columnIssues,
  expandedId,
  onToggle,
  getAgent,
  getRepo,
}: {
  column: ColumnDef;
  issues: Issue[];
  expandedId: string | null;
  onToggle: (id: string) => void;
  getAgent: (id: string) => { id: string; name: string } | undefined;
  getRepo: (id: string) => { id: string; name: string } | undefined;
}) {
  return (
    <div className={s.column} data-testid={column.testId}>
      <div className={`${s.columnHeader} ${column.headerClass}`}>
        <span className={s.columnName}>{column.label}</span>
        <span className={s.columnCount}>{columnIssues.length}</span>
      </div>
      <div className={s.columnCards}>
        {columnIssues.length === 0 ? (
          <div className={s.emptyColumn}>No issues</div>
        ) : (
          columnIssues.map((issue) => (
            <IssueCard
              key={issue.id}
              issue={issue}
              expanded={expandedId === issue.id}
              onToggle={() => onToggle(issue.id)}
              getAgent={getAgent}
              getRepo={getRepo}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Kanban (main)
// ---------------------------------------------------------------------------

export default function Kanban() {
  const { issues, agents, repos, tasks, totalCost, getAgent, getRepo } = useWorkflowData();
  const { isLive } = useConnectionStatus();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleToggle = (issueId: string) => {
    setExpandedId((prev) => (prev === issueId ? null : issueId));
  };

  // Compute stats
  const activeAgents = agents.filter((a) => a.status === 'running').length;
  const tasksInFlight = tasks.filter(
    (t) => t.status === 'running' || t.status === 'verifying'
  ).length;

  return (
    <div className={s.shell} data-testid="kanban-shell">
      {/* Header */}
      <div className={s.header} data-testid="kanban-header">
        <div className={s.headerLeft}>
          <span className={s.headerTitle}>Workflow Board</span>
          {isLive && <span className={s.liveDot} title="Connected to engine" />}
        </div>

        <div className={s.headerCenter}>
          <span className={s.statPill}>
            <span className={s.statPillValue}>{repos.length}</span>
            <span className={s.statPillLabel}>repos</span>
          </span>
          <span className={s.statPill}>
            <span className={s.statPillValue}>{issues.length}</span>
            <span className={s.statPillLabel}>issues</span>
          </span>
          <span className={s.statPill}>
            <span className={s.statPillValue}>{activeAgents}</span>
            <span className={s.statPillLabel}>agents</span>
          </span>
          <span className={s.statPill}>
            <span className={s.statPillValue}>{tasksInFlight}</span>
            <span className={s.statPillLabel}>in flight</span>
          </span>
        </div>

        <div className={s.headerRight}>
          <span className={s.costBadge}>${totalCost.toFixed(2)}</span>
          <button className={s.btnNewIssue}>+ New Issue</button>
        </div>
      </div>

      {/* Board */}
      <div className={s.board}>
        {COLUMNS.map((col) => {
          const columnIssues = issues.filter(col.statusFilter);
          return (
            <KanbanColumn
              key={col.key}
              column={col}
              issues={columnIssues}
              expandedId={expandedId}
              onToggle={handleToggle}
              getAgent={getAgent}
              getRepo={getRepo}
            />
          );
        })}
      </div>
    </div>
  );
}
