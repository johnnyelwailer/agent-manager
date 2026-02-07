import { useState } from 'react';
import { agents, executions } from '../../data/mock';
import type { ExecutionPrimitive, AgentInfo } from '../../types/primitives';
import s from './StartupChat.module.css';

/* ── Helpers ──────────────────────────────────────────── */

const ACTION_CHIPS = [
  { label: 'Plan', icon: '\u25A6' },
  { label: 'Review', icon: '\u25C9' },
  { label: 'Refactor', icon: '\u21BB' },
  { label: 'Debug', icon: '\u25A3' },
  { label: 'Deploy', icon: '\u25B2' },
] as const;

function statusDotClass(status: ExecutionPrimitive['status']): string {
  switch (status) {
    case 'completed':
      return s.dotCompleted;
    case 'running':
      return s.dotRunning;
    case 'queued':
      return s.dotQueued;
    case 'failed':
      return s.dotFailed;
    case 'paused':
      return s.dotPaused;
    default:
      return s.dotQueued;
  }
}

function agentFooterDotClass(status: AgentInfo['status']): string {
  switch (status) {
    case 'running':
      return s.footerDotRunning;
    case 'idle':
      return s.footerDotIdle;
    case 'errored':
      return s.footerDotErrored;
    default:
      return s.footerDotIdle;
  }
}

function timeAgo(timestamp: number | undefined): string {
  if (!timestamp) return '';
  const diffMs = Date.now() - timestamp;
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatTokens(n: number): string {
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function agentNameById(id: string): string | null {
  const agent = agents.find((a) => a.id === id);
  return agent ? agent.name : null;
}

/* ── Component ────────────────────────────────────────── */

export default function StartupChat() {
  const [inputValue, setInputValue] = useState('');
  const [activeChip, setActiveChip] = useState<string | null>(null);

  /* Aggregate footer stats */
  const connectedCount = agents.length;
  const totalCost = agents.reduce((sum, a) => sum + a.costUsd, 0);
  const totalTokens = agents.reduce((sum, a) => sum + a.tokensUsed, 0);

  const handleChipClick = (label: string) => {
    setActiveChip((prev) => (prev === label ? null : label));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      /* send action placeholder */
    }
  };

  return (
    <div className={s.shell} data-testid="startup-chat-shell">
      {/* ── Header ──────────────────────────────────── */}
      <div className={s.header}>
        <div className={s.logoIcon}>A</div>
        <button className={s.settingsBtn} aria-label="Settings">
          {'\u2699'}
        </button>
      </div>

      {/* ── Main centered content ───────────────────── */}
      <div className={s.main}>
        {/* Hero */}
        <div className={s.hero} data-testid="startup-chat-hero">
          <div className={s.heroLogo}>A</div>
          <h1 className={s.heroTitle}>Universal Agent Host</h1>
          <p className={s.heroTagline}>What would you like to work on?</p>
        </div>

        {/* Action Chips */}
        <div className={s.actions} data-testid="startup-chat-actions">
          {ACTION_CHIPS.map((chip) => (
            <button
              key={chip.label}
              className={`${s.chip}${activeChip === chip.label ? ` ${s.chipActive}` : ''}`}
              onClick={() => handleChipClick(chip.label)}
            >
              <span className={s.chipIcon}>{chip.icon}</span>
              {chip.label}
            </button>
          ))}
        </div>

        {/* Chat Input */}
        <div className={s.inputWrapper} data-testid="startup-chat-input">
          <div className={s.inputBox}>
            <textarea
              className={s.textarea}
              placeholder="Describe a task, ask a question, or pick an action above..."
              rows={3}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button className={s.sendBtn} aria-label="Send">
              {'\u2191'}
            </button>
          </div>
          <div className={s.inputHint}>Press Enter to send</div>
        </div>

        {/* Recent Tasks */}
        <div className={s.recentSection} data-testid="startup-chat-recent">
          <div className={s.recentLabel}>Recent Tasks</div>
          <div className={s.recentGrid}>
            {executions.map((exec) => {
              const agentName = exec.assignedAgent
                ? agentNameById(exec.assignedAgent)
                : null;
              const started = exec.startedAt ?? exec.completedAt;
              return (
                <div key={exec.id} className={s.taskCard}>
                  <div className={s.taskCardHeader}>
                    <span
                      className={`${s.statusDot} ${statusDotClass(exec.status)}`}
                    />
                    <span className={s.taskTitle}>{exec.title}</span>
                  </div>
                  <div className={s.taskMeta}>
                    {agentName && (
                      <span className={s.taskAgent}>{agentName}</span>
                    )}
                    {started && <span>{timeAgo(started)}</span>}
                    {exec.costUsd != null && exec.costUsd > 0 && (
                      <span className={s.taskCost}>
                        ${exec.costUsd.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Footer ──────────────────────────────────── */}
      <div className={s.footer} data-testid="startup-chat-footer">
        <span className={s.footerText}>
          {agents.map((agent) => (
            <span
              key={agent.id}
              className={`${s.footerDot} ${agentFooterDotClass(agent.status)}`}
            />
          ))}
          {connectedCount} agents connected
        </span>
        <span className={s.footerSep}>{'·'}</span>
        <span className={s.footerText}>${totalCost.toFixed(2)} spent</span>
        <span className={s.footerSep}>{'·'}</span>
        <span className={s.footerText}>
          {formatTokens(totalTokens)} tokens
        </span>
      </div>
    </div>
  );
}
