// Engine client — REST API + WebSocket connection to the agent-manager server.
//
// Usage:
//   const client = new EngineClient('http://localhost:3000');
//   await client.connect();                    // opens WebSocket
//   client.onEvent((event) => { ... });        // subscribe to all events
//   const session = await client.startSession({ ... });
//   client.disconnect();

import type {
  AgentEvent,
  SessionInfo,
  AdapterManifest,
  StartSessionRequest,
  ConnectionStatus,
  WsCommand,
} from './engine-types.ts';

// ---------------------------------------------------------------------------
// Event handler types
// ---------------------------------------------------------------------------

type EventHandler = (data: AgentEvent) => void;
type StatusHandler = (data: ConnectionStatus) => void;

// ---------------------------------------------------------------------------
// EngineClient
// ---------------------------------------------------------------------------

export class EngineClient {
  private baseUrl: string;
  private wsUrl: string;
  private ws: WebSocket | null = null;
  private _status: ConnectionStatus = 'disconnected';
  private eventHandlers = new Set<EventHandler>();
  private statusHandlers = new Set<StatusHandler>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private maxReconnectDelay = 10_000;
  private shouldReconnect = false;

  constructor(baseUrl: string = '') {
    // If no baseUrl provided, derive from window.location
    if (!baseUrl) {
      const loc = typeof window !== 'undefined' ? window.location : null;
      this.baseUrl = loc ? `${loc.protocol}//${loc.host}` : 'http://localhost:3000';
    } else {
      this.baseUrl = baseUrl.replace(/\/$/, '');
    }
    this.wsUrl = this.baseUrl.replace(/^http/, 'ws') + '/ws';
  }

  // -------------------------------------------------------------------------
  // Connection status
  // -------------------------------------------------------------------------

  get status(): ConnectionStatus {
    return this._status;
  }

  private setStatus(status: ConnectionStatus): void {
    this._status = status;
    this.emitStatus(status);
  }

  // -------------------------------------------------------------------------
  // Event subscription
  // -------------------------------------------------------------------------

  onEvent(handler: EventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => { this.eventHandlers.delete(handler); };
  }

  onStatus(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    return () => { this.statusHandlers.delete(handler); };
  }

  private emitEvent(data: AgentEvent): void {
    for (const h of this.eventHandlers) h(data);
  }

  private emitStatus(data: ConnectionStatus): void {
    for (const h of this.statusHandlers) h(data);
  }

  // -------------------------------------------------------------------------
  // WebSocket
  // -------------------------------------------------------------------------

  connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.shouldReconnect = true;
    this.setStatus('connecting');

    try {
      this.ws = new WebSocket(this.wsUrl);
    } catch {
      this.setStatus('error');
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.reconnectAttempt = 0;
      this.setStatus('connected');
      // Subscribe to all events
      this.sendWs({ type: 'subscribe', scope: 'all' });
    };

    this.ws.onmessage = (e) => {
      try {
        const data = JSON.parse(String(e.data)) as Record<string, unknown>;
        // Filter out subscription confirmations
        if (data.type === 'subscribed' || data.type === 'unsubscribed' || data.type === 'error') {
          return;
        }
        this.emitEvent(data as unknown as AgentEvent);
      } catch {
        // ignore malformed messages
      }
    };

    this.ws.onclose = () => {
      this.ws = null;
      if (this.shouldReconnect) {
        this.setStatus('disconnected');
        this.scheduleReconnect();
      } else {
        this.setStatus('disconnected');
      }
    };

    this.ws.onerror = () => {
      // onclose will fire after this
      this.setStatus('error');
    };
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setStatus('disconnected');
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect) return;
    if (this.reconnectTimer) return;

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempt), this.maxReconnectDelay);
    this.reconnectAttempt++;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private sendWs(cmd: WsCommand): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(cmd));
    }
  }

  // -------------------------------------------------------------------------
  // REST API
  // -------------------------------------------------------------------------

  async listAdapters(): Promise<AdapterManifest[]> {
    const res = await fetch(`${this.baseUrl}/api/adapters`);
    if (!res.ok) throw new Error(`listAdapters failed: ${res.status}`);
    const data = await res.json() as { adapters: AdapterManifest[] };
    return data.adapters;
  }

  async checkAdapterAvailability(adapterId: string): Promise<{ available: boolean; error: string | null }> {
    const res = await fetch(`${this.baseUrl}/api/adapters/${encodeURIComponent(adapterId)}/available`);
    if (!res.ok) throw new Error(`checkAdapter failed: ${res.status}`);
    return await res.json() as { available: boolean; error: string | null };
  }

  async listSessions(): Promise<SessionInfo[]> {
    const res = await fetch(`${this.baseUrl}/api/sessions`);
    if (!res.ok) throw new Error(`listSessions failed: ${res.status}`);
    const data = await res.json() as { sessions: SessionInfo[] };
    return data.sessions;
  }

  async getSession(sessionId: string): Promise<SessionInfo> {
    const res = await fetch(`${this.baseUrl}/api/sessions/${encodeURIComponent(sessionId)}`);
    if (!res.ok) throw new Error(`getSession failed: ${res.status}`);
    const data = await res.json() as { session: SessionInfo };
    return data.session;
  }

  async startSession(request: StartSessionRequest): Promise<SessionInfo> {
    const res = await fetch(`${this.baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error: string };
      throw new Error(err.error);
    }
    const data = await res.json() as { session: SessionInfo };
    return data.session;
  }

  async interruptSession(sessionId: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/sessions/${encodeURIComponent(sessionId)}/interrupt`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`interruptSession failed: ${res.status}`);
  }

  async terminateSession(sessionId: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/sessions/${encodeURIComponent(sessionId)}/terminate`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`terminateSession failed: ${res.status}`);
  }

  async killSession(sessionId: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/sessions/${encodeURIComponent(sessionId)}/kill`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`killSession failed: ${res.status}`);
  }
}
