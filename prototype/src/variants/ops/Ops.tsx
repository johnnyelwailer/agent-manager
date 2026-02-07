import { useState, useMemo, useCallback } from 'react';
import {
  issues,
  agents,
  project,
  repos,
  getAgent,
  getRepo,
  totalCost,
} from '../../data/workflow-mock';
import type {
  Issue,
  Task,
  VerificationStage,
  TaskLogEntry,
  IssueStatus,
} from '../../types/workflow';
import styles from './Ops.module.css';

// ---------------------------------------------------------------------------
// Constants & Helpers
// ---------------------------------------------------------------------------

/** Issue statuses in display order. */
const STATUS_ORDER: IssueStatus[] = [
  'in_progress',
  'review',
  'analysis',
  'planning',
  'blocked',
  'backlog',
  'done',
];

const STATUS_LABELS: Record<IssueStatus, string> = {
  in_progress: 'In Progress',
  review: 'Review',
  analysis: 'Analysis',
  planning: 'Planning',
  blocked: 'Blocked',
  backlog: 'Backlog',
  done: 'Done',
};

const STATUS_DOT_CLASS: Record<IssueStatus, string> = {
  in_progress: styles.statusInProgress,
  review: styles.statusReview,
  analysis: styles.statusAnalysis,
  planning: styles.statusPlanning,
  blocked: styles.statusBlocked,
  backlog: styles.statusBacklog,
  done: styles.statusDone,
};

const STATUS_BADGE_CLASS: Record<IssueStatus, string> = {
  in_progress: styles.statusBadgeInProgress,
  review: styles.statusBadgeReview,
  analysis: styles.statusBadgeAnalysis,
  planning: styles.statusBadgePlanning,
  blocked: styles.statusBadgeBlocked,
  backlog: styles.statusBadgeBacklog,
  done: styles.statusBadgeDone,
};

function typeIcon(type: Issue['type']): string {
  switch (type) {
    case 'story': return '\u{1F516}';      // bookmark
    case 'bug': return '\u{1F534}';         // red circle
    case 'idea': return '\u{1F4A1}';        // lightbulb
    case 'epic': return '\u{26A1}';         // lightning
    case 'task': return '\u{2611}';         // ballot box checked
    case 'subtask': return '\u{2022}';      // bullet
    default: return '\u{2022}';
  }
}

function stageIcon(type: VerificationStage['type']): string {
  switch (type) {
    case 'prechecks': return '\u{2713}';    // check mark
    case 'ai_review': return 'AI';
    case 'pr': return 'PR';
    case 'approval': return '\u{1F440}';    // eyes
    default: return '\u{2022}';
  }
}

function stageStatusClass(status: VerificationStage['status']): string {
  switch (status) {
    case 'passed': return styles.stagePassed;
    case 'failed': return styles.stageFailed;
    case 'running': return styles.stageRunning;
    case 'warning': return styles.stageWarning;
    case 'pending': return styles.stagePending;
    case 'skipped': return styles.stageSkipped;
    default: return styles.stagePending;
  }
}

function taskStatusClass(status: Task['status']): string {
  switch (status) {
    case 'running': return styles.taskStatusRunning;
    case 'queued': return styles.taskStatusQueued;
    case 'planning': return styles.taskStatusPlanning;
    case 'verifying': return styles.taskStatusVerifying;
    case 'review': return styles.taskStatusReview;
    case 'done': return styles.taskStatusDone;
    case 'failed': return styles.taskStatusFailed;
    case 'blocked': return styles.taskStatusBlocked;
    default: return styles.taskStatusQueued;
  }
}

