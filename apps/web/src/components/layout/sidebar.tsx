import { cn } from '@agent-manager/ui';
import type { SessionSummary } from '@agent-manager/shared';

export interface SidebarProps {
  sessions: SessionSummary[];
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  connected: boolean;
  className?: string;
}

const statusColors: Record<string, string> = {
  starting: 'bg-amber-500',
  running: 'bg-blue-500 animate-pulse',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
  interrupted: 'bg-zinc-400',
};

export function Sidebar({ sessions, activeSessionId, onSelectSession, connected, className }: SidebarProps) {
  return (
    <aside className={cn(
      'flex h-full w-64 flex-col border-r border-border bg-surface-elevated',
      'max-md:hidden',
      className,
    )}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h1 className="text-sm font-semibold text-text-primary">Agent Manager</h1>
        <div className={cn('h-2 w-2 rounded-full', connected ? 'bg-green-500' : 'bg-red-500')} title={connected ? 'Connected' : 'Disconnected'} />
      </div>

      {/* Sessions list */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-2">
          <h2 className="text-xs font-medium uppercase tracking-wide text-text-muted">Sessions</h2>
        </div>
        {sessions.length === 0 && (
          <p className="px-4 py-8 text-center text-xs text-text-secondary">
            No sessions yet
          </p>
        )}
        <div className="space-y-0.5 px-2">
          {sessions.map((session) => (
            <button
              key={session.sessionId}
              onClick={() => onSelectSession(session.sessionId)}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors',
                session.sessionId === activeSessionId
                  ? 'bg-zinc-200/70 text-text-primary dark:bg-zinc-800'
                  : 'text-text-secondary hover:bg-zinc-100 dark:hover:bg-zinc-900',
              )}
            >
              <div className={cn('h-1.5 w-1.5 shrink-0 rounded-full', statusColors[session.status] ?? 'bg-zinc-400')} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium">{session.prompt}</div>
                <div className="text-xs text-text-muted">${session.costUsd.toFixed(4)}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
