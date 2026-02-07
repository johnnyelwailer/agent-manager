import { executions, agents, verifications } from '../../data/mock';
import type { ExecutionPrimitive, AgentInfo } from '../../types/primitives';
import s from './AgentOS.module.css';

/** Format an execution id like "exec-2" as "TASK-002". */
function formatTaskId(id: string): string {
  const num = id.replace(/\D/g, '');
  return `TASK-${num.padStart(3, '0')}`;
}

/** Return the agent-tag colour class based on agent status. */
function agentTagVariant(status: AgentInfo['status']): string {
  switch (status) {
    case 'running':
      return s.agentTagRunning;
    case 'errored':
      return s.agentTagError;
    case 'idle':
    case 'paused':
    default:
      return s.agentTagIdle;
  }
}

export default function TaskBoard() {
  const agentMap = new Map(agents.map((a) => [a.id, a]));

  // Collect execution IDs that have at least one "needs_review" verification
  const needsReviewExecIds = new Set(
    verifications
      .filter((v) => v.status === 'needs_review')
      .map((v) => v.executionId),
  );

  // Bucket executions into the four columns
  const toDo: ExecutionPrimitive[] = [];
  const inProgress: ExecutionPrimitive[] = [];
  const review: ExecutionPrimitive[] = [];
  const done: ExecutionPrimitive[] = [];

  for (const exec of executions) {
    // A needs_review verification promotes the task to Review
    // (unless it is actively running — keep it in Agent In-Progress)
    if (needsReviewExecIds.has(exec.id) && exec.status !== 'running') {
      review.push(exec);
      continue;
    }

    switch (exec.status) {
      case 'queued':
        toDo.push(exec);
        break;
      case 'running':
        inProgress.push(exec);
        break;
      case 'paused':
        review.push(exec);
        break;
      case 'completed':
        done.push(exec);
        break;
      case 'failed':
        done.push(exec);
        break;
    }
  }

  // Failed tasks sink to the bottom of Done
  done.sort((a, b) => {
    if (a.status === 'failed' && b.status !== 'failed') return 1;
    if (a.status !== 'failed' && b.status === 'failed') return -1;
    return 0;
  });

  const columns: { title: string; items: ExecutionPrimitive[] }[] = [
    { title: 'To Do', items: toDo },
    { title: 'Agent In-Progress', items: inProgress },
    { title: 'Review', items: review },
    { title: 'Done', items: done },
  ];

  function renderCard(exec: ExecutionPrimitive) {
    const isRunning = exec.status === 'running';
    const isFailed = exec.status === 'failed';
    const agent = exec.assignedAgent
      ? agentMap.get(exec.assignedAgent)
      : undefined;

    // Determine the streaming / status line content
    const lastLog =
      exec.log.length > 0 ? exec.log[exec.log.length - 1] : undefined;
    const lastError = isFailed
      ? [...exec.log].reverse().find((entry) => entry.type === 'error')
      : undefined;
    const streamEntry = isFailed ? lastError : isRunning ? lastLog : undefined;

    const cardClasses = [
      s.kanbanCard,
      isRunning ? s.kanbanCardGlow : '',
      isFailed ? s.kanbanCardFailed : '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div key={exec.id} className={cardClasses}>
        <div className={s.kanbanCardId}>{formatTaskId(exec.id)}</div>
        <div className={s.kanbanCardTitle}>{exec.title}</div>

        {agent && (
          <div className={s.kanbanCardMeta}>
            <span
              className={`${s.agentTag} ${agentTagVariant(agent.status)}`}
            >
              {agent.name}
            </span>
          </div>
        )}

        {streamEntry && (
          <div
            className={[
              s.kanbanCardStream,
              isRunning ? s.kanbanCardStreamPulse : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {streamEntry.content}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={s.kanban} data-testid="agent-os-taskboard">
      {columns.map((col) => (
        <div key={col.title} className={s.kanbanColumn}>
          <div className={s.kanbanColumnHeader}>
            {col.title}
            <span className={s.kanbanCount}>{col.items.length}</span>
          </div>
          {col.items.map(renderCard)}
        </div>
      ))}
    </div>
  );
}
