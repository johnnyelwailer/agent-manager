import { MessagePrimitive } from '@assistant-ui/react';
import type {
  TextMessagePartComponent,
  ReasoningMessagePartComponent,
  ToolCallMessagePartComponent,
} from '@assistant-ui/react';
import { cn } from '@/lib/utils';
import { ToolCallViewer } from '@agent-manager/ui';

/**
 * Custom assistant message renderer for agent events.
 * Renders text, reasoning (thinking), and tool calls with our existing
 * chat element components.
 */
export function AgentMessage() {
  return (
    <div className="px-4 py-2">
      <div className="max-w-full">
        <MessagePrimitive.Content
          components={{
            Text: AgentText,
            Reasoning: AgentReasoning,
            tools: {
              Fallback: AgentToolCall,
            },
          }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Text part
// ---------------------------------------------------------------------------

const AgentText: TextMessagePartComponent = ({ text, status }) => {
  return (
    <div
      className={cn(
        'whitespace-pre-wrap text-sm text-foreground',
        status.type === 'running' && 'after:inline-block after:w-1 after:animate-pulse after:content-["▋"]',
      )}
    >
      {text}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Reasoning / thinking part
// ---------------------------------------------------------------------------

const AgentReasoning: ReasoningMessagePartComponent = ({ text, status }) => {
  return (
    <div
      className={cn(
        'my-1 rounded-lg bg-muted px-3 py-2 text-xs italic text-muted-foreground',
        status.type === 'running' && 'animate-pulse',
      )}
    >
      {text}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Tool call part (uses our existing ToolCallViewer)
// ---------------------------------------------------------------------------

const AgentToolCall: ToolCallMessagePartComponent = ({
  toolName,
  argsText,
  args,
  result,
  isError,
  toolCallId,
}) => {
  return (
    <div className="my-1">
      <ToolCallViewer
        element={{
          type: 'tool_call',
          id: toolCallId ?? 'unknown',
          toolName,
          input: (args ?? JSON.parse(argsText ?? '{}')) as Record<string, unknown>,
          output: typeof result === 'string' ? result : result != null ? JSON.stringify(result) : undefined,
          isError: isError ?? false,
          collapsed: true,
        }}
      />
    </div>
  );
};
