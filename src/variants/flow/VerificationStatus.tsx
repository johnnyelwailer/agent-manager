import { useState } from 'react';
import { verifications, executions } from '../../data/mock';
import type { VerificationPrimitive } from '../../types/primitives';
import styles from './Flow.module.css';

function badgeClass(status: VerificationPrimitive['status']): string {
  switch (status) {
    case 'passed':
      return styles.verPassed;
    case 'failed':
      return styles.verFailed;
    case 'pending':
      return styles.verPending;
    case 'needs_review':
      return styles.verNeedsReview;
    default:
      return '';
  }
}

function badgeLabel(status: VerificationPrimitive['status']): string {
  switch (status) {
    case 'passed':
      return 'Passed';
    case 'failed':
      return 'Failed';
    case 'pending':
      return 'Pending';
    case 'needs_review':
      return 'Needs Review';
    default:
      return status;
  }
}

function typeLabel(type: VerificationPrimitive['type']): string {
  switch (type) {
    case 'diff_review':
      return 'Diff Review';
    case 'test_run':
      return 'Test Run';
    case 'lint':
      return 'Lint';
    case 'human_approval':
      return 'Human Approval';
    default:
      return type;
  }
}

function getExecutionTitle(executionId: string): string {
  const exec = executions.find((e) => e.id === executionId);
  return exec ? exec.title : executionId;
}

// Group verifications by executionId
function groupByExecution(
  vers: VerificationPrimitive[],
): Map<string, VerificationPrimitive[]> {
  const map = new Map<string, VerificationPrimitive[]>();
  for (const v of vers) {
    const existing = map.get(v.executionId);
    if (existing) {
      existing.push(v);
    } else {
      map.set(v.executionId, [v]);
    }
  }
  return map;
}

export default function VerificationStatus() {
  const [collapsed, setCollapsed] = useState(false);
  const grouped = groupByExecution(verifications);

  return (
    <div data-testid="verification-status" className={styles.section}>
      <div
        className={styles.sectionHeader}
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className={styles.sectionHeaderLeft}>
          <span className={styles.sectionIcon}>{'\u2705'}</span>
          <span className={styles.sectionTitle}>Verification Status</span>
          <span className={styles.sectionCount}>
            {verifications.length} check{verifications.length !== 1 ? 's' : ''}
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
          {verifications.length === 0 ? (
            <div className={styles.emptyState}>No verifications yet.</div>
          ) : (
            Array.from(grouped.entries()).map(([execId, vers]) => (
              <div key={execId} className={styles.verificationGroup}>
                <div className={styles.verGroupHeader}>
                  {getExecutionTitle(execId)}
                  <span className={styles.verGroupExecId}>{execId}</span>
                </div>
                {vers.map((v) => (
                  <div key={v.id} className={styles.verItem}>
                    <span className={styles.verTypeLabel}>
                      {typeLabel(v.type)}
                    </span>
                    <span
                      className={`${styles.verBadge} ${badgeClass(v.status)}`}
                    >
                      {badgeLabel(v.status)}
                    </span>
                    <span className={styles.verDetails}>{v.details}</span>
                    {v.sourceFile && (
                      <span className={styles.verSourceFile}>
                        {v.sourceFile}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
