import type { WorktreeContract, WorktreeStatus } from '@agent-manager/shared';
import { cn } from '../primitives/cn.js';

export interface WorktreeSelectorProps {
  worktrees: WorktreeContract[];
  selectedId?: string;
  onSelect?: (worktreeId: string) => void;
  className?: string;
}

const statusConfig: Record<WorktreeStatus, { label: string; className: string }> = {
  clean: { label: 'Clean', className: 'text-green-600 dark:text-green-400' },
  dirty: { label: 'Modified', className: 'text-amber-600 dark:text-amber-400' },
  conflict: { label: 'Conflict', className: 'text-destructive' },
  detached: { label: 'Detached', className: 'text-muted-foreground' },
};

export function WorktreeSelector({ worktrees, selectedId, onSelect, className }: WorktreeSelectorProps) {
  return (
    <div data-slot="worktree-selector" className={cn('space-y-1', className)}>
      {worktrees.map((wt) => {
        const status = statusConfig[wt.status];
        const isSelected = wt.id === selectedId;
        return (
          <button
            key={wt.id}
            onClick={onSelect ? () => onSelect(wt.id) : undefined}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors',
              isSelected
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground',
            )}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium text-foreground">{wt.branch}</span>
                {wt.isMain && (
                  <span className="shrink-0 rounded-md bg-secondary px-1 py-0.5 text-xs font-semibold text-secondary-foreground">main</span>
                )}
              </div>
              <div className="truncate text-xs text-muted-foreground">{wt.path}</div>
            </div>
            <div className="flex shrink-0 items-center gap-2 text-xs">
              {wt.changedFiles > 0 && (
                <span className="text-amber-600 dark:text-amber-400">{wt.changedFiles} changed</span>
              )}
              <span className={status.className}>{status.label}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
