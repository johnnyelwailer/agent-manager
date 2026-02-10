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
      data-slot="tool-call-viewer"
      className={cn(
        'rounded-xl border bg-card',
        element.isError
          ? 'border-destructive'
          : 'border-border',
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
        <code className="font-mono text-xs text-muted-foreground">
          {element.toolName}
        </code>
        {element.isError && (
          <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-xs font-medium text-destructive">
            error
          </span>
        )}
        {element.durationMs !== undefined && (
          <span className="ml-auto text-xs text-muted-foreground">
            {element.durationMs}ms
          </span>
        )}
      </button>
      {expanded && (
        <div className="border-t border-border">
          <div className="px-3 py-2">
            <div className="text-xs font-medium text-muted-foreground">Input</div>
            <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 text-xs text-muted-foreground">
              {JSON.stringify(element.input, null, 2)}
            </pre>
          </div>
          {element.output !== undefined && (
            <div className="border-t border-border px-3 py-2">
              <div className="text-xs font-medium text-muted-foreground">Output</div>
              <pre className={cn(
                'mt-1 max-h-64 overflow-auto rounded p-2 text-xs',
                element.isError
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-muted text-muted-foreground',
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
