import s from './AgentOS.module.css';

type ActivityType = 'system' | 'tool' | 'agent' | 'user' | 'error';

interface ActivityEntry {
  id: string;
  time: string;
  type: ActivityType;
  label: string;
  detail: string;
}

const activities: ActivityEntry[] = [
  {
    id: 'act-1',
    time: '1m ago',
    type: 'agent',
    label: 'Running tests...',
    detail: 'file-watcher: npm test --grep debounce',
  },
  {
    id: 'act-2',
    time: '2m ago',
    type: 'tool',
    label: 'Edit Applied',
    detail: 'src/watchers/file-watcher.ts \u2014 Added debounce wrapper',
  },
  {
    id: 'act-3',
    time: '3m ago',
    type: 'system',
    label: 'Plan Updated',
    detail: 'Debounced re-parse logic marked as active',
  },
  {
    id: 'act-4',
    time: '5m ago',
    type: 'agent',
    label: 'Analyzing code...',
    detail: 'Reading src/watchers/index.ts (45 lines)',
  },
  // Position 5 is the generative widget — rendered inline below
  {
    id: 'act-5',
    time: '12m ago',
    type: 'user',
    label: 'You',
    detail: 'Implement the debounce logic for the file watcher pipeline',
  },
  {
    id: 'act-6',
    time: '15m ago',
    type: 'system',
    label: 'Task Started',
    detail: 'exec-2 assigned to Claude Sonnet',
  },
  {
    id: 'act-7',
    time: '20m ago',
    type: 'system',
    label: 'Agent Connected',
    detail: 'Claude Sonnet (claude-sonnet-4-5) session started',
  },
  {
    id: 'act-8',
    time: '1h ago',
    type: 'error',
    label: 'Task Failed',
    detail: 'exec-5: EACCES permission denied creating .agent-lock/',
  },
];

const iconCharMap: Record<ActivityType, string> = {
  system: '\u2726',
  tool: '\u2699',
  agent: '\u25B6',
  user: '\u2192',
  error: '!',
};

const iconClassMap: Record<ActivityType, string> = {
  system: s.activityIconSystem,
  tool: s.activityIconTool,
  agent: s.activityIconAgent,
  user: s.activityIconUser,
  error: s.activityIconError,
};

function ActivityItem({ entry }: { entry: ActivityEntry }) {
  return (
    <div className={s.activityItem}>
      <span className={s.activityTimestamp}>{entry.time}</span>
      <span className={`${s.activityIcon} ${iconClassMap[entry.type]}`}>
        {iconCharMap[entry.type]}
      </span>
      <div className={s.activityContent}>
        <div className={s.activityLabel}>{entry.label}</div>
        <div className={s.activityDetail}>{entry.detail}</div>
      </div>
    </div>
  );
}

function PlanReviewWidget() {
  return (
    <div className={s.genWidget} data-testid="agent-os-gen-widget">
      <div className={s.genWidgetHeader}>{'\u2726'} PLAN REVIEW</div>
      <div className={s.genWidgetTitle}>
        Proposed: Add retry logic to file watcher
      </div>
      <div className={s.genWidgetBody}>
        Claude Sonnet proposes adding exponential backoff when FS events are
        dropped under high load.
      </div>
      <div className={s.genWidgetDiff}>
        <div className={s.diffRemove}>- onFileChange(event)</div>
        <div className={s.diffAdd}>
          {'+ onFileChange(event, { retries: 3, backoff: 150 })'}
        </div>
      </div>
      <div className={s.genWidgetActions}>
        <button className={s.btnApprove}>Approve</button>
        <button className={s.btnReject}>Reject</button>
      </div>
    </div>
  );
}

export default function AgentConsole() {
  // Split activities around position 5 (after the first 4 items)
  const before = activities.slice(0, 4);
  const after = activities.slice(4);

  return (
    <section className={s.console} data-testid="agent-os-console">
      {/* ---- Header ---- */}
      <div className={s.consoleHeader}>
        <span className={s.consoleLive} />
        ACTIVITY STREAM
      </div>

      {/* ---- Activity Stream ---- */}
      <div className={s.activityStream}>
        {before.map((entry) => (
          <ActivityItem key={entry.id} entry={entry} />
        ))}

        <PlanReviewWidget />

        {after.map((entry) => (
          <ActivityItem key={entry.id} entry={entry} />
        ))}
      </div>

      {/* ---- Magic Input Bar ---- */}
      <div className={s.magicInputArea}>
        <div className={s.magicInput} data-testid="agent-os-magic-input">
          <span className={s.magicInputIcon}>{'\u2728'}</span>
          <input
            className={s.magicInputField}
            type="text"
            placeholder="Ask agents to refactor or plan..."
          />
          <span className={s.magicInputHint}>{'\u2318K'}</span>
        </div>
      </div>
    </section>
  );
}
