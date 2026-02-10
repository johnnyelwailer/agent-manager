import { useState } from 'react';
import type { ToolCallElement } from '@agent-manager/shared';
import { cn } from '../primitives/cn.js';

export interface ToolCallViewerProps {
  element: ToolCallElement;
  className?: string;
}

export function ToolCallViewer({ element, className }: ToolCallViewerProps) {
  const [expanded, setExpanded] = useState(!element.collapsed);

  return (
    <div
      className={cn(
        'rounded-lg border bg-white dark:bg-zinc-950',
        element.isError
          ? 'border-red-200 dark:border-red-800'
          : 'border-zinc-200 dark:border-zinc-800',
        className,
      )}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
      >
        <span className={cn(
          'text-xs transition-transform',
          expanded ? 'rotate-90' : '',
        )}>
          ▶
        </span>
        <code className="font-mono text-xs text-zinc-600 dark:text-zinc-300">
          {element.toolName}
        </code>
        {element.isError && (
          <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-600 dark:bg-red-900/30 dark:text-red-400">
            error
          </span>
        )}
        {element.durationMs !== undefined && (
          <span className="ml-auto text-xs text-zinc-400 dark:text-zinc-500">
            {element.durationMs}ms
          </span>
        )}
      </button>
      {expanded && (
        <div className="border-t border-zinc-100 dark:border-zinc-800">
          <div className="px-3 py-2">
            <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Input</div>
            <pre className="mt-1 overflow-x-auto rounded bg-zinc-50 p-2 text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
              {JSON.stringify(element.input, null, 2)}
            </pre>
          </div>
          {element.output !== undefined && (
            <div className="border-t border-zinc-100 px-3 py-2 dark:border-zinc-800">
              <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Output</div>
              <pre className={cn(
                'mt-1 max-h-64 overflow-auto rounded p-2 text-xs',
                element.isError
                  ? 'bg-red-50 text-red-700 dark:bg-red-900/10 dark:text-red-300'
                  : 'bg-zinc-50 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300',
              )}>
                {element.output}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
