import { describe, it, expect, mock, beforeEach } from 'bun:test';
import type { AgentEvent } from '@agent-manager/shared';

// ---------------------------------------------------------------------------
// Mock the @github/copilot-sdk module
// ---------------------------------------------------------------------------

type EventHandler = (event: { type: string; data?: Record<string, unknown> }) => void;

let mockSessionHandler: EventHandler | null = null;
let mockStartCalled = false;
let mockStopCalled = false;
let mockCreateSessionCalled = false;
let mockSendPrompt = '';
let mockAbortCalled = false;
let mockDestroyCalled = false;
let mockForceStopCalled = false;

const mockSession = {
  sessionId: 'copilot-session-123',
  send: mock(async (options: { prompt: string }) => {
    mockSendPrompt = options.prompt;
    return 'msg-001';
  }),
  on: mock((handlerOrType: unknown, maybeHandler?: unknown) => {
    if (typeof handlerOrType === 'function') {
      mockSessionHandler = handlerOrType as EventHandler;
    } else if (typeof maybeHandler === 'function') {
      // typed event handler — not used in the adapter, but support it
    }
    return () => {};
  }),
  abort: mock(async () => { mockAbortCalled = true; }),
  destroy: mock(async () => { mockDestroyCalled = true; }),
  getMessages: mock(async () => []),
};

const mockClient = {
  start: mock(async () => { mockStartCalled = true; }),
  stop: mock(async () => { mockStopCalled = true; return []; }),
  forceStop: mock(async () => { mockForceStopCalled = true; }),
  createSession: mock(async (_config?: unknown) => {
    mockCreateSessionCalled = true;
    return mockSession;
  }),
};

// Use Bun's module mock
mock.module('@github/copilot-sdk', () => ({
  CopilotClient: class {
    constructor() {
      return mockClient;
    }
  },
}));

// Import after mocking
const { CopilotSdkAdapter } = await import('../../src/adapters/copilot-sdk.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetMocks() {
  mockSessionHandler = null;
  mockStartCalled = false;
  mockStopCalled = false;
  mockCreateSessionCalled = false;
  mockSendPrompt = '';
  mockAbortCalled = false;
  mockDestroyCalled = false;
  mockForceStopCalled = false;
  mockSession.send.mockClear();
  mockSession.on.mockClear();
  mockSession.abort.mockClear();
  mockSession.destroy.mockClear();
  mockClient.start.mockClear();
  mockClient.stop.mockClear();
  mockClient.forceStop.mockClear();
  mockClient.createSession.mockClear();
}

