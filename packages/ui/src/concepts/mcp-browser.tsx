import type { McpContract, McpConnectionStatus } from '@agent-manager/shared';
import { cn } from '../primitives/cn.js';

export interface McpBrowserProps {
  servers: McpContract[];
  onSelectServer?: (serverId: string) => void;
  selectedServerId?: string;
  className?: string;
}

const statusConfig: Record<McpConnectionStatus, { label: string; dotClass: string }> = {
  connected: { label: 'Connected', dotClass: 'bg-green-500' },
  disconnected: { label: 'Disconnected', dotClass: 'bg-muted-foreground' },
  connecting: { label: 'Connecting', dotClass: 'bg-amber-500 animate-pulse' },
  error: { label: 'Error', dotClass: 'bg-destructive' },
};

export function McpBrowser({ servers, onSelectServer, selectedServerId, className }: McpBrowserProps) {
  return (
    <div data-slot="mcp-browser" className={cn('space-y-2', className)}>
      {servers.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
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
              'rounded-xl border p-3 shadow-sm transition-colors',
              isSelected
                ? 'border-ring bg-accent text-accent-foreground'
                : 'border-border bg-card text-card-foreground',
              onSelectServer ? 'cursor-pointer hover:border-ring/50' : '',
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={cn('h-2 w-2 rounded-full', status.dotClass)} title={status.label} />
                <span className="text-sm font-semibold">{server.name}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {server.tools.length} tools
              </span>
            </div>
            {server.errorMessage && (
              <p className="mt-1 text-xs text-destructive">{server.errorMessage}</p>
            )}
            {isSelected && server.tools.length > 0 && (
              <div className="mt-2 space-y-1 border-t border-border pt-2">
                {server.tools.map((tool) => (
                  <div key={tool.name} className="text-xs">
                    <span className="font-mono text-foreground">{tool.name}</span>
                    {tool.description && (
                      <span className="ml-1 text-muted-foreground"> — {tool.description}</span>
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
