import { strategies, agents } from '../../data/mock';
import type { StrategyPrimitive } from '../../types/primitives';
import s from './AgentOS.module.css';

function getAgentName(agentId: string): string | undefined {
  const agent = agents.find((a) => a.id === agentId);
  return agent?.name;
}

function PlanItem({ item, depth = 0 }: { item: StrategyPrimitive; depth?: number }) {
  const isCompleted = item.status === 'completed';
  const isActive = item.status === 'active';
  const assigneeId = item.metadata?.assignee as string | undefined;
  const agentName = assigneeId ? getAgentName(assigneeId) : undefined;

  return (
    <>
      <div
        className={s.planItem}
        style={depth > 0 ? { paddingLeft: `${16 + depth * 24}px` } : undefined}
      >
        <div
          className={[
            s.planCheckbox,
            isCompleted ? s.planCheckboxChecked : '',
            isActive ? s.planCheckboxActive : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {isCompleted && '\u2713'}
        </div>
        <div
          className={[s.planItemText, isCompleted ? s.planItemCompleted : '']
            .filter(Boolean)
            .join(' ')}
        >
          {item.title}
          {agentName && <div className={s.planItemAgent}>{agentName}</div>}
        </div>
      </div>
      {item.children.map((child) => (
        <PlanItem key={child.id} item={child} depth={depth + 1} />
      ))}
    </>
  );
}

export default function PlanView() {
  return (
    <div className={s.planView} data-testid="agent-os-planview">
      <h1 className={s.planHeading}>Project Roadmap</h1>
      <div className={s.planSubheading}>
        Strategy / Phase 1 / Authentication
      </div>

      {strategies.map((phase) => (
        <div key={phase.id} className={s.planPhase}>
          <div className={s.planPhaseHeader}>
            {phase.title}
            <span
              className={[
                s.planPhaseStatus,
                phase.status === 'active' ? s.planPhaseActive : s.planPhaseDraft,
              ].join(' ')}
            >
              {phase.status}
            </span>
          </div>
          {phase.children.map((child) => (
            <PlanItem key={child.id} item={child} />
          ))}
        </div>
      ))}
    </div>
  );
}
