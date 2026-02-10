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
      className={cn(
        'group rounded-lg border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {skill.name}
            </h3>
            {skill.autoDiscoverable && (
              <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                auto
              </span>
            )}
            {!skill.enabled && (
              <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                disabled
              </span>
            )}
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">
            {skill.description}
          </p>
          {isClaudeSkill(skill) && skill.slashCommand && (
            <code className="mt-2 inline-block rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-mono text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              /{skill.slashCommand}
            </code>
          )}
        </div>
        {onActivate && skill.enabled && (
          <button
            onClick={() => onActivate(skill.id)}
            className="shrink-0 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 dark:bg-zinc-100 dark:text-zinc-900"
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
