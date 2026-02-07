import { useState } from 'react';
import { agents, executions } from '../../data/mock';
import type { ExecutionPrimitive, AgentInfo } from '../../types/primitives';
import s from './Hive.module.css';

type TrustLevel = 'Autonomous' | 'Supervised' | 'Manual';

const TRUST_CYCLE: TrustLevel[] = ['Autonomous', 'Supervised', 'Manual'];

const TRUST_DEFAULTS: Record<string, TrustLevel> = {
  'agent-1': 'Autonomous',
  'agent-2': 'Supervised',
  'agent-3': 'Manual',
};

const TRUST_CLASS: Record<TrustLevel, string> = {
  Autonomous: s.trustAutonomous,
  Supervised: s.trustSupervised,
  Manual: s.trustManual,
};

function abbreviateModel(model: string): string {
  if (model.includes('sonnet-4-5')) return 'sonnet-4-5';
  if (model.includes('opus-4-6')) return 'opus-4-6';
  if (model.includes('haiku-4-5')) return 'haiku-4-5';
  // Generic fallback: strip 'claude-' prefix and date suffix
  return model.replace(/^claude-/, '').replace(/-\d{8}$/, '');
}

function formatTokens(n: number): string {
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function statusBadgeClass(status: ExecutionPrimitive['status']): string {
  switch (status) {
    case 'queued':
      return s.statusQueued;
    case 'paused':
      return s.statusPaused;
    case 'failed':
      return s.statusFailed;
    case 'completed':
      return s.statusCompleted;
    default:
      return s.statusQueued;
  }
}

function avatarStatusClass(status: AgentInfo['status']): string {
  switch (status) {
    case 'running':
      return s.avatarRunning;
    case 'idle':
      return s.avatarIdle;
    case 'errored':
      return s.avatarErrored;
    default:
      return s.avatarIdle;
  }
}

export default function Hive() {
  const [trustLevels, setTrustLevels] = useState<Record<string, TrustLevel>>(
    () => {
      const initial: Record<string, TrustLevel> = {};
      for (const agent of agents) {
        initial[agent.id] = TRUST_DEFAULTS[agent.id] ?? 'Supervised';
      }
      return initial;
    },
  );

  const cycleTrust = (agentId: string) => {
    setTrustLevels((prev) => {
      const current = prev[agentId] ?? 'Supervised';
      const idx = TRUST_CYCLE.indexOf(current);
      const next = TRUST_CYCLE[(idx + 1) % TRUST_CYCLE.length];
      return { ...prev, [agentId]: next };
    });
  };

  // Group executions by agent
  const agentExecs: Record<string, ExecutionPrimitive[]> = {};
  for (const agent of agents) {
    agentExecs[agent.id] = [];
  }
  const unassigned: ExecutionPrimitive[] = [];

  for (const exec of executions) {
    if (exec.assignedAgent && agentExecs[exec.assignedAgent]) {
      agentExecs[exec.assignedAgent].push(exec);
    } else if (!exec.assignedAgent) {
      unassigned.push(exec);
    }
  }

  // Header stats
  const agentCount = agents.length;
  const runningCount = agents.filter((a) => a.status === 'running').length;
  const totalCost = agents.reduce((sum, a) => sum + a.costUsd, 0);

  return (
    <div className={s.shell} data-testid="hive-shell">
      <div className={s.header}>
        <div className={s.headerTitle}>Agent Hive</div>
        <div className={s.headerStats}>
          <span className={s.headerStat}>{agentCount} agents</span>
          <span className={s.headerStat}>{runningCount} running</span>
          <span className={s.headerStat}>${totalCost.toFixed(2)} total</span>
        </div>
      </div>

      <div className={s.board}>
        {agents.map((agent) => {
          const myExecs = agentExecs[agent.id];
          const trust = trustLevels[agent.id] ?? 'Supervised';
          const taskCount = myExecs.length;
          const agentCost = agent.costUsd;
          const tokens = formatTokens(agent.tokensUsed);

          // Find current running execution
          const runningExec = myExecs.find((e) => e.status === 'running');
          const lastLog =
            runningExec && runningExec.log.length > 0
              ? runningExec.log[runningExec.log.length - 1]
              : null;

          // Queue: queued or paused
          const queuedExecs = myExecs.filter(
            (e) => e.status === 'queued' || e.status === 'paused',
          );
          // Done: completed or failed
          const doneExecs = myExecs.filter(
            (e) => e.status === 'completed' || e.status === 'failed',
          );

          return (
            <div
              key={agent.id}
              className={s.agentColumn}
              data-testid={`hive-agent-${agent.id}`}
            >
              <div className={s.columnHeader}>
                <div className={s.agentRow}>
                  <div
                    className={`${s.avatar} ${avatarStatusClass(agent.status)}`}
                  >
                    {agent.name.charAt(0)}
                  </div>
                  <div>
                    <div className={s.agentName}>{agent.name}</div>
                    <div className={s.agentModel}>
                      {abbreviateModel(agent.model)}
                    </div>
                  </div>
                  <span
                    className={`${s.trustBadge} ${TRUST_CLASS[trust]}`}
                    data-testid={`hive-trust-${agent.id}`}
                    onClick={() => cycleTrust(agent.id)}
                  >
                    {trust}
                  </span>
                </div>
              </div>

              <div className={s.statsRow}>
                <span className={s.statItem}>{taskCount} tasks</span>
                <span className={s.statItem}>${agentCost.toFixed(2)}</span>
                <span className={s.statItem}>{tokens} tokens</span>
              </div>

              <div className={s.columnBody}>
                {runningExec && (
                  <>
                    <div className={s.sectionLabel}>Current Work</div>
                    <div className={s.currentWork}>
                      <div className={s.currentWorkTitle}>
                        {runningExec.title}
                      </div>
                      {lastLog && (
                        <div
                          className={`${s.currentWorkStream} ${s.streamPulse}`}
                        >
                          {lastLog.content}
                        </div>
                      )}
                      <button className={s.interruptBtn}>Interrupt</button>
                    </div>
                  </>
                )}

                {queuedExecs.length > 0 && (
                  <>
                    <div className={s.sectionLabel}>Queue</div>
                    {queuedExecs.map((exec) => (
                      <div key={exec.id} className={s.taskCard}>
                        <div className={s.taskCardId}>{exec.id}</div>
                        <div className={s.taskCardTitle}>{exec.title}</div>
                        <span
                          className={`${s.taskCardStatus} ${statusBadgeClass(exec.status)}`}
                        >
                          {exec.status}
                        </span>
                      </div>
                    ))}
                  </>
                )}

                {doneExecs.length > 0 && (
                  <>
                    <div className={s.sectionLabel}>Completed</div>
                    {doneExecs.map((exec) => (
                      <div key={exec.id} className={s.taskCard}>
                        <div className={s.taskCardId}>{exec.id}</div>
                        <div className={s.taskCardTitle}>{exec.title}</div>
                        <span
                          className={`${s.taskCardStatus} ${statusBadgeClass(exec.status)}`}
                        >
                          {exec.status}
                        </span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          );
        })}

        {/* Unassigned column */}
        <div className={s.unassignedColumn} data-testid="hive-unassigned">
          <div className={s.columnHeader}>
            <div className={s.agentRow}>
              <div className={`${s.avatar} ${s.avatarIdle}`}>?</div>
              <div>
                <div className={s.agentName}>Unassigned</div>
                <div className={s.agentModel}>
                  {unassigned.length} task{unassigned.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
          </div>

          <div className={s.columnBody}>
            {unassigned.map((exec) => (
              <div key={exec.id} className={s.taskCard}>
                <div className={s.taskCardId}>{exec.id}</div>
                <div className={s.taskCardTitle}>{exec.title}</div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: 4,
                  }}
                >
                  <span
                    className={`${s.taskCardStatus} ${statusBadgeClass(exec.status)}`}
                  >
                    {exec.status}
                  </span>
                  <button className={s.dispatchBtn}>Dispatch</button>
                </div>
              </div>
            ))}
            <div className={s.dropZone}>Drag tasks here</div>
          </div>
        </div>
      </div>
    </div>
  );
}
