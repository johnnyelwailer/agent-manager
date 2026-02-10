import type { ResearchDocContract, ResearchDocRole } from '@agent-manager/shared';
import { cn } from '../primitives/cn.js';

export interface ResearchDocViewerProps {
  doc: ResearchDocContract;
  onEdit?: (docId: string, content: string) => void;
  className?: string;
}

const roleConfig: Record<ResearchDocRole, { label: string; color: string }> = {
  plan: { label: 'Plan', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  constitution: { label: 'Constitution', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  analysis: { label: 'Analysis', color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300' },
  rules: { label: 'Rules', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  notes: { label: 'Notes', color: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400' },
  report: { label: 'Report', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  specification: { label: 'Spec', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' },
  custom: { label: 'Custom', color: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400' },
};

export function ResearchDocViewer({ doc, className }: ResearchDocViewerProps) {
  const role = roleConfig[doc.role];

  return (
    <div
      className={cn(
        'rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950',
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <span className={cn('rounded-md px-2 py-0.5 text-xs font-medium', role.color)}>
            {role.label}
          </span>
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{doc.title}</h3>
        </div>
        <span className="text-xs text-zinc-400 dark:text-zinc-500">
          {doc.format}
        </span>
      </div>
      <div className="p-4">
        <pre className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
          {doc.content}
        </pre>
      </div>
      {doc.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 border-t border-zinc-200 px-4 py-2 dark:border-zinc-800">
          {doc.tags.map((tag) => (
            <span
              key={tag}
              className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
