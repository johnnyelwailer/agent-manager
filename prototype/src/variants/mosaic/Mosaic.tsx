import { useState } from 'react';
import { agents, executions, verifications, contexts, strategies } from '../../data/mock';
import type { StrategyPrimitive } from '../../types/primitives';
import s from './Mosaic.module.css';

// ── Helpers ────────────────────────────────────────────────────────────

function countLeaves(node: StrategyPrimitive): number {
  if (node.children.length === 0) return 1;
  return node.children.reduce((sum, c) => sum + countLeaves(c), 0);
}

function countCompletedLeaves(node: StrategyPrimitive): number {
  if (node.children.length === 0) return node.status === 'completed' ? 1 : 0;
  return node.children.reduce((sum, c) => sum + countCompletedLeaves(c), 0);
}

function abbreviateModel(model: string): string {
  if (model.includes('sonnet-4-5')) return 'sonnet-4.5';
  if (model.includes('opus-4-6')) return 'opus-4.6';
  if (model.includes('haiku-4-5')) return 'haiku-4.5';
  return model.replace(/^claude-/, '').replace(/-\d{8}$/, '');
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function timeAgo(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function agentName(agentId: string): string {
  const agent = agents.find((a) => a.id === agentId);
  return agent ? agent.name : agentId;
}

// Status dot CSS class
function dotClass(status: StrategyPrimitive['status']): string {
  switch (status) {
    case 'completed': return s.dotCompleted;
    case 'active': return s.dotActive;
    case 'draft': return s.dotDraft;
    case 'abandoned': return s.dotAbandoned;
    default: return s.dotDraft;
  }
}

// Agent ring class
function ringClass(status: string): string {
  switch (status) {
    case 'running': return s.ringRunning;
    case 'idle': return s.ringIdle;
    case 'errored': return s.ringErrored;
    case 'paused': return s.ringPaused;
    default: return s.ringIdle;
  }
}

// Agent status label class
function statusLabelClass(status: string): string {
  switch (status) {
    case 'running': return s.statusRunning;
    case 'idle': return s.statusIdle;
    case 'errored': return s.statusErrored;
    case 'paused': return s.statusPaused;
    default: return s.statusIdle;
  }
}

// Verification dot class
function verDotClass(status: string): string {
  switch (status) {
    case 'passed': return s.verPassed;
    case 'failed': return s.verFailed;
    case 'needs_review': return s.verNeedsReview;
    case 'pending': return s.verPending;
    default: return s.verNA;
  }
}

// Tag color class mapping
function tagColorClass(tag: string): string {
  if (tag === 'architecture' || tag === 'overview') return s.tagArchitecture;
  if (tag === 'sdk' || tag === 'claude' || tag === 'reference') return s.tagSdk;
  if (tag === 'protocol' || tag === 'adapter' || tag === 'spec') return s.tagProtocol;
  if (tag === 'concurrency' || tag === 'locking') return s.tagConcurrency;
  return s.tagDefault;
}

// Cost bar segment colors
const COST_COLORS = ['#7c3aed', '#2563eb', '#0891b2', '#0d9488', '#84cc16'];

// ── Derived data ───────────────────────────────────────────────────────

const totalLeaves = strategies.reduce((sum, st) => sum + countLeaves(st), 0);
const completedLeaves = strategies.reduce((sum, st) => sum + countCompletedLeaves(st), 0);
const completionPct = totalLeaves > 0 ? Math.round((completedLeaves / totalLeaves) * 100) : 0;

const totalCost = agents.reduce((sum, a) => sum + a.costUsd, 0);
const runningAgentCount = agents.filter((a) => a.status === 'running').length;
const totalTokens = agents.reduce((sum, a) => sum + a.tokensUsed, 0);

// Active work
const runningExecs = executions.filter((e) => e.status === 'running');
const queuedExecs = executions.filter((e) => e.status === 'queued');

// Review queue items: needs_review verifications or pending human_approval
const reviewItems = verifications.filter(
  (v) => v.status === 'needs_review' || (v.status === 'pending' && v.type === 'human_approval'),
);

// Verification matrix: group by execution, columns are the 4 types
const verTypes = ['test_run', 'lint', 'diff_review', 'human_approval'] as const;
const verTypeLabels: Record<string, string> = {
  test_run: 'test',
  lint: 'lint',
  diff_review: 'diff',
  human_approval: 'human',
};
const execsWithVer = Array.from(new Set(verifications.map((v) => v.executionId)));

// Verification summary
const verSummary = {
  passed: verifications.filter((v) => v.status === 'passed').length,
  failed: verifications.filter((v) => v.status === 'failed').length,
  pending: verifications.filter((v) => v.status === 'pending' || v.status === 'needs_review').length,
};

// Cost per strategy phase
function phaseCost(phase: StrategyPrimitive): number {
  const allIds = collectStrategyIds(phase);
  return executions
    .filter((e) => e.parentStrategyId && allIds.has(e.parentStrategyId))
    .reduce((sum, e) => sum + (e.costUsd ?? 0), 0);
}

function collectStrategyIds(node: StrategyPrimitive): Set<string> {
  const ids = new Set<string>([node.id]);
  for (const child of node.children) {
    for (const id of collectStrategyIds(child)) {
      ids.add(id);
    }
  }
  return ids;
}

// File activity: group artifacts by execution
const fileGroups = executions
  .filter((e) => e.artifacts.length > 0)
  .map((e) => ({
    execId: e.id,
    execTitle: e.title,
    files: e.artifacts,
    time: e.completedAt ?? e.startedAt ?? 0,
  }))
  .sort((a, b) => b.time - a.time);

// ── Sub-components ─────────────────────────────────────────────────────

function StrategyNode({
  node,
  depth,
}: {
  node: StrategyPrimitive;
  depth: number;
}) {
  const hasChildren = node.children.length > 0;
  const completed = countCompletedLeaves(node);
  const total = countLeaves(node);
  const assignee = node.metadata?.assignee as string | undefined;

  return (
    <div className={depth > 0 ? s.strategyNested : undefined}>
      <div className={s.strategyItem}>
        <span className={`${s.statusDot} ${dotClass(node.status)}`} />
        <span className={s.strategyLabel}>{node.title}</span>
        {assignee && (
          <span className={s.assigneeTag}>{agentName(assignee)}</span>
        )}
        {hasChildren && (
          <div className={s.miniProgressOuter}>
            <div
              className={s.miniProgressInner}
              style={{ width: `${total > 0 ? (completed / total) * 100 : 0}%` }}
            />
          </div>
        )}
      </div>
      {hasChildren &&
        node.children.map((child) => (
          <StrategyNode key={child.id} node={child} depth={depth + 1} />
        ))}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────

export default function Mosaic() {
  // Phase collapse state (all expanded by default)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const togglePhase = (id: string) => {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className={s.shell} data-testid="mosaic-shell">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className={s.header} data-testid="mosaic-header">
        <div className={s.headerTitle}>Universal Agent Host</div>
        <div className={s.headerCenter}>
          <div className={s.progressBarOuter}>
            <div
              className={s.progressBarInner}
              style={{ width: `${completionPct}%` }}
            />
          </div>
          <span className={s.progressLabel}>{completionPct}%</span>
        </div>
        <div className={s.headerRight}>
          <span className={s.costBadge}>${totalCost.toFixed(2)}</span>
          <span className={s.agentCountBadge}>
            {runningAgentCount} active / {agents.length} agents
          </span>
        </div>
      </div>

      {/* ── Card Grid ───────────────────────────────────────────────── */}
      <div className={s.grid}>
        {/* ── Card 1: Strategy Map ──────────────────────────────────── */}
        <div className={s.card} data-testid="mosaic-strategy">
          <div className={s.cardHeader}>
            <span className={s.cardIcon}>#</span>
            <span className={s.cardTitle}>Strategy Map</span>
          </div>
          <div className={s.cardBody}>
            {strategies.map((phase) => {
              const isCollapsed = collapsed[phase.id] ?? false;
              const completed = countCompletedLeaves(phase);
              const total = countLeaves(phase);
              return (
                <div key={phase.id} className={s.strategyPhase}>
                  <button
                    className={s.phaseToggle}
                    onClick={() => togglePhase(phase.id)}
                  >
                    <span
                      className={`${s.phaseArrow} ${!isCollapsed ? s.phaseArrowOpen : ''}`}
                    >
                      {'\u25B6'}
                    </span>
                    <span className={`${s.statusDot} ${dotClass(phase.status)}`} />
                    <span className={s.phaseTitle}>{phase.title}</span>
                    <span className={s.phaseProgress}>
                      {completed}/{total}
                    </span>
                  </button>
                  {!isCollapsed && (
                    <div className={s.strategyChildren}>
                      {phase.children.map((child) => (
                        <StrategyNode
                          key={child.id}
                          node={child}
                          depth={0}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Card 2: Agent Fleet ───────────────────────────────────── */}
        <div className={s.card} data-testid="mosaic-agents">
          <div className={s.cardHeader}>
            <span className={s.cardIcon}>@</span>
            <span className={s.cardTitle}>Agent Fleet</span>
          </div>
          <div className={s.cardBody}>
            <div className={s.agentGrid}>
              {agents.map((agent) => {
                const runningExec = executions.find(
                  (e) => e.id === agent.currentTask && e.status === 'running',
                );
                const failedExec = agent.status === 'errored'
                  ? executions.find(
                      (e) =>
                        e.id === agent.currentTask &&
                        (e.status === 'failed' || e.log.some((l) => l.type === 'error')),
                    )
                  : null;
                const errorMsg = failedExec
                  ? failedExec.log.filter((l) => l.type === 'error').pop()?.content
                  : null;

                return (
                  <div key={agent.id} className={s.agentTile}>
                    <div className={`${s.avatarCircle} ${ringClass(agent.status)}`}>
                      {agent.name.charAt(0)}
                    </div>
                    <div className={s.agentTileName}>{agent.name}</div>
                    <div className={s.agentTileModel}>
                      {abbreviateModel(agent.model)}
                    </div>
                    <span
                      className={`${s.agentTileStatus} ${statusLabelClass(agent.status)}`}
                    >
                      {agent.status}
                    </span>
                    {runningExec && (
                      <div className={s.agentTileTask}>
                        Working on: {runningExec.title}
                      </div>
                    )}
                    {errorMsg && (
                      <div className={s.agentTileError}>{errorMsg}</div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className={s.fleetFooter}>
              <span>{formatTokens(totalTokens)} tokens</span>
              <span>${totalCost.toFixed(2)} total</span>
            </div>
          </div>
        </div>

        {/* ── Card 3: Active Work ───────────────────────────────────── */}
        <div className={s.card} data-testid="mosaic-active">
          <div className={s.cardHeader}>
            <span className={s.cardIcon}>{'>'}</span>
            <span className={s.cardTitle}>Active Work</span>
          </div>
          <div className={s.cardBody}>
            <div className={s.activeCount}>
              {runningExecs.length} active, {queuedExecs.length} queued
            </div>
            {runningExecs.map((exec) => {
              const lastLog =
                exec.log.length > 0 ? exec.log[exec.log.length - 1] : null;
              return (
                <div
                  key={exec.id}
                  className={`${s.miniTaskCard} ${s.miniTaskRunning}`}
                >
                  <div className={s.miniTaskTitle}>{exec.title}</div>
                  {exec.assignedAgent && (
                    <div className={s.miniTaskAgent}>
                      {agentName(exec.assignedAgent)}
                    </div>
                  )}
                  {lastLog && (
                    <div className={s.miniTaskStream}>{lastLog.content}</div>
                  )}
                </div>
              );
            })}
            {queuedExecs.map((exec) => (
              <div
                key={exec.id}
                className={`${s.miniTaskCard} ${s.miniTaskQueued}`}
              >
                <div className={s.miniTaskTitle}>{exec.title}</div>
                <div className={s.miniTaskLabel}>Waiting...</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Card 4: Review Queue ──────────────────────────────────── */}
        <div className={s.card} data-testid="mosaic-reviews">
          <div className={s.cardHeader}>
            <span className={s.cardIcon}>!</span>
            <span className={s.cardTitle}>Review Queue</span>
          </div>
          <div className={s.cardBody}>
            {reviewItems.length === 0 ? (
              <div className={s.allClear}>All clear</div>
            ) : (
              reviewItems.map((item) => {
                const exec = executions.find((e) => e.id === item.executionId);
                return (
                  <div key={item.id} className={s.reviewItem}>
                    <span className={s.reviewDot} />
                    <div className={s.reviewContent}>
                      <div className={s.reviewTitle}>
                        {item.id}: {exec?.title ?? item.executionId}
                      </div>
                      <div className={s.reviewDesc}>{item.details}</div>
                      <span className={s.reviewTypeBadge}>
                        {item.type.replace('_', ' ')}
                      </span>
                    </div>
                    <button className={s.reviewAction}>Review</button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Card 5: Verification Matrix ───────────────────────────── */}
        <div className={s.card} data-testid="mosaic-verifications">
          <div className={s.cardHeader}>
            <span className={s.cardIcon}>*</span>
            <span className={s.cardTitle}>Verification Matrix</span>
          </div>
          <div className={s.cardBody}>
            <table className={s.verTable}>
              <thead>
                <tr>
                  <th>Execution</th>
                  {verTypes.map((t) => (
                    <th key={t}>{verTypeLabels[t]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {execsWithVer.map((execId) => {
                  const exec = executions.find((e) => e.id === execId);
                  return (
                    <tr key={execId}>
                      <td>{exec?.title ?? execId}</td>
                      {verTypes.map((vtype) => {
                        const ver = verifications.find(
                          (v) => v.executionId === execId && v.type === vtype,
                        );
                        return (
                          <td key={vtype}>
                            {ver ? (
                              <span
                                className={`${s.verDot} ${verDotClass(ver.status)}`}
                                title={`${ver.status}: ${ver.details}`}
                              />
                            ) : (
                              <span className={`${s.verDot} ${s.verNA}`}>--</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className={s.verSummary}>
              <span className={s.verSumPassed}>{verSummary.passed} passed</span>
              {', '}
              <span className={s.verSumFailed}>{verSummary.failed} failed</span>
              {', '}
              <span className={s.verSumPending}>{verSummary.pending} pending</span>
            </div>
          </div>
        </div>

        {/* ── Card 6: Cost Breakdown ────────────────────────────────── */}
        <div className={s.card} data-testid="mosaic-cost">
          <div className={s.cardHeader}>
            <span className={s.cardIcon}>$</span>
            <span className={s.cardTitle}>Cost Breakdown</span>
          </div>
          <div className={s.cardBody}>
            <div className={s.costBarContainer}>
              <div className={s.costBarTrack}>
                {agents.map((agent, i) => {
                  const pct = totalCost > 0 ? (agent.costUsd / totalCost) * 100 : 0;
                  return (
                    <div
                      key={agent.id}
                      className={s.costBarSegment}
                      style={{
                        flex: pct,
                        background: COST_COLORS[i % COST_COLORS.length],
                      }}
                      title={`${agent.name}: $${agent.costUsd.toFixed(2)}`}
                    >
                      {pct > 12 ? `$${agent.costUsd.toFixed(2)}` : ''}
                    </div>
                  );
                })}
              </div>
              <div className={s.costLegend}>
                {agents.map((agent, i) => (
                  <div key={agent.id} className={s.costLegendItem}>
                    <span
                      className={s.costLegendDot}
                      style={{ background: COST_COLORS[i % COST_COLORS.length] }}
                    />
                    {agent.name} ${agent.costUsd.toFixed(2)}
                  </div>
                ))}
              </div>
            </div>

            <div className={s.costSectionLabel}>Per Strategy Phase</div>
            {strategies.map((phase) => {
              const cost = phaseCost(phase);
              return (
                <div key={phase.id} className={s.costPhaseRow}>
                  <span>{phase.title}</span>
                  <span className={s.costPhaseAmount}>
                    ${cost.toFixed(2)}
                  </span>
                </div>
              );
            })}

            <div className={s.costTotal}>
              <span>Total</span>
              <span className={s.costTotalAmount}>
                ${totalCost.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* ── Card 7: File Activity ─────────────────────────────────── */}
        <div className={s.card} data-testid="mosaic-files">
          <div className={s.cardHeader}>
            <span className={s.cardIcon}>~</span>
            <span className={s.cardTitle}>File Activity</span>
          </div>
          <div className={s.cardBody}>
            {fileGroups.map((group) => (
              <div key={group.execId} className={s.fileGroup}>
                <div className={s.fileGroupLabel}>
                  {group.execId} - {group.execTitle}
                </div>
                {group.files.map((file) => (
                  <div key={file} className={s.fileEntry}>
                    <span className={s.fileIcon}>F</span>
                    <span className={s.filePath}>{file}</span>
                    <span className={s.fileTime}>
                      {group.time > 0 ? timeAgo(group.time) : '--'}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* ── Card 8: Context Library ───────────────────────────────── */}
        <div className={`${s.card} ${s.cardWide}`} data-testid="mosaic-context">
          <div className={s.cardHeader}>
            <span className={s.cardIcon}>D</span>
            <span className={s.cardTitle}>Context Library</span>
          </div>
          <div className={s.cardBody}>
            <div className={s.contextGrid}>
              {contexts.map((ctx) => (
                <div key={ctx.id} className={s.contextItem}>
                  <div className={s.contextItemHeader}>
                    <span className={s.contextDocIcon}>[D]</span>
                    <span className={s.contextItemTitle}>{ctx.title}</span>
                  </div>
                  <div className={s.contextSource}>{ctx.sourceFile}</div>
                  <div className={s.contextTags}>
                    {ctx.tags.map((tag) => (
                      <span
                        key={tag}
                        className={`${s.contextTag} ${tagColorClass(tag)}`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className={s.contextTime}>{timeAgo(ctx.lastModified)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
