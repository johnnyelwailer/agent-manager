import { describe, it, expect, beforeAll, afterAll, afterEach } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { SessionManager } from '../../src/core/session-manager.js';
import { WsHandler, type WsClientState } from '../../src/routes/ws.js';
import { createApp } from '../../src/app.js';
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

  async checkAvailability(): Promise<string | null> {
    return null;
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

    onEvent({
      id: randomUUID(),
      sessionId,
      timestamp: new Date().toISOString(),
      type: 'text_delta',
      text: 'WS test message',
    });

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
// Test with real Bun server for WebSocket
// ---------------------------------------------------------------------------

let manager: SessionManager;
let wsHandler: WsHandler;
let server: ReturnType<typeof Bun.serve<WsClientState>>;
let port: number;
const openSockets: WebSocket[] = [];

beforeAll(() => {
  manager = new SessionManager();
  manager.registerAdapter(new MockAdapter());
  wsHandler = new WsHandler(manager.bus);
  const app = createApp(manager);

  server = Bun.serve<WsClientState>({
    port: 0,
    hostname: '127.0.0.1',
    fetch(req, server) {
      const url = new URL(req.url);
      if (url.pathname === '/ws') {
        const upgraded = server.upgrade(req, {
          data: { subscribedAll: false, unsubAll: undefined, sessions: new Map() },
        });
        if (upgraded) return undefined;
        return new Response('WebSocket upgrade failed', { status: 400 });
      }
      return app.fetch(req);
    },
    websocket: {
      open(ws) { wsHandler.onOpen(ws); },
      message(ws, message) { wsHandler.onMessage(ws, message); },
      close(ws) { wsHandler.onClose(ws); },
    },
  });
  port = server.port ?? 0;
});

afterEach(async () => {
  for (const ws of openSockets) {
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close();
    }
  }
  openSockets.length = 0;
  await new Promise((r) => setTimeout(r, 20));
});

afterAll(() => {
  wsHandler.close();
  server.stop(true);
});

function connectWs(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    openSockets.push(ws);
    ws.onopen = () => resolve(ws);
    ws.onerror = (e) => reject(e);
  });
}

