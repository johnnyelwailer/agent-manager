import { contexts } from '../../data/mock';
import styles from './CommandCenter.module.css';

export default function ContextPanel() {
  return (
    <section
      className={`${styles.panel} ${styles.contextPanel}`}
      data-testid="context-panel"
    >
      <div className={styles.panelHeader}>
        <span className={styles.panelHeaderTitle}>Context</span>
        <span className={styles.panelHeaderBadge}>{contexts.length}</span>
      </div>
      <div className={styles.panelBody}>
        {contexts.map((ctx) => (
          <div key={ctx.id} className={styles.ctxCard}>
            <div className={styles.ctxTitle}>{ctx.title}</div>
            <div className={styles.ctxSource}>{ctx.sourceFile}</div>
            <div className={styles.ctxTags}>
              {ctx.tags.map((tag) => (
                <span key={tag} className={styles.ctxTag}>
                  {tag}
                </span>
              ))}
            </div>
            <div className={styles.ctxContent}>{ctx.content}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
