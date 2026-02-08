import { randomUUID } from 'node:crypto';
import type { AgentEvent, SessionConfig, SessionInfo } from '@agent-manager/shared';
import type { Adapter, SessionHandle } from '../adapters/adapter.js';
import { EventBus } from './event-bus.js';

export class SessionManager {
  readonly bus: EventBus;
  private adapters = new Map<string, Adapter>();
  private sessions = new Map<string, SessionInfo>();
  private handles = new Map<string, SessionHandle>();

  constructor(bus?: EventBus) {
    this.bus = bus ?? new EventBus();
  }

  registerAdapter(adapter: Adapter): void {
    this.adapters.set(adapter.manifest.id, adapter);
  }

  getAdapter(id: string): Adapter | undefined {
    return this.adapters.get(id);
  }

  listAdapters(): string[] {
    return Array.from(this.adapters.keys());
  }

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

    const info: SessionInfo = {
      sessionId,
      adapterId,
      prompt: config.prompt,
      cwd: config.cwd,
      model: config.model,
      status: 'starting',
      startedAt: new Date().toISOString(),
      endedAt: undefined,
      costUsd: 0,
      tokensIn: 0,
      tokensOut: 0,
      events: [],
    };
    this.sessions.set(sessionId, info);

    const handle = await adapter.startSession(fullConfig, (event) => {
      info.events.push(event);

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

      this.bus.emit(event);
    });

    this.handles.set(sessionId, handle);

    handle.done
      .catch(() => {})
      .finally(() => {
        this.handles.delete(sessionId);
        this.bus.removeSession(sessionId);
      });

    return info;
  }

  interruptSession(sessionId: string): boolean {
    const handle = this.handles.get(sessionId);
    if (handle) {
      handle.interrupt();
      return true;
    }
    return false;
  }

  terminateSession(sessionId: string): boolean {
    const handle = this.handles.get(sessionId);
    if (handle) {
      handle.terminate();
      return true;
    }
    return false;
  }

  killSession(sessionId: string): boolean {
    const handle = this.handles.get(sessionId);
    if (handle) {
      handle.kill();
      return true;
    }
    return false;
  }

  getSession(sessionId: string): SessionInfo | undefined {
    return this.sessions.get(sessionId);
  }

  listSessions(): SessionInfo[] {
    return Array.from(this.sessions.values());
  }

  activeSessions(): SessionInfo[] {
    return this.listSessions().filter(
      (s) => s.status === 'running' || s.status === 'starting',
    );
  }

  totalCost(): number {
    let total = 0;
    for (const session of this.sessions.values()) {
      total += session.costUsd;
    }
    return total;
  }

  terminateAll(): void {
    for (const handle of this.handles.values()) {
      handle.terminate();
    }
  }

  killAll(): void {
    for (const handle of this.handles.values()) {
      handle.kill();
    }
    this.handles.clear();
  }
}
