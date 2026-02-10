import type { HookContract } from '@agent-manager/shared';
import { cn } from '../primitives/cn.js';

export interface HookConfigPanelProps {
  hooks: HookContract[];
  onToggle?: (hookId: string, enabled: boolean) => void;
  className?: string;
}

export function HookConfigPanel({ hooks, onToggle, className }: HookConfigPanelProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {hooks.length === 0 && (
        <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
          No hooks configured
        </p>
      )}
      {hooks.map((hook) => (
        <div
          key={hook.id}
          className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={cn(
                'inline-flex rounded-md px-2 py-0.5 text-xs font-medium',
                'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
              )}>
                {hook.event}
              </span>
              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {hook.name}
              </span>
            </div>
            {onToggle && (
              <button
                onClick={() => onToggle(hook.id, !hook.enabled)}
                className={cn(
                  'relative h-5 w-9 rounded-full transition-colors',
                  hook.enabled ? 'bg-blue-500' : 'bg-zinc-300 dark:bg-zinc-600',
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform shadow-sm',
                    hook.enabled ? 'left-[18px]' : 'left-0.5',
                  )}
                />
              </button>
            )}
          </div>
          {hook.description && (
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{hook.description}</p>
          )}
          <div className="mt-2 flex items-center gap-3 text-xs text-zinc-400 dark:text-zinc-500">
            <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono dark:bg-zinc-800">{hook.handler}</code>
            {hook.lastRunAt && (
              <span>Last run: {new Date(hook.lastRunAt).toLocaleString()}</span>
            )}
            {hook.lastRunResult && (
              <span className={cn(
                hook.lastRunResult === 'success' ? 'text-green-500' : '',
                hook.lastRunResult === 'failure' ? 'text-red-500' : '',
                hook.lastRunResult === 'timeout' ? 'text-amber-500' : '',
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
