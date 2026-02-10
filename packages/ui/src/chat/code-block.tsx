import { useState } from 'react';
import type { CodeBlockElement } from '@agent-manager/shared';
import { cn } from '../primitives/cn.js';

export interface CodeBlockProps {
  element: CodeBlockElement;
  onApply?: (elementId: string) => void;
  className?: string;
}

export function CodeBlock({ element, onApply, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(element.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      data-slot="code-block"
      className={cn(
        'rounded-xl border border-border bg-card',
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{element.language}</span>
          {element.filePath && (
            <>
              <span className="text-muted-foreground/50">|</span>
              <span className="font-mono">{element.filePath}</span>
              {element.startLine !== undefined && (
                <span>:{element.startLine}</span>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          {element.actions.includes('copy') && (
            <button
              onClick={handleCopy}
              className="rounded px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          )}
          {element.actions.includes('apply') && onApply && (
            <button
              onClick={() => onApply(element.id)}
              className="rounded bg-primary px-2 py-0.5 text-xs text-primary-foreground hover:bg-primary/90"
            >
              Apply
            </button>
          )}
        </div>
      </div>
      <pre className="overflow-x-auto p-3 text-sm text-card-foreground">
        <code>{element.code}</code>
      </pre>
    </div>
  );
}
