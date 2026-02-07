import { useState } from 'react';
import { executions, agents } from '../../data/mock';
import type { ExecutionPrimitive, ExecutionLogEntry } from '../../types/primitives';
import styles from './Flow.module.css';

function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function logTypeIcon(type: ExecutionLogEntry['type']): string {
  switch (type) {
    case 'tool_call':
      return '\uD83D\uDD27'; // wrench
    case 'tool_result':
      return '\uD83D\uDCE4'; // outbox
    case 'text':
      return '\uD83D\uDCAC'; // speech bubble
    case 'thinking':
      return '\uD83D\uDCAD'; // thought bubble
    case 'error':
      return '\u274C'; // red x
    default:
      return '\u2022';
  }
}

function estimateProgress(exec: ExecutionPrimitive): number {
  if (exec.status === 'completed') return 100;
  if (exec.status === 'failed') return 100;
  if (exec.status === 'queued') return 0;
  // For running/paused, estimate from log length
  const logLen = exec.log.length;
  if (logLen === 0) return 5;
  // Rough heuristic: cap at 95 for running tasks
  return Math.min(95, Math.round((logLen / 12) * 100));
}

function getAgentName(agentId?: string): string {
  if (!agentId) return 'Unassigned';
  const agent = agents.find((a) => a.id === agentId);
  return agent ? agent.name : agentId;
}

function ActiveCard({ exec }: { exec: ExecutionPrimitive }) {
  const [logOpen, setLogOpen] = useState(false);
  const progress = estimateProgress(exec);
  const agentName = getAgentName(exec.assignedAgent);

  const badgeClass =
    exec.status === 'running' ? styles.badgeRunning : styles.badgePaused;
  const borderColor = exec.status === 'running' ? '#0969da' : '#9a6700';

  return (
    <div
      className={styles.activeCard}
      style={{ borderLeftColor: borderColor }}
    >
      <div className={styles.activeCardHeader}>
        <div className={styles.activeCardTitle}>
          {exec.status === 'running' && (
            <span className={styles.runningIndicator} />
          )}
          {exec.title}
        </div>
        <span className={`${styles.activeStatusBadge} ${badgeClass}`}>
          {exec.status === 'running' ? 'Running' : 'Paused'}
        </span>
      </div>

      <div className={styles.activeCardMeta}>
        <span className={styles.metaItem}>
          <span className={styles.metaIcon}>{'\uD83E\uDD16'}</span>
          {agentName}
        </span>
        {exec.startedAt && (
          <span className={styles.metaItem}>
            <span className={styles.metaIcon}>{'\uD83D\uDD52'}</span>
            Started {relativeTime(exec.startedAt)}
          </span>
        )}
        {exec.costUsd !== undefined && (
          <span className={styles.metaItem}>
            <span className={styles.metaIcon}>{'\uD83D\uDCB0'}</span>
            ${exec.costUsd.toFixed(2)}
          </span>
        )}
        {exec.artifacts.length > 0 && (
          <span className={styles.metaItem}>
            <span className={styles.metaIcon}>{'\uD83D\uDCC4'}</span>
            {exec.artifacts.length} artifact{exec.artifacts.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className={styles.progressBar}>
        <div
          className={styles.progressFill}
          style={{ width: `${progress}%` }}
        />
      </div>

      {exec.log.length > 0 && (
        <>
          <div
            className={styles.logToggle}
            onClick={() => setLogOpen(!logOpen)}
          >
            <span
              className={`${styles.logToggleChevron} ${logOpen ? styles.logToggleChevronOpen : ''}`}
            >
              &#9656;
            </span>
            View Log ({exec.log.length} entries)
          </div>
          {logOpen && (
            <div className={styles.logContainer}>
              {exec.log.map((entry, idx) => (
                <div
                  className={styles.logEntry}
                  key={`${exec.id}-log-${idx}`}
                >
                  <span className={styles.logTime}>
                    {relativeTime(entry.timestamp)}
                  </span>
                  <span className={styles.logIcon}>
                    {logTypeIcon(entry.type)}
                  </span>
                  <span
                    className={`${styles.logContent} ${entry.type === 'error' ? styles.logError : ''}`}
                  >
                    {entry.toolName && (
                      <span className={styles.logToolName}>
                        {entry.toolName}:
                      </span>
                    )}
                    {entry.content}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function ActiveWork() {
  const [collapsed, setCollapsed] = useState(false);
  const activeExecs = executions.filter(
    (e) => e.status === 'running' || e.status === 'paused',
  );

  return (
    <div data-testid="active-work" className={styles.section}>
      <div
        className={styles.sectionHeader}
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className={styles.sectionHeaderLeft}>
          <span className={styles.sectionIcon}>{'\u25B6\uFE0F'}</span>
          <span className={styles.sectionTitle}>Active Work</span>
          <span className={styles.sectionCount}>
            {activeExecs.length} task{activeExecs.length !== 1 ? 's' : ''}
          </span>
        </div>
        <span
          className={`${styles.chevron} ${!collapsed ? styles.chevronOpen : ''}`}
        >
          &#9656;
        </span>
      </div>
      {!collapsed && (
        <div className={styles.sectionBody}>
          {activeExecs.length === 0 ? (
            <div className={styles.emptyState}>No active tasks right now.</div>
          ) : (
            activeExecs.map((exec) => (
              <ActiveCard key={exec.id} exec={exec} />
            ))
          )}
        </div>
      )}
    </div>
  );
}
