import { useState } from 'react';
import s from './Metamorph.module.css';
import {
  issues,
  agents,
  repos,
  tasks,
  getAgent,
  getRepo,
  totalCost,
} from '../../data/workflow-mock';
import type {
  Issue,
  Task,
  Agent,
  VerificationStage,
  TaskLogEntry,
} from '../../types/workflow';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ViewMode = 'board' | 'elaborate';

interface ElaborationState {
  prompt: string;
  phase: 'input' | 'analyzing' | 'ready';
  generatedPlan: GeneratedPlan | null;
}

interface GeneratedPlan {
  title: string;
  summary: string;
  type: Issue['type'];
  priority: Issue['priority'];
  steps: { title: string; description: string; repos: string[] }[];
  complexity: 'trivial' | 'small' | 'medium' | 'large' | 'epic';
  risks: string[];
  affectedRepos: string[];
  estimatedTasks: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BOARD_COLUMNS = [
  { key: 'backlog', label: 'Backlog', color: '#52525b', filter: (i: Issue) => i.status === 'backlog' },
  { key: 'planning', label: 'Planning', color: '#7c3aed', filter: (i: Issue) => i.status === 'analysis' || i.status === 'planning' },
  { key: 'progress', label: 'In Progress', color: '#3b82f6', filter: (i: Issue) => i.status === 'in_progress' },
  { key: 'blocked', label: 'Blocked', color: '#ef4444', filter: (i: Issue) => i.status === 'blocked' },
  { key: 'review', label: 'Review', color: '#f59e0b', filter: (i: Issue) => i.status === 'review' },
  { key: 'done', label: 'Done', color: '#10b981', filter: (i: Issue) => i.status === 'done' },
] as const;

const MOCK_SUGGESTIONS = [
  'Add WebSocket reconnection with exponential backoff',
  'Implement rate limiting for the agent dispatch queue',
  'Create a unified logging pipeline across all repos',
  'Add dark mode theme switching to the dashboard',
];

// Mock pre-generated plan for demo
const MOCK_ELABORATED_PLAN: GeneratedPlan = {
  title: 'Add WebSocket reconnection with exponential backoff',
  summary:
    'Implement automatic WebSocket reconnection logic with exponential backoff and jitter. The reconnection handler will track connection state, emit events for UI updates, and respect a configurable max-retry limit. Changes span the runtime (core logic) and SDK (type exports).',
  type: 'story',
  priority: 'high',
  steps: [
    {
      title: 'Implement reconnection state machine',
      description:
        'Create a ReconnectionManager class that tracks connection state (connected, disconnecting, reconnecting, failed) and manages retry timing with exponential backoff + jitter.',
      repos: ['agent-runtime'],
    },
    {
      title: 'Add reconnection config types to SDK',
      description:
        'Export ReconnectionConfig and ReconnectionEvent interfaces from agent-sdk so consumers can configure retry behavior and listen for state changes.',
      repos: ['agent-sdk'],
    },
    {
      title: 'Wire reconnection into WebSocket transport',
      description:
        'Integrate the ReconnectionManager into the existing WebSocket transport layer, replacing the current naive single-retry approach.',
      repos: ['agent-runtime'],
    },
    {
      title: 'Add integration tests',
      description:
        'Test reconnection behavior with mock server that simulates disconnects, verify backoff timing, and ensure events fire correctly.',
      repos: ['agent-runtime', 'agent-sdk'],
    },
  ],
  complexity: 'medium',
  risks: [
    'Timer accumulation if many rapid disconnects occur',
    'SDK type changes may require downstream consumer updates',
    'WebSocket close codes need careful handling for intentional vs accidental disconnects',
  ],
  affectedRepos: ['agent-runtime', 'agent-sdk'],
  estimatedTasks: 4,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTypeIcon(type: Issue['type']): string {
  switch (type) {
    case 'epic': return '\u25C6';
    case 'story': return '\u25B7';
    case 'bug': return '\u25CF';
    case 'task': return '\u2610';
    case 'subtask': return '\u2514';
    case 'idea': return '\u2605';
    default: return '\u25CB';
  }
}

function getPriorityClass(p: Issue['priority']): string {
  switch (p) {
    case 'critical': return s.priCritical;
    case 'high': return s.priHigh;
    case 'medium': return s.priMedium;
    case 'low': return s.priLow;
    default: return s.priLow;
  }
}

function getStatusAccent(issue: Issue): string {
  if (issue.status === 'blocked') return s.accentBlocked;
  if (issue.status === 'review') return s.accentReview;
  if (issue.status === 'done') return s.accentDone;
  if (issue.status === 'planning' || issue.status === 'analysis') return s.accentPlanning;
  if (issue.tasks.some(t => t.status === 'running')) return s.accentRunning;
  return '';
}

function taskSummaryText(issueTasks: Task[]): string {
  if (issueTasks.length === 0) return 'No tasks';
  const c: Record<string, number> = {};
  for (const t of issueTasks) c[t.status] = (c[t.status] || 0) + 1;
  const parts: string[] = [];
  if (c.running) parts.push(`${c.running} running`);
  if (c.queued) parts.push(`${c.queued} queued`);
  if (c.verifying) parts.push(`${c.verifying} verifying`);
  if (c.review) parts.push(`${c.review} review`);
  if (c.done) parts.push(`${c.done} done`);
  if (c.failed) parts.push(`${c.failed} failed`);
  return parts.join(', ');
}

function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function vStageIcon(status: VerificationStage['status']): string {
  switch (status) {
    case 'passed': return '\u2713';
    case 'failed': return '\u2717';
    case 'warning': return '!';
    case 'running': return '\u2022';
    case 'skipped': return '-';
    default: return '\u25CB';
  }
}

function vStageClass(status: VerificationStage['status']): string {
  switch (status) {
    case 'passed': return s.vPassed;
    case 'failed': return s.vFailed;
    case 'warning': return s.vWarning;
    case 'running': return s.vRunning;
    case 'skipped': return s.vSkipped;
    default: return s.vPending;
  }
}

function taskStatusClass(status: Task['status']): string {
  switch (status) {
    case 'running': return s.tsRunning;
    case 'queued': return s.tsQueued;
    case 'planning': return s.tsPlanning;
    case 'review': return s.tsReview;
    case 'done': return s.tsDone;
    case 'failed': return s.tsFailed;
    case 'blocked': return s.tsBlocked;
    case 'verifying': return s.tsVerifying;
    default: return s.tsQueued;
  }
}

function agentStatusClass(status: Agent['status']): string {
  switch (status) {
    case 'running': return s.agentRunning;
    case 'idle': return s.agentIdle;
    case 'paused': return s.agentPaused;
    case 'errored': return s.agentErrored;
    default: return s.agentIdle;
  }
}

function logTypeClass(entry: TaskLogEntry): string {
  if (entry.type === 'error') return s.logError;
  if (entry.type === 'milestone') return s.logMilestone;
  if (entry.type === 'tool_call') return s.logTool;
  if (entry.type === 'thinking') return s.logThinking;
  return '';
}

function getIssueCost(issue: Issue): number {
  return issue.tasks.reduce((sum, t) => sum + t.costUsd, 0);
}

function getRunningAgentForIssue(issue: Issue): Agent | null {
  for (const task of issue.tasks) {
    if (task.status === 'running' && task.assignedAgent) {
      const agent = getAgent(task.assignedAgent);
      if (agent) return agent;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

function Sidebar({
  selectedIssueId,
  onSelectIssue,
  filter,
  onFilterChange,
}: {
  selectedIssueId: string | null;
  onSelectIssue: (id: string) => void;
  filter: string;
  onFilterChange: (f: string) => void;
}) {
  const filtered = issues.filter(
    i =>
      i.title.toLowerCase().includes(filter.toLowerCase()) ||
      (i.externalId || '').toLowerCase().includes(filter.toLowerCase()) ||
      i.labels.some(l => l.toLowerCase().includes(filter.toLowerCase()))
  );

  const runningCount = tasks.filter(t => t.status === 'running').length;
  const reviewCount = tasks.filter(t => t.status === 'review').length;

  return (
    <div className={s.sidebar} data-testid="metamorph-sidebar">
      {/* Filter */}
      <div className={s.sidebarSection}>
        <input
          className={s.filterInput}
          type="text"
          placeholder="Filter issues..."
          value={filter}
          onChange={e => onFilterChange(e.target.value)}
          data-testid="metamorph-filter"
        />
      </div>

      {/* Quick stats */}
      <div className={s.quickStats}>
        <span className={s.quickStat}>
          <span className={s.quickStatDot} style={{ background: '#10b981' }} />
          {runningCount} running
        </span>
        <span className={s.quickStat}>
          <span className={s.quickStatDot} style={{ background: '#f59e0b' }} />
          {reviewCount} review
        </span>
      </div>

      {/* Issue list */}
      <div className={s.issueList} data-testid="metamorph-issue-list">
        {filtered.map(issue => (
          <div
            key={issue.id}
            className={`${s.issueItem} ${selectedIssueId === issue.id ? s.issueItemSelected : ''} ${getStatusAccent(issue)}`}
            onClick={() => onSelectIssue(issue.id)}
            data-testid={`metamorph-issue-${issue.id}`}
          >
            <div className={s.issueItemHeader}>
              <span className={s.issueItemIcon}>{getTypeIcon(issue.type)}</span>
              {issue.externalId && <span className={s.issueItemId}>{issue.externalId}</span>}
              <span className={`${s.priDot} ${getPriorityClass(issue.priority)}`} />
            </div>
            <div className={s.issueItemTitle}>{issue.title}</div>
            {issue.tasks.length > 0 && (
              <div className={s.issueItemMeta}>{taskSummaryText(issue.tasks)}</div>
            )}
          </div>
        ))}
      </div>

      {/* Agent fleet */}
      <div className={s.sidebarSection} data-testid="metamorph-agents">
        <div className={s.sectionLabel}>Agent Fleet</div>
        {agents.map(agent => (
          <div key={agent.id} className={s.agentRow}>
            <span className={`${s.agentDot} ${agentStatusClass(agent.status)}`} />
            <span className={s.agentLabel}>{agent.name}</span>
            <span className={s.agentModel}>
              {agent.model.includes('sonnet') ? 'Sonnet' : agent.model.includes('opus') ? 'Opus' : 'Haiku'}
            </span>
            <span className={s.agentCost}>${agent.costUsd.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Board Card (compact)
// ---------------------------------------------------------------------------

function BoardCard({
  issue,
  isSelected,
  onSelect,
}: {
  issue: Issue;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const cost = getIssueCost(issue);
  const runningAgent = getRunningAgentForIssue(issue);
  const repoIds = new Set<string>();
  for (const task of issue.tasks) {
    for (const tr of task.repos) repoIds.add(tr.repoId);
  }
  if (issue.plan) {
    for (const r of issue.plan.affectedRepos) repoIds.add(r);
  }

  const primaryTask = issue.tasks.find(t => t.verification.stages.length > 0);
  const isRunning = issue.tasks.some(t => t.status === 'running');

  return (
    <div
      className={`${s.boardCard} ${getStatusAccent(issue)} ${isSelected ? s.boardCardSelected : ''} ${isRunning ? s.boardCardRunning : ''}`}
      onClick={onSelect}
      data-testid={`metamorph-card-${issue.id}`}
    >
      {/* Header */}
      <div className={s.cardHead}>
        <span className={s.cardTypeIcon}>{getTypeIcon(issue.type)}</span>
        {issue.externalId && <span className={s.cardExtId}>{issue.externalId}</span>}
        <span className={`${s.priDot} ${getPriorityClass(issue.priority)}`} />
      </div>

      {/* Title */}
      <div className={s.cardTitle}>{issue.title}</div>

      {/* Labels */}
      {issue.labels.length > 0 && (
        <div className={s.cardLabels}>
          {issue.labels.map(l => (
            <span key={l} className={s.cardLabel}>{l}</span>
          ))}
        </div>
      )}

      {/* Task summary */}
      {issue.tasks.length > 0 && (
        <div className={s.cardTaskSummary}>{taskSummaryText(issue.tasks)}</div>
      )}

      {/* Repos */}
      {repoIds.size > 0 && (
        <div className={s.cardRepos}>
          {Array.from(repoIds).map(rid => {
            const repo = getRepo(rid);
            return <span key={rid} className={s.cardRepo}>{repo?.name || rid}</span>;
          })}
        </div>
      )}

      {/* Verification dots */}
      {primaryTask && (
        <div className={s.cardVerification}>
          {primaryTask.verification.stages.map(stage => (
            <span
              key={stage.id}
              className={`${s.vDot} ${vStageClass(stage.status)}`}
              title={`${stage.label}: ${stage.status}`}
            >
              {vStageIcon(stage.status)}
            </span>
          ))}
        </div>
      )}

      {/* Footer: agent + cost */}
      <div className={s.cardFooter}>
        {runningAgent && (
          <span className={s.cardAgent}>
            <span className={s.cardAgentDot} />
            {runningAgent.name.split(' ').map(w => w[0]).join('')}
          </span>
        )}
        {cost > 0 && <span className={s.cardCost}>${cost.toFixed(2)}</span>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Board Column
// ---------------------------------------------------------------------------

function BoardColumn({
  label,
  color,
  columnIssues,
  selectedId,
  onSelect,
  testId,
}: {
  label: string;
  color: string;
  columnIssues: Issue[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  testId: string;
}) {
  return (
    <div className={s.boardColumn} data-testid={testId}>
      <div className={s.colHeader} style={{ borderTopColor: color }}>
        <span className={s.colLabel}>{label}</span>
        <span className={s.colCount}>{columnIssues.length}</span>
      </div>
      <div className={s.colCards}>
        {columnIssues.length === 0 ? (
          <div className={s.colEmpty}>No issues</div>
        ) : (
          columnIssues.map(issue => (
            <BoardCard
              key={issue.id}
              issue={issue}
              isSelected={selectedId === issue.id}
              onSelect={() => onSelect(issue.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail Panel
// ---------------------------------------------------------------------------

function DetailPanel({ issue }: { issue: Issue }) {
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(
    issue.tasks.find(t => t.status === 'running')?.id || issue.tasks[0]?.id || null
  );

  // Get PR info
  let prInfo: { number: number; url: string } | null = null;
  for (const task of issue.tasks) {
    for (const stage of task.verification.stages) {
      if (stage.type === 'pr' && stage.metadata?.prNumber) {
        prInfo = { number: stage.metadata.prNumber as number, url: (stage.metadata.prUrl as string) || '#' };
      }
    }
  }

  return (
    <div className={s.detail} data-testid="metamorph-detail">
      {/* Issue header */}
      <div className={s.detailHeader}>
        <div className={s.detailHeaderRow}>
          <span className={s.detailTypeIcon}>{getTypeIcon(issue.type)}</span>
          {issue.externalId && (
            <a
              href={issue.externalUrl}
              target="_blank"
              rel="noreferrer"
              className={s.detailExtLink}
            >
              {issue.externalId}
            </a>
          )}
          <span className={`${s.priDot} ${getPriorityClass(issue.priority)}`} />
          {prInfo && (
            <a href={prInfo.url} target="_blank" rel="noreferrer" className={s.detailPrLink}>
              PR #{prInfo.number}
            </a>
          )}
        </div>
        <div className={s.detailTitle}>{issue.title}</div>
        <div className={s.detailDesc}>{issue.description}</div>
        <div className={s.detailLabels}>
          {issue.labels.map(l => (
            <span key={l} className={s.detailLabel}>{l}</span>
          ))}
        </div>
      </div>

      {/* Plan */}
      {issue.plan && (
        <div className={s.detailSection} data-testid="metamorph-detail-plan">
          <div className={s.detailSectionHead}>
            <span className={s.detailSectionTitle}>Plan</span>
            <span className={s.complexityBadge}>{issue.plan.estimatedComplexity}</span>
          </div>
          <div className={s.detailPlanSummary}>{issue.plan.summary}</div>
          <div className={s.planSteps}>
            {issue.plan.steps.map((step, idx) => (
              <div key={step.id} className={s.planStep}>
                <span className={`${s.planStepNum} ${step.status === 'done' ? s.planStepDone : step.status === 'in_progress' ? s.planStepActive : ''}`}>
                  {step.status === 'done' ? '\u2713' : idx + 1}
                </span>
                <div className={s.planStepBody}>
                  <div className={s.planStepTitle}>{step.title}</div>
                  <div className={s.planStepRepos}>
                    {step.repoIds.map(rid => {
                      const repo = getRepo(rid);
                      return <span key={rid} className={s.planStepRepo}>{repo?.name || rid}</span>;
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {issue.plan.risks.length > 0 && (
            <div className={s.riskSection}>
              <div className={s.riskLabel}>Risks</div>
              {issue.plan.risks.map((r, i) => (
                <div key={i} className={s.riskItem}>{r}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tasks */}
      {issue.tasks.length > 0 && (
        <div className={s.detailSection} data-testid="metamorph-detail-tasks">
          <div className={s.detailSectionHead}>
            <span className={s.detailSectionTitle}>Tasks</span>
            <span className={s.detailSectionCount}>{issue.tasks.length}</span>
          </div>
          {issue.tasks.map(task => {
            const isExpanded = expandedTaskId === task.id;
            const agent = task.assignedAgent ? getAgent(task.assignedAgent) : null;
            return (
              <div key={task.id} className={s.taskCard} data-testid={`metamorph-task-${task.id}`}>
                <div
                  className={s.taskCardHeader}
                  onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                >
                  <span className={`${s.taskBadge} ${taskStatusClass(task.status)}`}>
                    {task.status}
                  </span>
                  <span className={s.taskCardTitle}>{task.title}</span>
                  {agent && (
                    <span className={s.taskAgent}>
                      {agent.name.split(' ').map(w => w[0]).join('')}
                    </span>
                  )}
                  <span className={s.taskCardChevron}>{isExpanded ? '\u25B4' : '\u25BE'}</span>
                </div>

                {isExpanded && (
                  <div className={s.taskCardBody}>
                    {/* Verification pipeline */}
                    <div className={s.verifyPipeline}>
                      {task.verification.stages.map(stage => (
                        <div key={stage.id} className={s.verifyStage}>
                          <span className={`${s.verifyDot} ${vStageClass(stage.status)}`}>
                            {vStageIcon(stage.status)}
                          </span>
                          <div className={s.verifyStageMeta}>
                            <span className={s.verifyStageLabel}>{stage.label}</span>
                            {stage.summary && (
                              <span className={s.verifyStageSummary}>{stage.summary}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Repos + files */}
                    {task.repos.map(tr => {
                      const repo = getRepo(tr.repoId);
                      return (
                        <div key={tr.repoId} className={s.taskRepoInfo}>
                          <span className={s.taskRepoName}>{repo?.name || tr.repoId}</span>
                          <span className={s.taskRepoBranch}>{tr.branch}</span>
                          {(tr.additions > 0 || tr.deletions > 0) && (
                            <span className={s.taskRepoDiff}>
                              <span className={s.diffAdd}>+{tr.additions}</span>
                              <span className={s.diffDel}>-{tr.deletions}</span>
                            </span>
                          )}
                          {tr.filesChanged.length > 0 && (
                            <div className={s.taskFiles}>
                              {tr.filesChanged.map(f => (
                                <div key={f} className={s.taskFile}>{f}</div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Log */}
                    {task.log.length > 0 && (
                      <div className={s.taskLog}>
                        {task.log.slice(-6).map((entry, i) => (
                          <div key={i} className={s.logEntry}>
                            <span className={s.logTime}>{formatTimeAgo(entry.timestamp)}</span>
                            {entry.toolName && (
                              <span className={s.logToolName}>{entry.toolName}</span>
                            )}
                            <span className={`${s.logText} ${logTypeClass(entry)}`}>
                              {entry.content}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Task cost */}
                    <div className={s.taskFooter}>
                      {task.costUsd > 0 && (
                        <span className={s.taskCostLabel}>${task.costUsd.toFixed(2)}</span>
                      )}
                      {task.tokensUsed > 0 && (
                        <span className={s.taskTokens}>
                          {task.tokensUsed > 1000
                            ? `${(task.tokensUsed / 1000).toFixed(1)}k`
                            : task.tokensUsed}{' '}
                          tokens
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Actions */}
      <div className={s.detailActions} data-testid="metamorph-detail-actions">
        <button className={`${s.actionBtn} ${s.actionBtnPrimary}`}>Dispatch Agent</button>
        {issue.tasks.some(t => t.status === 'failed') && (
          <button className={`${s.actionBtn} ${s.actionBtnDanger}`}>Retry Failed</button>
        )}
        <button className={s.actionBtn}>Stop All</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AI Prompt Bar (collapsed)
// ---------------------------------------------------------------------------

function PromptBar({
  onExpand,
  elaboration,
  onPromptChange,
}: {
  onExpand: () => void;
  elaboration: ElaborationState;
  onPromptChange: (p: string) => void;
}) {
  return (
    <div className={s.promptBar} data-testid="metamorph-prompt-bar">
      <div className={s.promptBarInner}>
        <span className={s.promptIcon}>AI</span>
        <input
          className={s.promptInput}
          type="text"
          placeholder="Describe what you want to build... AI will help elaborate a plan"
          value={elaboration.prompt}
          onChange={e => onPromptChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && elaboration.prompt.trim()) onExpand();
          }}
          data-testid="metamorph-prompt-input"
        />
        <button
          className={s.promptExpandBtn}
          onClick={onExpand}
          disabled={!elaboration.prompt.trim()}
        >
          Elaborate Plan
        </button>
        <span className={s.promptHint}>Enter to elaborate</span>
      </div>
      {/* Suggestion chips */}
      <div className={s.promptSuggestions} data-testid="metamorph-suggestions">
        {MOCK_SUGGESTIONS.map((sug, i) => (
          <button
            key={i}
            className={s.suggestionChip}
            onClick={() => {
              onPromptChange(sug);
            }}
          >
            {sug}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AI Plan Elaboration View (full screen overlay)
// ---------------------------------------------------------------------------

function ElaborationView({
  elaboration,
  onPromptChange,
  onAnalyze,
  onAccept,
  onBack,
}: {
  elaboration: ElaborationState;
  onPromptChange: (p: string) => void;
  onAnalyze: () => void;
  onAccept: () => void;
  onBack: () => void;
}) {
  return (
    <div className={s.elaboration} data-testid="metamorph-elaboration">
      <div className={s.elabHeader}>
        <button className={s.elabBackBtn} onClick={onBack}>
          {'\u2190'} Back to Board
        </button>
        <span className={s.elabTitle}>AI Plan Elaboration</span>
        <span className={s.elabPhase}>
          {elaboration.phase === 'input' && 'Describe your intent'}
          {elaboration.phase === 'analyzing' && 'Analyzing...'}
          {elaboration.phase === 'ready' && 'Plan ready for review'}
        </span>
      </div>

      <div className={s.elabBody}>
        {/* Left: Prompt editor */}
        <div className={s.elabPromptPanel} data-testid="metamorph-elab-prompt">
          <div className={s.elabPanelHead}>Prompt</div>
          <textarea
            className={s.elabTextarea}
            placeholder="Describe what you want to build in detail. The AI will analyze your codebase, identify affected repos, break the work into tasks, estimate complexity, and flag risks."
            value={elaboration.prompt}
            onChange={e => onPromptChange(e.target.value)}
            data-testid="metamorph-elab-textarea"
          />

          <div className={s.elabContextHints}>
            <div className={s.elabHintLabel}>Context detected</div>
            <div className={s.elabHints}>
              <span className={s.elabHint}>3 repos indexed</span>
              <span className={s.elabHint}>47 source files</span>
              <span className={s.elabHint}>6 active issues</span>
            </div>
          </div>

          <div className={s.elabPromptActions}>
            <button className={s.elabRefineBtn}>Refine with AI</button>
            <button
              className={s.elabSubmitBtn}
              onClick={onAnalyze}
              disabled={!elaboration.prompt.trim()}
            >
              {elaboration.phase === 'analyzing' ? 'Analyzing...' : 'Generate Plan'}
            </button>
          </div>
        </div>

        {/* Right: Generated plan */}
        <div className={s.elabPlanPanel} data-testid="metamorph-elab-plan">
          <div className={s.elabPanelHead}>Generated Plan</div>

          {elaboration.phase === 'input' && (
            <div className={s.elabPlanEmpty}>
              <div className={s.elabPlanEmptyIcon}>AI</div>
              <div className={s.elabPlanEmptyText}>
                Write a prompt and click "Generate Plan" to see the AI-elaborated breakdown
              </div>
            </div>
          )}

          {elaboration.phase === 'analyzing' && (
            <div className={s.elabPlanAnalyzing}>
              <div className={s.elabSpinner} />
              <div className={s.elabAnalyzingText}>
                Analyzing codebase and generating plan...
              </div>
              <div className={s.elabAnalyzingSteps}>
                <div className={s.elabAnalyzingStep}>
                  <span className={s.elabStepDone}>\u2713</span> Scanning repository structure
                </div>
                <div className={s.elabAnalyzingStep}>
                  <span className={s.elabStepDone}>\u2713</span> Identifying affected files
                </div>
                <div className={`${s.elabAnalyzingStep} ${s.elabStepCurrent}`}>
                  <span className={s.elabStepPulse}>\u2022</span> Breaking down into tasks
                </div>
                <div className={s.elabAnalyzingStep}>
                  <span className={s.elabStepPending}>\u25CB</span> Estimating complexity
                </div>
                <div className={s.elabAnalyzingStep}>
                  <span className={s.elabStepPending}>\u25CB</span> Identifying risks
                </div>
              </div>
            </div>
          )}

          {elaboration.phase === 'ready' && elaboration.generatedPlan && (
            <div className={s.elabPlanContent}>
              <div className={s.elabPlanMeta}>
                <span className={s.elabPlanType}>{getTypeIcon(elaboration.generatedPlan.type)} {elaboration.generatedPlan.type}</span>
                <span className={`${s.elabPlanPri} ${getPriorityClass(elaboration.generatedPlan.priority)}`}>{elaboration.generatedPlan.priority}</span>
                <span className={s.elabPlanComplexity}>{elaboration.generatedPlan.complexity}</span>
                <span className={s.elabPlanTasks}>{elaboration.generatedPlan.estimatedTasks} tasks</span>
              </div>

              <div className={s.elabPlanTitle}>{elaboration.generatedPlan.title}</div>
              <div className={s.elabPlanSummary}>{elaboration.generatedPlan.summary}</div>

              {/* Steps */}
              <div className={s.elabStepsList}>
                <div className={s.elabStepsLabel}>Execution Steps</div>
                {elaboration.generatedPlan.steps.map((step, idx) => (
                  <div key={idx} className={s.elabStep}>
                    <span className={s.elabStepIdx}>{idx + 1}</span>
                    <div className={s.elabStepContent}>
                      <div className={s.elabStepTitle}>{step.title}</div>
                      <div className={s.elabStepDesc}>{step.description}</div>
                      <div className={s.elabStepRepos}>
                        {step.repos.map(r => (
                          <span key={r} className={s.elabStepRepoTag}>{r}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Affected repos */}
              <div className={s.elabRepoSection}>
                <div className={s.elabRepoLabel}>Affected Repositories</div>
                <div className={s.elabRepoList}>
                  {elaboration.generatedPlan.affectedRepos.map(r => (
                    <span key={r} className={s.elabRepoTag}>{r}</span>
                  ))}
                </div>
              </div>

              {/* Risks */}
              {elaboration.generatedPlan.risks.length > 0 && (
                <div className={s.elabRiskSection}>
                  <div className={s.elabRiskLabel}>Identified Risks</div>
                  {elaboration.generatedPlan.risks.map((r, i) => (
                    <div key={i} className={s.elabRiskItem}>{r}</div>
                  ))}
                </div>
              )}

              {/* Accept / modify */}
              <div className={s.elabPlanActions}>
                <button className={s.elabAcceptBtn} onClick={onAccept}>
                  Accept &amp; Create Issue
                </button>
                <button className={s.elabModifyBtn}>Modify Plan</button>
                <button className={s.elabDiscardBtn} onClick={onBack}>
                  Discard
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main: Metamorph
// ---------------------------------------------------------------------------

export default function Metamorph() {
  const [viewMode, setViewMode] = useState<ViewMode>('board');
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>('issue-1');
  const [filter, setFilter] = useState('');
  const [elaboration, setElaboration] = useState<ElaborationState>({
    prompt: '',
    phase: 'input',
    generatedPlan: null,
  });

  const selectedIssue = issues.find(i => i.id === selectedIssueId) || null;
  const activeAgents = agents.filter(a => a.status === 'running').length;
  const inFlightTasks = tasks.filter(t => t.status === 'running' || t.status === 'verifying').length;
  const cost = totalCost();

  const handleExpand = () => {
    setViewMode('elaborate');
    // Simulate the "analyzing" phase briefly, then show a pre-generated plan
    setElaboration(prev => ({ ...prev, phase: 'analyzing' }));
    setTimeout(() => {
      setElaboration(prev => ({
        ...prev,
        phase: 'ready',
        generatedPlan: MOCK_ELABORATED_PLAN,
      }));
    }, 100); // near-instant for screenshot purposes
  };

  const handleAcceptPlan = () => {
    setViewMode('board');
    setElaboration({ prompt: '', phase: 'input', generatedPlan: null });
  };

  return (
    <div className={s.shell} data-testid="metamorph-shell">
      {/* Top bar */}
      <div className={s.topBar} data-testid="metamorph-topbar">
        <div className={s.topBarLeft}>
          <span className={s.topBarLogo}>metamorph</span>
          <span className={s.topBarProject}>Universal Agent Host</span>
        </div>
        <div className={s.topBarCenter}>
          <span className={s.topBarStat}>
            <span className={s.topBarStatVal}>{repos.length}</span> repos
          </span>
          <span className={s.topBarStatSep} />
          <span className={s.topBarStat}>
            <span className={s.topBarStatVal}>{issues.length}</span> issues
          </span>
          <span className={s.topBarStatSep} />
          <span className={s.topBarStat}>
            <span className={`${s.topBarStatVal} ${activeAgents > 0 ? s.topBarActive : ''}`}>{activeAgents}</span> agents
          </span>
          <span className={s.topBarStatSep} />
          <span className={s.topBarStat}>
            <span className={s.topBarStatVal}>{inFlightTasks}</span> in flight
          </span>
        </div>
        <div className={s.topBarRight}>
          <span className={s.topBarCost}>${cost.toFixed(2)}</span>
          <button
            className={s.topBarNewBtn}
            onClick={() => {
              setViewMode('elaborate');
              setElaboration({ prompt: '', phase: 'input', generatedPlan: null });
            }}
          >
            + New Issue
          </button>
        </div>
      </div>

      {viewMode === 'board' ? (
        <div className={s.mainLayout}>
          {/* Left: sidebar */}
          <Sidebar
            selectedIssueId={selectedIssueId}
            onSelectIssue={setSelectedIssueId}
            filter={filter}
            onFilterChange={setFilter}
          />

          {/* Center: board */}
          <div className={s.boardArea} data-testid="metamorph-board">
            <div className={s.board}>
              {BOARD_COLUMNS.map(col => {
                const colIssues = issues.filter(col.filter);
                return (
                  <BoardColumn
                    key={col.key}
                    label={col.label}
                    color={col.color}
                    columnIssues={colIssues}
                    selectedId={selectedIssueId}
                    onSelect={setSelectedIssueId}
                    testId={`metamorph-col-${col.key}`}
                  />
                );
              })}
            </div>
          </div>

          {/* Right: detail panel */}
          {selectedIssue && <DetailPanel issue={selectedIssue} />}
        </div>
      ) : (
        <div className={s.mainLayout}>
          <Sidebar
            selectedIssueId={selectedIssueId}
            onSelectIssue={id => {
              setSelectedIssueId(id);
              setViewMode('board');
            }}
            filter={filter}
            onFilterChange={setFilter}
          />
          <ElaborationView
            elaboration={elaboration}
            onPromptChange={p => setElaboration(prev => ({ ...prev, prompt: p }))}
            onAnalyze={handleExpand}
            onAccept={handleAcceptPlan}
            onBack={() => setViewMode('board')}
          />
        </div>
      )}

      {/* Bottom prompt bar (only in board mode) */}
      {viewMode === 'board' && (
        <PromptBar
          onExpand={handleExpand}
          elaboration={elaboration}
          onPromptChange={p => setElaboration(prev => ({ ...prev, prompt: p }))}
        />
      )}
    </div>
  );
}
