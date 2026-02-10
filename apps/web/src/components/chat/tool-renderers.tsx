import { makeAssistantToolUI } from '@assistant-ui/react';
import { ToolCallViewer, CodeBlock, DiffView } from '@agent-manager/ui';

/**
 * Tool-specific renderers using assistant-ui's makeAssistantToolUI.
 * These override the generic ToolCallFallback for specific tool names,
 * rendering rich UI for known tools.
 *
 * Register these by rendering them as components inside the
 * AssistantRuntimeProvider tree.
 */

// ---------------------------------------------------------------------------
// Read tool — show file path and content
// ---------------------------------------------------------------------------

export const ReadToolUI = makeAssistantToolUI<
  { file_path: string; offset?: number; limit?: number },
  string
>({
  toolName: 'Read',
  render: ({ args, result }) => {
    if (!result) {
      return (
        <div className="my-1 animate-pulse rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          Reading {args.file_path}...
        </div>
      );
    }
    return (
      <div className="my-1">
        <CodeBlock
          element={{
            type: 'code_block',
            id: `read-${args.file_path}`,
            language: args.file_path.split('.').pop() ?? 'text',
            code: typeof result === 'string' ? result : String(result),
            filePath: args.file_path,
            startLine: args.offset,
            actions: ['copy'],
          }}
        />
      </div>
    );
  },
});

// ---------------------------------------------------------------------------
// Edit tool — show diff-like view
// ---------------------------------------------------------------------------

export const EditToolUI = makeAssistantToolUI<
  { file_path: string; old_string: string; new_string: string },
  string
>({
  toolName: 'Edit',
  render: ({ args, result }) => {
    return (
      <div className="my-1">
        <DiffView
          element={{
            type: 'diff',
            id: `edit-${args.file_path}`,
            filePath: args.file_path,
            hunks: [
              {
                oldStart: 1,
                oldLines: args.old_string.split('\n').length,
                newStart: 1,
                newLines: args.new_string.split('\n').length,
                content:
                  args.old_string
                    .split('\n')
                    .map((l) => `-${l}`)
                    .join('\n') +
                  '\n' +
                  args.new_string
                    .split('\n')
                    .map((l) => `+${l}`)
                    .join('\n'),
              },
            ],
            mode: 'unified',
            result: result ? 'accepted' : 'pending',
          }}
        />
      </div>
    );
  },
});

// ---------------------------------------------------------------------------
// Write tool — show file being written
// ---------------------------------------------------------------------------

export const WriteToolUI = makeAssistantToolUI<
  { file_path: string; content: string },
  string
>({
  toolName: 'Write',
  render: ({ args, result }) => {
    if (!result) {
      return (
        <div className="my-1 animate-pulse rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          Writing {args.file_path}...
        </div>
      );
    }
    return (
      <div className="my-1">
        <CodeBlock
          element={{
            type: 'code_block',
            id: `write-${args.file_path}`,
            language: args.file_path.split('.').pop() ?? 'text',
            code: args.content.length > 500 ? args.content.slice(0, 500) + '\n...' : args.content,
            filePath: args.file_path,
            actions: ['copy'],
          }}
        />
      </div>
    );
  },
});

// ---------------------------------------------------------------------------
// Bash tool — show command execution
// ---------------------------------------------------------------------------

export const BashToolUI = makeAssistantToolUI<
  { command: string; description?: string },
  string
>({
  toolName: 'Bash',
  render: ({ args, result }) => {
    return (
      <div className="my-1">
        <ToolCallViewer
          element={{
            type: 'tool_call',
            id: `bash-${args.command.slice(0, 30)}`,
            toolName: 'Bash',
            input: { command: args.command, description: args.description },
            output: typeof result === 'string' ? result : result != null ? JSON.stringify(result) : undefined,
            isError: false,
            collapsed: !result,
          }}
        />
      </div>
    );
  },
});
