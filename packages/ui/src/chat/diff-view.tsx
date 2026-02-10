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
      className={cn(
        'rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950',
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
        <span className="text-xs font-mono text-zinc-600 dark:text-zinc-300">
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
                className="rounded bg-red-600 px-2 py-0.5 text-xs text-white hover:bg-red-500"
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
            element.result === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : '',
          )}>
            {element.result}
          </span>
        )}
      </div>
      <div className="overflow-x-auto">
        {element.hunks.map((hunk, i) => (
          <div key={i} className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-800">
            <div className="bg-zinc-50 px-3 py-1 text-xs text-zinc-500 font-mono dark:bg-zinc-900 dark:text-zinc-400">
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
                      !isAdd && !isDel ? 'text-zinc-600 dark:text-zinc-400' : '',
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
