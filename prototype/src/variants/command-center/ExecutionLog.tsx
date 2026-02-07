import { executions, agents } from '../../data/mock';
import type { ExecutionLogEntry } from '../../types/primitives';
import styles from './CommandCenter.module.css';

/* ── Helpers ─────────────────────────────────────────────────────────── */

function relativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function elapsedTime(startedAt: number, completedAt?: number): string {
  const end = completedAt ?? Date.now();
  const diffSec = Math.floor((end - startedAt) / 1000);
  const m = Math.floor(diffSec / 60);
  const s = diffSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const TYPE_COLORS: Record<ExecutionLogEntry['type'], { color: string; bg: string }> = {
  tool_call: { color: '#79c0ff', bg: 'rgba(121,192,255,0.12)' },
  tool_result: { color: '#3fb950', bg: 'rgba(63,185,80,0.12)' },
  thinking: { color: '#d2a8ff', bg: 'rgba(210,168,255,0.12)' },
  error: { color: '#f85149', bg: 'rgba(248,81,73,0.15)' },
  text: { color: '#8b949e', bg: 'rgba(139,148,158,0.10)' },
};

const EXEC_STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  running: { color: '#3fb950', bg: 'rgba(63,185,80,0.15)' },
  completed: { color: '#3fb950', bg: 'rgba(63,185,80,0.10)' },
  queued: { color: '#8b949e', bg: 'rgba(139,148,158,0.12)' },
  failed: { color: '#f85149', bg: 'rgba(248,81,73,0.15)' },
  paused: { color: '#d29922', bg: 'rgba(210,153,34,0.15)' },
};

/* ── Component ───────────────────────────────────────────────────────── */

export default function ExecutionLog() {
  // Show the currently running execution (exec-2)
  const execution = executions.find((e) => e.id === 'exec-2') ?? executions[0];
  const agent = agents.find((a) => a.id === execution.assignedAgent);
  const statusStyle = EXEC_STATUS_COLORS[execution.status] ?? EXEC_STATUS_COLORS.queued;

  return (
    <section
      className={`${styles.panel} ${styles.executionPanel}`}
      data-testid="execution-log"
    >
      {/* Execution info bar */}
      <div className={styles.executionHeader}>
        <span className={styles.executionTitle}>{execution.title}</span>
        {agent && (
          <span className={styles.executionAgent}>{agent.name}</span>
        )}
        <span
          className={styles.executionStatusBadge}
          style={{ color: statusStyle.color, background: statusStyle.bg }}
        >
          {execution.status}
        </span>
        {execution.startedAt && (
          <span className={styles.executionElapsed}>
            {elapsedTime(execution.startedAt, execution.completedAt)}
          </span>
        )}
      </div>

      {/* Log entries */}
      <div className={styles.executionLog}>
        {execution.log.map((entry, idx) => {
          const typeStyle = TYPE_COLORS[entry.type];
          const isLast = idx === execution.log.length - 1;

          return (
            <div key={idx} className={styles.logEntry}>
              <span className={styles.logTimestamp}>
                {relativeTime(entry.timestamp)}
              </span>
              <span
                className={styles.logTypeBadge}
                style={{ color: typeStyle.color, background: typeStyle.bg }}
              >
                {entry.type === 'tool_call'
                  ? 'call'
                  : entry.type === 'tool_result'
                    ? 'result'
                    : entry.type}
              </span>
              {entry.toolName && (
                <span className={styles.logToolName}>{entry.toolName}</span>
              )}
              <span
                className={`${styles.logContent} ${
                  entry.type === 'error'
                    ? styles.logContentError
                    : entry.type === 'thinking'
                      ? styles.logContentThinking
                      : ''
                }`}
              >
                {entry.content}
                {isLast && execution.status === 'running' && (
                  <span className={styles.logCursor} />
                )}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
