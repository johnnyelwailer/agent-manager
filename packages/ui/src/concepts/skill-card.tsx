import type { SkillContract, SpecializedSkillContract, ClaudeSkillContract } from '@agent-manager/shared';
import { cn } from '../primitives/cn.js';

export interface SkillCardProps {
  skill: SkillContract | SpecializedSkillContract;
  onActivate?: (skillId: string) => void;
  className?: string;
}

function isClaudeSkill(skill: SkillContract | SpecializedSkillContract): skill is ClaudeSkillContract {
  return 'specialization' in skill && skill.specialization === 'claude';
}

export function SkillCard({ skill, onActivate, className }: SkillCardProps) {
  return (
    <div
      data-slot="skill-card"
      className={cn(
        'group rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm transition-colors hover:border-ring/50',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold">
              {skill.name}
            </h3>
            {skill.autoDiscoverable && (
              <span className="shrink-0 rounded-md border border-transparent bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                auto
              </span>
            )}
            {!skill.enabled && (
              <span className="shrink-0 rounded-md border border-transparent bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                disabled
              </span>
            )}
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {skill.description}
          </p>
          {isClaudeSkill(skill) && skill.slashCommand && (
            <code className="mt-2 inline-block rounded-md bg-muted px-1.5 py-0.5 text-xs font-mono text-secondary-foreground">
              /{skill.slashCommand}
            </code>
          )}
        </div>
        {onActivate && skill.enabled && (
          <button
            onClick={() => onActivate(skill.id)}
            className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100 hover:bg-primary/90"
          >
            Run
          </button>
        )}
      </div>
      {skill.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {skill.tags.map((tag) => (
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
