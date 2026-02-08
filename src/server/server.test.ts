// Tests for the server layer — REST API + WebSocket transport.
// Uses the real HTTP server on a random port, tests against the actual endpoints.

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import { WebSocket } from 'ws';
import { createServer, type AgentServer } from './index.ts';
import { SessionManager } from '../core/session-manager.ts';
import type { Adapter, AdapterManifest, SessionConfig, SessionHandle } from '../adapters/adapter.ts';
import type { AgentEvent } from '../types/events.ts';
import { randomUUID } from 'node:crypto';

// ---------------------------------------------------------------------------
// Mock adapter — emits a few events then completes
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
    timer.unref(); // don't block process exit

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
// Helpers
// ---------------------------------------------------------------------------

function fetch(url: string, init?: { method?: string; body?: string }): Promise<{ status: number; json: () => Promise<unknown> }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = httpRequest({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: init?.method ?? 'GET',
      headers: init?.body ? { 'Content-Type': 'application/json' } : {},
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf-8');
        resolve({
          status: res.statusCode ?? 0,
          json: async () => JSON.parse(body),
        });
      });
    });
    req.on('error', reject);
    if (init?.body) req.write(init.body);
    req.end();
  });
}

function connectWs(port: number, path = '/ws'): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}${path}`);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

function waitForMessage(ws: WebSocket, timeoutMs = 2000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('waitForMessage timed out')), timeoutMs);
    timer.unref();
    ws.once('message', (data) => {
      clearTimeout(timer);
      resolve(JSON.parse(String(data)));
    });
  });
}

function closeWs(ws: WebSocket, timeoutMs = 2000): Promise<void> {
  return new Promise((resolve) => {
    if (ws.readyState === ws.CLOSED) { resolve(); return; }
    const timer = setTimeout(() => { ws.terminate(); resolve(); }, timeoutMs);
    timer.unref();
    ws.on('close', () => { clearTimeout(timer); resolve(); });
    ws.close();
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('REST API', () => {
  let server: AgentServer;
  let mockAdapter: MockAdapter;
  let baseUrl: string;

  before(async () => {
    const manager = new SessionManager();
    mockAdapter = new MockAdapter();
    mockAdapter.events = [
      { type: 'text_delta', text: 'Hello from mock' },
    ];
    manager.registerAdapter(mockAdapter);

    server = await createServer({ manager, port: 0, host: '127.0.0.1' });
    baseUrl = `http://127.0.0.1:${server.port}`;
  });

  after(async () => {
    await server.close();
  });

  it('GET /api/adapters returns registered adapters', async () => {
    const res = await fetch(`${baseUrl}/api/adapters`);
    assert.equal(res.status, 200);
    const body = await res.json() as { adapters: { id: string }[] };
    assert.equal(body.adapters.length, 1);
    assert.equal(body.adapters[0].id, 'mock');
  });

  it('GET /api/adapters/:id/available checks adapter availability', async () => {
    const res = await fetch(`${baseUrl}/api/adapters/mock/available`);
    assert.equal(res.status, 200);
    const body = await res.json() as { available: boolean };
    assert.equal(body.available, true);
  });

  it('GET /api/adapters/:id/available returns 404 for unknown adapter', async () => {
    const res = await fetch(`${baseUrl}/api/adapters/unknown/available`);
    assert.equal(res.status, 404);
  });

  it('GET /api/sessions returns empty list initially', async () => {
    const res = await fetch(`${baseUrl}/api/sessions`);
    assert.equal(res.status, 200);
    const body = await res.json() as { sessions: unknown[] };
    assert.equal(body.sessions.length, 0);
  });

  it('POST /api/sessions starts a new session', async () => {
    const res = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      body: JSON.stringify({
        adapterId: 'mock',
        prompt: 'test prompt',
        cwd: '/tmp',
      }),
    });
    assert.equal(res.status, 201);
    const body = await res.json() as { session: { sessionId: string; adapterId: string } };
    assert.ok(body.session.sessionId);
    assert.equal(body.session.adapterId, 'mock');
  });

  it('POST /api/sessions rejects missing fields', async () => {
    const res = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      body: JSON.stringify({ adapterId: 'mock' }),
    });
    assert.equal(res.status, 400);
  });

  it('POST /api/sessions rejects unknown adapter', async () => {
    const res = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      body: JSON.stringify({
        adapterId: 'nonexistent',
        prompt: 'test',
        cwd: '/tmp',
      }),
    });
    assert.equal(res.status, 500);
  });

  it('GET /api/sessions/:id returns session details', async () => {
    const createRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      body: JSON.stringify({
        adapterId: 'mock',
        prompt: 'detail test',
        cwd: '/tmp',
      }),
    });
    const { session: created } = await createRes.json() as { session: { sessionId: string } };

    await new Promise((r) => setTimeout(r, 50));

    const res = await fetch(`${baseUrl}/api/sessions/${created.sessionId}`);
    assert.equal(res.status, 200);
    const body = await res.json() as { session: { sessionId: string; events: unknown[] } };
    assert.equal(body.session.sessionId, created.sessionId);
    assert.ok(body.session.events.length > 0, 'should include events in detail view');
  });

  it('GET /api/sessions/:id returns 404 for unknown session', async () => {
    const res = await fetch(`${baseUrl}/api/sessions/nonexistent`);
    assert.equal(res.status, 404);
  });

  it('returns 404 for unknown routes', async () => {
    const res = await fetch(`${baseUrl}/api/unknown`);
    assert.equal(res.status, 404);
  });

  it('handles CORS preflight', async () => {
    const res = await fetch(`${baseUrl}/api/sessions`, { method: 'OPTIONS' });
    assert.equal(res.status, 204);
  });

  it('POST /api/sessions rejects invalid JSON body', async () => {
    const res = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      body: '{not valid json',
    });
    assert.equal(res.status, 400);
    const body = await res.json() as { error: string };
    assert.ok(body.error.includes('Invalid JSON'), `expected "Invalid JSON" in error, got "${body.error}"`);
  });

  it('GET /api/adapters/:id/available reports unavailable adapter', async () => {
    mockAdapter.available = false;
    try {
      const res = await fetch(`${baseUrl}/api/adapters/mock/available`);
      assert.equal(res.status, 200);
      const body = await res.json() as { available: boolean; error: string };
      assert.equal(body.available, false);
      assert.ok(body.error);
    } finally {
      mockAdapter.available = true;
    }
  });

  it('POST /api/sessions/:id/interrupt returns 404 for unknown session', async () => {
    const res = await fetch(`${baseUrl}/api/sessions/nonexistent/interrupt`, { method: 'POST' });
    assert.equal(res.status, 404);
  });

  it('POST /api/sessions/:id/terminate returns 404 for unknown session', async () => {
    const res = await fetch(`${baseUrl}/api/sessions/nonexistent/terminate`, { method: 'POST' });
    assert.equal(res.status, 404);
  });

  it('POST /api/sessions/:id/kill returns 404 for unknown session', async () => {
    const res = await fetch(`${baseUrl}/api/sessions/nonexistent/kill`, { method: 'POST' });
    assert.equal(res.status, 404);
  });

  it('GET /api/sessions list omits events but includes eventCount', async () => {
    const res = await fetch(`${baseUrl}/api/sessions`);
    assert.equal(res.status, 200);
    const body = await res.json() as { sessions: { events?: unknown; eventCount: number }[] };
    assert.ok(body.sessions.length > 0, 'should have sessions from previous tests');
    for (const s of body.sessions) {
      assert.equal(s.events, undefined, 'events should be omitted from list view');
      assert.equal(typeof s.eventCount, 'number', 'eventCount should be present');
    }
  });
});

