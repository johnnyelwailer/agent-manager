import type {
  StrategyPrimitive,
  ExecutionPrimitive,
  VerificationPrimitive,
  ContextPrimitive,
  AgentInfo,
  ExecutionLogEntry,
} from '../../types/primitives';
import styles from './Spatial.module.css';

type NodeType = 'strategy' | 'execution' | 'verification' | 'context' | 'agent';

type NodeData =
  | StrategyPrimitive
  | ExecutionPrimitive
  | VerificationPrimitive
  | ContextPrimitive
  | AgentInfo;

interface DetailSidebarProps {
  nodeType: NodeType;
  data: NodeData;
  onClose: () => void;
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

function statusBadge(status: string) {
  const classMap: Record<string, string> = {
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
  return (
    <span className={`${styles.statusBadge} ${classMap[status] ?? ''}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function logTypeClass(type: ExecutionLogEntry['type']): string {
  const map: Record<string, string> = {
    tool_call: styles.logToolCall,
    tool_result: styles.logToolResult,
    text: styles.logText,
    error: styles.logError,
    thinking: styles.logThinking,
  };
  return map[type] ?? '';
}

/* ── per-type detail views ───────────────────────────────────── */

function StrategyDetail({ d }: { d: StrategyPrimitive }) {
  return (
    <>
      <Section label="Status">{statusBadge(d.status)}</Section>
      <Section label="Source File">
        <div className={styles.sidebarValue}>{d.sourceFile}</div>
        {d.sourceRange && (
          <div className={styles.sidebarValue}>
            Lines {d.sourceRange.start}&ndash;{d.sourceRange.end}
          </div>
        )}
      </Section>
      {d.children.length > 0 && (
        <Section label={`Children (${d.children.length})`}>
          {d.children.map((c) => (
            <div key={c.id} className={styles.childItem}>
              <span>{c.title}</span>
              <span className={styles.childStatus}>{c.status}</span>
            </div>
          ))}
        </Section>
      )}
      {Object.keys(d.metadata).length > 0 && (
        <Section label="Metadata">
          <div className={styles.sidebarValue}>
            {Object.entries(d.metadata).map(([k, v]) => (
              <div key={k}>
                <strong>{k}:</strong> {String(v)}
              </div>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

function ExecutionDetail({ d }: { d: ExecutionPrimitive }) {
  return (
    <>
      <Section label="Status">{statusBadge(d.status)}</Section>
      {d.assignedAgent && (
        <Section label="Assigned Agent">
          <div className={styles.sidebarValue}>{d.assignedAgent}</div>
        </Section>
      )}
      {d.parentStrategyId && (
        <Section label="Parent Strategy">
          <div className={styles.sidebarValue}>{d.parentStrategyId}</div>
        </Section>
      )}
      <Section label="Timing">
        <div className={styles.sidebarValue}>
          {d.startedAt ? `Started: ${relativeTime(d.startedAt)}` : 'Not started'}
          {d.completedAt && <div>Completed: {relativeTime(d.completedAt)}</div>}
        </div>
      </Section>
      {d.costUsd !== undefined && (
        <Section label="Cost">
          <div className={styles.sidebarValue}>${d.costUsd.toFixed(2)}</div>
        </Section>
      )}
      {d.artifacts.length > 0 && (
        <Section label={`Artifacts (${d.artifacts.length})`}>
          <ul className={styles.artifactList}>
            {d.artifacts.map((a) => (
              <li key={a} className={styles.artifactItem}>
                {a}
              </li>
            ))}
          </ul>
        </Section>
      )}
      {d.log.length > 0 && (
        <Section label={`Log (${d.log.length} entries)`}>
          {d.log.map((entry, i) => (
            <div key={i} className={styles.logEntry}>
              <div className={styles.logTimestamp}>
                {relativeTime(entry.timestamp)}
              </div>
              <span className={`${styles.logType} ${logTypeClass(entry.type)}`}>
                {entry.type.replace(/_/g, ' ')}
              </span>
              {entry.toolName && (
                <span className={styles.logType}>{entry.toolName}</span>
              )}
              <div className={styles.logContent}>{entry.content}</div>
            </div>
          ))}
        </Section>
      )}
    </>
  );
}

function VerificationDetail({ d }: { d: VerificationPrimitive }) {
  const typeLabel: Record<string, string> = {
    test_run: 'Test Run',
    diff_review: 'Diff Review',
    lint: 'Lint',
    human_approval: 'Human Approval',
  };
  return (
    <>
      <Section label="Type">
        <div className={styles.sidebarValue}>{typeLabel[d.type] ?? d.type}</div>
      </Section>
      <Section label="Status">{statusBadge(d.status)}</Section>
      <Section label="Linked Execution">
        <div className={styles.sidebarValue}>{d.executionId}</div>
      </Section>
      <Section label="Details">
        <div className={styles.sidebarValue}>{d.details}</div>
      </Section>
      {d.sourceFile && (
        <Section label="Source File">
          <div className={styles.sidebarValue}>{d.sourceFile}</div>
        </Section>
      )}
    </>
  );
}

function ContextDetail({ d }: { d: ContextPrimitive }) {
  return (
    <>
      <Section label="Content">
        <div className={styles.sidebarValue}>{d.content}</div>
      </Section>
      <Section label="Tags">
        <div>
          {d.tags.map((t) => (
            <span key={t} className={styles.sidebarTag}>
              {t}
            </span>
          ))}
        </div>
      </Section>
      <Section label="Source File">
        <div className={styles.sidebarValue}>{d.sourceFile}</div>
      </Section>
      <Section label="Last Modified">
        <div className={styles.sidebarValue}>{relativeTime(d.lastModified)}</div>
      </Section>
    </>
  );
}

function AgentDetail({ d }: { d: AgentInfo }) {
  return (
    <>
      <Section label="Model">
        <div className={styles.sidebarValue}>{d.model}</div>
      </Section>
      <Section label="Status">{statusBadge(d.status)}</Section>
      {d.sessionId && (
        <Section label="Session">
          <div className={styles.sidebarValue}>{d.sessionId}</div>
        </Section>
      )}
      {d.currentTask && (
        <Section label="Current Task">
          <div className={styles.sidebarValue}>{d.currentTask}</div>
        </Section>
      )}
      <Section label="Cost">
        <div className={styles.sidebarValue}>${d.costUsd.toFixed(2)}</div>
      </Section>
      <Section label="Tokens Used">
        <div className={styles.sidebarValue}>
          {d.tokensUsed.toLocaleString()}
        </div>
      </Section>
    </>
  );
}

/* ── reusable section wrapper ────────────────────────────────── */

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.sidebarSection}>
      <div className={styles.sidebarLabel}>{label}</div>
      {children}
    </div>
  );
}

/* ── main component ──────────────────────────────────────────── */

export default function DetailSidebar({
  nodeType,
  data,
  onClose,
}: DetailSidebarProps) {
  const titleMap: Record<NodeType, (d: NodeData) => string> = {
    strategy: (d) => (d as StrategyPrimitive).title,
    execution: (d) => (d as ExecutionPrimitive).title,
    verification: (d) => {
      const v = d as VerificationPrimitive;
      const labels: Record<string, string> = {
        test_run: 'Test Run',
        diff_review: 'Diff Review',
        lint: 'Lint',
        human_approval: 'Human Approval',
      };
      return labels[v.type] ?? v.type;
    },
    context: (d) => (d as ContextPrimitive).title,
    agent: (d) => (d as AgentInfo).name,
  };

  const title = titleMap[nodeType](data);

  return (
    <div className={styles.sidebar} data-testid="detail-sidebar">
      <div className={styles.sidebarHeader}>
        <div>
          <div className={styles.sidebarTypeLabel}>{nodeType}</div>
          <div className={styles.sidebarTitle}>{title}</div>
        </div>
        <button className={styles.sidebarClose} onClick={onClose} title="Close">
          &times;
        </button>
      </div>

      {nodeType === 'strategy' && <StrategyDetail d={data as StrategyPrimitive} />}
      {nodeType === 'execution' && <ExecutionDetail d={data as ExecutionPrimitive} />}
      {nodeType === 'verification' && (
        <VerificationDetail d={data as VerificationPrimitive} />
      )}
      {nodeType === 'context' && <ContextDetail d={data as ContextPrimitive} />}
      {nodeType === 'agent' && <AgentDetail d={data as AgentInfo} />}
    </div>
  );
}
