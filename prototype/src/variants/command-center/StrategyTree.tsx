import { strategies } from '../../data/mock';
import type { StrategyPrimitive } from '../../types/primitives';
import styles from './CommandCenter.module.css';

const STATUS_COLORS: Record<StrategyPrimitive['status'], string> = {
  active: '#3fb950',
  completed: '#3fb950',
  draft: '#8b949e',
  abandoned: '#f85149',
};

const STATUS_BG: Record<StrategyPrimitive['status'], string> = {
  active: 'rgba(63,185,80,0.15)',
  completed: 'rgba(63,185,80,0.10)',
  draft: 'rgba(139,148,158,0.12)',
  abandoned: 'rgba(248,81,73,0.12)',
};

function StrategyNode({ node, depth }: { node: StrategyPrimitive; depth: number }) {
  const isActive = node.status === 'active';
  const hasChildren = node.children.length > 0;

  if (!hasChildren) {
    return (
      <div
        className={styles.strategyLeaf}
        style={{ paddingLeft: 12 + depth * 16 }}
      >
        <span className={styles.strategyLeafBullet}>{'\u2022'}</span>
        <span
          className={`${styles.strategyTitle} ${isActive ? styles.strategyTitleActive : ''}`}
        >
          {node.title}
        </span>
        <span
          className={styles.strategyStatusBadge}
          style={{
            color: STATUS_COLORS[node.status],
            background: STATUS_BG[node.status],
          }}
        >
          {node.status}
        </span>
      </div>
    );
  }

  return (
    <details
      className={styles.strategyDetails}
      open={node.status === 'active' || node.status === 'completed'}
    >
      <summary style={{ paddingLeft: 12 + depth * 16 }}>
        <span
          className={`${styles.strategyTitle} ${isActive ? styles.strategyTitleActive : ''}`}
        >
          {node.title}
        </span>
        <span
          className={styles.strategyStatusBadge}
          style={{
            color: STATUS_COLORS[node.status],
            background: STATUS_BG[node.status],
          }}
        >
          {node.status}
        </span>
      </summary>
      <div className={styles.strategyChildren}>
        {node.children.map((child) => (
          <StrategyNode key={child.id} node={child} depth={depth + 1} />
        ))}
      </div>
    </details>
  );
}

export default function StrategyTree() {
  const totalNodes = strategies.reduce(
    (acc, s) => acc + 1 + countDescendants(s),
    0,
  );

  return (
    <section
      className={`${styles.panel} ${styles.strategyPanel}`}
      data-testid="strategy-tree"
    >
      <div className={styles.panelHeader}>
        <span className={styles.panelHeaderTitle}>Strategy</span>
        <span className={styles.panelHeaderBadge}>{totalNodes}</span>
      </div>
      <div className={styles.panelBody}>
        <div className={styles.strategyTree}>
          {strategies.map((strat) => (
            <StrategyNode key={strat.id} node={strat} depth={0} />
          ))}
        </div>
      </div>
    </section>
  );
}

function countDescendants(node: StrategyPrimitive): number {
  return node.children.reduce(
    (acc, child) => acc + 1 + countDescendants(child),
    0,
  );
}
