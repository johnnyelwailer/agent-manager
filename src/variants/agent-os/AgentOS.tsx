import { useState } from 'react';
import s from './AgentOS.module.css';
import Sidebar from './Sidebar';
import TaskBoard from './TaskBoard';
import PlanView from './PlanView';
import AgentConsole from './AgentConsole';

type ViewTab = 'taskboard' | 'plan';

export default function AgentOS() {
  const [activeTab, setActiveTab] = useState<ViewTab>('taskboard');

  return (
    <div className={s.shell} data-testid="agent-os-shell">
      {/* Left: Semantic Navigator */}
      <Sidebar />

      {/* Center: The "Lens" */}
      <div className={s.mainContent} data-testid="agent-os-main">
        {/* Header with breadcrumbs + actions */}
        <div className={s.mainHeader}>
          <div className={s.breadcrumbs}>
            <span>Strategy</span>
            <span className={s.breadcrumbSep}>/</span>
            <span>Phase 1</span>
            <span className={s.breadcrumbSep}>/</span>
            <span className={s.breadcrumbCurrent}>Core Infrastructure</span>
          </div>
          <div className={s.headerActions}>
            <button className={s.btnPrimary}>
              <span>{'\u26A1'}</span> Dispatch Agents
            </button>
            <button className={s.btnDanger}>
              <span>{'\u25A0'}</span> Stop All
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className={s.mainTabs}>
          <button
            className={`${s.mainTab} ${activeTab === 'taskboard' ? s.mainTabActive : ''}`}
            onClick={() => setActiveTab('taskboard')}
          >
            Task Board
          </button>
          <button
            className={`${s.mainTab} ${activeTab === 'plan' ? s.mainTabActive : ''}`}
            onClick={() => setActiveTab('plan')}
          >
            Plan View
          </button>
        </div>

        {/* Active View */}
        {activeTab === 'taskboard' ? <TaskBoard /> : <PlanView />}
      </div>

      {/* Right: Agent Console */}
      <AgentConsole />
    </div>
  );
}
