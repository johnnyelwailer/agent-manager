import { wsCommandSchema, type WsCommand } from '@agent-manager/shared';
import type { EventBus } from '../core/event-bus.js';
import type { ServerWebSocket } from 'bun';

export interface WsClientState {
  subscribedAll: boolean;
  unsubAll: (() => void) | undefined;
  sessions: Map<string, () => void>;
}

export class WsHandler {
  private bus: EventBus;
  private clients = new Set<ServerWebSocket<WsClientState>>();

  constructor(bus: EventBus) {
    this.bus = bus;
  }

  get clientCount(): number {
    return this.clients.size;
  }

  onOpen(ws: ServerWebSocket<WsClientState>): void {
    const state: WsClientState = {
      subscribedAll: false,
      unsubAll: undefined,
      sessions: new Map(),
    };
    ws.data = state;
    this.clients.add(ws);
  }

  onMessage(ws: ServerWebSocket<WsClientState>, message: string | Buffer): void {
    const state = ws.data;
    if (!state) return;

    let raw: unknown;
    try {
      raw = JSON.parse(String(message));
    } catch {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
      return;
    }

    const parsed = wsCommandSchema.safeParse(raw);
    if (!parsed.success) {
      const obj = raw as Record<string, unknown> | null;
      const type = obj && typeof obj === 'object' ? obj.type : undefined;
      if (type !== 'subscribe' && type !== 'unsubscribe') {
        ws.send(JSON.stringify({ type: 'error', message: `Unknown command type: "${type}"` }));
      } else {
        const scope = obj && typeof obj === 'object' ? obj.scope : undefined;
        if (scope !== 'all' && scope !== 'session') {
          ws.send(JSON.stringify({ type: 'error', message: `Invalid scope: "${scope}". Use "all" or "session"` }));
        } else {
          ws.send(JSON.stringify({ type: 'error', message: 'sessionId is required when scope is "session"' }));
        }
      }
      return;
    }

    this.handleCommand(ws, state, parsed.data);
  }

  onClose(ws: ServerWebSocket<WsClientState>): void {
    const state = ws.data;
    if (state) {
      this.cleanupClient(state);
    }
    this.clients.delete(ws);
  }

  close(): void {
    for (const ws of this.clients) {
      this.cleanupClient(ws.data);
      ws.close();
    }
    this.clients.clear();
  }

  private handleCommand(
    ws: ServerWebSocket<WsClientState>,
    state: WsClientState,
    cmd: WsCommand,
  ): void {
    switch (cmd.type) {
      case 'subscribe':
        if (cmd.scope === 'all') {
          if (state.subscribedAll) return;
          state.subscribedAll = true;
          state.unsubAll = this.bus.onAll((event) => {
            ws.send(JSON.stringify(event));
          });
          ws.send(JSON.stringify({ type: 'subscribed', scope: 'all' }));
        } else {
          if (state.sessions.has(cmd.sessionId)) return;
          const unsub = this.bus.on(cmd.sessionId, (event) => {
            ws.send(JSON.stringify(event));
          });
          state.sessions.set(cmd.sessionId, unsub);
          ws.send(JSON.stringify({ type: 'subscribed', scope: 'session', sessionId: cmd.sessionId }));
        }
        break;

      case 'unsubscribe':
        if (cmd.scope === 'all') {
          state.unsubAll?.();
          state.unsubAll = undefined;
          state.subscribedAll = false;
          ws.send(JSON.stringify({ type: 'unsubscribed', scope: 'all' }));
        } else {
          const unsub = state.sessions.get(cmd.sessionId);
          unsub?.();
          state.sessions.delete(cmd.sessionId);
          ws.send(JSON.stringify({ type: 'unsubscribed', scope: 'session', sessionId: cmd.sessionId }));
        }
        break;
    }
  }

  private cleanupClient(state: WsClientState): void {
    state.unsubAll?.();
    for (const unsub of state.sessions.values()) {
      unsub();
    }
    state.sessions.clear();
  }
}
