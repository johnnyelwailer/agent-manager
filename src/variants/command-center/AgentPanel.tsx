import { agents, executions } from '../../data/mock';
import type { AgentInfo } from '../../types/primitives';
import styles from './CommandCenter.module.css';

const STATUS_COLORS: Record<AgentInfo['status'], string> = {
  running: '#3fb950',
  idle: '#8b949e',
  paused: '#d29922',
  errored: '#f85149',
};

const STATUS_BG: Record<AgentInfo['status'], string> = {
  running: 'rgba(63,185,80,0.15)',
  idle: 'rgba(139,148,158,0.15)',
  paused: 'rgba(210,153,34,0.15)',
  errored: 'rgba(248,81,73,0.15)',
};

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function getTaskTitle(taskId: string | undefined): string | null {
  if (!taskId) return null;
  const exec = executions.find((e) => e.id === taskId);
  return exec ? exec.title : taskId;
}

export default function AgentPanel() {
  return (
    <section
      className={`${styles.panel} ${styles.agentPanel}`}
      data-testid="agent-panel"
    >
      <div className={styles.panelHeader}>
        <span className={styles.panelHeaderTitle}>Agents</span>
        <span className={styles.panelHeaderBadge}>{agents.length}</span>
      </div>
      <div className={styles.panelBody}>
        {agents.map((agent) => (
          <div key={agent.id} className={styles.agentCard}>
            <div className={styles.agentCardTopRow}>
              <span
                className={styles.agentStatusDot}
                style={{ background: STATUS_COLORS[agent.status] }}
              />
              <span className={styles.agentName}>{agent.name}</span>
              <span
                className={styles.agentStatusBadge}
                style={{
                  color: STATUS_COLORS[agent.status],
                  background: STATUS_BG[agent.status],
                }}
              >
                {agent.status}
              </span>
            </div>
            <div className={styles.agentModel}>{agent.model}</div>
            {agent.currentTask && (
              <div className={styles.agentTask}>
                {getTaskTitle(agent.currentTask)}
              </div>
            )}
            <div className={styles.agentMeta}>
              <span className={styles.agentMetaItem}>
                <span className={styles.agentMetaLabel}>cost</span>
                <span className={styles.agentMetaValue}>
                  ${agent.costUsd.toFixed(2)}
                </span>
              </span>
              <span className={styles.agentMetaItem}>
                <span className={styles.agentMetaLabel}>tokens</span>
                <span className={styles.agentMetaValue}>
                  {formatTokens(agent.tokensUsed)}
                </span>
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