function logIcon(type: TaskLogEntry['type']): { icon: string; className: string } {
  switch (type) {
    case 'text': return { icon: '\u{25CB}', className: styles.logIconText };
    case 'tool_call': return { icon: '\u{25B6}', className: styles.logIconTool };
    case 'tool_result': return { icon: '\u{25C0}', className: styles.logIconResult };
    case 'error': return { icon: '\u{2716}', className: styles.logIconError };
    case 'thinking': return { icon: '\u{25C6}', className: styles.logIconThinking };
    case 'milestone': return { icon: '\u{2605}', className: styles.logIconMilestone };
    default: return { icon: '\u{25CB}', className: styles.logIconText };
  }
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function modelAbbrev(model: string): string {
  if (model.includes('opus')) return 'Opus';
  if (model.includes('sonnet')) return 'Sonnet';
  if (model.includes('haiku')) return 'Haiku';
  return model.slice(0, 8);
}

function complexityClass(c: string): string {
  switch (c) {
    case 'trivial': return styles.complexityTrivial;
    case 'small': return styles.complexitySmall;
    case 'medium': return styles.complexityMedium;
    case 'large': return styles.complexityLarge;
    case 'epic': return styles.complexityEpic;
    default: return styles.complexityMedium;
  }
}

function priorityBadgeClass(p: Issue['priority']): string {
  switch (p) {
    case 'critical': return styles.priorityBadgeCritical;
    case 'high': return styles.priorityBadgeHigh;
    case 'medium': return styles.priorityBadgeMedium;
    case 'low': return styles.priorityBadgeLow;
    default: return styles.priorityBadgeLow;
  }
}

function priorityDotClass(p: Issue['priority']): string {
  switch (p) {
    case 'critical': return styles.priorityCritical;
    case 'high': return styles.priorityHigh;
    case 'medium': return styles.priorityMedium;
    case 'low': return styles.priorityLow;
    default: return styles.priorityLow;
  }
}

// ---------------------------------------------------------------------------
// Sub-component: VerificationPipelineView
// ---------------------------------------------------------------------------

function VerificationPipelineView({
  stages,
  taskId,
}: {
  stages: VerificationStage[];
  taskId: string;
}) {
  return (
    <div className={styles.verificationPipeline} data-testid={`ops-verification-${taskId}`}>
      {stages.map((stage, idx) => {
        const meta = stage.metadata;
        // Build inline detail text from summary or metadata
        let inlineText = stage.summary ?? '';

        if (stage.type === 'pr' && meta?.prNumber) {
          inlineText = `#${meta.prNumber}`;
        }

        return (
          <span key={stage.id} style={{ display: 'contents' }}>
            {idx > 0 && <span className={styles.pipelineConnector} />}
            <span className={`${styles.pipelineStage} ${stageStatusClass(stage.status)}`}>
              <span className={styles.stageIcon}>{stageIcon(stage.type)}</span>
              {stage.label}
              {inlineText && (
                <>
                  {' '}
                  {meta?.prUrl && stage.type === 'pr' ? (
                    <a
                      href={meta.prUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${styles.stageMetaInline} ${styles.stagePrLink}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {inlineText}
                    </a>
                  ) : (
                    <span className={styles.stageMetaInline}>{inlineText}</span>
                  )}
                </>
              )}
            </span>
          </span>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: TaskLogFeed
// ---------------------------------------------------------------------------

function TaskLogFeed({ log }: { log: TaskLogEntry[] }) {
  const recentLog = log.slice(-8);
  if (recentLog.length === 0) return null;

  return (
    <div className={styles.logSection}>
      <div className={styles.logSectionTitle}>Agent Activity</div>
      <div className={styles.logFeed}>
        {recentLog.map((entry, idx) => {
          const { icon, className: iconClass } = logIcon(entry.type);
          const contentClass =
            entry.type === 'error'
              ? styles.logContentError
              : entry.type === 'milestone'
              ? styles.logContentMilestone
              : '';
          return (
            <div key={idx} className={styles.logEntry}>
              <span className={styles.logTimestamp}>{formatTime(entry.timestamp)}</span>
              <span className={`${styles.logIcon} ${iconClass}`}>{icon}</span>
              <span className={`${styles.logContent} ${contentClass}`}>
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: TaskCard
// ---------------------------------------------------------------------------

function TaskCard({
  task,
  isExpanded,
  onToggle,
}: {
  task: Task;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const [showFiles, setShowFiles] = useState(false);
  const agent = task.assignedAgent ? getAgent(task.assignedAgent) : undefined;
  const isFailed = task.status === 'failed';

  return (
    <div className={`${styles.taskCard} ${isFailed ? styles.taskCardFailed : ''}`}>
      {/* Header */}
      <div className={styles.taskCardHeader} onClick={onToggle}>
        <span
          className={`${styles.taskExpandIcon} ${isExpanded ? styles.taskExpandIconOpen : ''}`}
        >
          {'\u{25B8}'}
        </span>
        <span className={`${styles.taskStatusBadge} ${taskStatusClass(task.status)}`}>
          {task.status.replace('_', ' ')}
        </span>
        <span className={styles.taskTitle}>{task.title}</span>
        {agent && (
          <span className={styles.agentTag}>
            {modelAbbrev(agent.model)}
          </span>
        )}
        {task.costUsd > 0 && (
          <span className={styles.taskCost}>${task.costUsd.toFixed(2)}</span>
        )}
      </div>

      {/* Expanded body */}
      {isExpanded && (
        <div className={styles.taskBody}>
          <div className={styles.taskDescription}>{task.description}</div>

          {/* Repo badges */}
          {task.repos.length > 0 && (
            <div className={styles.taskRepos}>
              {task.repos.map((tr) => {
                const repo = getRepo(tr.repoId);
                return (
                  <span key={tr.repoId} className={styles.taskRepoTag}>
                    <span className={styles.taskRepoName}>{repo?.name ?? tr.repoId}</span>
                    {tr.branch && (
                      <span className={styles.taskRepoBranch}>{tr.branch}</span>
                    )}
                    {(tr.additions > 0 || tr.deletions > 0) && (
                      <span className={styles.taskRepoDiff}>
                        <span className={styles.additions}>+{tr.additions}</span>{' '}
                        <span className={styles.deletions}>-{tr.deletions}</span>
                      </span>
                    )}
                  </span>
                );
              })}
            </div>
          )}

          {/* Verification Pipeline */}
          {task.verification.stages.length > 0 && (
            <VerificationPipelineView stages={task.verification.stages} taskId={task.id} />
          )}

          {/* Files changed */}
          {task.repos.some((tr) => tr.filesChanged.length > 0) && (
            <div className={styles.filesSection}>
              <div
                className={styles.filesToggle}
                onClick={() => setShowFiles(!showFiles)}
              >
                <span>{showFiles ? '\u{25BE}' : '\u{25B8}'}</span>
                Files changed (
                {task.repos.reduce((sum, tr) => sum + tr.filesChanged.length, 0)})
              </div>
              {showFiles && (
                <ul className={styles.filesList}>
                  {task.repos.map((tr) => {
                    const repo = getRepo(tr.repoId);
                    return tr.filesChanged.map((f) => (
                      <li key={`${tr.repoId}-${f}`} className={styles.fileItem}>
                        <span className={styles.fileRepoTag}>
                          {repo?.name ?? tr.repoId}
                        </span>
                        <span className={styles.fileName}>{f}</span>
                      </li>
                    ));
                  })}
                </ul>
              )}
            </div>
          )}

          {/* Agent log */}
          {(task.status === 'running' || task.log.length > 0) && (
            <TaskLogFeed log={task.log} />
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: PlanSection
// ---------------------------------------------------------------------------

function PlanSection({ issue }: { issue: Issue }) {
  const [collapsed, setCollapsed] = useState(false);
  const plan = issue.plan;
  if (!plan) return null;

  return (
    <div className={styles.section} data-testid="ops-plan">
      <div className={styles.sectionHeader} onClick={() => setCollapsed(!collapsed)}>
        <span
          className={`${styles.sectionChevron} ${collapsed ? styles.sectionChevronCollapsed : ''}`}
        >
          {'\u{25BE}'}
        </span>
        <span className={styles.sectionTitle}>Plan</span>
        <span className={`${styles.complexityBadge} ${complexityClass(plan.estimatedComplexity)}`}>
          {plan.estimatedComplexity}
        </span>
      </div>

      {!collapsed && (
        <>
          <p className={styles.planSummary}>{plan.summary}</p>

          <ol className={styles.planSteps}>
            {plan.steps.map((step, idx) => {
              const linkedTask = step.taskId
                ? issue.tasks.find((t) => t.id === step.taskId)
                : undefined;
              const stepNumClass =
                step.status === 'done'
                  ? styles.stepNumberDone
                  : step.status === 'in_progress'
                  ? styles.stepNumberActive
                  : '';

              return (
                <li key={step.id} className={styles.planStep}>
                  <span className={`${styles.stepNumber} ${stepNumClass}`}>
                    {step.status === 'done' ? '\u{2713}' : idx + 1}
                  </span>
                  <div className={styles.stepContent}>
                    <div className={styles.stepTitle}>
                      {step.title}
                      {linkedTask && (
                        <span
                          className={`${styles.taskStatusBadge} ${taskStatusClass(linkedTask.status)}`}
                          style={{ marginLeft: 6, fontSize: 9 }}
                        >
                          {linkedTask.status.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                    {step.repoIds.length > 0 && (
                      <div className={styles.stepRepos}>
                        {step.repoIds.map((rid) => (
                          <span key={rid} className={styles.repoTag}>
                            {getRepo(rid)?.name ?? rid}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>

          {plan.risks.length > 0 && (
            <ul className={styles.planRisks}>
              {plan.risks.map((risk, idx) => (
                <li key={idx} className={styles.planRisk}>
                  <span className={styles.riskIcon}>{'\u{26A0}'}</span>
                  {risk}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: IssueDetail
// ---------------------------------------------------------------------------

function IssueDetail({
  issue,
  expandedTasks,
  onToggleTask,
}: {
  issue: Issue | undefined;
  expandedTasks: Set<string>;
  onToggleTask: (taskId: string) => void;
}) {
  if (!issue) {
    return (
      <div className={styles.detailPanel} data-testid="ops-issue-detail">
        <div className={styles.noSelection}>
          <div className={styles.noSelectionIcon}>{'\u{1F4CB}'}</div>
          <div className={styles.noSelectionText}>Select an issue to view details</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.detailPanel} data-testid="ops-issue-detail">
      {/* Issue Header */}
      <div className={styles.issueHeader}>
        <div className={styles.issueHeaderTop}>
          {issue.externalId && issue.externalUrl ? (
            <a
              href={issue.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.externalIdLink}
            >
              {issue.externalId}
              <span className={styles.externalLinkIcon}>{'\u{2197}'}</span>
            </a>
          ) : issue.externalId ? (
            <span className={styles.externalIdLink}>{issue.externalId}</span>
          ) : null}
          <span className={`${styles.statusBadge} ${STATUS_BADGE_CLASS[issue.status]}`}>
            {STATUS_LABELS[issue.status]}
          </span>
          <span className={`${styles.priorityBadge} ${priorityBadgeClass(issue.priority)}`}>
            {issue.priority}
          </span>
          <span className={styles.typeBadge}>
            {typeIcon(issue.type)} {issue.type}
          </span>
        </div>

        <h2 className={styles.issueTitleLarge}>{issue.title}</h2>
        <p className={styles.issueDescription}>{issue.description}</p>

        {issue.labels.length > 0 && (
          <div className={styles.issueMetaRow}>
            {issue.labels.map((lbl) => (
              <span key={lbl} className={styles.label}>
                {lbl}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Plan */}
      {issue.plan && <PlanSection issue={issue} />}

      {/* Tasks */}
      <div className={styles.section} data-testid="ops-tasks">
        <div className={styles.tasksSectionHeader}>
          <span className={styles.sectionTitle}>Tasks</span>
          <span className={styles.taskCount}>{issue.tasks.length}</span>
        </div>

        {issue.tasks.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyStateIcon}>{'\u{1F4ED}'}</div>
            <div className={styles.emptyStateText}>No tasks yet</div>
            <button className={styles.analyzeBtn}>Analyze &amp; Plan</button>
          </div>
        ) : (
          issue.tasks.map((task) => (
            <TaskCard
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
// Sub-component: IssueList
// ---------------------------------------------------------------------------

function IssueList({
  selectedIssueId,
  onSelectIssue,
  filterText,
  onFilterChange,
  collapsedGroups,
  onToggleGroup,
}: {
  selectedIssueId: string;
  onSelectIssue: (id: string) => void;
  filterText: string;
  onFilterChange: (text: string) => void;
  collapsedGroups: Set<IssueStatus>;
  onToggleGroup: (status: IssueStatus) => void;
}) {
  const filteredIssues = useMemo(() => {
    if (!filterText.trim()) return issues;
    const lower = filterText.toLowerCase();
    return issues.filter(
      (i) =>
        i.title.toLowerCase().includes(lower) ||
        (i.externalId && i.externalId.toLowerCase().includes(lower)) ||
        i.labels.some((l) => l.toLowerCase().includes(lower))
    );
  }, [filterText]);

  const grouped = useMemo(() => {
    const map = new Map<IssueStatus, Issue[]>();
    for (const status of STATUS_ORDER) {
      const matching = filteredIssues.filter((i) => i.status === status);
      if (matching.length > 0) {
        map.set(status, matching);
      }
    }
    return map;
  }, [filteredIssues]);

  return (
    <div className={styles.issueListPanel} data-testid="ops-issue-list">
      <div className={styles.filterBar}>
        <input
          type="text"
          className={styles.filterInput}
          placeholder="Filter issues..."
          value={filterText}
          onChange={(e) => onFilterChange(e.target.value)}
        />
      </div>
      <div className={styles.issueListScroll}>
        {Array.from(grouped.entries()).map(([status, groupIssues]) => {
          const isCollapsed = collapsedGroups.has(status);
          return (
            <div key={status} className={styles.statusGroup}>
              <div
                className={styles.statusGroupHeader}
                onClick={() => onToggleGroup(status)}
              >
                <span>
                  <span
                    className={`${styles.statusGroupChevron} ${
                      isCollapsed ? styles.statusGroupChevronCollapsed : ''
                    }`}
                  >
                    {'\u{25BE}'}
                  </span>{' '}
                  {STATUS_LABELS[status]}
                </span>
                <span className={styles.statusGroupCount}>{groupIssues.length}</span>
              </div>
              {!isCollapsed &&
                groupIssues.map((issue) => (
                  <div
                    key={issue.id}
                    className={`${styles.issueRow} ${
                      selectedIssueId === issue.id ? styles.issueRowSelected : ''
                    }`}
                    data-testid={`ops-issue-${issue.id}`}
                    onClick={() => onSelectIssue(issue.id)}
                  >
                    <span className={styles.issueTypeIcon}>{typeIcon(issue.type)}</span>
                    {issue.externalId ? (
                      <a
                        href={issue.externalUrl ?? '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.issueExternalId}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {issue.externalId}
                      </a>
                    ) : (
                      <span className={styles.issueExternalId} style={{ color: '#52525b' }}>
                        idea
                      </span>
                    )}
                    <span className={styles.issueTitle}>{issue.title}</span>
                    <span className={`${styles.priorityDot} ${priorityDotClass(issue.priority)}`} />
                    {issue.tasks.length > 0 && (
                      <span className={styles.taskCountPill}>
                        {issue.tasks.length} task{issue.tasks.length !== 1 ? 's' : ''}
                      </span>
                    )}
                    <span className={`${styles.statusDot} ${STATUS_DOT_CLASS[issue.status]}`} />
                  </div>
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main: Ops
// ---------------------------------------------------------------------------

export default function Ops() {
  const [selectedIssueId, setSelectedIssueId] = useState('issue-1');
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(() => {
    // Auto-expand running or failed tasks of the default selected issue
    const defaultIssue = issues.find((i) => i.id === 'issue-1');
    const expanded = new Set<string>();
    if (defaultIssue) {
      for (const t of defaultIssue.tasks) {
        if (t.status === 'running' || t.status === 'failed') {
          expanded.add(t.id);
        }
      }
    }
    return expanded;
  });
  const [filterText, setFilterText] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<IssueStatus>>(new Set());

  const selectedIssue = useMemo(
    () => issues.find((i) => i.id === selectedIssueId),
    [selectedIssueId]
  );

  const handleSelectIssue = useCallback(
    (id: string) => {
      setSelectedIssueId(id);
      // Auto-expand running/failed tasks on the new issue
      const issue = issues.find((i) => i.id === id);
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
    },
    []
  );

  const handleToggleTask = useCallback((taskId: string) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }, []);

  const handleToggleGroup = useCallback((status: IssueStatus) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  }, []);

  const activeAgentCount = agents.filter((a) => a.status === 'running').length;
  const cost = totalCost();

  return (
    <div className={styles.shell} data-testid="ops-shell">
      {/* Top Bar */}
      <div className={styles.topbar} data-testid="ops-topbar">
        <div className={styles.projectInfo}>
          <div className={styles.projectAvatar}>U</div>
          <span className={styles.projectName}>{project.name}</span>
        </div>
        <div className={styles.topbarCenter}>
          <span className={styles.repoBadge}>
            {'\u{1F4C1}'} {repos.length} repos
          </span>
        </div>
        <div className={styles.topbarRight}>
          <span className={styles.costBadge}>${cost.toFixed(2)}</span>
          <span className={styles.agentCountBadge}>
            {activeAgentCount} agent{activeAgentCount !== 1 ? 's' : ''} active
          </span>
          <button className={styles.newIssueBtn}>+ New Issue</button>
        </div>
      </div>

      {/* Left Panel: Issue List */}
      <IssueList
        selectedIssueId={selectedIssueId}
        onSelectIssue={handleSelectIssue}
        filterText={filterText}
        onFilterChange={setFilterText}
        collapsedGroups={collapsedGroups}
        onToggleGroup={handleToggleGroup}
      />

      {/* Center Panel: Issue Detail */}
      <IssueDetail
        issue={selectedIssue}
        expandedTasks={expandedTasks}
        onToggleTask={handleToggleTask}
      />
    </div>
  );
}
