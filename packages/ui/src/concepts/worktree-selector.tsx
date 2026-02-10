import type { WorktreeContract, WorktreeStatus } from '@agent-manager/shared';
import { cn } from '../primitives/cn.js';

export interface WorktreeSelectorProps {
  worktrees: WorktreeContract[];
  selectedId?: string;
  onSelect?: (worktreeId: string) => void;
  className?: string;
}

const statusConfig: Record<WorktreeStatus, { label: string; color: string }> = {
  clean: { label: 'Clean', color: 'text-green-500' },
  dirty: { label: 'Modified', color: 'text-amber-500' },
  conflict: { label: 'Conflict', color: 'text-red-500' },
  detached: { label: 'Detached', color: 'text-zinc-500' },
};

export function WorktreeSelector({ worktrees, selectedId, onSelect, className }: WorktreeSelectorProps) {
  return (
    <div className={cn('space-y-1', className)}>
      {worktrees.map((wt) => {
        const status = statusConfig[wt.status];
        const isSelected = wt.id === selectedId;
        return (
          <button
            key={wt.id}
            onClick={onSelect ? () => onSelect(wt.id) : undefined}
            className={cn(
              'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors',
              isSelected
                ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                : 'text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-900',
            )}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium">{wt.branch}</span>
                {wt.isMain && (
                  <span className="shrink-0 rounded bg-zinc-200 px-1 py-0.5 text-xs dark:bg-zinc-700">main</span>
                )}
              </div>
              <div className="truncate text-xs text-zinc-400 dark:text-zinc-500">{wt.path}</div>
            </div>
            <div className="flex shrink-0 items-center gap-2 text-xs">
              {wt.changedFiles > 0 && (
                <span className="text-amber-500">{wt.changedFiles} changed</span>
              )}
              <span className={status.color}>{status.label}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
