import { useState } from 'react';
import { cn } from '@agent-manager/ui';

export interface NewSessionFormProps {
  adapters: Array<{ id: string; name: string; available: boolean }>;
  onSubmit: (params: { adapterId: string; prompt: string; cwd: string }) => void;
  loading?: boolean;
  className?: string;
}

export function NewSessionForm({ adapters, onSubmit, loading, className }: NewSessionFormProps) {
  const [adapterId, setAdapterId] = useState(adapters[0]?.id ?? '');
  const [prompt, setPrompt] = useState('');
  const [cwd, setCwd] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || !cwd.trim()) return;
    onSubmit({ adapterId, prompt: prompt.trim(), cwd: cwd.trim() });
    setPrompt('');
  };

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-3', className)}>
      <div>
        <label className="block text-xs font-medium text-muted-foreground" htmlFor="adapter">
          Agent
        </label>
        <select
          id="adapter"
          value={adapterId}
          onChange={(e) => setAdapterId(e.target.value)}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground"
        >
          {adapters.map((a) => (
            <option key={a.id} value={a.id} disabled={!a.available}>
              {a.name} {!a.available ? '(unavailable)' : ''}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground" htmlFor="cwd">
          Working Directory
        </label>
        <input
          id="cwd"
          type="text"
          value={cwd}
          onChange={(e) => setCwd(e.target.value)}
          placeholder="/path/to/project"
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground" htmlFor="prompt">
          Prompt
        </label>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the task..."
          rows={3}
          className="mt-1 w-full resize-none rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground"
        />
      </div>
      <button
        type="submit"
        disabled={!prompt.trim() || !cwd.trim() || loading}
        className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {loading ? 'Starting...' : 'Start Session'}
      </button>
    </form>
  );
}
