import { verifications } from '../../data/mock';
import type { VerificationPrimitive } from '../../types/primitives';
import styles from './CommandCenter.module.css';

/* ── Color maps ──────────────────────────────────────────────────────── */

const STATUS_DOT_COLORS: Record<VerificationPrimitive['status'], string> = {
  passed: '#3fb950',
  failed: '#f85149',
  pending: '#8b949e',
  needs_review: '#d29922',
};

const TYPE_STYLE: Record<
  VerificationPrimitive['type'],
  { label: string; color: string; bg: string }
> = {
  test_run: { label: 'TEST', color: '#3fb950', bg: 'rgba(63,185,80,0.12)' },
  diff_review: { label: 'DIFF', color: '#79c0ff', bg: 'rgba(121,192,255,0.12)' },
  lint: { label: 'LINT', color: '#d2a8ff', bg: 'rgba(210,168,255,0.12)' },
  human_approval: { label: 'HUMAN', color: '#d29922', bg: 'rgba(210,153,34,0.12)' },
};

/* ── Component ───────────────────────────────────────────────────────── */

export default function VerificationPanel() {
  return (
    <section
      className={`${styles.panel} ${styles.verificationPanel}`}
      data-testid="verification-panel"
    >
      <div className={styles.panelHeader}>
        <span className={styles.panelHeaderTitle}>Verification</span>
        <span className={styles.panelHeaderBadge}>{verifications.length}</span>
      </div>
      <div className={styles.panelBody}>
        {verifications.map((ver) => {
          const typeStyle = TYPE_STYLE[ver.type];
          return (
            <div key={ver.id} className={styles.verRow}>
              <span
                className={styles.verTypeBadge}
                style={{ color: typeStyle.color, background: typeStyle.bg }}
              >
                {typeStyle.label}
              </span>
              <div className={styles.verInfo}>
                <div className={styles.verExecId}>{ver.executionId}</div>
                <div className={styles.verDetails}>{ver.details}</div>
              </div>
              <span
                className={styles.verStatusDot}
                style={{ background: STATUS_DOT_COLORS[ver.status] }}
                title={ver.status}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
