import { useState } from 'react';
import { strategies } from '../../data/mock';
import type { StrategyPrimitive } from '../../types/primitives';
import styles from './Flow.module.css';

function statusDotClass(status: StrategyPrimitive['status']): string {
  switch (status) {
    case 'completed':
      return styles.statusCompleted;
    case 'active':
      return styles.statusActive;
    case 'abandoned':
      return styles.statusAbandoned;
    default:
      return styles.statusDraft;
  }
}

function statusIcon(status: StrategyPrimitive['status']): string {
  switch (status) {
    case 'completed':
      return '\u25CF'; // filled circle
    case 'active':
      return '\u25D0'; // half circle
    default:
      return '\u25CB'; // empty circle
  }
}

function countProgress(strategy: StrategyPrimitive): {
  done: number;
  total: number;
} {
  let done = 0;
  let total = 0;

  function walk(node: StrategyPrimitive) {
    if (node.children.length === 0) {
      total++;
      if (node.status === 'completed') done++;
    } else {
      for (const child of node.children) {
        walk(child);
      }
    }
  }

  for (const child of strategy.children) {
    walk(child);
  }
  return { done, total };
}

function StrategyChildren({
  children,
  isLast,
}: {
  children: StrategyPrimitive[];
  isLast?: boolean[];
}) {
  return (
    <>
      {children.map((child, idx) => {
        const last = idx === children.length - 1;
        const connector = last ? '\u2514\u2500\u2500' : '\u251C\u2500\u2500';
        return (
          <div key={child.id}>
            <div className={styles.stratChild}>
              <span className={styles.treeConnector}>{connector}</span>
              <span className={styles.childLabel}>{child.title}</span>
              <span className={styles.childStatusIcon}>
                {statusIcon(child.status)}
              </span>
            </div>
            {child.children.length > 0 && (
              <div className={styles.nestedChildren}>
                <StrategyChildren children={child.children} />
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

function PhaseCard({ strategy }: { strategy: StrategyPrimitive }) {
  const [open, setOpen] = useState(strategy.status === 'active');
  const { done, total } = countProgress(strategy);

  return (
    <div className={styles.phase}>
      <div className={styles.phaseHeader} onClick={() => setOpen(!open)}>
        <span
          className={`${styles.phaseChevron} ${open ? styles.phaseChevronOpen : ''}`}
        >
          &#9656;
        </span>
        <span className={styles.phaseTitle}>{strategy.title}</span>
        {total > 0 && (
          <span className={styles.phaseProgress}>
            {done}/{total}
          </span>
        )}
        <span
          className={`${styles.statusDot} ${statusDotClass(strategy.status)}`}
          title={strategy.status}
        />
      </div>
      {open && strategy.children.length > 0 && (
        <div className={styles.phaseChildren}>
          <StrategyChildren children={strategy.children} />
        </div>
      )}
    </div>
  );
}

export default function StrategyRoadmap() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div data-testid="strategy-roadmap" className={styles.section}>
      <div
        className={styles.sectionHeader}
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className={styles.sectionHeaderLeft}>
          <span className={styles.sectionIcon}>{'\uD83D\uDDFA\uFE0F'}</span>
          <span className={styles.sectionTitle}>Strategy Roadmap</span>
          <span className={styles.sectionCount}>{strategies.length} phases</span>
        </div>
        <span
          className={`${styles.chevron} ${!collapsed ? styles.chevronOpen : ''}`}
        >
          &#9656;
        </span>
      </div>
      {!collapsed && (
        <div className={styles.sectionBody}>
          <div className={styles.roadmap}>
            {strategies.map((s) => (
              <PhaseCard key={s.id} strategy={s} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
