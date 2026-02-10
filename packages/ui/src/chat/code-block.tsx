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
      className={cn(
        'rounded-lg border border-zinc-200 bg-zinc-950 dark:border-zinc-800',
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-1.5">
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <span>{element.language}</span>
          {element.filePath && (
            <>
              <span className="text-zinc-600">|</span>
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
              className="rounded px-2 py-0.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          )}
          {element.actions.includes('apply') && onApply && (
            <button
              onClick={() => onApply(element.id)}
              className="rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-500"
            >
              Apply
            </button>
          )}
        </div>
      </div>
      <pre className="overflow-x-auto p-3 text-sm text-zinc-100">
        <code>{element.code}</code>
      </pre>
    </div>
  );
}
