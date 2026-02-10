import type { ResearchDocContract, ResearchDocRole } from '@agent-manager/shared';
import { cn } from '../primitives/cn.js';

export interface ResearchDocViewerProps {
  doc: ResearchDocContract;
  onEdit?: (docId: string, content: string) => void;
  className?: string;
}

const roleConfig: Record<ResearchDocRole, { label: string; badgeClass: string }> = {
  plan: { label: 'Plan', badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  constitution: { label: 'Constitution', badgeClass: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' },
  analysis: { label: 'Analysis', badgeClass: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300' },
  rules: { label: 'Rules', badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  notes: { label: 'Notes', badgeClass: 'bg-secondary text-secondary-foreground' },
  report: { label: 'Report', badgeClass: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  specification: { label: 'Spec', badgeClass: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300' },
  custom: { label: 'Custom', badgeClass: 'bg-secondary text-secondary-foreground' },
};

export function ResearchDocViewer({ doc, className }: ResearchDocViewerProps) {
  const role = roleConfig[doc.role];

  return (
    <div
      data-slot="research-doc-viewer"
      className={cn(
        'rounded-xl border border-border bg-card text-card-foreground shadow-sm',
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={cn('rounded-md px-2 py-0.5 text-xs font-semibold', role.badgeClass)}>
            {role.label}
          </span>
          <h3 className="text-sm font-semibold">{doc.title}</h3>
        </div>
        <span className="text-xs text-muted-foreground">
          {doc.format}
        </span>
      </div>
      <div className="p-4">
        <pre className="whitespace-pre-wrap text-sm text-foreground">
          {doc.content}
        </pre>
      </div>
      {doc.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 border-t border-border px-4 py-2">
          {doc.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
