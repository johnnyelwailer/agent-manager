import type { TaskContract, TaskContractStatus } from '@agent-manager/shared';
import { cn } from '../primitives/cn.js';

export interface TaskCardProps {
  task: TaskContract;
  onSelect?: (taskId: string) => void;
  compact?: boolean;
  className?: string;
}

const statusConfig: Record<TaskContractStatus, { label: string; color: string; icon: string }> = {
  pending: { label: 'Pending', color: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400', icon: '○' },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', icon: '◐' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300', icon: '●' },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300', icon: '✕' },
  blocked: { label: 'Blocked', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', icon: '⊘' },
  cancelled: { label: 'Cancelled', color: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500', icon: '—' },
};

const priorityColors: Record<string, string> = {
  critical: 'border-l-red-500',
  high: 'border-l-orange-500',
  medium: 'border-l-blue-500',
  low: 'border-l-zinc-300 dark:border-l-zinc-600',
};

export function TaskCard({ task, onSelect, compact, className }: TaskCardProps) {
  const status = statusConfig[task.status];
  const completedSubtasks = task.subtasks.filter((s) => s.status === 'completed').length;

  return (
    <div
      onClick={onSelect ? () => onSelect(task.id) : undefined}
      className={cn(
        'rounded-lg border border-zinc-200 bg-white transition-colors dark:border-zinc-800 dark:bg-zinc-950',
        task.priority ? `border-l-2 ${priorityColors[task.priority] ?? ''}` : '',
        onSelect ? 'cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-700' : '',
        compact ? 'p-3' : 'p-4',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm" title={status.label}>{status.icon}</span>
            <h3 className={cn(
              'truncate font-medium text-zinc-900 dark:text-zinc-100',
              compact ? 'text-xs' : 'text-sm',
            )}>
              {task.title}
            </h3>
          </div>
          {!compact && task.description && (
            <p className="mt-1 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">
              {task.description}
            </p>
          )}
        </div>
        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-medium', status.color)}>
          {status.label}
        </span>
      </div>

      {/* Progress bar */}
      {task.progress !== undefined && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span>Progress</span>
            <span>{task.progress}%</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div
              className="h-full rounded-full bg-blue-500 transition-all"
              style={{ width: `${task.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Subtasks */}
      {!compact && task.subtasks.length > 0 && (
        <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          {completedSubtasks}/{task.subtasks.length} subtasks completed
        </div>
      )}

      {/* Labels */}
      {!compact && task.labels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {task.labels.map((label) => (
            <span
              key={label}
              className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
            >
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
