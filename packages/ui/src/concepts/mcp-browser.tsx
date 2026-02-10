import type { McpContract, McpConnectionStatus } from '@agent-manager/shared';
import { cn } from '../primitives/cn.js';

export interface McpBrowserProps {
  servers: McpContract[];
  onSelectServer?: (serverId: string) => void;
  selectedServerId?: string;
  className?: string;
}

const statusConfig: Record<McpConnectionStatus, { label: string; color: string }> = {
  connected: { label: 'Connected', color: 'bg-green-500' },
  disconnected: { label: 'Disconnected', color: 'bg-zinc-400' },
  connecting: { label: 'Connecting', color: 'bg-amber-500' },
  error: { label: 'Error', color: 'bg-red-500' },
};

export function McpBrowser({ servers, onSelectServer, selectedServerId, className }: McpBrowserProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {servers.length === 0 && (
        <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
          No MCP servers connected
        </p>
      )}
      {servers.map((server) => {
        const status = statusConfig[server.status];
        const isSelected = server.id === selectedServerId;
        return (
          <div
            key={server.id}
            onClick={onSelectServer ? () => onSelectServer(server.id) : undefined}
            className={cn(
              'rounded-lg border p-3 transition-colors',
              isSelected
                ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/20'
                : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950',
              onSelectServer ? 'cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-700' : '',
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={cn('h-2 w-2 rounded-full', status.color)} title={status.label} />
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{server.name}</span>
              </div>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {server.tools.length} tools
              </span>
            </div>
            {server.errorMessage && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{server.errorMessage}</p>
            )}
            {isSelected && server.tools.length > 0 && (
              <div className="mt-2 space-y-1 border-t border-zinc-100 pt-2 dark:border-zinc-800">
                {server.tools.map((tool) => (
                  <div key={tool.name} className="text-xs text-zinc-600 dark:text-zinc-300">
                    <span className="font-mono">{tool.name}</span>
                    {tool.description && (
                      <span className="ml-1 text-zinc-400"> — {tool.description}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
