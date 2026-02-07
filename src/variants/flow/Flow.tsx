import SummaryRibbon from './SummaryRibbon';
import StrategyRoadmap from './StrategyRoadmap';
import ActiveWork from './ActiveWork';
import RecentActivity from './RecentActivity';
import KnowledgeBase from './KnowledgeBase';
import VerificationStatus from './VerificationStatus';
import styles from './Flow.module.css';

export default function Flow() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.headerIcon}>{'\u2630'}</span>
        <span className={styles.headerTitle}>
          Universal Agent Host
          <span className={styles.headerSubtitle}>Flow View</span>
        </span>
      </header>

      <main className={styles.container}>
        <SummaryRibbon />
        <StrategyRoadmap />
        <ActiveWork />
        <RecentActivity />
        <KnowledgeBase />
        <VerificationStatus />
      </main>
    </div>
  );
}
