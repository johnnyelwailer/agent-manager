import { useState } from 'react';
import { contexts } from '../../data/mock';
import styles from './Flow.module.css';

function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function KnowledgeBase() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div data-testid="knowledge-base" className={styles.section}>
      <div
        className={styles.sectionHeader}
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className={styles.sectionHeaderLeft}>
          <span className={styles.sectionIcon}>{'\uD83D\uDCD6'}</span>
          <span className={styles.sectionTitle}>Knowledge Base</span>
          <span className={styles.sectionCount}>
            {contexts.length} item{contexts.length !== 1 ? 's' : ''}
          </span>
        </div>
        <span
          className={`${styles.chevron} ${!collapsed ? styles.chevronOpen : ''}`}
        >
          &#9656;
        </span>
      </div>
      {!collapsed && (
        <div className={styles.sectionBody}>
          {contexts.length === 0 ? (
            <div className={styles.emptyState}>
              No knowledge entries yet.
            </div>
          ) : (
            <div className={styles.knowledgeList}>
              {contexts.map((ctx) => (
                <div key={ctx.id} className={styles.knowledgeCard}>
                  <div className={styles.knowledgeTitle}>{ctx.title}</div>
                  <div className={styles.knowledgeContent}>{ctx.content}</div>
                  <div className={styles.knowledgeMeta}>
                    {ctx.tags.map((tag) => (
                      <span key={tag} className={styles.tag}>
                        {tag}
                      </span>
                    ))}
                    <span className={styles.knowledgeSource}>
                      {ctx.sourceFile}
                    </span>
                    <span className={styles.knowledgeTime}>
                      {relativeTime(ctx.lastModified)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
