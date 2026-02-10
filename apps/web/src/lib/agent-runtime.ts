import { useMemo } from 'react';
import { useExternalStoreRuntime } from '@assistant-ui/react';
import type { ThreadMessageLike } from '@assistant-ui/react';
import type { SessionInfo } from '@agent-manager/shared';

// ---------------------------------------------------------------------------
// Convert AgentEvent[] → ThreadMessageLike[]
// ---------------------------------------------------------------------------

type ContentPart = NonNullable<
  Exclude<ThreadMessageLike['content'], string>
>[number];

/**
 * Groups a flat AgentEvent stream into assistant-ui ThreadMessageLike messages.
 *
 * Mapping:
 * - session_start → system message
 * - text_delta (contiguous) → accumulated into assistant text content
 * - thinking → assistant reasoning part
 * - tool_call + tool_result → assistant tool-call part
 * - error → assistant text with error status
 * - cost_update → skipped (rendered in header)
 * - session_end → skipped (rendered in header)
 * - subagent_start/end → skipped
 * - The initial prompt → user message (prepended)
 */
export function convertEventsToMessages(
  session: SessionInfo,
): ThreadMessageLike[] {
  const messages: ThreadMessageLike[] = [];

  // User prompt as the first message
  if (session.prompt) {
    messages.push({
      role: 'user',
      content: session.prompt,
      id: `user-${session.sessionId}`,
      createdAt: new Date(session.startedAt),
    });
  }

  // Build the assistant message content parts from the event stream
  const parts: ContentPart[] = [];
  let textBuffer = '';

  const flushText = () => {
    if (textBuffer) {
      parts.push({ type: 'text' as const, text: textBuffer });
      textBuffer = '';
    }
  };

  // Track tool results so we can match them to tool calls
  const toolResults = new Map<
    string,
    { output: string; isError: boolean }
  >();

  // Pre-scan for tool results
  for (const event of session.events) {
    if (event.type === 'tool_result') {
      toolResults.set(event.toolUseId, {
        output: event.output,
        isError: event.isError,
      });
    }
  }

  for (const event of session.events) {
    switch (event.type) {
      case 'session_start':
        // System message for session metadata
        messages.push({
          role: 'system',
          content: `Session started \u00b7 ${event.model} \u00b7 ${event.cwd}`,
          id: event.id,
          createdAt: new Date(event.timestamp),
        });
        break;

      case 'text_delta':
        textBuffer += event.text;
        break;

      case 'thinking':
        flushText();
        parts.push({ type: 'reasoning' as const, text: event.text });
        break;

      case 'tool_call': {
        flushText();
        const result = toolResults.get(event.toolUseId);
        const toolCallPart: ContentPart = {
          type: 'tool-call' as const,
          toolCallId: event.toolUseId,
          toolName: event.toolName,
          args: event.input as Record<string, string | number | boolean | null>,
          ...(result ? { result: result.output, isError: result.isError } : {}),
        };
        parts.push(toolCallPart);
        break;
      }

      case 'tool_result':
        // Already handled via pre-scan
        break;

      case 'error':
        flushText();
        parts.push({ type: 'text' as const, text: `Error: ${event.message}` });
        break;

      case 'cost_update':
      case 'session_end':
      case 'subagent_start':
      case 'subagent_end':
        // Rendered elsewhere (header / sidebar)
        break;
    }
  }

  flushText();

  // Build the assistant message if we have content
  if (parts.length > 0) {
    const isRunning = session.status === 'running';
    messages.push({
      role: 'assistant',
      content: parts,
      id: `assistant-${session.sessionId}`,
      createdAt: new Date(session.startedAt),
      status: isRunning
        ? { type: 'running' }
        : { type: 'complete', reason: 'stop' },
    });
  }

  return messages;
}

// ---------------------------------------------------------------------------
// useAgentRuntime — hook returning an AssistantRuntime for a session
// ---------------------------------------------------------------------------

export function useAgentRuntime(
  session: SessionInfo | null,
  onSendMessage?: (message: string) => void,
) {
  const messages = useMemo(
    () => (session ? convertEventsToMessages(session) : []),
    [session],
  );

  const isRunning = session?.status === 'running';

  const runtime = useExternalStoreRuntime({
    messages,
    isRunning,
    convertMessage: (msg: ThreadMessageLike) => msg,
    onNew: async (message) => {
      // Extract user text from the append message
      const textParts =
        typeof message.content === 'string'
          ? message.content
          : (message.content as Array<{ type: string; text?: string }>)
              .filter((p) => p.type === 'text')
              .map((p) => p.text ?? '')
              .join('');

      onSendMessage?.(textParts);
    },
    onCancel: async () => {
      // Could send interrupt via WebSocket
    },
  });

  return runtime;
}
