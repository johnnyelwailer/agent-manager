import { useMemo } from 'react';
import { agents, executions, verifications } from '../../data/mock';
import type {
  AgentInfo,
  ExecutionPrimitive,
  ExecutionLogEntry,
  VerificationPrimitive,
} from '../../types/primitives';
import s from './NerveCenter.module.css';

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

function shortTime(ts: number): string {
  const diffMs = Date.now() - ts;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return '<1m';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h${mins % 60}m`;
}

function getVerTypeIcon(type: VerificationPrimitive['type']): string {
  switch (type) {
    case 'test_run': return 'T';
    case 'lint': return 'L';
    case 'diff_review': return 'D';
    case 'human_approval': return 'H';
  }
}

function getVerTypeLabel(type: VerificationPrimitive['type']): string {
  switch (type) {
    case 'test_run': return 'tests';
    case 'lint': return 'lint';
    case 'diff_review': return 'diff';
    case 'human_approval': return 'approval';
  }
}

function getVerStatusMark(status: VerificationPrimitive['status']): string {
  switch (status) {
    case 'passed': return ' [pass]';
    case 'failed': return ' [fail]';
    case 'needs_review': return ' [review]';
    case 'pending': return ' [pending]';
  }
}

// ── Attention item types ──

type AttentionUrgency = 'error' | 'review' | 'approval' | 'blocked';

interface AttentionItem {
  id: string;
  urgency: AttentionUrgency;
  title: string;
  description: string;
  timeAgo: string;
  sourceId: string;
}

function buildAttentionQueue(
  execs: ExecutionPrimitive[],
  vers: VerificationPrimitive[],
): AttentionItem[] {
  const items: AttentionItem[] = [];

  // Errors: failed executions
  for (const exec of execs) {
    if (exec.status === 'failed') {
      const lastError = [...exec.log].reverse().find((l) => l.type === 'error');
      items.push({
        id: `attn-err-${exec.id}`,
        urgency: 'error',
        title: `${exec.id}: ${exec.title}`,
        description: lastError?.content ?? 'Execution failed',
        timeAgo: exec.completedAt ? timeAgo(exec.completedAt) : '',
        sourceId: exec.id,
      });
    }
  }

  // Reviews: verifications with needs_review
  for (const ver of vers) {
    if (ver.status === 'needs_review') {
      items.push({
        id: `attn-rev-${ver.id}`,
        urgency: 'review',
        title: `${ver.id}: ${getVerTypeLabel(ver.type)} results`,
        description: ver.details,
        timeAgo: '',
        sourceId: ver.executionId,
      });
    }
  }

  // Approvals: verifications pending human_approval
  for (const ver of vers) {
    if (ver.status === 'pending' && ver.type === 'human_approval') {
      items.push({
        id: `attn-appr-${ver.id}`,
        urgency: 'approval',
        title: `${ver.id}: Human approval needed`,
        description: ver.details,
        timeAgo: '',
        sourceId: ver.executionId,
      });
    }
  }

  // Blocked: paused executions
  for (const exec of execs) {
    if (exec.status === 'paused') {
      const lastLog = exec.log.length > 0 ? exec.log[exec.log.length - 1] : null;
      items.push({
        id: `attn-block-${exec.id}`,
        urgency: 'blocked',
        title: `${exec.id}: Paused`,
        description: lastLog?.content ?? 'Execution paused',
        timeAgo: exec.startedAt ? timeAgo(exec.startedAt) : '',
        sourceId: exec.id,
      });
    }
  }

  return items;
}

// ── Sub-components ──

function MetricsBar() {
  // Burn rate: only running agents contribute.
  // agent-1 has $0.42 in 15min => $1.68/hr
  const runningAgents = agents.filter((a) => a.status === 'running');
  const burnRate = runningAgents.reduce((sum, agent) => {
    const agentExec = executions.find(
      (e) => e.assignedAgent === agent.id && e.status === 'running',
    );
    if (agentExec?.startedAt && agentExec.costUsd !== undefined) {
      const durationMin = (Date.now() - agentExec.startedAt) / 60_000;
      if (durationMin > 0) {
        return sum + (agentExec.costUsd / durationMin) * 60;
      }
    }
    return sum;
  }, 0);

  const activeCount = runningAgents.length;
  const totalAgents = agents.length;

  const runningExecs = executions.filter((e) => e.status === 'running').length;
  const queuedExecs = executions.filter((e) => e.status === 'queued').length;

  const reviewCount = verifications.filter(
    (v) => v.status === 'needs_review' || v.status === 'pending',
  ).length;

  const totalCost = agents.reduce((sum, a) => sum + a.costUsd, 0);

  return (
    <div className={s.metricsBar} data-testid="nerve-center-metrics">
      <div className={s.metricTile}>
        <div>
          <div className={s.metricLabel}>Burn Rate</div>
          <div className={`${s.metricValue} ${s.metricValueGreen}`}>
            ${burnRate.toFixed(2)}/hr
          </div>
        </div>
      </div>
      <div className={s.metricTile}>
        <div className={`${s.metricDot} ${activeCount > 0 ? s.metricDotGreen : ''}`} />
        <div>
          <div className={s.metricLabel}>Active Agents</div>
          <div className={s.metricValue}>
            {activeCount} of {totalAgents}
          </div>
        </div>
      </div>
      <div className={s.metricTile}>
        <div>
          <div className={s.metricLabel}>Tasks In Flight</div>
          <div className={s.metricValue}>
            {runningExecs} running, {queuedExecs} queued
          </div>
        </div>
      </div>
      <div className={s.metricTile}>
        <div className={`${s.metricDot} ${reviewCount > 0 ? s.metricDotAmber : ''}`} />
        <div>
          <div className={s.metricLabel}>Review Queue</div>
          <div className={`${s.metricValue} ${reviewCount > 0 ? s.metricValueAmber : ''}`}>
            {reviewCount}
          </div>
        </div>
      </div>
      <div className={s.metricTile}>
        <div>
          <div className={s.metricLabel}>Total Cost</div>
          <div className={`${s.metricValue} ${s.metricValuePurple}`}>
            ${totalCost.toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  );
}

function AgentFleetPanel() {
  return (
    <div className={s.fleetPanel} data-testid="nerve-center-fleet">
      <div className={s.sectionHeader}>
        <div className={s.liveDot} />
        AGENT FLEET
      </div>
      <div className={s.fleetList}>
        {agents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>
    </div>
  );
}

function AgentCard({ agent }: { agent: AgentInfo }) {
  const statusDotClass = (() => {
    switch (agent.status) {
      case 'running': return s.statusDotRunning;
      case 'idle': return s.statusDotIdle;
      case 'errored': return s.statusDotErrored;
      case 'paused': return s.statusDotPaused;
      default: return s.statusDotIdle;
    }
  })();

  const currentExec = agent.currentTask
    ? executions.find((e) => e.id === agent.currentTask)
    : null;

  const lastLog =
    currentExec && currentExec.log.length > 0
      ? currentExec.log[currentExec.log.length - 1]
      : null;

  const uptime = currentExec?.startedAt ? shortTime(currentExec.startedAt) : '--';

  const cardClass = `${s.agentCard} ${agent.status === 'errored' ? s.agentCardErrored : ''}`;

  return (
    <div className={cardClass}>
      <div className={s.agentCardRow}>
        <div className={`${s.statusDot} ${statusDotClass}`} />
        <span className={s.agentCardName}>{agent.name}</span>
        <span className={s.agentCardModel}>{abbreviateModel(agent.model)}</span>
        {agent.status === 'errored' && (
          <span className={s.errorIcon}>[ERR]</span>
        )}
      </div>
      {currentExec && (
        <div className={s.agentCardTask}>{currentExec.title}</div>
      )}
      <div className={s.agentCardStats}>
        <span>{formatTokens(agent.tokensUsed)}</span>
        <span>${agent.costUsd.toFixed(2)}</span>
        <span>{uptime}</span>
      </div>
      {agent.status === 'running' && lastLog && (
        <div className={`${s.agentMiniStream} ${s.agentMiniStreamPulse}`}>
          {lastLog.content}
        </div>
      )}
    </div>
  );
}

function VerificationWall() {
  return (
    <div className={s.verificationPanel} data-testid="nerve-center-verifications">
      <div className={s.sectionHeader}>VERIFICATION WALL</div>
      <div className={s.verificationGrid}>
        {verifications.map((ver) => (
          <VerBadge key={ver.id} ver={ver} />
        ))}
      </div>
    </div>
  );
}

function VerBadge({ ver }: { ver: VerificationPrimitive }) {
  const iconClass = (() => {
    switch (ver.status) {
      case 'passed': return s.verIconPassed;
      case 'failed': return s.verIconFailed;
      case 'needs_review': return s.verIconNeedsReview;
      case 'pending': return s.verIconPending;
    }
  })();

  return (
    <div className={s.verBadge}>
      <div className={`${s.verIcon} ${iconClass}`}>
        {getVerTypeIcon(ver.type)}
      </div>
      <div className={s.verLabel}>
        {ver.executionId} {getVerTypeLabel(ver.type)}{getVerStatusMark(ver.status)}
      </div>
    </div>
  );
}

function ExecutionTimeline() {
  // Collect all agent-assigned executions for swimlanes
  const agentSwimlanes = useMemo(() => {
    return agents.map((agent) => {
      const agentExecs = executions.filter((e) => e.assignedAgent === agent.id);
      return { agent, executions: agentExecs };
    });
  }, []);

  // Timeline range: from earliest startedAt to now
  const now = Date.now();
  const allStartTimes = executions
    .filter((e) => e.startedAt)
    .map((e) => e.startedAt as number);
  const timelineStart = allStartTimes.length > 0 ? Math.min(...allStartTimes) : now - 180 * 60_000;
  const timelineEnd = now;
  const timelineSpan = timelineEnd - timelineStart;

  // Build event feed: all tool_calls and tool_results from all executions
  const eventFeed = useMemo(() => {
    const events: (ExecutionLogEntry & { execId: string })[] = [];
    for (const exec of executions) {
      for (const entry of exec.log) {
        if (
          entry.type === 'tool_call' ||
          entry.type === 'tool_result' ||
          entry.type === 'error'
        ) {
          events.push({ ...entry, execId: exec.id });
        }
      }
    }
    events.sort((a, b) => b.timestamp - a.timestamp);
    return events.slice(0, 15);
  }, []);

  function getBlockPosition(exec: ExecutionPrimitive) {
    const start = exec.startedAt ?? timelineEnd;
    const end = exec.completedAt ?? (exec.status === 'running' ? timelineEnd : start);
    const leftPct = ((start - timelineStart) / timelineSpan) * 100;
    const widthPct = Math.max(((end - start) / timelineSpan) * 100, 2);
    return { left: `${leftPct}%`, width: `${widthPct}%` };
  }

  function getBlockClass(status: ExecutionPrimitive['status']): string {
    switch (status) {
      case 'completed': return s.execBlockCompleted;
      case 'running': return s.execBlockRunning;
      case 'failed': return s.execBlockFailed;
      case 'paused': return s.execBlockPaused;
      case 'queued': return s.execBlockQueued;
    }
  }

  return (
    <div className={s.timelinePanel} data-testid="nerve-center-timeline">
      <div className={s.sectionHeader}>EXECUTION TIMELINE</div>
      <div className={s.timelineBody}>
        <div className={s.swimlanes}>
          <div className={s.nowMarker}>
            <div className={s.nowMarkerLabel}>now</div>
          </div>
          {agentSwimlanes.map(({ agent, executions: agentExecs }) => (
            <div className={s.swimlane} key={agent.id}>
              <div className={s.swimlaneLabel}>{agent.name}</div>
              <div className={s.swimlaneTrack}>
                {agentExecs.map((exec) => {
                  if (!exec.startedAt && exec.status === 'queued') return null;
                  const pos = getBlockPosition(exec);
                  return (
                    <div
                      key={exec.id}
                      className={`${s.execBlock} ${getBlockClass(exec.status)}`}
                      style={{ left: pos.left, width: pos.width }}
                      title={`${exec.id}: ${exec.title} (${exec.status})`}
                    >
                      {exec.title}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className={s.eventFeed}>
          <div className={s.eventFeedTitle}>Recent Events</div>
          {eventFeed.map((event, i) => (
            <div className={s.eventRow} key={`${event.execId}-${event.timestamp}-${i}`}>
              <span className={s.eventTime}>{shortTime(event.timestamp)}</span>
              <span
                className={`${s.eventType} ${
                  event.type === 'tool_call'
                    ? s.eventTypeCall
                    : event.type === 'error'
                      ? s.eventTypeError
                      : s.eventTypeResult
                }`}
              >
                {event.type === 'tool_call'
                  ? event.toolName ?? 'call'
                  : event.type === 'error'
                    ? 'error'
                    : 'result'}
              </span>
              <span className={s.eventContent}>{event.content}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AttentionQueue() {
  const items = useMemo(() => buildAttentionQueue(executions, verifications), []);

  const urgencyClass = (urgency: AttentionUrgency): string => {
    switch (urgency) {
      case 'error': return s.attentionItemError;
      case 'review': return s.attentionItemReview;
      case 'approval': return s.attentionItemApproval;
      case 'blocked': return s.attentionItemBlocked;
    }
  };

  const urgencyIcon = (urgency: AttentionUrgency): string => {
    switch (urgency) {
      case 'error': return '[!]';
      case 'review': return '[?]';
      case 'approval': return '[*]';
      case 'blocked': return '[-]';
    }
  };

  return (
    <div className={s.attentionPanel} data-testid="nerve-center-attention">
      <div className={s.sectionHeader}>
        ATTENTION QUEUE
        {items.length > 0 && (
          <span className={s.countBadge}>{items.length}</span>
        )}
      </div>
      <div className={s.attentionList}>
        {items.map((item) => (
          <div
            key={item.id}
            className={`${s.attentionItem} ${urgencyClass(item.urgency)}`}
          >
            <div className={s.attentionTitle}>
              <span className={s.attentionIcon}>{urgencyIcon(item.urgency)}</span>
              {item.title}
            </div>
            <div className={s.attentionDesc}>{item.description}</div>
            {item.timeAgo && (
              <div className={s.attentionTime}>{item.timeAgo}</div>
            )}
            <div className={s.attentionActions}>
              {item.urgency === 'error' && (
                <>
                  <button className={s.btnDanger}>Retry</button>
                  <button className={s.btnSecondary}>Investigate</button>
                </>
              )}
              {item.urgency === 'review' && (
                <button className={s.btnAmber}>View Results</button>
              )}
              {item.urgency === 'approval' && (
                <>
                  <button className={s.btnPrimary}>Approve</button>
                  <button className={s.btnSecondary}>Reject</button>
                </>
              )}
              {item.urgency === 'blocked' && (
                <button className={s.btnSecondary}>Investigate</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AlertBar() {
  const errorCount = executions.filter((e) => e.status === 'failed').length;

  // Find the most recent log entry across all executions
  let lastEvent: (ExecutionLogEntry & { execId: string }) | null = null;
  for (const exec of executions) {
    for (const entry of exec.log) {
      if (!lastEvent || entry.timestamp > lastEvent.timestamp) {
        lastEvent = { ...entry, execId: exec.id };
      }
    }
  }

  const erroredAgents = agents.filter((a) => a.status === 'errored').length;
  const systemOk = erroredAgents === 0;

  return (
    <div className={s.alertBar} data-testid="nerve-center-alerts">
      <div className={s.alertLeft}>
        <div className={errorCount > 0 ? s.alertDotError : s.alertDotOk} />
        {errorCount} error{errorCount !== 1 ? 's' : ''}
      </div>
      <div className={s.alertCenter}>
        {lastEvent
          ? `Last: ${lastEvent.type === 'tool_call' ? lastEvent.toolName ?? 'call' : lastEvent.type} -- ${lastEvent.content.slice(0, 60)} -- ${timeAgo(lastEvent.timestamp)}`
          : 'No recent events'}
      </div>
      <div className={s.alertRight}>
        <div className={systemOk ? s.alertDotOk : s.alertDotError} />
        {systemOk ? 'System OK' : `${erroredAgents} agent${erroredAgents !== 1 ? 's' : ''} errored`}
      </div>
    </div>
  );
}

// ── Main Component ──

export default function NerveCenter() {
  return (
    <div className={s.shell} data-testid="nerve-center-shell">
      <MetricsBar />
      <div className={s.leftColumn}>
        <AgentFleetPanel />
        <VerificationWall />
      </div>
      <ExecutionTimeline />
      <AttentionQueue />
      <AlertBar />
    </div>
  );
}
