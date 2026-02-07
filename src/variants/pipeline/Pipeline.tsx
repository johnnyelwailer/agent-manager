import { agents, executions, verifications } from '../../data/mock';
import s from './Pipeline.module.css';

export default function Pipeline() {
  // --- Categorize executions into pipeline stages ---
  const backlog = executions.filter(
    (e) => e.status === 'queued' && !e.assignedAgent,
  );
  const dispatched = executions.filter(
    (e) => e.status === 'queued' && !!e.assignedAgent,
  );
  const working = executions.filter((e) => e.status === 'running');
  const done = executions.filter(
    (e) => e.status === 'completed' || e.status === 'failed',
  );

  // --- Review Gate items ---
  // exec-6: paused, with ver-6 pending human_approval
  const exec6 = executions.find((e) => e.id === 'exec-6')!;
  const ver6 = verifications.find((v) => v.id === 'ver-6')!;

  // exec-2's ver-3: needs_review (test results)
  const exec2 = executions.find((e) => e.id === 'exec-2')!;
  const ver3 = verifications.find((v) => v.id === 'ver-3')!;

  const reviewItems = [
    { exec: exec6, ver: ver6 },
    { exec: exec2, ver: ver3 },
  ];

  // --- Helpers ---
  const getAgent = (agentId?: string) =>
    agents.find((a) => a.id === agentId);

  const agentStatusClass = (status: string) => {
    if (status === 'running') return s.agentRunning;
    if (status === 'errored') return s.agentError;
    return s.agentIdle;
  };

  const totalCost = executions
    .reduce((sum, e) => sum + (e.costUsd ?? 0), 0)
    .toFixed(2);

  const workingCost = working
    .reduce((sum, e) => sum + (e.costUsd ?? 0), 0)
    .toFixed(2);

  // --- Stage definitions ---
  const stages = [
    { key: 'backlog', label: 'Backlog', icon: '\u{1F4E5}', testId: 'pipeline-backlog' },
    { key: 'dispatched', label: 'Dispatched', icon: '\u{1F4E8}', testId: 'pipeline-dispatched' },
    { key: 'working', label: 'Working', icon: '\u2699\uFE0F', testId: 'pipeline-working' },
    { key: 'review', label: 'Review Gate', icon: '\u{1F441}', testId: 'pipeline-review' },
    { key: 'done', label: 'Done', icon: '\u2713', testId: 'pipeline-done' },
  ];

  // --- Render helpers ---

  function renderBacklogCards() {
    return backlog.map((exec) => (
      <div className={s.taskCard} key={exec.id}>
        <div className={s.taskCardId}>{exec.id}</div>
        <div className={s.taskCardTitle}>{exec.title}</div>
        <button className={s.dispatchBtn}>Dispatch</button>
      </div>
    ));
  }

  function renderDispatchedCards() {
    if (dispatched.length === 0) {
      return (
        <div className={s.emptyStage}>No tasks waiting to start</div>
      );
    }
    return dispatched.map((exec) => {
      const agent = getAgent(exec.assignedAgent);
      return (
        <div className={s.taskCard} key={exec.id}>
          <div className={s.taskCardId}>{exec.id}</div>
          <div className={s.taskCardTitle}>{exec.title}</div>
          {agent && (
            <span
              className={`${s.taskCardAgent} ${agentStatusClass(agent.status)}`}
            >
              {agent.name}
            </span>
          )}
        </div>
      );
    });
  }

  function renderWorkingCards() {
    return working.map((exec) => {
      const agent = getAgent(exec.assignedAgent);
      const lastLog =
        exec.log.length > 0 ? exec.log[exec.log.length - 1] : null;
      return (
        <div
          className={`${s.taskCard} ${s.taskCardWorking}`}
          key={exec.id}
        >
          <div className={s.taskCardId}>{exec.id}</div>
          <div className={s.taskCardTitle}>{exec.title}</div>
          {agent && (
            <span
              className={`${s.taskCardAgent} ${agentStatusClass(agent.status)}`}
            >
              <span
                style={{ animation: 'pulse-glow 2s ease-in-out infinite' }}
              >
                &#9679;
              </span>
              {agent.name}
            </span>
          )}
          {lastLog && (
            <div className={s.miniLog}>{lastLog.content}</div>
          )}
        </div>
      );
    });
  }

  function renderReviewCards() {
    return (
      <>
        <div className={s.gateLabel} style={{ margin: '4px 8px 2px' }}>
          <span style={{ animation: 'pulse-glow 2s ease-in-out infinite' }}>
            &#9888;
          </span>
          REVIEW GATE &mdash; Human checkpoint
        </div>

        {/* exec-6: paused, awaiting human approval */}
        <div
          className={s.reviewCard}
          data-testid="pipeline-review-card"
          key={exec6.id}
        >
          <div className={s.reviewTitle}>{exec6.title}</div>
          <div className={s.reviewMeta}>
            <strong>Agent:</strong>{' '}
            {getAgent(exec6.assignedAgent)?.name ?? 'Unassigned'}
            <br />
            {ver6.details}
          </div>
          <div className={s.reviewActions}>
            <button className={s.approveBtn}>Approve</button>
            <button className={s.rejectBtn}>Reject</button>
            <button className={s.changesBtn}>Request Changes</button>
          </div>
        </div>

        {/* exec-2 ver-3: test results need review */}
        <div
          className={s.reviewCard}
          data-testid="pipeline-review-card"
          key={`${exec2.id}-${ver3.id}`}
        >
          <div className={s.reviewTitle}>
            File watcher debounce &mdash; Test Results
          </div>
          <div className={s.reviewMeta}>
            3/4 tests passed. 1 failing: should coalesce rapid events
          </div>
          <div className={s.reviewDiff}>
            <div className={s.diffRemove}>- onFileChange(event)</div>
            <div className={s.diffAdd}>
              + onFileChange(event, {'{'} debounce: 150 {'}'})
            </div>
          </div>
          <div className={s.reviewActions}>
            <button
              className={`${s.approveBtn} ${s.approveBtnDisabled}`}
              disabled
            >
              Approve
            </button>
            <button className={s.changesBtn}>Request Changes</button>
          </div>
        </div>
      </>
    );
  }

  function renderDoneCards() {
    return (
      <>
        {/* exec-1: completed */}
        {executions
          .filter((e) => e.status === 'completed')
          .map((exec) => (
            <div className={s.doneCard} key={exec.id}>
              <div className={s.taskCardTitle}>
                <span className={s.doneCardCheck}>&#10003;</span>
                {exec.title}
              </div>
              <div style={{ fontSize: 11, color: '#71717a' }}>
                ${exec.costUsd?.toFixed(2)} &middot; 3h ago
              </div>
            </div>
          ))}

        {/* exec-5: failed */}
        {executions
          .filter((e) => e.status === 'failed')
          .map((exec) => {
            const lastError = exec.log
              .slice()
              .reverse()
              .find((l) => l.type === 'error');
            return (
              <div
                className={`${s.doneCard} ${s.failedCard}`}
                key={exec.id}
              >
                <div className={s.taskCardTitle}>{exec.title}</div>
                {lastError && (
                  <div className={s.failedLabel}>{lastError.content}</div>
                )}
                <button className={s.retryBtn}>Retry</button>
              </div>
            );
          })}
      </>
    );
  }

  function renderStageBody(key: string) {
    switch (key) {
      case 'backlog':
        return renderBacklogCards();
      case 'dispatched':
        return renderDispatchedCards();
      case 'working':
        return renderWorkingCards();
      case 'review':
        return renderReviewCards();
      case 'done':
        return renderDoneCards();
      default:
        return null;
    }
  }

  function stageCount(key: string): number {
    switch (key) {
      case 'backlog':
        return backlog.length;
      case 'dispatched':
        return dispatched.length;
      case 'working':
        return working.length;
      case 'review':
        return reviewItems.length;
      case 'done':
        return done.length;
      default:
        return 0;
    }
  }

  // --- Render ---

  return (
    <div className={s.shell} data-testid="pipeline-shell">
      {/* Header */}
      <div className={s.header}>
        <div className={s.headerTitle}>Pipeline</div>
        <div className={s.headerRight}>
          <span style={{ fontSize: 12, color: '#a1a1aa' }}>
            {reviewItems.length} in review &nbsp;|&nbsp; {working.length}{' '}
            working &nbsp;|&nbsp; ${workingCost}
          </span>
          <button className={s.addBtn}>+ New Task</button>
        </div>
      </div>

      {/* Board */}
      <div className={s.board}>
        {stages.map((stage, idx) => (
          <div key={stage.key} style={{ display: 'flex' }}>
            <div
              className={`${s.stage} ${stage.key === 'review' ? s.stageReview : ''}`}
              data-testid={stage.testId}
            >
              <div className={s.stageHeader}>
                <span className={s.stageIcon}>{stage.icon}</span>
                <span
                  className={`${s.stageLabel} ${stage.key === 'review' ? s.stageLabelReview : ''}`}
                >
                  {stage.label}
                </span>
                <span className={s.stageCount}>{stageCount(stage.key)}</span>
              </div>
              <div className={s.stageBody}>
                {renderStageBody(stage.key)}
              </div>
            </div>

            {/* Connector arrow between stages (not after last) */}
            {idx < stages.length - 1 && (
              <div className={s.stageConnector}>
                <span className={s.connectorArrow}>&rarr;</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className={s.footer}>
        <span>
          Backlog: {backlog.length} &nbsp;|&nbsp; Working: {working.length}{' '}
          &nbsp;|&nbsp; Review: {reviewItems.length} &nbsp;|&nbsp; Done:{' '}
          {done.length} &nbsp;|&nbsp; Total: ${totalCost}
        </span>
        <span style={{ color: '#3f3f46' }}>pipeline v1</span>
      </div>
    </div>
  );
}
