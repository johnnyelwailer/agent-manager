import { agents, executions } from '../../data/mock';
import type { AgentInfo, ExecutionPrimitive } from '../../types/primitives';
import styles from './Flow.module.css';

function countByStatus(
  items: ExecutionPrimitive[],
  status: ExecutionPrimitive['status'],
): number {
  return items.filter((e) => e.status === status).length;
}

function totalCost(agentList: AgentInfo[]): string {
  const sum = agentList.reduce((acc, a) => acc + a.costUsd, 0);
  return `$${sum.toFixed(2)}`;
}

function agentsByStatus(
  agentList: AgentInfo[],
  status: AgentInfo['status'],
): number {
  return agentList.filter((a) => a.status === status).length;
}

export default function SummaryRibbon() {
  const running = countByStatus(executions, 'running');
  const queued = countByStatus(executions, 'queued');
  const completed = countByStatus(executions, 'completed');
  const failed = countByStatus(executions, 'failed');
  const paused = countByStatus(executions, 'paused');

  const activeAgents = agentsByStatus(agents, 'running');
  const idleAgents = agentsByStatus(agents, 'idle');
  const erroredAgents = agentsByStatus(agents, 'errored');

  return (
    <div data-testid="summary-ribbon" className={styles.section}>
      <div className={styles.ribbon}>
        <div className={styles.ribbonStat}>
          <span className={styles.ribbonValue}>{agents.length}</span>
          <span className={styles.ribbonLabel}>
            Agents ({activeAgents} active, {idleAgents} idle
            {erroredAgents > 0 ? `, ${erroredAgents} errored` : ''})
          </span>
        </div>

        <div className={styles.ribbonStat}>
          <span className={styles.ribbonValue}>{executions.length}</span>
          <span className={styles.ribbonLabel}>
            Tasks ({running} running, {queued} queued, {completed} done
            {failed > 0 ? `, ${failed} failed` : ''}
            {paused > 0 ? `, ${paused} paused` : ''})
          </span>
        </div>

        <div className={styles.ribbonStat}>
          <span className={styles.ribbonValue}>{totalCost(agents)}</span>
          <span className={styles.ribbonLabel}>Total Cost</span>
        </div>
      </div>
    </div>
  );
}
