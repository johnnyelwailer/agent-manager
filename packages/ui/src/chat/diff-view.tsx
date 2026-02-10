import type { DiffViewElement } from '@agent-manager/shared';
import { cn } from '../primitives/cn.js';

export interface DiffViewProps {
  element: DiffViewElement;
  onAccept?: (elementId: string) => void;
  onReject?: (elementId: string) => void;
  className?: string;
}

export function DiffView({ element, onAccept, onReject, className }: DiffViewProps) {
  return (
    <div
      data-slot="diff-view"
      className={cn(
        'rounded-xl border border-border bg-card',
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-mono text-muted-foreground">
          {element.filePath}
        </span>
        {element.result === 'pending' && (onAccept || onReject) && (
          <div className="flex items-center gap-1">
            {onAccept && (
              <button
                onClick={() => onAccept(element.id)}
                className="rounded bg-green-600 px-2 py-0.5 text-xs text-white hover:bg-green-500"
              >
                Accept
              </button>
            )}
            {onReject && (
              <button
                onClick={() => onReject(element.id)}
                className="rounded bg-destructive px-2 py-0.5 text-xs text-destructive-foreground hover:bg-destructive/90"
              >
                Reject
              </button>
            )}
          </div>
        )}
        {element.result !== 'pending' && (
          <span className={cn(
            'rounded-full px-2 py-0.5 text-xs font-medium',
            element.result === 'accepted' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : '',
            element.result === 'rejected' ? 'bg-destructive/10 text-destructive' : '',
          )}>
            {element.result}
          </span>
        )}
      </div>
      <div className="overflow-x-auto">
        {element.hunks.map((hunk, i) => (
          <div key={i} className="border-b border-border last:border-b-0">
            <div className="bg-muted px-3 py-1 text-xs text-muted-foreground font-mono">
              @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
            </div>
            <pre className="px-3 py-1 text-xs font-mono">
              {hunk.content.split('\n').map((line, j) => {
                const isAdd = line.startsWith('+');
                const isDel = line.startsWith('-');
                return (
                  <div
                    key={j}
                    className={cn(
                      'px-1',
                      isAdd ? 'bg-green-50 text-green-700 dark:bg-green-900/10 dark:text-green-300' : '',
                      isDel ? 'bg-red-50 text-red-700 dark:bg-red-900/10 dark:text-red-300' : '',
                      !isAdd && !isDel ? 'text-muted-foreground' : '',
                    )}
                  >
                    {line}
                  </div>
                );
              })}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}
