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
      data-slot="cost-ticker"
      className={cn(
        'inline-flex items-center gap-3 rounded-md bg-muted px-2.5 py-1 text-xs',
        className,
      )}
    >
      <span className="font-medium text-foreground">
        {formatCost(element.costUsd)}
      </span>
      <span className="text-muted-foreground">|</span>
      <span className="text-muted-foreground" title="Tokens in">
        {formatTokens(element.tokensIn)} in
      </span>
      <span className="text-muted-foreground" title="Tokens out">
        {formatTokens(element.tokensOut)} out
      </span>
      {element.model && (
        <>
          <span className="text-muted-foreground">|</span>
          <span className="text-muted-foreground">{element.model}</span>
        </>
      )}
    </div>
  );
}
