import { useState, useMemo, useCallback } from 'react';
import {
  issues,
  agents,
  project,
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
  IssueStatus,
} from '../../types/workflow';
import styles from './GSD.module.css';

// ---------------------------------------------------------------------------
// Constants & Helpers
// ---------------------------------------------------------------------------

function typeIcon(type: Issue['type']): string {
  switch (type) {
    case 'story': return '\u{1F516}';
    case 'bug': return '\u{1F41B}';
    case 'idea': return '\u{1F4A1}';
    case 'epic': return '\u{26A1}';
    case 'task': return '\u{2611}';
    case 'subtask': return '\u{2022}';
    default: return '\u{2022}';
  }
}

function priorityWeight(p: Issue['priority']): number {
  switch (p) {
    case 'critical': return 0;
    case 'high': return 1;
    case 'medium': return 2;
    case 'low': return 3;
    default: return 4;
  }
}

function statusWeight(s: IssueStatus): number {
  switch (s) {
    case 'blocked': return 0;
    case 'in_progress': return 1;
    case 'review': return 2;
    case 'analysis': return 3;
    case 'planning': return 4;
    case 'backlog': return 5;
    case 'done': return 6;
    default: return 7;
  }
}

function statusLabel(s: IssueStatus): string {
  return s.replace('_', ' ');
}

function stageStatusDot(status: VerificationStage['status']): string {
  switch (status) {
    case 'passed': return styles.dotPassed;
    case 'failed': return styles.dotFailed;
    case 'running': return styles.dotRunning;
    case 'warning': return styles.dotWarning;
    case 'pending': return styles.dotPending;
    case 'skipped': return styles.dotSkipped;
    default: return styles.dotPending;
  }
}

function stageLabel(type: VerificationStage['type']): string {
  switch (type) {
    case 'prechecks': return 'Pre';
    case 'ai_review': return 'AI';
    case 'pr': return 'PR';
    case 'approval': return 'Ok';
    default: return '?';
  }
}

function taskStatusClass(status: Task['status']): string {
  switch (status) {
    case 'running': return styles.taskRunning;
    case 'queued': return styles.taskQueued;
    case 'planning': return styles.taskPlanning;
    case 'verifying': return styles.taskVerifying;
    case 'review': return styles.taskReview;
    case 'done': return styles.taskDone;
    case 'failed': return styles.taskFailed;
    case 'blocked': return styles.taskBlocked;
    default: return styles.taskQueued;
  }
}

function agentStatusClass(status: Agent['status']): string {
  switch (status) {
    case 'running': return styles.agentRunning;
    case 'idle': return styles.agentIdle;
    case 'paused': return styles.agentPaused;
    case 'errored': return styles.agentErrored;
    default: return styles.agentIdle;
  }
}

