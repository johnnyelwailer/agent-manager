import { useMemo } from 'react';
import { agents, executions, verifications, strategies } from '../../data/mock';
import type { StrategyPrimitive } from '../../types/primitives';
import s from './StartupDashboard.module.css';

// ── Helpers ──

function abbreviateModel(model: string): string {
  if (model.includes('sonnet-4-5')) return 'sonnet-4.5';
  if (model.includes('opus-4-6')) return 'opus-4.6';
  if (model.includes('haiku-4-5')) return 'haiku-4.5';
  return model.replace(/^claude-/, '').replace(/-\d{8}$/, '');
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function timeAgo(ts: number): string {
  const diffMs = Date.now() - ts;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m ago`;
}

function agentInitial(name: string): string {
  const parts = name.split(' ');
  if (parts.length >= 2) return parts[1][0];
  return name[0];
}

function countCompleted(children: StrategyPrimitive[]): number {
  return children.filter((c) => c.status === 'completed').length;
}

// ── Status icon chars (plain text, no emojis) ──

function execStatusIcon(status: string): string {
  switch (status) {
    case 'completed': return '\u2713'; // checkmark
    case 'running': return '\u25CF';   // filled circle
    case 'queued': return '\u25CB';    // empty circle
    case 'failed': return '\u2717';    // X mark
    case 'paused': return '\u25D0';    // half circle
    default: return '\u25CB';
  }
}

function execStatusClass(status: string): string {
  switch (status) {
    case 'completed': return s.taskStatusCompleted;
    case 'running': return s.taskStatusRunning;
    case 'queued': return s.taskStatusQueued;
    case 'failed': return s.taskStatusFailed;
    case 'paused': return s.taskStatusPaused;
    default: return s.taskStatusQueued;
  }
}

// ── Sub-components ──

function WelcomeHeader() {
  const inProgress = executions.filter((e) => e.status === 'running').length;
  const awaitingReview = verifications.filter(
    (v) => v.status === 'needs_review' || v.status === 'pending',
  ).length;
  const totalCost = agents.reduce((sum, a) => sum + a.costUsd, 0);

  return (
    <header className={s.welcomeHeader} data-testid="startup-dashboard-welcome">
      <h1 className={s.welcomeTitle}>Welcome back</h1>
      <div className={s.welcomeSummary}>
        <span className={s.summaryHighlight}>{inProgress} task{inProgress !== 1 ? 's' : ''} in progress</span>
        <span className={s.summarySeparator}>{'\u00B7'}</span>
        <span className={s.summaryHighlight}>{awaitingReview} awaiting review</span>
        <span className={s.summarySeparator}>{'\u00B7'}</span>
        <span className={s.summaryCost}>${totalCost.toFixed(2)} today</span>
      </div>
    </header>
  );
}

function RecentTasks() {
  const sorted = useMemo(() => {
    const withTime = executions
      .filter((e) => e.startedAt != null)
      .sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0));
    const queued = executions.filter((e) => e.startedAt == null);
    return [...withTime, ...queued];
  }, []);

  return (
    <div className={s.card} data-testid="startup-dashboard-tasks">
      <div className={s.cardHeader}>
        Recent Tasks
        <span className={s.countBadge}>{executions.length}</span>
      </div>
      <div className={s.cardBody}>
        {sorted.map((exec) => {
          const agent = exec.assignedAgent
            ? agents.find((a) => a.id === exec.assignedAgent)
            : null;
          return (
            <div className={s.taskItem} key={exec.id}>
              <div className={`${s.taskStatusIcon} ${execStatusClass(exec.status)}`}>
                {execStatusIcon(exec.status)}
              </div>
              <div className={s.taskInfo}>
                <div className={s.taskTitle}>{exec.title}</div>
                <div className={s.taskMeta}>
                  {agent && <span className={s.taskAgent}>{agent.name}</span>}
                  {exec.startedAt && (
                    <span className={s.taskTime}>{timeAgo(exec.startedAt)}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AgentActivity() {
  return (
    <div className={s.card} data-testid="startup-dashboard-agents">
      <div className={s.cardHeader}>
        <span className={s.liveDot} />
        Agent Activity
      </div>
      <div className={s.cardBody}>
        {agents.map((agent) => {
          const currentExec = agent.currentTask
            ? executions.find((e) => e.id === agent.currentTask)
            : null;
          const lastLog =
            currentExec && currentExec.log.length > 0
              ? currentExec.log[currentExec.log.length - 1]
              : null;

          const avatarClass =
            agent.status === 'running'
              ? s.agentAvatarRunning
              : agent.status === 'errored'
                ? s.agentAvatarErrored
                : s.agentAvatarIdle;

          let statusDescription: string;
          let statusIsError = false;
          if (agent.status === 'running' && currentExec) {
            statusDescription = `Working on: ${currentExec.title}`;
          } else if (agent.status === 'idle') {
            statusDescription = 'Idle \u2014 ready for dispatch';
          } else if (agent.status === 'errored') {
            const errorEntry = currentExec?.log
              .slice()
              .reverse()
              .find((l) => l.type === 'error');
            statusDescription = errorEntry
              ? `Error: Task failed (${errorEntry.content.slice(0, 50)})`
              : 'Error: Task failed';
            statusIsError = true;
          } else if (agent.status === 'paused') {
            statusDescription = 'Paused';
          } else {
            statusDescription = agent.status;
          }

          return (
            <div className={s.agentSection} key={agent.id}>
              <div className={s.agentHeader}>
                <div className={`${s.agentAvatar} ${avatarClass}`}>
                  {agentInitial(agent.name)}
                </div>
                <div className={s.agentNameGroup}>
                  <div className={s.agentName}>{agent.name}</div>
                  <div className={s.agentModel}>{abbreviateModel(agent.model)}</div>
                </div>
              </div>
              <div
                className={
                  statusIsError
                    ? `${s.agentStatusLabel} ${s.agentStatusLabelError}`
                    : s.agentStatusLabel
                }
              >
                {statusDescription}
              </div>
              {agent.status === 'running' && lastLog && (
                <div className={s.agentStream}>{lastLog.content}</div>
              )}
              <div className={s.agentStats}>
                <span>${agent.costUsd.toFixed(2)}</span>
                <span>{formatTokens(agent.tokensUsed)} tokens</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StrategyProgress() {
  return (
    <div className={s.card} data-testid="startup-dashboard-strategy">
      <div className={s.cardHeader}>Strategy Progress</div>
      <div className={s.cardBody}>
        {strategies.map((phase) => {
          const total = phase.children.length;
          const completed = countCompleted(phase.children);
          const pct = total > 0 ? (completed / total) * 100 : 0;
          const isActive = phase.status === 'active';

          return (
            <div className={s.strategyPhase} key={phase.id}>
              <div className={s.phaseHeader}>
                <span className={s.phaseName}>{phase.title}</span>
                <span
                  className={`${s.phaseBadge} ${
                    isActive ? s.phaseBadgeActive : s.phaseBadgeDraft
                  }`}
                >
                  {phase.status}
                </span>
              </div>
              <div className={s.progressBarTrack}>
                <div
                  className={s.progressBarFill}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className={s.childList}>
                {phase.children.map((child) => {
                  const dotClass =
                    child.status === 'completed'
                      ? s.childDotCompleted
                      : child.status === 'active'
                        ? s.childDotActive
                        : s.childDotDraft;
                  return (
                    <div className={s.childItem} key={child.id}>
                      <div className={`${s.childDot} ${dotClass}`} />
                      <span className={s.childLabel}>{child.title}</span>
                    </div>
                  );
                })}
              </div>
              <div className={s.progressFraction}>
                {completed}/{total}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QuickActions() {
  const reviewCount = verifications.filter(
    (v) => v.status === 'needs_review' || v.status === 'pending',
  ).length;

  return (
    <div className={s.actionsBar} data-testid="startup-dashboard-actions">
      <button className={`${s.actionBtn} ${s.actionBtnPrimary}`}>
        <span className={s.actionBtnIcon}>+</span>
        New Task
      </button>
      <button className={`${s.actionBtn} ${s.actionBtnOutline}`}>
        <span className={s.actionBtnIcon}>{'\u2630'}</span>
        Plan
      </button>
      <button className={`${s.actionBtn} ${s.actionBtnOutline}`}>
        <span className={s.actionBtnIcon}>{'\u25C9'}</span>
        Review Queue
        {reviewCount > 0 && (
          <span className={s.reviewBadge}>{reviewCount}</span>
        )}
      </button>
      <button className={`${s.actionBtn} ${s.actionBtnOutline}`}>
        <span className={s.actionBtnIcon}>{'\u25B2'}</span>
        Deploy
      </button>
    </div>
  );
}

// ── Main Component ──

export default function StartupDashboard() {
  return (
    <div className={s.shell} data-testid="startup-dashboard-shell">
      <WelcomeHeader />
      <div className={s.contentGrid}>
        <RecentTasks />
        <AgentActivity />
        <StrategyProgress />
      </div>
      <QuickActions />
    </div>
  );
}
