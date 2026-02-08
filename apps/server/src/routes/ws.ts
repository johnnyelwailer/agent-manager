import type { AgentEvent } from '@agent-manager/shared';
import type { EventBus } from '../core/event-bus.js';
import type { ServerWebSocket } from 'bun';

export interface WsClientState {
  subscribedAll: boolean;
  unsubAll?: () => void;
  sessions: Map<string, () => void>;
}

export class WsHandler {
  private bus: EventBus;
  private clients = new Map<ServerWebSocket<WsClientState>, WsClientState>();

  constructor(bus: EventBus) {
    this.bus = bus;
  }

  get clientCount(): number {
    return this.clients.size;
  }

  onOpen(ws: ServerWebSocket<WsClientState>): void {
    const state: WsClientState = {
      subscribedAll: false,
      sessions: new Map(),
    };
    ws.data = state;
    this.clients.set(ws, state);
  }

  onMessage(ws: ServerWebSocket<WsClientState>, message: string | Buffer): void {
    const state = ws.data;
    if (!state) return;

    let cmd: Record<string, unknown>;
    try {
      cmd = JSON.parse(String(message)) as Record<string, unknown>;
    } catch {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
      return;
    }

    this.handleCommand(ws, state, cmd);
  }

  onClose(ws: ServerWebSocket<WsClientState>): void {
    const state = ws.data;
    if (state) {
      this.cleanupClient(state);
    }
    this.clients.delete(ws);
  }

  close(): void {
    for (const [ws, state] of this.clients) {
      this.cleanupClient(state);
      ws.close();
    }
    this.clients.clear();
  }

  private handleCommand(
    ws: ServerWebSocket<WsClientState>,
    state: WsClientState,
    cmd: Record<string, unknown>,
  ): void {
    const type = cmd.type as string | undefined;
    const scope = cmd.scope as string | undefined;
    const sessionId = cmd.sessionId as string | undefined;

    if (type !== 'subscribe' && type !== 'unsubscribe') {
      ws.send(JSON.stringify({ type: 'error', message: `Unknown command type: "${type}"` }));
      return;
    }

    if (scope !== 'all' && scope !== 'session') {
      ws.send(JSON.stringify({ type: 'error', message: `Invalid scope: "${scope}". Use "all" or "session"` }));
      return;
    }

    if (scope === 'session' && !sessionId) {
      ws.send(JSON.stringify({ type: 'error', message: 'sessionId is required when scope is "session"' }));
      return;
    }

    if (type === 'subscribe') {
      if (scope === 'all') {
        if (state.subscribedAll) return;
        state.subscribedAll = true;
        state.unsubAll = this.bus.onAll((event) => {
          ws.send(JSON.stringify(event));
        });
        ws.send(JSON.stringify({ type: 'subscribed', scope: 'all' }));
      } else {
        if (state.sessions.has(sessionId!)) return;
        const unsub = this.bus.on(sessionId!, (event) => {
          ws.send(JSON.stringify(event));
        });
        state.sessions.set(sessionId!, unsub);
        ws.send(JSON.stringify({ type: 'subscribed', scope: 'session', sessionId }));
      }
    } else {
      if (scope === 'all') {
        state.unsubAll?.();
        state.unsubAll = undefined;
        state.subscribedAll = false;
        ws.send(JSON.stringify({ type: 'unsubscribed', scope: 'all' }));
      } else {
        const unsub = state.sessions.get(sessionId!);
        unsub?.();
        state.sessions.delete(sessionId!);
        ws.send(JSON.stringify({ type: 'unsubscribed', scope: 'session', sessionId }));
      }
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
