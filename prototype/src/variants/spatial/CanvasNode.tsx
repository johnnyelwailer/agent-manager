import type {
  StrategyPrimitive,
  ExecutionPrimitive,
  VerificationPrimitive,
  ContextPrimitive,
  AgentInfo,
} from '../../types/primitives';
import styles from './Spatial.module.css';

type NodeType = 'strategy' | 'execution' | 'verification' | 'context' | 'agent';

type NodeData =
  | StrategyPrimitive
  | ExecutionPrimitive
  | VerificationPrimitive
  | ContextPrimitive
  | AgentInfo;

interface CanvasNodeProps {
  id: string;
  position: { x: number; y: number };
  type: NodeType;
  data: NodeData;
  selected: boolean;
  onClick: () => void;
}

/* ── helpers ─────────────────────────────────────────────────── */

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function statusClass(status: string): string {
  const map: Record<string, string> = {
    completed: styles.statusCompleted,
    running: styles.statusRunning,
    failed: styles.statusFailed,
    queued: styles.statusQueued,
    active: styles.statusActive,
    draft: styles.statusDraft,
    paused: styles.statusPaused,
    passed: styles.statusPassed,
    pending: styles.statusPending,
    needs_review: styles.statusNeedsReview,
    idle: styles.statusIdle,
    errored: styles.statusErrored,
    abandoned: styles.statusAbandoned,
  };
  return map[status] ?? '';
}

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ');
}

/* ── per-type rendering ──────────────────────────────────────── */

function renderStrategy(d: StrategyPrimitive) {
  return (
    <>
      <div className={styles.nodeTypeLabel}>Strategy</div>
      <div className={styles.nodeTitle}>{d.title}</div>
      <span className={`${styles.statusBadge} ${statusClass(d.status)}`}>
        {statusLabel(d.status)}
      </span>
      {d.children.length > 0 && (
        <div className={styles.nodeInfo}>
          {d.children.length} sub-task{d.children.length > 1 ? 's' : ''}
        </div>
      )}
    </>
  );
}

function renderExecution(d: ExecutionPrimitive) {
  return (
    <>
      <div className={styles.nodeTypeLabel}>Execution</div>
      <div className={styles.nodeTitle}>{d.title}</div>
      <span className={`${styles.statusBadge} ${statusClass(d.status)}`}>
        {statusLabel(d.status)}
      </span>
      {d.assignedAgent && (
        <div className={styles.nodeInfo}>Agent: {d.assignedAgent}</div>
      )}
      {d.startedAt && (
        <div className={styles.nodeInfo}>{relativeTime(d.startedAt)}</div>
      )}
    </>
  );
}

function renderVerification(d: VerificationPrimitive) {
  const typeLabel: Record<string, string> = {
    test_run: 'Tests',
    diff_review: 'Diff Review',
    lint: 'Lint',
    human_approval: 'Approval',
  };
  return (
    <>
      <div className={styles.nodeTypeLabel}>Verification</div>
      <div className={styles.nodeTitle}>{typeLabel[d.type] ?? d.type}</div>
      <span className={`${styles.statusBadge} ${statusClass(d.status)}`}>
        {statusLabel(d.status)}
      </span>
      <div className={styles.nodeInfo}>exec: {d.executionId}</div>
    </>
  );
}

function renderContext(d: ContextPrimitive) {
  return (
    <>
      <div className={styles.nodeTypeLabel}>Context</div>
      <div className={styles.nodeTitle}>{d.title}</div>
      <div className={styles.nodeInfo}>
        {d.tags.join(', ')}
      </div>
      <div className={styles.nodeInfo}>{relativeTime(d.lastModified)}</div>
    </>
  );
}

function renderAgent(d: AgentInfo) {
  return (
    <>
      <div className={styles.nodeTypeLabel}>Agent</div>
      <div className={styles.nodeTitle}>{d.name}</div>
      <span className={`${styles.statusBadge} ${statusClass(d.status)}`}>
        {statusLabel(d.status)}
      </span>
      <div className={styles.nodeInfo}>
        ${d.costUsd.toFixed(2)} &middot; {d.tokensUsed.toLocaleString()} tok
      </div>
    </>
  );
}

/* ── main component ──────────────────────────────────────────── */

export default function CanvasNode({
  id,
  position,
  type,
  data,
  selected,
  onClick,
}: CanvasNodeProps) {
  /* build className list */
  const classes: string[] = [styles.node];

  if (selected) classes.push(styles.nodeSelected);

  switch (type) {
    case 'strategy': {
      classes.push(styles.nodeStrategy);
      const s = data as StrategyPrimitive;
      if (s.status === 'active') classes.push(styles.glowActive);
      break;
    }
    case 'execution': {
      classes.push(styles.nodeExecution);
      const e = data as ExecutionPrimitive;
      const statusMap: Record<string, string> = {
        completed: styles.nodeExecutionCompleted,
        running: styles.nodeExecutionRunning,
        failed: styles.nodeExecutionFailed,
        queued: styles.nodeExecutionQueued,
        paused: styles.nodeExecutionPaused,
      };
      if (statusMap[e.status]) classes.push(statusMap[e.status]);
      if (e.status === 'running') classes.push(styles.glowRunning);
      if (e.status === 'failed') classes.push(styles.glowFailed);
      break;
    }
    case 'verification':
      classes.push(styles.nodeVerification);
      break;
    case 'context':
      classes.push(styles.nodeContext);
      break;
    case 'agent': {
      classes.push(styles.nodeAgent);
      const a = data as AgentInfo;
      if (a.status === 'running') classes.push(styles.glowRunning);
      break;
    }
  }

  /* render inner content based on type */
  let content: JSX.Element | null = null;
  switch (type) {
    case 'strategy':
      content = renderStrategy(data as StrategyPrimitive);
      break;
    case 'execution':
      content = renderExecution(data as ExecutionPrimitive);
      break;
    case 'verification':
      content = renderVerification(data as VerificationPrimitive);
      break;
    case 'context':
      content = renderContext(data as ContextPrimitive);
      break;
    case 'agent':
      content = renderAgent(data as AgentInfo);
      break;
  }

  return (
    <div
      data-testid={`node-${id}`}
      className={classes.join(' ')}
      style={{
        left: position.x,
        top: position.y,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {content}
    </div>
  );
}