function logEntryIcon(type: TaskLogEntry['type']): { char: string; cls: string } {
  switch (type) {
    case 'text': return { char: '\u{25CB}', cls: styles.logText };
    case 'tool_call': return { char: '\u{25B6}', cls: styles.logTool };
    case 'tool_result': return { char: '\u{25C0}', cls: styles.logResult };
    case 'error': return { char: '\u{2716}', cls: styles.logError };
    case 'thinking': return { char: '\u{25C6}', cls: styles.logThinking };
    case 'milestone': return { char: '\u{2605}', cls: styles.logMilestone };
    default: return { char: '\u{25CB}', cls: styles.logText };
  }
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function modelShort(model: string): string {
  if (model.includes('opus')) return 'Opus';
  if (model.includes('sonnet')) return 'Sonnet';
  if (model.includes('haiku')) return 'Haiku';
  return model.slice(0, 8);
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ---------------------------------------------------------------------------
// Sub: Agent Sidebar
// ---------------------------------------------------------------------------

function AgentCard({ agent }: { agent: Agent }) {
  const currentTask = agent.currentTaskId
    ? tasks.find(t => t.id === agent.currentTaskId)
    : undefined;

  return (
    <div className={styles.agentCard} data-testid={`gsd-agent-${agent.id}`}>
      <div className={styles.agentHeader}>
        <span className={`${styles.agentDot} ${agentStatusClass(agent.status)}`} />
        <span className={styles.agentName}>{agent.name}</span>
        <span className={styles.agentModel}>{modelShort(agent.model)}</span>
      </div>
      <div className={styles.agentMeta}>
        <span className={styles.agentStatus}>{agent.status}</span>
        <span className={styles.agentCost}>${agent.costUsd.toFixed(2)}</span>
        <span className={styles.agentTokens}>
          {(agent.tokensUsed / 1000).toFixed(0)}k tok
        </span>
      </div>
      {currentTask && (
        <div className={styles.agentCurrentTask}>
          <span className={styles.agentTaskLabel}>Working on:</span>
          <span className={styles.agentTaskTitle}>{currentTask.title}</span>
        </div>
      )}
    </div>
  );
}

function AgentSidebar() {
  const runningCount = agents.filter(a => a.status === 'running').length;
  const cost = totalCost();

  return (
    <div className={styles.sidebar} data-testid="gsd-sidebar">
      <div className={styles.sidebarHeader}>
        <span className={styles.sidebarTitle}>Agents</span>
        <span className={styles.sidebarBadge}>
          {runningCount}/{agents.length} active
        </span>
      </div>
      <div className={styles.agentList}>
        {agents.map(agent => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>
      <div className={styles.sidebarStats}>
        <div className={styles.statRow}>
          <span className={styles.statLabel}>Total Cost</span>
          <span className={styles.statValueGreen}>${cost.toFixed(2)}</span>
        </div>
        <div className={styles.statRow}>
          <span className={styles.statLabel}>Repos</span>
          <span className={styles.statValue}>{repos.length}</span>
        </div>
        <div className={styles.statRow}>
          <span className={styles.statLabel}>Open Issues</span>
          <span className={styles.statValue}>
            {issues.filter(i => i.status !== 'done').length}
          </span>
        </div>
        <div className={styles.statRow}>
          <span className={styles.statLabel}>Active Tasks</span>
          <span className={styles.statValueBlue}>
            {tasks.filter(t => t.status === 'running').length}
          </span>
        </div>
      </div>
      <div className={styles.sidebarQuickNav}>
        <div className={styles.quickNavTitle}>Repos</div>
        {repos.map(r => (
          <div key={r.id} className={styles.quickNavItem}>
            <span className={styles.quickNavIcon}>{'\u{1F4C1}'}</span>
            <span className={styles.quickNavLabel}>{r.name}</span>
            <span className={styles.quickNavBranch}>{r.defaultBranch}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub: Priority Queue (center panel)
// ---------------------------------------------------------------------------

function VerificationDots({ task }: { task: Task }) {
  return (
    <div className={styles.verDots}>
      {task.verification.stages.map(stage => (
        <span
          key={stage.id}
          className={`${styles.verDot} ${stageStatusDot(stage.status)}`}
          title={`${stage.label}: ${stage.status}${stage.summary ? ` — ${stage.summary}` : ''}`}
        >
          {stageLabel(stage.type)}
        </span>
      ))}
    </div>
  );
}

function QueueItem({
  issue,
  isSelected,
  onSelect,
}: {
  issue: Issue;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const runningTasks = issue.tasks.filter(t => t.status === 'running');
  const failedTasks = issue.tasks.filter(t => t.status === 'failed');
  const doneTasks = issue.tasks.filter(t => t.status === 'done');
  const totalTasks = issue.tasks.length;
  const hasAttention = failedTasks.length > 0 || issue.status === 'blocked';

  return (
    <div
      className={`${styles.queueItem} ${isSelected ? styles.queueItemSelected : ''} ${hasAttention ? styles.queueItemAttention : ''}`}
      onClick={onSelect}
      data-testid={`gsd-queue-${issue.id}`}
    >
      <div className={styles.queueItemTop}>
        <span className={`${styles.priorityBar} ${styles[`priority${issue.priority.charAt(0).toUpperCase() + issue.priority.slice(1)}`]}`} />
        <span className={styles.queueType}>{typeIcon(issue.type)}</span>
        {issue.externalId && (
          <span className={styles.queueExternalId}>{issue.externalId}</span>
        )}
        <span className={styles.queueTitle}>{issue.title}</span>
        <span className={`${styles.queueStatus} ${styles[`qs${issue.status.charAt(0).toUpperCase() + issue.status.slice(1).replace('_', '')}`]}`}>
          {statusLabel(issue.status)}
        </span>
      </div>

      <div className={styles.queueItemBottom}>
        {/* Task progress */}
        {totalTasks > 0 && (
          <div className={styles.taskProgress}>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${(doneTasks.length / totalTasks) * 100}%` }}
              />
              {runningTasks.length > 0 && (
                <div
                  className={styles.progressActive}
                  style={{
                    left: `${(doneTasks.length / totalTasks) * 100}%`,
                    width: `${(runningTasks.length / totalTasks) * 100}%`,
                  }}
                />
              )}
            </div>
            <span className={styles.progressLabel}>
              {doneTasks.length}/{totalTasks}
            </span>
          </div>
        )}

        {/* Verification dots for running/recent tasks */}
        {(runningTasks.length > 0 || failedTasks.length > 0) && (
          <div className={styles.queueVerifications}>
            {[...runningTasks, ...failedTasks].slice(0, 2).map(t => (
              <VerificationDots key={t.id} task={t} />
            ))}
          </div>
        )}

        {/* Agent avatars */}
        <div className={styles.queueAgents}>
          {[...new Set(issue.tasks.filter(t => t.assignedAgent).map(t => t.assignedAgent!))].map(agentId => {
            const agent = getAgent(agentId);
            if (!agent) return null;
            return (
              <span
                key={agentId}
                className={`${styles.queueAgentDot} ${agentStatusClass(agent.status)}`}
                title={agent.name}
              >
                {modelShort(agent.model).charAt(0)}
              </span>
            );
          })}
        </div>

        <span className={styles.queueTime}>{relativeTime(issue.updatedAt)}</span>
      </div>
    </div>
  );
}

function PriorityQueue({
  selectedId,
  onSelect,
  filter,
  onFilterChange,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
  filter: string;
  onFilterChange: (v: string) => void;
}) {
  const sortedIssues = useMemo(() => {
    let filtered = issues;
    if (filter.trim()) {
      const lower = filter.toLowerCase();
      filtered = issues.filter(
        i =>
          i.title.toLowerCase().includes(lower) ||
          (i.externalId && i.externalId.toLowerCase().includes(lower)) ||
          i.labels.some(l => l.toLowerCase().includes(lower))
      );
    }
    return [...filtered].sort((a, b) => {
      // Sort by: status urgency, then priority, then updated time
      const sw = statusWeight(a.status) - statusWeight(b.status);
      if (sw !== 0) return sw;
      const pw = priorityWeight(a.priority) - priorityWeight(b.priority);
      if (pw !== 0) return pw;
      return b.updatedAt - a.updatedAt;
    });
  }, [filter]);

  const needsAttention = sortedIssues.filter(
    i => i.status === 'blocked' || i.tasks.some(t => t.status === 'failed')
  );
  const inFlight = sortedIssues.filter(
    i => !needsAttention.includes(i) && ['in_progress', 'review', 'analysis'].includes(i.status)
  );
  const ready = sortedIssues.filter(
    i => !needsAttention.includes(i) && !inFlight.includes(i) && i.status !== 'done'
  );
  const done = sortedIssues.filter(i => i.status === 'done');

  return (
    <div className={styles.queue} data-testid="gsd-queue">
      <div className={styles.queueHeader}>
        <h2 className={styles.queueHeading}>Priority Queue</h2>
        <input
          className={styles.queueFilter}
          type="text"
          placeholder="Filter..."
          value={filter}
          onChange={e => onFilterChange(e.target.value)}
        />
      </div>
      <div className={styles.queueScroll}>
        {needsAttention.length > 0 && (
          <div className={styles.queueSection}>
            <div className={`${styles.queueSectionHeader} ${styles.sectionAttention}`}>
              <span>{'\u{26A0}'} Needs Attention</span>
              <span className={styles.sectionCount}>{needsAttention.length}</span>
            </div>
            {needsAttention.map(issue => (
              <QueueItem
                key={issue.id}
                issue={issue}
                isSelected={selectedId === issue.id}
                onSelect={() => onSelect(issue.id)}
              />
            ))}
          </div>
        )}
        {inFlight.length > 0 && (
          <div className={styles.queueSection}>
            <div className={`${styles.queueSectionHeader} ${styles.sectionActive}`}>
              <span>{'\u{1F680}'} In Flight</span>
              <span className={styles.sectionCount}>{inFlight.length}</span>
            </div>
            {inFlight.map(issue => (
              <QueueItem
                key={issue.id}
                issue={issue}
                isSelected={selectedId === issue.id}
                onSelect={() => onSelect(issue.id)}
              />
            ))}
          </div>
        )}
        {ready.length > 0 && (
          <div className={styles.queueSection}>
            <div className={`${styles.queueSectionHeader} ${styles.sectionReady}`}>
              <span>{'\u{1F4CB}'} Ready</span>
              <span className={styles.sectionCount}>{ready.length}</span>
            </div>
            {ready.map(issue => (
              <QueueItem
                key={issue.id}
                issue={issue}
                isSelected={selectedId === issue.id}
                onSelect={() => onSelect(issue.id)}
              />
            ))}
          </div>
        )}
        {done.length > 0 && (
          <div className={styles.queueSection}>
            <div className={`${styles.queueSectionHeader} ${styles.sectionDone}`}>
              <span>{'\u{2705}'} Done</span>
              <span className={styles.sectionCount}>{done.length}</span>
            </div>
            {done.map(issue => (
              <QueueItem
                key={issue.id}
                issue={issue}
                isSelected={selectedId === issue.id}
                onSelect={() => onSelect(issue.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub: Detail Panel (right)
// ---------------------------------------------------------------------------

function DetailPanel({
  issue,
  expandedTasks,
  onToggleTask,
}: {
  issue: Issue | undefined;
  expandedTasks: Set<string>;
  onToggleTask: (id: string) => void;
}) {
  if (!issue) {
    return (
      <div className={styles.detail} data-testid="gsd-detail">
        <div className={styles.detailEmpty}>
          <div className={styles.emptyIcon}>{'\u{1F3AF}'}</div>
          <div className={styles.emptyText}>Select an issue to get shit done</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.detail} data-testid="gsd-detail">
      {/* Issue header */}
      <div className={styles.detailHeader}>
        <div className={styles.detailBadges}>
          {issue.externalId && (
            <a
              href={issue.externalUrl ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.detailExtId}
              onClick={e => e.stopPropagation()}
            >
              {issue.externalId} {'\u{2197}'}
            </a>
          )}
          <span className={`${styles.detailStatusBadge} ${styles[`dsb${issue.status.charAt(0).toUpperCase() + issue.status.slice(1).replace('_', '')}`]}`}>
            {statusLabel(issue.status)}
          </span>
          <span className={`${styles.detailPriorityBadge} ${styles[`dp${issue.priority}`]}`}>
            {issue.priority}
          </span>
        </div>
        <h3 className={styles.detailTitle}>{issue.title}</h3>
        <p className={styles.detailDesc}>{issue.description}</p>
        {issue.labels.length > 0 && (
          <div className={styles.detailLabels}>
            {issue.labels.map(l => (
              <span key={l} className={styles.detailLabel}>{l}</span>
            ))}
          </div>
        )}
      </div>

      {/* Plan */}
      {issue.plan && (
        <div className={styles.detailSection} data-testid="gsd-plan">
          <div className={styles.detailSectionHeader}>
            <span className={styles.detailSectionTitle}>Plan</span>
            <span className={`${styles.complexityBadge} ${styles[`cx${issue.plan.estimatedComplexity}`]}`}>
              {issue.plan.estimatedComplexity}
            </span>
          </div>
          <p className={styles.planSummary}>{issue.plan.summary}</p>
          <div className={styles.planSteps}>
            {issue.plan.steps.map((step, idx) => {
              const linked = step.taskId
                ? issue.tasks.find(t => t.id === step.taskId)
                : undefined;
              return (
                <div key={step.id} className={styles.planStep}>
                  <span className={`${styles.stepNum} ${step.status === 'done' ? styles.stepDone : step.status === 'in_progress' ? styles.stepActive : ''}`}>
                    {step.status === 'done' ? '\u{2713}' : idx + 1}
                  </span>
                  <span className={styles.stepTitle}>{step.title}</span>
                  {linked && (
                    <span className={`${styles.stepTaskBadge} ${taskStatusClass(linked.status)}`}>
                      {linked.status.replace('_', ' ')}
                    </span>
                  )}
                  {step.repoIds.length > 0 && (
                    <span className={styles.stepRepos}>
                      {step.repoIds.map(rid => (
                        <span key={rid} className={styles.miniRepoTag}>
                          {getRepo(rid)?.name ?? rid}
                        </span>
                      ))}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {issue.plan.risks.length > 0 && (
            <div className={styles.planRisks}>
              {issue.plan.risks.map((r, i) => (
                <div key={i} className={styles.planRisk}>
                  <span className={styles.riskIcon}>{'\u{26A0}'}</span> {r}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tasks */}
      <div className={styles.detailSection} data-testid="gsd-tasks">
        <div className={styles.detailSectionHeader}>
          <span className={styles.detailSectionTitle}>Tasks</span>
          <span className={styles.taskCounter}>{issue.tasks.length}</span>
        </div>
        {issue.tasks.length === 0 ? (
          <div className={styles.noTasks}>
            <button className={styles.actionBtn}>Analyze & Plan</button>
          </div>
        ) : (
          issue.tasks.map(task => (
            <TaskDetail
              key={task.id}
              task={task}
              isExpanded={expandedTasks.has(task.id)}
              onToggle={() => onToggleTask(task.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub: Task Detail Card
// ---------------------------------------------------------------------------

function TaskDetail({
  task,
  isExpanded,
  onToggle,
}: {
  task: Task;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const agent = task.assignedAgent ? getAgent(task.assignedAgent) : undefined;

  return (
    <div className={`${styles.taskCard} ${task.status === 'failed' ? styles.taskCardFailed : ''}`}>
      <div className={styles.taskHeader} onClick={onToggle}>
        <span className={`${styles.taskExpand} ${isExpanded ? styles.taskExpandOpen : ''}`}>
          {'\u{25B8}'}
        </span>
        <span className={`${styles.taskBadge} ${taskStatusClass(task.status)}`}>
          {task.status.replace('_', ' ')}
        </span>
        <span className={styles.taskTitle}>{task.title}</span>
        {agent && (
          <span className={styles.taskAgent}>{modelShort(agent.model)}</span>
        )}
        {task.costUsd > 0 && (
          <span className={styles.taskCost}>${task.costUsd.toFixed(2)}</span>
        )}
      </div>

      {isExpanded && (
        <div className={styles.taskBody}>
          <p className={styles.taskDesc}>{task.description}</p>

          {/* Repos */}
          {task.repos.length > 0 && (
            <div className={styles.taskRepos}>
              {task.repos.map(tr => {
                const repo = getRepo(tr.repoId);
                return (
                  <span key={tr.repoId} className={styles.taskRepoTag}>
                    <span className={styles.repoName}>{repo?.name ?? tr.repoId}</span>
                    {tr.branch && <span className={styles.repoBranch}>{tr.branch}</span>}
                    {(tr.additions > 0 || tr.deletions > 0) && (
                      <span className={styles.repoDiff}>
                        <span className={styles.diffAdd}>+{tr.additions}</span>
                        <span className={styles.diffDel}>-{tr.deletions}</span>
                      </span>
                    )}
                  </span>
                );
              })}
            </div>
          )}

          {/* Verification pipeline */}
          <div className={styles.verPipeline}>
            {task.verification.stages.map((stage, idx) => (
              <span key={stage.id} style={{ display: 'contents' }}>
                {idx > 0 && <span className={styles.verConnector} />}
                <span className={`${styles.verStage} ${stageStatusDot(stage.status)}`}>
                  <span className={styles.verStageIcon}>{stageLabel(stage.type)}</span>
                  {stage.label}
                  {stage.summary && (
                    <span className={styles.verStageMeta}>{stage.summary}</span>
                  )}
                </span>
              </span>
            ))}
          </div>

          {/* Log */}
          {task.log.length > 0 && (
            <div className={styles.taskLog}>
              <div className={styles.taskLogHeader}>Activity</div>
              {task.log.slice(-6).map((entry, idx) => {
                const { char, cls } = logEntryIcon(entry.type);
                return (
                  <div key={idx} className={styles.logEntry}>
                    <span className={styles.logTime}>{formatTime(entry.timestamp)}</span>
                    <span className={`${styles.logIcon} ${cls}`}>{char}</span>
                    <span className={`${styles.logContent} ${entry.type === 'error' ? styles.logContentErr : ''}`}>
                      {entry.toolName && (
                        <span className={styles.logToolName}>{entry.toolName}</span>
                      )}{' '}
                      {entry.content}
                      {entry.repoId && (
                        <span className={styles.logRepoTag}>
                          {getRepo(entry.repoId)?.name ?? entry.repoId}
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub: Command Bar
// ---------------------------------------------------------------------------

function CommandBar() {
  const [value, setValue] = useState('');

  const suggestions = [
    { key: 'dispatch', label: 'Dispatch next queued task', shortcut: 'D' },
    { key: 'retry', label: 'Retry failed task', shortcut: 'R' },
    { key: 'approve', label: 'Approve pending PR', shortcut: 'A' },
    { key: 'plan', label: 'Analyze & plan issue', shortcut: 'P' },
  ];

  return (
    <div className={styles.commandBar} data-testid="gsd-command-bar">
      <div className={styles.commandInputWrap}>
        <span className={styles.commandPrompt}>{'\u{276F}'}</span>
        <input
          className={styles.commandInput}
          type="text"
          placeholder="What needs to get done? Type a command or describe a task..."
          value={value}
          onChange={e => setValue(e.target.value)}
        />
        <div className={styles.commandHints}>
          {suggestions.map(s => (
            <span key={s.key} className={styles.commandHint}>
              <span className={styles.hintKey}>{s.shortcut}</span>
              {s.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main: GSD
// ---------------------------------------------------------------------------

export default function GSD() {
  const [selectedIssueId, setSelectedIssueId] = useState('issue-2'); // blocked issue first
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(() => {
    const expanded = new Set<string>();
    // Auto-expand running/failed tasks of selected issue
    const issue = issues.find(i => i.id === 'issue-2');
    if (issue) {
      for (const t of issue.tasks) {
        if (t.status === 'running' || t.status === 'failed') {
          expanded.add(t.id);
        }
      }
    }
    return expanded;
  });
  const [filter, setFilter] = useState('');

  const selectedIssue = useMemo(
    () => issues.find(i => i.id === selectedIssueId),
    [selectedIssueId]
  );

  const handleSelect = useCallback((id: string) => {
    setSelectedIssueId(id);
    const issue = issues.find(i => i.id === id);
    if (issue) {
      const expanded = new Set<string>();
      for (const t of issue.tasks) {
        if (t.status === 'running' || t.status === 'failed') {
          expanded.add(t.id);
        }
      }
      setExpandedTasks(expanded);
    } else {
      setExpandedTasks(new Set());
    }
  }, []);

  const handleToggleTask = useCallback((taskId: string) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  const runningCount = agents.filter(a => a.status === 'running').length;
  const failedCount = tasks.filter(t => t.status === 'failed').length;
  const reviewCount = tasks.filter(t => t.status === 'review').length;
  const cost = totalCost();

  return (
    <div className={styles.shell} data-testid="gsd-shell">
      {/* Top Bar */}
      <div className={styles.topbar} data-testid="gsd-topbar">
        <div className={styles.topLeft}>
          <span className={styles.gsdLogo}>GSD</span>
          <span className={styles.projectName}>{project.name}</span>
        </div>
        <div className={styles.topCenter}>
          <div className={styles.topStat}>
            <span className={styles.topStatIcon}>{'\u{1F916}'}</span>
            <span className={styles.topStatValue}>{runningCount}</span>
            <span className={styles.topStatLabel}>agents</span>
          </div>
          {failedCount > 0 && (
            <div className={`${styles.topStat} ${styles.topStatAlert}`}>
              <span className={styles.topStatIcon}>{'\u{26A0}'}</span>
              <span className={styles.topStatValue}>{failedCount}</span>
              <span className={styles.topStatLabel}>failed</span>
            </div>
          )}
          {reviewCount > 0 && (
            <div className={styles.topStat}>
              <span className={styles.topStatIcon}>{'\u{1F440}'}</span>
              <span className={styles.topStatValue}>{reviewCount}</span>
              <span className={styles.topStatLabel}>review</span>
            </div>
          )}
          <div className={styles.topStat}>
            <span className={styles.topStatIcon}>{'\u{1F4B0}'}</span>
            <span className={styles.topStatValueGreen}>${cost.toFixed(2)}</span>
          </div>
        </div>
        <div className={styles.topRight}>
          <button className={styles.topAction}>+ Issue</button>
          <button className={styles.topActionSecondary}>Dispatch All</button>
        </div>
      </div>

      {/* 3-panel body */}
      <div className={styles.body}>
        <AgentSidebar />
        <PriorityQueue
          selectedId={selectedIssueId}
          onSelect={handleSelect}
          filter={filter}
          onFilterChange={setFilter}
        />
        <DetailPanel
          issue={selectedIssue}
          expandedTasks={expandedTasks}
          onToggleTask={handleToggleTask}
        />
      </div>

      {/* Command Bar */}
      <CommandBar />
    </div>
  );
}
