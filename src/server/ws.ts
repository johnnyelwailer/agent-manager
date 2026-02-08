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

type ClientCommand =
  | { type: 'subscribe'; scope: 'all' }
  | { type: 'subscribe'; scope: 'session'; sessionId: string }
  | { type: 'unsubscribe'; scope: 'all' }
  | { type: 'unsubscribe'; scope: 'session'; sessionId: string };

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
        const cmd = JSON.parse(String(data)) as ClientCommand;
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

  private handleCommand(ws: WebSocket, state: ClientState, cmd: ClientCommand): void {
    switch (cmd.type) {
      case 'subscribe':
        if (cmd.scope === 'all') {
          if (state.subscribedAll) return; // already subscribed
          state.subscribedAll = true;
          state.unsubAll = this.bus.onAll((event) => {
            this.send(ws, event);
          });
          this.send(ws, { type: 'subscribed', scope: 'all' });
        } else if (cmd.scope === 'session' && cmd.sessionId) {
          if (state.sessions.has(cmd.sessionId)) return; // already subscribed
          const unsub = this.bus.on(cmd.sessionId, (event) => {
            this.send(ws, event);
          });
          state.sessions.set(cmd.sessionId, unsub);
          this.send(ws, { type: 'subscribed', scope: 'session', sessionId: cmd.sessionId });
        }
        break;

      case 'unsubscribe':
        if (cmd.scope === 'all') {
          state.unsubAll?.();
          state.unsubAll = undefined;
          state.subscribedAll = false;
          this.send(ws, { type: 'unsubscribed', scope: 'all' });
        } else if (cmd.scope === 'session' && cmd.sessionId) {
          const unsub = state.sessions.get(cmd.sessionId);
          unsub?.();
          state.sessions.delete(cmd.sessionId);
          this.send(ws, { type: 'unsubscribed', scope: 'session', sessionId: cmd.sessionId });
        }
        break;
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
