import { describe, it, expect, beforeAll } from 'bun:test';
import { testClient } from 'hono/testing';
import { randomUUID } from 'node:crypto';
import { createApp, type AppType } from '../../src/app.js';
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
  events: Array<{ type: string; [key: string]: unknown }> = [];

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

    setTimeout(() => {
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
// Setup
// ---------------------------------------------------------------------------

let manager: SessionManager;
let mockAdapter: MockAdapter;
let app: AppType;
let client: ReturnType<typeof testClient<AppType>>;

beforeAll(() => {
  manager = new SessionManager();
  mockAdapter = new MockAdapter();
  mockAdapter.events = [
    { type: 'text_delta', text: 'Hello from mock' },
  ];
  manager.registerAdapter(mockAdapter);
  app = createApp(manager);
  client = testClient(app);
});

// Also keep raw request helper for edge cases testClient can't cover
function req(path: string, init?: RequestInit) {
  return app.request(path, init);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('REST API', () => {
  it('GET /api/adapters returns registered adapters', async () => {
    const res = await client.api.adapters.$get();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.adapters).toHaveLength(1);
    expect(body.adapters[0]!.id).toBe('mock');
  });

  it('GET /api/adapters/:id/available checks adapter availability', async () => {
    const res = await client.api.adapters[':id'].available.$get({ param: { id: 'mock' } });
    expect(res.status).toBe(200);
    const body = await res.json();
    if ('available' in body) {
      expect(body.available).toBe(true);
    }
  });

  it('GET /api/adapters/:id/available returns 404 for unknown adapter', async () => {
    const res = await client.api.adapters[':id'].available.$get({ param: { id: 'unknown' } });
    expect(res.status).toBe(404);
  });

  it('GET /api/adapters/:id/available reports unavailable adapter', async () => {
    mockAdapter.available = false;
    try {
      const res = await client.api.adapters[':id'].available.$get({ param: { id: 'mock' } });
      expect(res.status).toBe(200);
      const body = await res.json();
      if ('available' in body) {
        expect(body.available).toBe(false);
      }
    } finally {
      mockAdapter.available = true;
    }
  });

  it('GET /api/sessions returns empty list initially', async () => {
    const freshManager = new SessionManager();
    freshManager.registerAdapter(mockAdapter);
    const freshApp = createApp(freshManager);
    const freshClient = testClient(freshApp);
    const res = await freshClient.api.sessions.$get();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sessions).toHaveLength(0);
  });

  it('POST /api/sessions starts a new session', async () => {
    const res = await client.api.sessions.$post({
      json: { adapterId: 'mock', prompt: 'test prompt', cwd: '/tmp' },
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    if ('session' in body) {
      expect(body.session.sessionId).toBeTruthy();
      expect(body.session.adapterId).toBe('mock');
    }
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
    const res = await client.api.sessions.$post({
      json: { adapterId: 'nonexistent', prompt: 'test', cwd: '/tmp' },
    });
    expect(res.status).toBe(500);
  });

  it('GET /api/sessions/:id returns session details', async () => {
    const createRes = await client.api.sessions.$post({
      json: { adapterId: 'mock', prompt: 'detail test', cwd: '/tmp' },
    });
    const created = await createRes.json();

    await new Promise((r) => setTimeout(r, 50));

    if ('session' in created) {
      const res = await client.api.sessions[':id'].$get({ param: { id: created.session.sessionId } });
      expect(res.status).toBe(200);
      const body = await res.json();
      if ('session' in body) {
        expect(body.session.sessionId).toBe(created.session.sessionId);
        expect(body.session.events.length).toBeGreaterThan(0);
      }
    }
  });

  it('GET /api/sessions/:id returns 404 for unknown session', async () => {
    const res = await client.api.sessions[':id'].$get({ param: { id: 'nonexistent' } });
    expect(res.status).toBe(404);
  });

  it('POST /api/sessions/:id/interrupt returns 404 for unknown session', async () => {
    const res = await client.api.sessions[':id'].interrupt.$post({ param: { id: 'nonexistent' } });
    expect(res.status).toBe(404);
  });

  it('POST /api/sessions/:id/terminate returns 404 for unknown session', async () => {
    const res = await client.api.sessions[':id'].terminate.$post({ param: { id: 'nonexistent' } });
    expect(res.status).toBe(404);
  });

  it('POST /api/sessions/:id/kill returns 404 for unknown session', async () => {
    const res = await client.api.sessions[':id'].kill.$post({ param: { id: 'nonexistent' } });
    expect(res.status).toBe(404);
  });

  it('GET /api/sessions list omits events but includes eventCount', async () => {
    const res = await client.api.sessions.$get();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sessions.length).toBeGreaterThan(0);
    for (const s of body.sessions) {
      expect((s as any).events).toBeUndefined();
      expect(typeof s.eventCount).toBe('number');
    }
  });

  it('returns 404 for unknown routes', async () => {
    const res = await req('/api/unknown');
    expect(res.status).toBe(404);
  });
});
