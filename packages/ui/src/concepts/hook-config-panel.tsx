import type { HookContract } from '@agent-manager/shared';
import { cn } from '../primitives/cn.js';

export interface HookConfigPanelProps {
  hooks: HookContract[];
  onToggle?: (hookId: string, enabled: boolean) => void;
  className?: string;
}

export function HookConfigPanel({ hooks, onToggle, className }: HookConfigPanelProps) {
  return (
    <div data-slot="hook-config-panel" className={cn('space-y-2', className)}>
      {hooks.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No hooks configured
        </p>
      )}
      {hooks.map((hook) => (
        <div
          key={hook.id}
          className="rounded-xl border border-border bg-card p-3 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-flex rounded-md border border-transparent bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-800 dark:bg-violet-900/30 dark:text-violet-300">
                {hook.event}
              </span>
              <span className="text-sm font-semibold text-card-foreground">
                {hook.name}
              </span>
            </div>
            {onToggle && (
              <button
                onClick={() => onToggle(hook.id, !hook.enabled)}
                className={cn(
                  'relative h-5 w-9 rounded-full transition-colors',
                  hook.enabled ? 'bg-primary' : 'bg-input',
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 h-4 w-4 rounded-full bg-primary-foreground shadow-sm transition-transform',
                    hook.enabled ? 'left-[18px]' : 'left-0.5',
                  )}
                />
              </button>
            )}
          </div>
          {hook.description && (
            <p className="mt-1 text-xs text-muted-foreground">{hook.description}</p>
          )}
          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
            <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono">{hook.handler}</code>
            {hook.lastRunAt && (
              <span>Last run: {new Date(hook.lastRunAt).toLocaleString()}</span>
            )}
            {hook.lastRunResult && (
              <span className={cn(
                hook.lastRunResult === 'success' ? 'text-green-600 dark:text-green-400' : '',
                hook.lastRunResult === 'failure' ? 'text-destructive' : '',
                hook.lastRunResult === 'timeout' ? 'text-amber-600 dark:text-amber-400' : '',
              )}>
                {hook.lastRunResult}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
