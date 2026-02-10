import type { AgentEvent, WsCommand } from '@agent-manager/shared';

export type WsEventHandler = (event: AgentEvent) => void;

export class WsManager {
  private ws: WebSocket | null = null;
  private handlers = new Set<WsEventHandler>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30_000;

  constructor(private url: string) {}

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.reconnectDelay = 1000;
      // Subscribe to all events by default
      this.send({ type: 'subscribe', scope: 'all' });
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string);
        // Agent events have a 'type' field matching our event types
        if (data.type && data.sessionId) {
          for (const handler of this.handlers) {
            handler(data as AgentEvent);
          }
        }
      } catch {
        // Ignore non-JSON messages
      }
    };

    this.ws.onclose = () => {
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }

  subscribe(handler: WsEventHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  send(command: WsCommand): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(command));
    }
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
      this.connect();
    }, this.reconnectDelay);
  }
}
