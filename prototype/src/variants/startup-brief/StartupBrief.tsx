import { useState } from 'react';
import {
  usePrimitivesData,
  useStrategies,
  useConnectionStatus,
} from '../../lib/EngineProvider.tsx';
import type { StrategyPrimitive } from '../../types/primitives';
import s from './StartupBrief.module.css';

// ── Helpers ──

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function countCompletedChildren(node: StrategyPrimitive): number {
  if (node.children.length === 0) {
    return node.status === 'completed' ? 1 : 0;
  }
  return node.children.reduce((sum, child) => sum + countCompletedChildren(child), 0);
}

function countTotalLeaves(node: StrategyPrimitive): number {
  if (node.children.length === 0) return 1;
  return node.children.reduce((sum, child) => sum + countTotalLeaves(child), 0);
}

// ── Session Summary Section ──

function SessionSummary({
  agents,
  executions,
}: {
  agents: { id: string; name: string }[];
  executions: { id: string; title: string; status: string; assignedAgent?: string; log: { type: string; content: string }[] }[];
}) {
  const completed = executions.filter((e) => e.status === 'completed');
  const running = executions.filter((e) => e.status === 'running');
  const failed = executions.filter((e) => e.status === 'failed');
  const paused = executions.filter((e) => e.status === 'paused');
  const queued = executions.filter((e) => e.status === 'queued');

  const items: { dot: string; label: string; detail: string }[] = [];

  for (const exec of completed) {
    const agent = exec.assignedAgent
      ? agents.find((a) => a.id === exec.assignedAgent)
      : null;
    items.push({
      dot: s.summaryDotCompleted,
      label: `${completed.length} task completed: ${exec.title}`,
      detail: agent ? `by ${agent.name}` : '',
    });
  }

  for (const exec of running) {
    const agent = exec.assignedAgent
      ? agents.find((a) => a.id === exec.assignedAgent)
      : null;
    items.push({
      dot: s.summaryDotRunning,
      label: `1 task actively running: ${exec.title}`,
      detail: agent ? `by ${agent.name}` : '',
    });
  }

  for (const exec of failed) {
    const lastError = [...exec.log].reverse().find((l) => l.type === 'error');
    items.push({
      dot: s.summaryDotFailed,
      label: `1 task failed: ${exec.title}`,
      detail: lastError ? lastError.content : '',
    });
  }

  for (const exec of paused) {
    const lastLog = exec.log.length > 0 ? exec.log[exec.log.length - 1] : null;
    items.push({
      dot: s.summaryDotPaused,
      label: `1 task paused: ${exec.title}`,
      detail: lastLog ? lastLog.content : 'waiting for dependency',
    });
  }

  if (queued.length > 0) {
    items.push({
      dot: s.summaryDotQueued,
      label: `${queued.length} tasks queued and waiting`,
      detail: queued.map((e) => e.title).join(', '),
    });
  }

  return (
    <div className={s.section} data-testid="startup-brief-summary">
      <div className={s.sectionHeader}>
        <div className={s.sectionAccent} />
        Since Your Last Session
      </div>
      <div className={s.summaryList}>
        {items.map((item, i) => (
          <div className={s.summaryItem} key={i}>
            <div className={`${s.summaryDot} ${item.dot}`} />
            <div className={s.summaryText}>
              <div className={s.summaryLabel}>{item.label}</div>
              {item.detail && <div className={s.summaryDetail}>{item.detail}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Needs Your Attention Section ──

function AttentionSection({
  executions,
  verifications,
}: {
  executions: { id: string; title: string; status: string; log: { type: string; content: string }[] }[];
  verifications: { id: string; executionId: string; type: string; status: string; details: string }[];
}) {
  const failedExecs = executions.filter((e) => e.status === 'failed');
  const reviewVers = verifications.filter((v) => v.status === 'needs_review');
  const approvalVers = verifications.filter(
    (v) => v.status === 'pending' && v.type === 'human_approval',
  );

  return (
    <div className={s.section} data-testid="startup-brief-attention">
      <div className={s.sectionHeader}>
        <div className={s.sectionAccent} />
        Needs Your Attention
      </div>
      <div className={s.attentionList}>
        {/* Error cards */}
        {failedExecs.map((exec) => {
          const lastError = [...exec.log].reverse().find((l) => l.type === 'error');
          return (
            <div
              key={exec.id}
              className={`${s.attentionCard} ${s.attentionCardError}`}
            >
              <div className={s.attentionCardTitle}>
                File locking task failed
              </div>
              <div className={s.attentionCardDesc}>
                {lastError?.content ?? 'Execution failed'}
              </div>
              <div className={s.attentionCardMeta}>{exec.id}</div>
              <div className={s.attentionCardActions}>
                <button className={s.btnDanger}>Retry</button>
                <button className={s.btnSecondary}>Investigate</button>
              </div>
            </div>
          );
        })}

        {/* Review cards */}
        {reviewVers.map((ver) => (
          <div
            key={ver.id}
            className={`${s.attentionCard} ${s.attentionCardReview}`}
          >
            <div className={s.attentionCardTitle}>
              Test results need review
            </div>
            <div className={s.attentionCardDesc}>{ver.details}</div>
            <div className={s.attentionCardMeta}>{ver.id} / {ver.executionId}</div>
            <div className={s.attentionCardActions}>
              <button className={s.btnAmber}>View Results</button>
            </div>
          </div>
        ))}

        {/* Approval cards */}
        {approvalVers.map((ver) => (
          <div
            key={ver.id}
            className={`${s.attentionCard} ${s.attentionCardApproval}`}
          >
            <div className={s.attentionCardTitle}>
              Git snapshot strategy awaiting approval
            </div>
            <div className={s.attentionCardDesc}>{ver.details}</div>
            <div className={s.attentionCardMeta}>{ver.id} / {ver.executionId}</div>
            <div className={s.attentionCardActions}>
              <button className={s.btnPrimary}>Approve</button>
              <button className={s.btnSecondary}>Reject</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Strategy Progress Section ──

function StrategyProgress({ strategies }: { strategies: StrategyPrimitive[] }) {
  return (
    <div className={s.section} data-testid="startup-brief-strategy">
      <div className={s.sectionHeader}>
        <div className={s.sectionAccent} />
        Strategy Progress
      </div>
      <div className={s.strategyList}>
        {strategies.map((phase) => {
          const completed = countCompletedChildren(phase);
          const total = countTotalLeaves(phase);
          const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

          const badgeClass =
            phase.status === 'active'
              ? s.strategyBadgeActive
              : phase.status === 'completed'
                ? s.strategyBadgeCompleted
                : s.strategyBadgeDraft;

          return (
            <div className={s.strategyRow} key={phase.id}>
              <div className={s.strategyName}>{phase.title}</div>
              <span className={`${s.strategyBadge} ${badgeClass}`}>
                {phase.status}
              </span>
              <div className={s.progressTrack}>
                <div
                  className={s.progressFill}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className={s.strategyPercent}>{pct}%</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Cost Summary Section ──

function CostSummary({
  agents,
}: {
  agents: { id: string; name: string; costUsd: number; tokensUsed: number }[];
}) {
  const totalCost = agents.reduce((sum, a) => sum + a.costUsd, 0);
  const totalTokens = agents.reduce((sum, a) => sum + a.tokensUsed, 0);

  return (
    <div className={s.section} data-testid="startup-brief-cost">
      <div className={s.sectionHeader}>
        <div className={s.sectionAccent} />
        Cost Summary
      </div>
      <div className={s.costContainer}>
        <div className={s.costHeadline}>
          Session total:{' '}
          <span className={s.costHeadlineAmount}>
            ${totalCost.toFixed(2)}
          </span>{' '}
          across {agents.length} agents
        </div>
        <div className={s.costBadges}>
          {agents.map((agent) => (
            <span className={s.costBadge} key={agent.id}>
              {agent.name}:{' '}
              <span className={s.costBadgeAmount}>
                ${agent.costUsd.toFixed(2)}
              </span>
            </span>
          ))}
        </div>
        <div className={s.costTokens}>
          {formatTokens(totalTokens)} tokens used
        </div>
      </div>
    </div>
  );
}

// ── Quick Actions Section ──

function QuickActions({
  verifications,
}: {
  verifications: { id: string; type: string; status: string }[];
}) {
  const reviewCount = verifications.filter(
    (v) => v.status === 'needs_review' || (v.status === 'pending' && v.type === 'human_approval'),
  ).length;

  return (
    <div className={s.section} data-testid="startup-brief-actions">
      <div className={s.sectionHeader}>
        <div className={s.sectionAccent} />
        Quick Actions
      </div>
      <div className={s.quickActions}>
        <button className={`${s.actionBtn} ${s.actionBtnPlan}`}>Plan</button>
        <button className={`${s.actionBtn} ${s.actionBtnReview}`}>
          Review Queue ({reviewCount})
        </button>
        <button className={`${s.actionBtn} ${s.actionBtnDebug}`}>Debug</button>
        <button className={`${s.actionBtn} ${s.actionBtnDeploy}`}>Deploy</button>
      </div>
    </div>
  );
}

// ── Chat Panel ──

function ChatPanel() {
  const [inputValue, setInputValue] = useState('');

  const systemMessage =
    'Good morning. You have 2 items needing review and 1 error to investigate. What would you like to start with?';

  const quickReplies = [
    'Review test results',
    'Fix file locking error',
    'Check strategy progress',
  ];

  return (
    <div className={s.chatPanel} data-testid="startup-brief-chat">
      <div className={s.chatHeader}>
        <div className={s.onlineDot} />
        <div className={s.chatHeaderTitle}>Chat</div>
      </div>

      <div className={s.chatMessages}>
        <div className={s.chatBubbleSystem}>
          <div className={s.chatBubbleText}>{systemMessage}</div>
        </div>
        <div className={s.chipRow}>
          {quickReplies.map((reply) => (
            <button
              className={s.chip}
              key={reply}
              onClick={() => setInputValue(reply)}
            >
              {reply}
            </button>
          ))}
        </div>
      </div>

      <div className={s.chatInputArea}>
        <div className={s.chatInputRow}>
          <input
            className={s.chatInput}
            type="text"
            placeholder="Ask about your project..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            data-testid="startup-brief-chat-input"
          />
          <button className={s.sendBtn} aria-label="Send message">
            <span className={s.sendArrow}>&#x2191;</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ──

export default function StartupBrief() {
  const { agents, executions, verifications } = usePrimitivesData();
  const strategies = useStrategies();
  const { isLive } = useConnectionStatus();
  const briefDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className={s.shell} data-testid="startup-brief-shell">
      <div className={s.briefPanel} data-testid="startup-brief-content">
        <div className={s.briefHeader}>
          <h1 className={s.briefTitle}>
            Mission Brief
            {isLive && <span className={s.liveDot} title="Connected to engine" />}
          </h1>
          <div className={s.briefDate}>{briefDate}</div>
          <div className={s.briefDivider} />
        </div>

        <SessionSummary agents={agents} executions={executions} />
        <AttentionSection executions={executions} verifications={verifications} />
        <StrategyProgress strategies={strategies} />
        <CostSummary agents={agents} />
        <QuickActions verifications={verifications} />
      </div>

      <ChatPanel />
    </div>
  );
}