describe('WebSocket transport', () => {
  let server: AgentServer;
  let mockAdapter: MockAdapter;

  before(async () => {
    const manager = new SessionManager();
    mockAdapter = new MockAdapter();
    mockAdapter.events = [
      { type: 'text_delta', text: 'WS test message' },
    ];
    manager.registerAdapter(mockAdapter);

    server = await createServer({ manager, port: 0, host: '127.0.0.1' });
  });

  after(async () => {
    await server.close();
  });

  it('connects to the WebSocket server', async () => {
    const ws = await connectWs(server.port);
    assert.ok(ws.readyState === ws.OPEN);
    await closeWs(ws);
  });

  it('subscribes to all events and receives them', async () => {
    const ws = await connectWs(server.port);

    ws.send(JSON.stringify({ type: 'subscribe', scope: 'all' }));
    const ack = await waitForMessage(ws) as { type: string; scope: string };
    assert.equal(ack.type, 'subscribed');
    assert.equal(ack.scope, 'all');

    // Collect messages
    const messages: unknown[] = [];
    ws.on('message', (data) => {
      messages.push(JSON.parse(String(data)));
    });

    const info = await server.manager.startSession('mock', {
      prompt: 'ws test',
      cwd: '/tmp',
    });

    // Wait for events to arrive
    await new Promise((r) => setTimeout(r, 50));

    assert.ok(messages.length >= 2, `expected >= 2 events, got ${messages.length}`);
    const types = messages.map((m: any) => m.type);
    assert.ok(types.includes('session_start'), 'should receive session_start');

    await closeWs(ws);
  });

  it('subscribes to a specific session and receives ack', async () => {
    const ws = await connectWs(server.port);

    const info = await server.manager.startSession('mock', {
      prompt: 'specific session test',
      cwd: '/tmp',
    });

    ws.send(JSON.stringify({ type: 'subscribe', scope: 'session', sessionId: info.sessionId }));
    const ack = await waitForMessage(ws) as { type: string; scope: string; sessionId: string };
    assert.equal(ack.type, 'subscribed');
    assert.equal(ack.sessionId, info.sessionId);

    await closeWs(ws);
  });

  it('unsubscribes from all events', async () => {
    const ws = await connectWs(server.port);

    ws.send(JSON.stringify({ type: 'subscribe', scope: 'all' }));
    await waitForMessage(ws);

    ws.send(JSON.stringify({ type: 'unsubscribe', scope: 'all' }));
    const ack = await waitForMessage(ws) as { type: string };
    assert.equal(ack.type, 'unsubscribed');

    await closeWs(ws);
  });

  it('sends error for invalid JSON', async () => {
    const ws = await connectWs(server.port);

    ws.send('not json');
    const msg = await waitForMessage(ws) as { type: string; message: string };
    assert.equal(msg.type, 'error');
    assert.ok(msg.message.includes('Invalid JSON'));

    await closeWs(ws);
  });

  it('tracks client count', async () => {
    const ws1 = await connectWs(server.port);
    const ws2 = await connectWs(server.port);

    await new Promise((r) => setTimeout(r, 10));
    assert.ok(server.ws.clientCount >= 2);

    await closeWs(ws1);
    await closeWs(ws2);
  });

  it('returns error for unknown command type', async () => {
    const ws = await connectWs(server.port);

    ws.send(JSON.stringify({ type: 'unknown' }));
    const msg = await waitForMessage(ws) as { type: string; message: string };
    assert.equal(msg.type, 'error');
    assert.ok(msg.message.includes('Unknown command'));

    await closeWs(ws);
  });

  it('returns error for missing scope', async () => {
    const ws = await connectWs(server.port);

    ws.send(JSON.stringify({ type: 'subscribe' }));
    const msg = await waitForMessage(ws) as { type: string; message: string };
    assert.equal(msg.type, 'error');
    assert.ok(msg.message.includes('Invalid scope'));

    await closeWs(ws);
  });

  it('returns error for session scope without sessionId', async () => {
    const ws = await connectWs(server.port);

    ws.send(JSON.stringify({ type: 'subscribe', scope: 'session' }));
    const msg = await waitForMessage(ws) as { type: string; message: string };
    assert.equal(msg.type, 'error');
    assert.ok(msg.message.includes('sessionId is required'));

    await closeWs(ws);
  });

  it('unsubscribes from a specific session', async () => {
    const ws = await connectWs(server.port);

    const info = await server.manager.startSession('mock', {
      prompt: 'unsub session test',
      cwd: '/tmp',
    });

    ws.send(JSON.stringify({ type: 'subscribe', scope: 'session', sessionId: info.sessionId }));
    const subAck = await waitForMessage(ws) as { type: string };
    assert.equal(subAck.type, 'subscribed');

    ws.send(JSON.stringify({ type: 'unsubscribe', scope: 'session', sessionId: info.sessionId }));
    const unsubAck = await waitForMessage(ws) as { type: string; sessionId: string };
    assert.equal(unsubAck.type, 'unsubscribed');
    assert.equal(unsubAck.sessionId, info.sessionId);

    await closeWs(ws);
  });

  it('ignores duplicate subscribe to all', async () => {
    const ws = await connectWs(server.port);

    ws.send(JSON.stringify({ type: 'subscribe', scope: 'all' }));
    const ack1 = await waitForMessage(ws) as { type: string };
    assert.equal(ack1.type, 'subscribed');

    // Second subscribe should be silently ignored (no ack)
    ws.send(JSON.stringify({ type: 'subscribe', scope: 'all' }));
    // Send a known command after to confirm the duplicate was skipped
    ws.send(JSON.stringify({ type: 'unsubscribe', scope: 'all' }));
    const next = await waitForMessage(ws) as { type: string };
    assert.equal(next.type, 'unsubscribed', 'duplicate subscribe should be silently skipped');

    await closeWs(ws);
  });
});
