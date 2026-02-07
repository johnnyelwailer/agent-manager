import { useState, useMemo } from 'react';
import { agents, executions } from '../../data/mock';
import styles from './StartupCommand.module.css';

// ── Action definitions ──────────────────────────────────

interface Action {
  id: string;
  icon: string;
  label: string;
  description: string;
  shortcut: string;
}

const actions: Action[] = [
  { id: 'plan', icon: '\u26A1', label: 'Plan', description: 'Create a new strategy', shortcut: 'Ctrl+1' },
  { id: 'review', icon: '\u25C9', label: 'Review', description: 'Open review queue (2)', shortcut: 'Ctrl+2' },
  { id: 'refactor', icon: '\u2699', label: 'Refactor', description: 'Restructure code', shortcut: 'Ctrl+3' },
  { id: 'debug', icon: '\u2716', label: 'Debug', description: 'Investigate errors', shortcut: 'Ctrl+4' },
  { id: 'deploy', icon: '\u25B6', label: 'Deploy', description: 'Ship changes', shortcut: 'Ctrl+5' },
];

// ── Helpers ──────────────────────────────────────────────

function timeAgo(timestamp: number | undefined): string {
  if (!timestamp) return '';
  const diffMs = Date.now() - timestamp;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function getAgentName(agentId: string | undefined): string {
  if (!agentId) return '';
  const agent = agents.find((a) => a.id === agentId);
  return agent ? agent.name : agentId;
}

function dotClass(status: string): string {
  switch (status) {
    case 'completed':
      return styles.dotCompleted;
    case 'running':
      return styles.dotRunning;
    case 'queued':
      return styles.dotQueued;
    case 'failed':
      return styles.dotFailed;
    case 'paused':
      return styles.dotPaused;
    default:
      return styles.dotQueued;
  }
}

function agentFooterDot(status: string): string {
  switch (status) {
    case 'running':
      return styles.footerDotRunning;
    case 'idle':
      return styles.footerDotIdle;
    case 'errored':
      return styles.footerDotErrored;
    default:
      return styles.footerDotIdle;
  }
}

// ── Component ────────────────────────────────────────────

export default function StartupCommand() {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Sort executions by startedAt descending, take up to 6
  const recentExecutions = useMemo(() => {
    return [...executions]
      .sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0))
      .slice(0, 6);
  }, []);

  // Filter actions and recent items by query
  const filteredActions = useMemo(() => {
    if (!query.trim()) return actions;
    const q = query.toLowerCase();
    return actions.filter(
      (a) =>
        a.label.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q)
    );
  }, [query]);

  const filteredRecent = useMemo(() => {
    if (!query.trim()) return recentExecutions;
    const q = query.toLowerCase();
    return recentExecutions.filter((e) =>
      e.title.toLowerCase().includes(q)
    );
  }, [query, recentExecutions]);

  const totalItems = filteredActions.length + filteredRecent.length;
  const hasResults = totalItems > 0;

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % totalItems);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + totalItems) % totalItems);
    }
  };

  // Compute totals for footer
  const totalCost = agents.reduce((sum, a) => sum + a.costUsd, 0);
  const totalTasks = executions.length;

  return (
    <div className={styles.shell} data-testid="startup-command-shell">
      <div className={styles.centerContent}>
        <div className={styles.commandBarWrapper}>
          {/* ── Command Bar ── */}
          <div
            className={`${styles.commandBar} ${!hasResults ? styles.commandBarNoResults : ''}`}
          >
            <span className={styles.commandIcon}>&gt;</span>
            <input
              className={styles.commandInput}
              data-testid="startup-command-input"
              type="text"
              placeholder="Type a command or search..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          </div>

          {/* ── Results Panel ── */}
          {hasResults && (
            <div
              className={styles.resultsPanel}
              data-testid="startup-command-results"
            >
              {/* Actions Section */}
              {filteredActions.length > 0 && (
                <div data-testid="startup-command-actions">
                  <div className={styles.sectionHeader}>Actions</div>
                  {filteredActions.map((action, i) => {
                    const isSelected = selectedIndex === i;
                    return (
                      <div
                        key={action.id}
                        className={`${styles.row} ${isSelected ? styles.rowSelected : ''}`}
                        onMouseEnter={() => setSelectedIndex(i)}
                      >
                        <div
                          className={`${styles.rowIcon} ${isSelected ? styles.rowSelectedIcon : ''}`}
                        >
                          {action.icon}
                        </div>
                        <div className={styles.rowBody}>
                          <div className={styles.rowLabel}>{action.label}</div>
                          <div className={styles.rowDescription}>
                            {action.description}
                          </div>
                        </div>
                        <span className={styles.rowShortcut}>
                          {action.shortcut}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Divider between sections */}
              {filteredActions.length > 0 && filteredRecent.length > 0 && (
                <div className={styles.divider} />
              )}

              {/* Recent Section */}
              {filteredRecent.length > 0 && (
                <div data-testid="startup-command-recent">
                  <div className={styles.sectionHeader}>Recent</div>
                  {filteredRecent.map((exec, i) => {
                    const globalIndex = filteredActions.length + i;
                    const isSelected = selectedIndex === globalIndex;
                    return (
                      <div
                        key={exec.id}
                        className={`${styles.recentRow} ${isSelected ? styles.recentRowSelected : ''}`}
                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                      >
                        <span
                          className={`${styles.statusDot} ${dotClass(exec.status)}`}
                        />
                        <div className={styles.recentBody}>
                          <span className={styles.recentTitle}>
                            {exec.title}
                          </span>
                          {exec.assignedAgent && (
                            <span className={styles.recentAgent}>
                              {getAgentName(exec.assignedAgent)}
                            </span>
                          )}
                        </div>
                        <span className={styles.recentTime}>
                          {timeAgo(exec.startedAt)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Empty filtered state */}
              {!hasResults && (
                <div className={styles.emptyState}>
                  No results for "{query}"
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Keyboard Hints ── */}
        <div className={styles.hints} data-testid="startup-command-hints">
          <span>
            <span className={styles.hintKey}>[Esc]</span> Close
          </span>
          <span>
            <span className={styles.hintKey}>[Up/Down]</span> Navigate
          </span>
          <span>
            <span className={styles.hintKey}>[Enter]</span> Select
          </span>
        </div>
      </div>

      {/* ── Footer Stats ── */}
      <div className={styles.footer}>
        <span className={styles.footerText}>
          {agents.map((agent) => (
            <span
              key={agent.id}
              className={`${styles.footerDot} ${agentFooterDot(agent.status)}`}
            />
          ))}
          {agents.length} agents connected
        </span>
        <span className={styles.footerSep}>&middot;</span>
        <span className={styles.footerText}>{totalTasks} tasks</span>
        <span className={styles.footerSep}>&middot;</span>
        <span className={styles.footerText}>${totalCost.toFixed(2)} spent</span>
      </div>
    </div>
  );
}
