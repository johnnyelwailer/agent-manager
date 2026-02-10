import type { TaskContract, TaskContractStatus } from '@agent-manager/shared';
import { cn } from '../primitives/cn.js';

export interface TaskCardProps {
  task: TaskContract;
  onSelect?: (taskId: string) => void;
  compact?: boolean;
  className?: string;
}

const statusConfig: Record<TaskContractStatus, { label: string; badgeClass: string; icon: string }> = {
  pending: { label: 'Pending', badgeClass: 'bg-secondary text-secondary-foreground', icon: '\u25CB' },
  in_progress: { label: 'In Progress', badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', icon: '\u25D0' },
  completed: { label: 'Completed', badgeClass: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', icon: '\u25CF' },
  failed: { label: 'Failed', badgeClass: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', icon: '\u2715' },
  blocked: { label: 'Blocked', badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300', icon: '\u2298' },
  cancelled: { label: 'Cancelled', badgeClass: 'bg-muted text-muted-foreground', icon: '\u2014' },
};

const priorityColors: Record<string, string> = {
  critical: 'border-l-red-500',
  high: 'border-l-orange-500',
  medium: 'border-l-blue-500',
  low: 'border-l-border',
};

export function TaskCard({ task, onSelect, compact, className }: TaskCardProps) {
  const status = statusConfig[task.status];
  const completedSubtasks = task.subtasks.filter((s) => s.status === 'completed').length;

  return (
    <div
      data-slot="task-card"
      onClick={onSelect ? () => onSelect(task.id) : undefined}
      className={cn(
        'rounded-xl border border-border bg-card text-card-foreground shadow-sm transition-colors',
        task.priority ? `border-l-2 ${priorityColors[task.priority] ?? ''}` : '',
        onSelect ? 'cursor-pointer hover:border-ring/50' : '',
        compact ? 'p-3' : 'p-4',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm" title={status.label}>{status.icon}</span>
            <h3 className={cn(
              'truncate font-semibold',
              compact ? 'text-xs' : 'text-sm',
            )}>
              {task.title}
            </h3>
          </div>
          {!compact && task.description && (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {task.description}
            </p>
          )}
        </div>
        <span className={cn('shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold', status.badgeClass)}>
          {status.label}
        </span>
      </div>

      {task.progress !== undefined && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>{task.progress}%</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${task.progress}%` }}
            />
          </div>
        </div>
      )}

      {!compact && task.subtasks.length > 0 && (
        <div className="mt-3 text-xs text-muted-foreground">
          {completedSubtasks}/{task.subtasks.length} subtasks completed
        </div>
      )}

      {!compact && task.labels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {task.labels.map((label) => (
            <span
              key={label}
              className="rounded-md bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground"
            >
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
