import type { ProgressElement } from '@agent-manager/shared';
import { cn } from '../primitives/cn.js';

export interface ProgressIndicatorProps {
  element: ProgressElement;
  className?: string;
}

const statusColors = {
  running: 'bg-blue-500',
  completed: 'bg-green-500',
  failed: 'bg-destructive',
  cancelled: 'bg-muted-foreground',
};

export function ProgressIndicator({ element, className }: ProgressIndicatorProps) {
  return (
    <div
      data-slot="progress-indicator"
      className={cn('rounded-xl border border-border bg-card p-3', className)}
    >
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-card-foreground">{element.label}</span>
        <span className="text-xs text-muted-foreground">{element.progress}%</span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
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
        <p className="mt-1.5 text-xs text-muted-foreground">{element.details}</p>
      )}
    </div>
  );
}
