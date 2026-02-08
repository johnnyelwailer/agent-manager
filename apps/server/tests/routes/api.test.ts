import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { createApp } from '../../src/app.js';
import { SessionManager } from '../../src/core/session-manager.js';
import type { Adapter, SessionHandle } from '../../src/adapters/adapter.js';
import type { AgentEvent, AdapterManifest, SessionConfig } from '@agent-manager/shared';

// ---------------------------------------------------------------------------
// Mock adapter
// ---------------------------------------------------------------------------

class MockAdapter implements Adapter {
  readonly manifest: AdapterManifest = {
    id: 'mock',
    name: 'Mock Adapter',
    version: '1.0.0',
    runtime: 'mock',
  };

  available = true;
  events: Omit<AgentEvent, 'id' | 'sessionId' | 'timestamp'>[] = [];

  async checkAvailability(): Promise<string | null> {
    return this.available ? null : 'Mock unavailable';
  }

  async startSession(
    config: SessionConfig,
    onEvent: (event: AgentEvent) => void,
  ): Promise<SessionHandle> {
    const sessionId = config.sessionId;

    onEvent({
      id: randomUUID(),
      sessionId,
      timestamp: new Date().toISOString(),
      type: 'session_start',
      model: 'mock-model',
      cwd: config.cwd,
    });

    for (const evt of this.events) {
      onEvent({
        ...evt,
        id: randomUUID(),
        sessionId,
        timestamp: new Date().toISOString(),
      } as AgentEvent);
    }

    let resolveSession: () => void;
    const done = new Promise<void>((resolve) => { resolveSession = resolve; });

    const timer = setTimeout(() => {
      onEvent({
        id: randomUUID(),
        sessionId,
        timestamp: new Date().toISOString(),
        type: 'session_end',
        result: 'success',
        costUsd: 0.001,
        durationMs: 100,
        tokensIn: 500,
        tokensOut: 100,
      });
      resolveSession!();
    }, 10);
    // Bun doesn't have .unref(), so we just let it run
    if (typeof timer === 'object' && 'unref' in timer) {
      (timer as NodeJS.Timeout).unref();
    }

    return {
      sessionId,
      interrupt() {},
      terminate() {},
      kill() {},
      done,
    };
  }
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

let manager: SessionManager;
let mockAdapter: MockAdapter;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  manager = new SessionManager();
  mockAdapter = new MockAdapter();
  mockAdapter.events = [
    { type: 'text_delta', text: 'Hello from mock' },
  ];
  manager.registerAdapter(mockAdapter);
  app = createApp(manager);
});

function req(path: string, init?: RequestInit) {
  return app.request(path, init);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('REST API', () => {
  it('GET /api/adapters returns registered adapters', async () => {
    const res = await req('/api/adapters');
    expect(res.status).toBe(200);
    const body = await res.json() as { adapters: { id: string }[] };
    expect(body.adapters).toHaveLength(1);
    expect(body.adapters[0]!.id).toBe('mock');
  });

  it('GET /api/adapters/:id/available checks adapter availability', async () => {
    const res = await req('/api/adapters/mock/available');
    expect(res.status).toBe(200);
    const body = await res.json() as { available: boolean };
    expect(body.available).toBe(true);
  });

  it('GET /api/adapters/:id/available returns 404 for unknown adapter', async () => {
    const res = await req('/api/adapters/unknown/available');
    expect(res.status).toBe(404);
  });

  it('GET /api/adapters/:id/available reports unavailable adapter', async () => {
    mockAdapter.available = false;
    try {
      const res = await req('/api/adapters/mock/available');
      expect(res.status).toBe(200);
      const body = await res.json() as { available: boolean; error: string };
      expect(body.available).toBe(false);
      expect(body.error).toBeTruthy();
    } finally {
      mockAdapter.available = true;
    }
  });

  it('GET /api/sessions returns empty list initially', async () => {
    // Use a fresh manager for this test
    const freshManager = new SessionManager();
    freshManager.registerAdapter(mockAdapter);
    const freshApp = createApp(freshManager);
    const res = await freshApp.request('/api/sessions');
    expect(res.status).toBe(200);
    const body = await res.json() as { sessions: unknown[] };
    expect(body.sessions).toHaveLength(0);
  });

  it('POST /api/sessions starts a new session', async () => {
    const res = await req('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        adapterId: 'mock',
        prompt: 'test prompt',
        cwd: '/tmp',
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { session: { sessionId: string; adapterId: string } };
    expect(body.session.sessionId).toBeTruthy();
    expect(body.session.adapterId).toBe('mock');
  });

  it('POST /api/sessions rejects missing fields', async () => {
    const res = await req('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adapterId: 'mock' }),
    });
    expect(res.status).toBe(400);
  });

  it('POST /api/sessions rejects unknown adapter', async () => {
    const res = await req('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        adapterId: 'nonexistent',
        prompt: 'test',
        cwd: '/tmp',
      }),
    });
    expect(res.status).toBe(500);
  });

  it('GET /api/sessions/:id returns session details', async () => {
    const createRes = await req('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        adapterId: 'mock',
        prompt: 'detail test',
        cwd: '/tmp',
      }),
    });
    const { session: created } = await createRes.json() as { session: { sessionId: string } };

    await new Promise((r) => setTimeout(r, 50));

    const res = await req(`/api/sessions/${created.sessionId}`);
    expect(res.status).toBe(200);
    const body = await res.json() as { session: { sessionId: string; events: unknown[] } };
    expect(body.session.sessionId).toBe(created.sessionId);
    expect(body.session.events.length).toBeGreaterThan(0);
  });

  it('GET /api/sessions/:id returns 404 for unknown session', async () => {
    const res = await req('/api/sessions/nonexistent');
    expect(res.status).toBe(404);
  });

  it('POST /api/sessions/:id/interrupt returns 404 for unknown session', async () => {
    const res = await req('/api/sessions/nonexistent/interrupt', { method: 'POST' });
    expect(res.status).toBe(404);
  });

  it('POST /api/sessions/:id/terminate returns 404 for unknown session', async () => {
    const res = await req('/api/sessions/nonexistent/terminate', { method: 'POST' });
    expect(res.status).toBe(404);
  });

  it('POST /api/sessions/:id/kill returns 404 for unknown session', async () => {
    const res = await req('/api/sessions/nonexistent/kill', { method: 'POST' });
    expect(res.status).toBe(404);
  });

  it('GET /api/sessions list omits events but includes eventCount', async () => {
    const res = await req('/api/sessions');
    expect(res.status).toBe(200);
    const body = await res.json() as { sessions: { events?: unknown; eventCount: number }[] };
    expect(body.sessions.length).toBeGreaterThan(0);
    for (const s of body.sessions) {
      expect(s.events).toBeUndefined();
      expect(typeof s.eventCount).toBe('number');
    }
  });

  it('returns 404 for unknown routes', async () => {
    const res = await req('/api/unknown');
    expect(res.status).toBe(404);
  });
});