function emitEvent(type: string, data?: Record<string, unknown>) {
  if (mockSessionHandler) {
    mockSessionHandler({ type, data });
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CopilotSdkAdapter', () => {
  beforeEach(() => {
    resetMocks();
  });

  describe('manifest', () => {
    it('has correct adapter metadata', () => {
      const adapter = new CopilotSdkAdapter();
      expect(adapter.manifest.id).toBe('copilot-sdk');
      expect(adapter.manifest.name).toBe('GitHub Copilot SDK');
      expect(adapter.manifest.runtime).toBe('copilot');
    });
  });

  describe('startSession', () => {
    it('starts client and creates session', async () => {
      const adapter = new CopilotSdkAdapter();
      const events: AgentEvent[] = [];

      const handle = await adapter.startSession(
        { sessionId: 'test-001', prompt: 'Fix the bug', cwd: '/tmp' },
        (event) => events.push(event),
      );

      expect(mockStartCalled).toBe(true);
      expect(mockCreateSessionCalled).toBe(true);
      expect(mockSendPrompt).toBe('Fix the bug');

      // Should have emitted session_start
      const start = events.find((e) => e.type === 'session_start');
      expect(start).toBeDefined();
      expect(start!.sessionId).toBe('test-001');
      if (start?.type === 'session_start') {
        expect(start.cwd).toBe('/tmp');
      }

      expect(handle.sessionId).toBe('test-001');

      // Simulate idle to complete
      emitEvent('session.idle');
      await handle.done;
    });

    it('normalizes assistant.message events to text_delta', async () => {
      const adapter = new CopilotSdkAdapter();
      const events: AgentEvent[] = [];

      const handle = await adapter.startSession(
        { sessionId: 'test-text', prompt: 'hello', cwd: '/tmp' },
        (event) => events.push(event),
      );

      emitEvent('assistant.message', { content: 'Hello! I can help with that.' });
      emitEvent('session.idle');
      await handle.done;

      const textEvents = events.filter((e) => e.type === 'text_delta');
      expect(textEvents).toHaveLength(1);
      if (textEvents[0]?.type === 'text_delta') {
        expect(textEvents[0].text).toBe('Hello! I can help with that.');
      }
    });

    it('normalizes assistant.message_delta events to text_delta', async () => {
      const adapter = new CopilotSdkAdapter();
      const events: AgentEvent[] = [];

      const handle = await adapter.startSession(
        { sessionId: 'test-delta', prompt: 'hello', cwd: '/tmp' },
        (event) => events.push(event),
      );

      emitEvent('assistant.message_delta', { deltaContent: 'Hel' });
      emitEvent('assistant.message_delta', { deltaContent: 'lo!' });
      emitEvent('assistant.message', { content: 'Hello!' });
      emitEvent('session.idle');
      await handle.done;

      const deltas = events.filter((e) => e.type === 'text_delta');
      expect(deltas).toHaveLength(3); // 2 deltas + 1 final message
      if (deltas[0]?.type === 'text_delta') {
        expect(deltas[0].text).toBe('Hel');
      }
      if (deltas[1]?.type === 'text_delta') {
        expect(deltas[1].text).toBe('lo!');
      }
    });

    it('normalizes reasoning events to thinking', async () => {
      const adapter = new CopilotSdkAdapter();
      const events: AgentEvent[] = [];

      const handle = await adapter.startSession(
        { sessionId: 'test-reason', prompt: 'think', cwd: '/tmp' },
        (event) => events.push(event),
      );

      emitEvent('assistant.reasoning_delta', { deltaContent: 'Let me think...' });
      emitEvent('assistant.reasoning', { content: 'Let me think about this carefully.' });
      emitEvent('session.idle');
      await handle.done;

      const thoughts = events.filter((e) => e.type === 'thinking');
      expect(thoughts).toHaveLength(2);
      if (thoughts[0]?.type === 'thinking') {
        expect(thoughts[0].text).toBe('Let me think...');
      }
      if (thoughts[1]?.type === 'thinking') {
        expect(thoughts[1].text).toBe('Let me think about this carefully.');
      }
    });

    it('normalizes tool events', async () => {
      const adapter = new CopilotSdkAdapter();
      const events: AgentEvent[] = [];

      const handle = await adapter.startSession(
        { sessionId: 'test-tool', prompt: 'read file', cwd: '/tmp' },
        (event) => events.push(event),
      );

      emitEvent('tool.execution_start', {
        toolUseId: 'tool-001',
        toolName: 'ReadFile',
        input: { path: '/tmp/test.ts' },
      });

      emitEvent('tool.execution_complete', {
        toolUseId: 'tool-001',
        toolName: 'ReadFile',
        output: 'file contents here',
        isError: false,
      });

      emitEvent('session.idle');
      await handle.done;

      const calls = events.filter((e) => e.type === 'tool_call');
      expect(calls).toHaveLength(1);
      if (calls[0]?.type === 'tool_call') {
        expect(calls[0].toolUseId).toBe('tool-001');
        expect(calls[0].toolName).toBe('ReadFile');
        expect(calls[0].input).toEqual({ path: '/tmp/test.ts' });
      }

      const results = events.filter((e) => e.type === 'tool_result');
      expect(results).toHaveLength(1);
      if (results[0]?.type === 'tool_result') {
        expect(results[0].toolUseId).toBe('tool-001');
        expect(results[0].toolName).toBe('ReadFile');
        expect(results[0].output).toBe('file contents here');
        expect(results[0].isError).toBe(false);
      }
    });

    it('emits session_end with success on idle', async () => {
      const adapter = new CopilotSdkAdapter();
      const events: AgentEvent[] = [];

      const handle = await adapter.startSession(
        { sessionId: 'test-end', prompt: 'test', cwd: '/tmp' },
        (event) => events.push(event),
      );

      emitEvent('assistant.message', { content: 'Done!' });
      emitEvent('session.idle');
      await handle.done;

      const ends = events.filter((e) => e.type === 'session_end');
      expect(ends).toHaveLength(1);
      if (ends[0]?.type === 'session_end') {
        expect(ends[0].result).toBe('success');
        expect(ends[0].durationMs).toBeGreaterThanOrEqual(0);
      }
    });

    it('all events have correct sessionId', async () => {
      const adapter = new CopilotSdkAdapter();
      const events: AgentEvent[] = [];

      const handle = await adapter.startSession(
        { sessionId: 'test-ids', prompt: 'test', cwd: '/tmp' },
        (event) => events.push(event),
      );

      emitEvent('assistant.message_delta', { deltaContent: 'hi' });
      emitEvent('assistant.message', { content: 'hi' });
      emitEvent('tool.execution_start', {
        toolUseId: 'tool-x',
        toolName: 'Bash',
        input: { command: 'ls' },
      });
      emitEvent('tool.execution_complete', {
        toolUseId: 'tool-x',
        toolName: 'Bash',
        output: 'file1.ts',
        isError: false,
      });
      emitEvent('session.idle');
      await handle.done;

      for (const event of events) {
        expect(event.sessionId).toBe('test-ids');
      }
    });

    it('passes model config to createSession', async () => {
      const adapter = new CopilotSdkAdapter();
      const events: AgentEvent[] = [];

      const handle = await adapter.startSession(
        { sessionId: 'test-model', prompt: 'test', cwd: '/tmp', model: 'gpt-5' },
        (event) => events.push(event),
      );

      emitEvent('session.idle');
      await handle.done;

      const createCall = mockClient.createSession.mock.calls[0];
      expect(createCall?.[0]?.model).toBe('gpt-5');
    });
  });

  describe('session control', () => {
    it('interrupt calls session.abort()', async () => {
      const adapter = new CopilotSdkAdapter();
      const events: AgentEvent[] = [];

      const handle = await adapter.startSession(
        { sessionId: 'test-interrupt', prompt: 'test', cwd: '/tmp' },
        (event) => events.push(event),
      );

      handle.interrupt();
      expect(mockAbortCalled).toBe(true);

      // Simulate idle after abort to resolve done
      emitEvent('session.idle');
    });

    it('terminate calls session.destroy() and client.stop()', async () => {
      const adapter = new CopilotSdkAdapter();
      const events: AgentEvent[] = [];

      const handle = await adapter.startSession(
        { sessionId: 'test-terminate', prompt: 'test', cwd: '/tmp' },
        (event) => events.push(event),
      );

      handle.terminate();
      expect(mockDestroyCalled).toBe(true);

      emitEvent('session.idle');
    });

    it('kill calls client.forceStop()', async () => {
      const adapter = new CopilotSdkAdapter();
      const events: AgentEvent[] = [];

      const handle = await adapter.startSession(
        { sessionId: 'test-kill', prompt: 'test', cwd: '/tmp' },
        (event) => events.push(event),
      );

      handle.kill();
      expect(mockForceStopCalled).toBe(true);

      emitEvent('session.idle');
    });
  });

  describe('ignores unknown event types', () => {
    it('does not emit events for unknown types', async () => {
      const adapter = new CopilotSdkAdapter();
      const events: AgentEvent[] = [];

      const handle = await adapter.startSession(
        { sessionId: 'test-unknown', prompt: 'test', cwd: '/tmp' },
        (event) => events.push(event),
      );

      emitEvent('some.unknown.event', { foo: 'bar' });
      emitEvent('session.idle');
      await handle.done;

      // Should only have session_start + session_end (no events from unknown type)
      const types = events.map((e) => e.type);
      expect(types).toEqual(['session_start', 'session_end']);
    });
  });
});

