import { AssistantRuntimeProvider } from '@assistant-ui/react';
import { CostTicker } from '@agent-manager/ui';
import type { SessionInfo } from '@agent-manager/shared';
import { cn } from '@/lib/utils';
import { useAgentRuntime } from '@/lib/agent-runtime';
import { AgentThread } from '@/components/chat/agent-thread';
import {
  ReadToolUI,
  EditToolUI,
  WriteToolUI,
  BashToolUI,
} from '@/components/chat/tool-renderers';

export interface SessionPanelProps {
  session: SessionInfo | null;
  className?: string;
  onSendMessage?: (message: string) => void;
}

export function SessionPanel({ session, className, onSendMessage }: SessionPanelProps) {
  const runtime = useAgentRuntime(session, onSendMessage);

  if (!session) {
    return (
      <div className={cn('flex h-full items-center justify-center', className)}>
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Select a session to view</p>
          <p className="mt-1 text-xs text-muted-foreground">or start a new one</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex h-full flex-col', className)}>
      {/* Session header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-foreground">{session.prompt}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
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

      {/* Chat thread powered by assistant-ui */}
      <AssistantRuntimeProvider runtime={runtime}>
        {/* Tool-specific renderers */}
        <ReadToolUI />
        <EditToolUI />
        <WriteToolUI />
        <BashToolUI />

        <AgentThread className="flex-1" />
      </AssistantRuntimeProvider>
    </div>
  );
}
