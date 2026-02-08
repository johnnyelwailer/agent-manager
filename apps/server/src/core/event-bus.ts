import type { AgentEvent } from '@agent-manager/shared';

export type EventHandler = (event: AgentEvent) => void;

export class EventBus {
  private globalHandlers: EventHandler[] = [];
  private sessionHandlers = new Map<string, EventHandler[]>();

  onAll(handler: EventHandler): () => void {
    this.globalHandlers.push(handler);
    return () => {
      this.globalHandlers = this.globalHandlers.filter((h) => h !== handler);
    };
  }

  on(sessionId: string, handler: EventHandler): () => void {
    const handlers = this.sessionHandlers.get(sessionId) ?? [];
    handlers.push(handler);
    this.sessionHandlers.set(sessionId, handlers);
    return () => {
      const current = this.sessionHandlers.get(sessionId) ?? [];
      this.sessionHandlers.set(
        sessionId,
        current.filter((h) => h !== handler),
      );
    };
  }

  emit(event: AgentEvent): void {
    for (const handler of this.globalHandlers) {
      try {
        handler(event);
      } catch {
        // Don't let one handler blow up the bus
      }
    }

    const sessionHandlers = this.sessionHandlers.get(event.sessionId) ?? [];
    for (const handler of sessionHandlers) {
      try {
        handler(event);
      } catch {
        // same
      }
    }
  }

  removeSession(sessionId: string): void {
    this.sessionHandlers.delete(sessionId);
  }

  clear(): void {
    this.globalHandlers = [];
    this.sessionHandlers.clear();
  }
}
