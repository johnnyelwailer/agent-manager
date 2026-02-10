import type { ProgressElement } from '@agent-manager/shared';
import { cn } from '../primitives/cn.js';

export interface ProgressIndicatorProps {
  element: ProgressElement;
  className?: string;
}

const statusColors = {
  running: 'bg-blue-500',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
  cancelled: 'bg-zinc-400',
};

export function ProgressIndicator({ element, className }: ProgressIndicatorProps) {
  return (
    <div className={cn('rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950', className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-zinc-900 dark:text-zinc-100">{element.label}</span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{element.progress}%</span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            statusColors[element.status],
            element.status === 'running' ? 'animate-pulse' : '',
          )}
          style={{ width: `${element.progress}%` }}
        />
      </div>
      {element.details && (
        <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">{element.details}</p>
      )}
    </div>
  );
}
