// Session manager — the top-level orchestrator. Creates sessions via adapters,
// tracks their lifecycle, routes events through the bus. This is what the UI
// (or any consumer) talks to.

import { randomUUID } from 'node:crypto';
import type { Adapter, SessionConfig, SessionHandle } from '../adapters/adapter.ts';
import type { AgentEvent } from '../types/events.ts';
import { EventBus } from './event-bus.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SessionInfo {
  sessionId: string;
  adapterId: string;
  prompt: string;
  cwd: string;
  model?: string;
  status: 'starting' | 'running' | 'completed' | 'failed' | 'interrupted';
  startedAt: string;
  endedAt?: string;
  costUsd: number;
  tokensIn: number;
  tokensOut: number;
  events: AgentEvent[];
}

// ---------------------------------------------------------------------------
// SessionManager
// ---------------------------------------------------------------------------

export class SessionManager {
  readonly bus: EventBus;
  private adapters = new Map<string, Adapter>();
  private sessions = new Map<string, SessionInfo>();
  private handles = new Map<string, SessionHandle>();

  constructor(bus?: EventBus) {
    this.bus = bus ?? new EventBus();
  }

  // -------------------------------------------------------------------------
  // Adapter registration
  // -------------------------------------------------------------------------

  /** Register an adapter (e.g. ClaudeCliAdapter, GsdAdapter, etc.) */
  registerAdapter(adapter: Adapter): void {
    this.adapters.set(adapter.manifest.id, adapter);
  }

  /** Get a registered adapter */
  getAdapter(id: string): Adapter | undefined {
    return this.adapters.get(id);
  }

  /** List registered adapter IDs */
  listAdapters(): string[] {
    return Array.from(this.adapters.keys());
  }

  // -------------------------------------------------------------------------
  // Session lifecycle
  // -------------------------------------------------------------------------

  /**
   * Start a new agent session.
   *
   * @param adapterId — which adapter to use (e.g. "claude-cli")
   * @param config — session configuration (prompt, cwd, model, etc.)
   *                 If sessionId is omitted, one is generated.
   */
  async startSession(
    adapterId: string,
    config: Omit<SessionConfig, 'sessionId'> & { sessionId?: string },
  ): Promise<SessionInfo> {
    const adapter = this.adapters.get(adapterId);
    if (!adapter) {
      throw new Error(`Adapter "${adapterId}" not registered. Available: ${this.listAdapters().join(', ')}`);
    }

    const sessionId = config.sessionId ?? randomUUID();
    const fullConfig: SessionConfig = { ...config, sessionId };

    // Create session info
    const info: SessionInfo = {
      sessionId,
      adapterId,
      prompt: config.prompt,
      cwd: config.cwd,
      model: config.model,
      status: 'starting',
      startedAt: new Date().toISOString(),
      costUsd: 0,
      tokensIn: 0,
      tokensOut: 0,
      events: [],
    };
    this.sessions.set(sessionId, info);

    // Start the adapter session — events are routed through the bus
    const handle = await adapter.startSession(fullConfig, (event) => {
      // Store event in session history
      info.events.push(event);

      // Update session info from key events
      if (event.type === 'session_start') {
        info.status = 'running';
        info.model = event.model;
      } else if (event.type === 'session_end') {
        info.endedAt = event.timestamp;
        info.costUsd = event.costUsd;
        info.tokensIn = event.tokensIn;
        info.tokensOut = event.tokensOut;
        info.status =
          event.result === 'success' ? 'completed' :
          event.result === 'interrupted' ? 'interrupted' :
          'failed';
      } else if (event.type === 'cost_update') {
        info.costUsd = event.costUsd;
        info.tokensIn = event.tokensIn;
        info.tokensOut = event.tokensOut;
      }

      // Emit on the bus (for UI subscribers)
      this.bus.emit(event);
    });

    this.handles.set(sessionId, handle);
    info.status = 'running';

    // Clean up when session finishes
    handle.done
      .catch(() => {}) // errors are already handled via events
      .finally(() => {
        this.handles.delete(sessionId);
        this.bus.removeSession(sessionId);
      });

    return info;
  }

  /** Interrupt a running session (SIGINT) */
  interruptSession(sessionId: string): boolean {
    const handle = this.handles.get(sessionId);
    if (handle) {
      handle.interrupt();
      return true;
    }
    return false;
  }

  /** Terminate a running session (SIGTERM) */
  terminateSession(sessionId: string): boolean {
    const handle = this.handles.get(sessionId);
    if (handle) {
      handle.terminate();
      return true;
    }
    return false;
  }

  /** Force kill a running session */
  killSession(sessionId: string): boolean {
    const handle = this.handles.get(sessionId);
    if (handle) {
      handle.kill();
      return true;
    }
    return false;
  }

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  /** Get session info */
  getSession(sessionId: string): SessionInfo | undefined {
    return this.sessions.get(sessionId);
  }

  /** List all sessions */
  listSessions(): SessionInfo[] {
    return Array.from(this.sessions.values());
  }

  /** List active (running/starting) sessions */
  activeSessions(): SessionInfo[] {
    return this.listSessions().filter(
      (s) => s.status === 'running' || s.status === 'starting',
    );
  }

  /** Total cost across all sessions */
  totalCost(): number {
    let total = 0;
    for (const session of this.sessions.values()) {
      total += session.costUsd;
    }
    return total;
  }

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------

  /** Terminate all active sessions */
  terminateAll(): void {
    for (const handle of this.handles.values()) {
      handle.terminate();
    }
  }

  /** Force kill all active sessions */
  killAll(): void {
    for (const handle of this.handles.values()) {
      handle.kill();
    }
    this.handles.clear();
  }
}
