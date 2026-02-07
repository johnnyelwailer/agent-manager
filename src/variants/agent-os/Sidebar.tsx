import s from './AgentOS.module.css';
import { agents, strategies, executions, verifications } from '../../data/mock';
import type { StrategyPrimitive } from '../../types/primitives';

/** Map strategy status to the appropriate CSS dot class */
function statusDotClass(status: StrategyPrimitive['status']): string {
  switch (status) {
    case 'completed':
      return s.statusDotGreen;
    case 'active':
      return s.statusDotYellow;
    case 'abandoned':
      return s.statusDotRed;
    default:
      return '';
  }
}

/** Recursively render a strategy tree node and its children */
function StrategyItem({
  node,
  depth = 0,
}: {
  node: StrategyPrimitive;
  depth?: number;
}) {
  const isActive = node.status === 'active';
  const hasChildren = node.children.length > 0;
  const icon = hasChildren ? '\u25BE' : '\u25B8';

  return (
    <>
      <div
        className={`${s.sidebarItem} ${isActive ? s.sidebarItemActive : ''} ${
          depth > 0 ? s.sidebarNested : ''
        }`}
      >
        <span className={s.sidebarItemIcon}>{icon}</span>
        <span>{node.title}</span>
        <span
          className={`${s.statusDot} ${statusDotClass(node.status)}`}
          style={{ marginLeft: 'auto' }}
        />
      </div>
      {hasChildren &&
        node.children.map((child) => (
          <StrategyItem key={child.id} node={child} depth={depth + 1} />
        ))}
    </>
  );
}

export default function Sidebar() {
  const runningAgentCount = agents.filter((a) => a.status === 'running').length;
  const taskCount = executions.length;
  const reviewCount = verifications.filter(
    (v) => v.status === 'needs_review' || v.status === 'pending',
  ).length;

  return (
    <aside className={s.sidebar} data-testid="agent-os-sidebar">
      {/* ---- Header ---- */}
      <div className={s.sidebarHeader}>
        <div className={s.sidebarLogo}>
          <span className={s.sidebarLogoIcon}>A</span>
          AgentOS
        </div>
      </div>

      {/* ---- CONTEXT ---- */}
      <div className={s.sidebarSection}>
        <div className={s.sidebarSectionLabel}>Context</div>

        <div className={s.sidebarItem}>
          <span className={s.sidebarItemIcon}>{'\u00A7'}</span>
          Constitution
        </div>

        <div className={s.sidebarItem}>
          <span className={s.sidebarItemIcon}>{'\u25C9'}</span>
          Vision
        </div>

        <div className={s.sidebarItem}>
          <span className={s.sidebarItemIcon}>{'\u25A0'}</span>
          Design System
        </div>
      </div>

      {/* ---- STRATEGY ---- */}
      <div className={s.sidebarSection}>
        <div className={s.sidebarSectionLabel}>Strategy</div>

        {strategies.map((phase) => (
          <StrategyItem key={phase.id} node={phase} />
        ))}
      </div>

      {/* ---- EXECUTION ---- */}
      <div className={s.sidebarSection}>
        <div className={s.sidebarSectionLabel}>Execution</div>

        <div className={`${s.sidebarItem} ${s.sidebarItemActive}`}>
          <span className={s.sidebarItemIcon}>{'\u26A1'}</span>
          Active Sprints
        </div>

        <div className={s.sidebarItem}>
          <span className={s.sidebarItemIcon}>{'\u2587'}</span>
          Kanban Board
          <span className={s.sidebarBadge}>{taskCount}</span>
        </div>

        <div className={s.sidebarItem}>
          <span className={s.sidebarItemIcon}>{'\u2709'}</span>
          Review Inbox
          <span className={s.sidebarBadge}>{reviewCount}</span>
        </div>
      </div>

      {/* ---- Footer ---- */}
      <div className={s.sidebarFooter}>
        <div className={s.statusRow}>
          <span className={`${s.statusDot} ${s.statusDotGreen}`} />
          Agent Swarm
          <span style={{ marginLeft: 'auto' }}>
            {runningAgentCount} running
          </span>
        </div>

        <div className={s.statusRow}>
          <span className={`${s.statusDot} ${s.statusDotGreen}`} />
          Local Server
          <span style={{ marginLeft: 'auto' }}>Connected</span>
        </div>
      </div>
    </aside>
  );
}
