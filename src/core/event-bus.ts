// Minimal typed event emitter. Routes AgentEvents from adapters to consumers.

import type { AgentEvent } from '../types/events.ts';

export type EventHandler = (event: AgentEvent) => void;
export type SessionEventHandler = (sessionId: string, event: AgentEvent) => void;

/**
 * Simple pub/sub event bus for agent events.
 *
 * - `on('*', handler)` receives ALL events from ALL sessions
 * - `on(sessionId, handler)` receives events for a specific session
 */
export class EventBus {
  private globalHandlers: EventHandler[] = [];
  private sessionHandlers = new Map<string, EventHandler[]>();

  /** Subscribe to all events */
  onAll(handler: EventHandler): () => void {
    this.globalHandlers.push(handler);
    return () => {
      this.globalHandlers = this.globalHandlers.filter((h) => h !== handler);
    };
  }

  /** Subscribe to events from a specific session */
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

  /** Emit an event to all matching subscribers */
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

  /** Remove all handlers for a session (cleanup after session ends) */
  removeSession(sessionId: string): void {
    this.sessionHandlers.delete(sessionId);
  }

  /** Remove everything */
  clear(): void {
    this.globalHandlers = [];
    this.sessionHandlers.clear();
  }
}
