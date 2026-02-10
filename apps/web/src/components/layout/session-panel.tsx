import { cn } from '@agent-manager/ui';
import { ToolCallViewer, CostTicker, ProgressIndicator } from '@agent-manager/ui';
import type { SessionInfo, AgentEvent } from '@agent-manager/shared';

export interface SessionPanelProps {
  session: SessionInfo | null;
  className?: string;
}

function EventItem({ event }: { event: AgentEvent }) {
  switch (event.type) {
    case 'text_delta':
      return <span className="text-sm text-text-primary">{event.text}</span>;

    case 'thinking':
      return (
        <div className="rounded bg-zinc-100 px-3 py-2 text-xs italic text-text-secondary dark:bg-zinc-900">
          {event.text}
        </div>
      );

    case 'tool_call':
      return (
        <ToolCallViewer
          element={{
            type: 'tool_call',
            id: event.toolUseId,
            toolName: event.toolName,
            input: event.input,
            collapsed: true,
            isError: false,
          }}
        />
      );

    case 'tool_result':
      return (
        <div className={cn(
          'rounded border px-3 py-2 text-xs font-mono',
          event.isError
            ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/10 dark:text-red-300'
            : 'border-zinc-200 bg-zinc-50 text-text-secondary dark:border-zinc-800 dark:bg-zinc-900',
        )}>
          <div className="mb-1 text-xs font-sans text-text-muted">{event.toolName} result</div>
          <div className="max-h-32 overflow-auto whitespace-pre-wrap">{event.output}</div>
        </div>
      );

    case 'error':
      return (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-900/10 dark:text-red-300">
          Error: {event.message}
        </div>
      );

    case 'cost_update':
      return (
        <CostTicker
          element={{
            type: 'cost_ticker',
            id: event.id,
            costUsd: event.costUsd,
            tokensIn: event.tokensIn,
            tokensOut: event.tokensOut,
          }}
        />
      );

    case 'session_start':
      return (
        <div className="text-xs text-text-muted">
          Session started &middot; {event.model} &middot; {event.cwd}
        </div>
      );

    case 'session_end':
      return (
        <div className={cn(
          'rounded px-3 py-2 text-xs',
          event.result === 'success'
            ? 'bg-green-50 text-green-700 dark:bg-green-900/10 dark:text-green-300'
            : 'bg-red-50 text-red-700 dark:bg-red-900/10 dark:text-red-300',
        )}>
          Session ended: {event.result} &middot; ${event.costUsd.toFixed(4)} &middot; {(event.durationMs / 1000).toFixed(1)}s
        </div>
      );

    default:
      return null;
  }
}

export function SessionPanel({ session, className }: SessionPanelProps) {
  if (!session) {
    return (
      <div className={cn('flex h-full items-center justify-center', className)}>
        <div className="text-center">
          <p className="text-sm text-text-secondary">Select a session to view</p>
          <p className="mt-1 text-xs text-text-muted">or start a new one</p>
        </div>
      </div>
    );
  }

  // Accumulate text deltas into contiguous blocks
  const rendered: React.ReactNode[] = [];
  let textBuffer = '';

  for (const event of session.events) {
    if (event.type === 'text_delta') {
      textBuffer += event.text;
      continue;
    }
    if (textBuffer) {
      rendered.push(
        <div key={`text-${rendered.length}`} className="whitespace-pre-wrap text-sm text-text-primary">
          {textBuffer}
        </div>,
      );
      textBuffer = '';
    }
    rendered.push(<EventItem key={event.id} event={event} />);
  }
  if (textBuffer) {
    rendered.push(
      <div key={`text-${rendered.length}`} className="whitespace-pre-wrap text-sm text-text-primary">
        {textBuffer}
      </div>,
    );
  }

  return (
    <div className={cn('flex h-full flex-col', className)}>
      {/* Session header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-text-primary">{session.prompt}</div>
          <div className="mt-0.5 text-xs text-text-muted">
            {session.adapterId} &middot; {session.status}
            {session.model && ` \u00b7 ${session.model}`}
          </div>
        </div>
        <CostTicker
          element={{
            type: 'cost_ticker',
            id: 'header-cost',
            costUsd: session.costUsd,
            tokensIn: session.tokensIn,
            tokensOut: session.tokensOut,
          }}
        />
      </div>

      {/* Event stream */}
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {rendered}
      </div>
    </div>
  );
}