function waitForMessage(ws: WebSocket, timeoutMs = 2000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('waitForMessage timed out')), timeoutMs);
    const handler = (event: MessageEvent) => {
      clearTimeout(timer);
      ws.removeEventListener('message', handler);
      resolve(JSON.parse(String(event.data)));
    };
    ws.addEventListener('message', handler);
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WebSocket transport', () => {
  it('connects to the WebSocket server', async () => {
    const ws = await connectWs();
    expect(ws.readyState).toBe(WebSocket.OPEN);
  });

  it('subscribes to all events and receives ack', async () => {
    const ws = await connectWs();
    ws.send(JSON.stringify({ type: 'subscribe', scope: 'all' }));
    const ack = await waitForMessage(ws) as { type: string; scope: string };
    expect(ack.type).toBe('subscribed');
    expect(ack.scope).toBe('all');
  });

  it('receives events after subscribing to all', async () => {
    const ws = await connectWs();
    ws.send(JSON.stringify({ type: 'subscribe', scope: 'all' }));
    await waitForMessage(ws); // subscribed ack

    const messages: unknown[] = [];
    ws.onmessage = (event) => {
      messages.push(JSON.parse(String(event.data)));
    };

    await manager.startSession('mock', { prompt: 'ws test', cwd: '/tmp' });
    await new Promise((r) => setTimeout(r, 50));

    expect(messages.length).toBeGreaterThanOrEqual(2);
    const types = messages.map((m: any) => m.type);
    expect(types).toContain('session_start');
  });

  it('subscribes to a specific session', async () => {
    const ws = await connectWs();
    const info = await manager.startSession('mock', { prompt: 'specific test', cwd: '/tmp' });

    ws.send(JSON.stringify({ type: 'subscribe', scope: 'session', sessionId: info.sessionId }));
    const ack = await waitForMessage(ws) as { type: string; sessionId: string };
    expect(ack.type).toBe('subscribed');
    expect(ack.sessionId).toBe(info.sessionId);
  });

  it('unsubscribes from all events', async () => {
    const ws = await connectWs();
    ws.send(JSON.stringify({ type: 'subscribe', scope: 'all' }));
    await waitForMessage(ws);

    ws.send(JSON.stringify({ type: 'unsubscribe', scope: 'all' }));
    const ack = await waitForMessage(ws) as { type: string };
    expect(ack.type).toBe('unsubscribed');
  });

  it('sends error for invalid JSON', async () => {
    const ws = await connectWs();
    ws.send('not json');
    const msg = await waitForMessage(ws) as { type: string; message: string };
    expect(msg.type).toBe('error');
    expect(msg.message).toContain('Invalid JSON');
  });

  it('returns error for unknown command type', async () => {
    const ws = await connectWs();
    ws.send(JSON.stringify({ type: 'unknown' }));
    const msg = await waitForMessage(ws) as { type: string; message: string };
    expect(msg.type).toBe('error');
    expect(msg.message).toContain('Unknown command');
  });

  it('returns error for missing scope', async () => {
    const ws = await connectWs();
    ws.send(JSON.stringify({ type: 'subscribe' }));
    const msg = await waitForMessage(ws) as { type: string; message: string };
    expect(msg.type).toBe('error');
    expect(msg.message).toContain('Invalid scope');
  });

  it('returns error for session scope without sessionId', async () => {
    const ws = await connectWs();
    ws.send(JSON.stringify({ type: 'subscribe', scope: 'session' }));
    const msg = await waitForMessage(ws) as { type: string; message: string };
    expect(msg.type).toBe('error');
    expect(msg.message).toContain('sessionId is required');
  });

  it('unsubscribes from a specific session', async () => {
    const ws = await connectWs();
    const info = await manager.startSession('mock', { prompt: 'unsub test', cwd: '/tmp' });

    ws.send(JSON.stringify({ type: 'subscribe', scope: 'session', sessionId: info.sessionId }));
    const subAck = await waitForMessage(ws) as { type: string };
    expect(subAck.type).toBe('subscribed');

    ws.send(JSON.stringify({ type: 'unsubscribe', scope: 'session', sessionId: info.sessionId }));
    const unsubAck = await waitForMessage(ws) as { type: string; sessionId: string };
    expect(unsubAck.type).toBe('unsubscribed');
    expect(unsubAck.sessionId).toBe(info.sessionId);
  });

  it('ignores duplicate subscribe to all', async () => {
    const ws = await connectWs();

    ws.send(JSON.stringify({ type: 'subscribe', scope: 'all' }));
    const ack1 = await waitForMessage(ws) as { type: string };
    expect(ack1.type).toBe('subscribed');

    // Second subscribe is silently ignored
    ws.send(JSON.stringify({ type: 'subscribe', scope: 'all' }));
    ws.send(JSON.stringify({ type: 'unsubscribe', scope: 'all' }));
    const next = await waitForMessage(ws) as { type: string };
    expect(next.type).toBe('unsubscribed');
  });

  it('delivers events to session-scoped subscribers', async () => {
    const ws = await connectWs();

    // Start a session first, then subscribe
    const info = await manager.startSession('mock', { prompt: 'delivery test', cwd: '/tmp' });
    ws.send(JSON.stringify({ type: 'subscribe', scope: 'session', sessionId: info.sessionId }));
    const subAck = await waitForMessage(ws) as { type: string };
    expect(subAck.type).toBe('subscribed');

    // The session_end fires after 10ms, so we should receive it
    const messages: unknown[] = [];
    ws.onmessage = (event) => {
      messages.push(JSON.parse(String(event.data)));
    };

    await new Promise((r) => setTimeout(r, 50));

    // Should have received the session_end event
    const types = messages.map((m: any) => m.type);
    expect(types).toContain('session_end');

    // All received events should be for our session
    for (const msg of messages) {
      const m = msg as { sessionId?: string };
      if (m.sessionId) {
        expect(m.sessionId).toBe(info.sessionId);
      }
    }
  });

  it('does not deliver events for other sessions to scoped subscriber', async () => {
    const ws = await connectWs();

    // Subscribe to a specific session ID
    ws.send(JSON.stringify({ type: 'subscribe', scope: 'session', sessionId: 'nonexistent-session' }));
    const subAck = await waitForMessage(ws) as { type: string };
    expect(subAck.type).toBe('subscribed');

    const messages: unknown[] = [];
    ws.onmessage = (event) => {
      messages.push(JSON.parse(String(event.data)));
    };

    // Start a different session
    await manager.startSession('mock', { prompt: 'other session', cwd: '/tmp' });
    await new Promise((r) => setTimeout(r, 50));

    // Should NOT have received any events (subscribed to different session)
    const agentEvents = messages.filter((m: any) => m.sessionId);
    expect(agentEvents).toHaveLength(0);
  });

  it('tracks client count', async () => {
    const ws1 = await connectWs();
    const ws2 = await connectWs();
    await new Promise((r) => setTimeout(r, 10));
    expect(wsHandler.clientCount).toBeGreaterThanOrEqual(2);
  });
});
