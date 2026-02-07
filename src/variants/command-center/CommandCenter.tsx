import styles from './CommandCenter.module.css';
import AgentPanel from './AgentPanel';
import StrategyTree from './StrategyTree';
import ExecutionLog from './ExecutionLog';
import VerificationPanel from './VerificationPanel';
import ContextPanel from './ContextPanel';

export default function CommandCenter() {
  return (
    <div className={styles.root}>
      {/* ── Top bar ──────────────────────────────────────────────── */}
      <header className={styles.topBar}>
        <span className={styles.topBarTitle}>Universal Agent Host</span>
        <span className={styles.topBarClock}>
          {new Date().toLocaleTimeString('en-US', { hour12: false })}
        </span>
      </header>

      {/* ── Grid ─────────────────────────────────────────────────── */}
      <div className={styles.grid}>
        <AgentPanel />
        <StrategyTree />
        <ExecutionLog />
        <VerificationPanel />
        <ContextPanel />
      </div>
    </div>
  );
}
