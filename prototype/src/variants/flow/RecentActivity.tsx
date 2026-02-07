import { useState } from 'react';
import { executions, agents } from '../../data/mock';
import type { ExecutionPrimitive } from '../../types/primitives';
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

function statusIcon(status: ExecutionPrimitive['status']): string {
  switch (status) {
    case 'completed':
      return '\u2705'; // green check
    case 'failed':
      return '\u274C'; // red x
    case 'queued':
      return '\u23F3'; // hourglass
    default:
      return '\u2022';
  }
}

function getAgentName(agentId?: string): string {
  if (!agentId) return 'Unassigned';
  const agent = agents.find((a) => a.id === agentId);
  return agent ? agent.name : agentId;
}

export default function RecentActivity() {
  const [collapsed, setCollapsed] = useState(false);

  // Show completed, failed, and queued executions (not running/paused)
  const recentExecs = executions.filter(
    (e) => e.status === 'completed' || e.status === 'failed' || e.status === 'queued',
  );

  return (
    <div data-testid="recent-activity" className={styles.section}>
      <div
        className={styles.sectionHeader}
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className={styles.sectionHeaderLeft}>
          <span className={styles.sectionIcon}>{'\uD83D\uDCCB'}</span>
          <span className={styles.sectionTitle}>Recent Activity</span>
          <span className={styles.sectionCount}>
            {recentExecs.length} item{recentExecs.length !== 1 ? 's' : ''}
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
          {recentExecs.length === 0 ? (
            <div className={styles.emptyState}>No recent activity.</div>
          ) : (
            <div className={styles.activityList}>
              {recentExecs.map((exec) => (
                <div key={exec.id} className={styles.activityCard}>
                  <span className={styles.activityStatusIcon}>
                    {statusIcon(exec.status)}
                  </span>
                  <div className={styles.activityMain}>
                    <div className={styles.activityTitle}>{exec.title}</div>
                    <div className={styles.activityDetails}>
                      <span>{getAgentName(exec.assignedAgent)}</span>
                      <span>{exec.status}</span>
                      {exec.completedAt && (
                        <span>{relativeTime(exec.completedAt)}</span>
                      )}
                      {!exec.completedAt && exec.startedAt && (
                        <span>started {relativeTime(exec.startedAt)}</span>
                      )}
                      {!exec.completedAt && !exec.startedAt && (
                        <span>queued</span>
                      )}
                    </div>
                  </div>
                  <div className={styles.activityRight}>
                    {exec.costUsd !== undefined && (
                      <span className={styles.activityCost}>
                        ${exec.costUsd.toFixed(2)}
                      </span>
                    )}
                    {exec.artifacts.length > 0 && (
                      <span className={styles.activityArtifacts}>
                        {exec.artifacts.length} artifact
                        {exec.artifacts.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
