import type { CostTickerElement } from '@agent-manager/shared';
import { cn } from '../primitives/cn.js';

export interface CostTickerProps {
  element: CostTickerElement;
  className?: string;
}

function formatCost(usd: number): string {
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

function formatTokens(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
  return String(count);
}

export function CostTicker({ element, className }: CostTickerProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-3 rounded-md bg-zinc-100 px-2.5 py-1 text-xs dark:bg-zinc-800',
        className,
      )}
    >
      <span className="font-medium text-zinc-700 dark:text-zinc-200">
        {formatCost(element.costUsd)}
      </span>
      <span className="text-zinc-400 dark:text-zinc-500">|</span>
      <span className="text-zinc-500 dark:text-zinc-400" title="Tokens in">
        {formatTokens(element.tokensIn)} in
      </span>
      <span className="text-zinc-500 dark:text-zinc-400" title="Tokens out">
        {formatTokens(element.tokensOut)} out
      </span>
      {element.model && (
        <>
          <span className="text-zinc-400 dark:text-zinc-500">|</span>
          <span className="text-zinc-500 dark:text-zinc-400">{element.model}</span>
        </>
      )}
    </div>
  );
}
