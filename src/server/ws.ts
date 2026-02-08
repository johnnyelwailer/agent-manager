// WebSocket transport. Streams AgentEvents to connected UI clients in real-time.
//
// Clients send JSON commands to subscribe/unsubscribe:
//   { "type": "subscribe", "scope": "all" }
//   { "type": "subscribe", "scope": "session", "sessionId": "..." }
//   { "type": "unsubscribe", "scope": "all" }
//   { "type": "unsubscribe", "scope": "session", "sessionId": "..." }
//
// Server pushes AgentEvents as JSON to clients based on their subscriptions.

import { WebSocketServer, type WebSocket } from 'ws';
import type { Server as HttpServer } from 'node:http';
import type { AgentEvent } from '../types/events.ts';
import type { EventBus } from '../core/event-bus.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClientState {
  /** Is the client subscribed to all events? */
  subscribedAll: boolean;
  /** Unsubscribe function for the global subscription (if active) */
  unsubAll?: () => void;
  /** Per-session subscriptions: sessionId → unsubscribe function */
  sessions: Map<string, () => void>;
}

// ---------------------------------------------------------------------------
// WebSocket transport
// ---------------------------------------------------------------------------

export interface WsTransportOptions {
  /** The HTTP server to attach to (for upgrade handling) */
  server: HttpServer;
  /** The event bus to subscribe to */
  bus: EventBus;
  /** Optional: WebSocket path prefix (default: "/ws") */
  path?: string;
}

export class WsTransport {
  private wss: WebSocketServer;
  private clients = new Map<WebSocket, ClientState>();
  private bus: EventBus;

  constructor(options: WsTransportOptions) {
    this.bus = options.bus;
    const path = options.path ?? '/ws';

    this.wss = new WebSocketServer({
      server: options.server,
      path,
    });

    this.wss.on('connection', (ws) => this.handleConnection(ws));
  }

  /** Number of connected clients */
  get clientCount(): number {
    return this.clients.size;
  }

  /** Shut down the WebSocket server */
  close(): void {
    for (const [ws, state] of this.clients) {
      this.cleanupClient(ws, state);
    }
    this.clients.clear();
    this.wss.close();
  }

  // -------------------------------------------------------------------------
  // Connection handling
  // -------------------------------------------------------------------------

  private handleConnection(ws: WebSocket): void {
    const state: ClientState = {
      subscribedAll: false,
      sessions: new Map(),
    };
    this.clients.set(ws, state);

    ws.on('message', (data) => {
      try {
        const cmd = JSON.parse(String(data)) as Record<string, unknown>;
        this.handleCommand(ws, state, cmd);
      } catch {
        this.send(ws, { type: 'error', message: 'Invalid JSON' });
      }
    });

    ws.on('close', () => {
      this.cleanupClient(ws, state);
      this.clients.delete(ws);
    });

    ws.on('error', () => {
      this.cleanupClient(ws, state);
      this.clients.delete(ws);
    });
  }

  private handleCommand(ws: WebSocket, state: ClientState, cmd: Record<string, unknown>): void {
    const type = cmd.type as string | undefined;
    const scope = cmd.scope as string | undefined;
    const sessionId = cmd.sessionId as string | undefined;

    if (type !== 'subscribe' && type !== 'unsubscribe') {
      this.send(ws, { type: 'error', message: `Unknown command type: "${type}"` });
      return;
    }

    if (scope !== 'all' && scope !== 'session') {
      this.send(ws, { type: 'error', message: `Invalid scope: "${scope}". Use "all" or "session"` });
      return;
    }

    if (scope === 'session' && !sessionId) {
      this.send(ws, { type: 'error', message: 'sessionId is required when scope is "session"' });
      return;
    }

    if (type === 'subscribe') {
      if (scope === 'all') {
        if (state.subscribedAll) return; // already subscribed
        state.subscribedAll = true;
        state.unsubAll = this.bus.onAll((event) => {
          this.send(ws, event);
        });
        this.send(ws, { type: 'subscribed', scope: 'all' });
      } else {
        if (state.sessions.has(sessionId!)) return; // already subscribed
        const unsub = this.bus.on(sessionId!, (event) => {
          this.send(ws, event);
        });
        state.sessions.set(sessionId!, unsub);
        this.send(ws, { type: 'subscribed', scope: 'session', sessionId });
      }
    } else {
      if (scope === 'all') {
        state.unsubAll?.();
        state.unsubAll = undefined;
        state.subscribedAll = false;
        this.send(ws, { type: 'unsubscribed', scope: 'all' });
      } else {
        const unsub = state.sessions.get(sessionId!);
        unsub?.();
        state.sessions.delete(sessionId!);
        this.send(ws, { type: 'unsubscribed', scope: 'session', sessionId });
      }
    }
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private send(ws: WebSocket, data: unknown): void {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  private cleanupClient(ws: WebSocket, state: ClientState): void {
    state.unsubAll?.();
    for (const unsub of state.sessions.values()) {
      unsub();
    }
    state.sessions.clear();
    try { ws.close(); } catch { /* already closed */ }
  }
}