describe('CopilotSdkAdapter + SessionManager integration', () => {
  it('registers and appears in adapter list', async () => {
    const { SessionManager } = await import('../../src/core/session-manager.js');
    const manager = new SessionManager();
    const adapter = new CopilotSdkAdapter();
    manager.registerAdapter(adapter);

    expect(manager.listAdapters()).toContain('copilot-sdk');
    const retrieved = manager.getAdapter('copilot-sdk');
    expect(retrieved).toBeDefined();
    expect(retrieved!.manifest.name).toBe('GitHub Copilot SDK');
  });

  it('routes events through EventBus', async () => {
    resetMocks();

    const { SessionManager } = await import('../../src/core/session-manager.js');
    const manager = new SessionManager();
    const adapter = new CopilotSdkAdapter();
    manager.registerAdapter(adapter);

    const busEvents: AgentEvent[] = [];
    manager.bus.onAll((event) => busEvents.push(event));

    const info = await manager.startSession('copilot-sdk', {
      prompt: 'hello',
      cwd: '/tmp',
    });

    // Simulate agent doing work
    emitEvent('assistant.message', { content: 'Done!' });
    emitEvent('session.idle');

    // Wait for completion
    const handle = (manager as any).handles.get(info.sessionId);
    await handle?.done;

    expect(busEvents.some((e) => e.type === 'session_start')).toBe(true);
    expect(busEvents.some((e) => e.type === 'text_delta')).toBe(true);
    expect(busEvents.some((e) => e.type === 'session_end')).toBe(true);

    const session = manager.getSession(info.sessionId);
    expect(session).toBeDefined();
    expect(session!.status).toBe('completed');
  });
});
