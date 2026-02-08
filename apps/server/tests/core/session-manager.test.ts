import { describe, it, expect, afterEach } from 'bun:test';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { SessionManager } from '../../src/core/session-manager.js';
import { ClaudeCliAdapter } from '../../src/adapters/claude-cli.js';
import type { Adapter, SessionHandle } from '../../src/adapters/adapter.js';
import type { AgentEvent, AdapterManifest, SessionConfig } from '@agent-manager/shared';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const tempDirs: string[] = [];

function createFakeClaude(lines: object[], exitCode = 0): string {
  const dir = join(tmpdir(), `claude-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);

  const ndjson = lines.map((l) => JSON.stringify(l)).join('\n');
  const scriptPath = join(dir, 'claude');

  if (exitCode !== 0) {
    writeFileSync(
      scriptPath,
      `#!/bin/sh\ncat <<'NDJSON_EOF'\n${ndjson}\nNDJSON_EOF\nexit ${exitCode}\n`,
      { mode: 0o755 },
    );
  } else {
    writeFileSync(
      scriptPath,
      `#!/bin/sh\ncat <<'NDJSON_EOF'\n${ndjson}\nNDJSON_EOF\n`,
      { mode: 0o755 },
    );
  }

  return scriptPath;
}

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs.length = 0;
});

const INIT_MESSAGE = {
  type: 'system', subtype: 'init', session_id: 's1',
  tools: ['Read'], model: 'claude-sonnet-4-5-20250929', cwd: '/tmp',
};
const TEXT_MESSAGE = {
  type: 'assistant', message: {
    id: 'msg_1', type: 'message', role: 'assistant',
    content: [{ type: 'text', text: 'Hello' }],
    model: 'claude-sonnet-4-5-20250929', stop_reason: null,
  }, session_id: 's1',
};
const RESULT_SUCCESS = {
  type: 'result', subtype: 'success', cost_usd: 0.01, total_cost_usd: 0.01,
  duration_ms: 1000, duration_api_ms: 800, is_error: false, num_turns: 1,
  session_id: 's1', usage: { input_tokens: 100, output_tokens: 50 },
};

// ---------------------------------------------------------------------------
// Mock adapter for fast tests
// ---------------------------------------------------------------------------

class MockAdapter implements Adapter {
  readonly manifest: AdapterManifest = {
    id: 'mock', name: 'Mock', version: '1.0.0', runtime: 'mock',
  };

  async checkAvailability(): Promise<string | null> { return null; }

  async startSession(config: SessionConfig, onEvent: (event: AgentEvent) => void): Promise<SessionHandle> {
    const sessionId = config.sessionId;
    let resolveSession: () => void;
    const done = new Promise<void>((resolve) => { resolveSession = resolve; });

    onEvent({ id: randomUUID(), sessionId, timestamp: new Date().toISOString(), type: 'session_start', model: 'mock', cwd: config.cwd });

    setTimeout(() => {
      onEvent({ id: randomUUID(), sessionId, timestamp: new Date().toISOString(), type: 'session_end', result: 'success', costUsd: 0.005, durationMs: 50, tokensIn: 200, tokensOut: 50 });
      resolveSession!();
    }, 10);

    let interrupted = false;
    return {
      sessionId,
      interrupt() { interrupted = true; },
      terminate() {},
      kill() {},
      done,
    };
  }
}

// ---------------------------------------------------------------------------
// SessionManager tests
// ---------------------------------------------------------------------------

describe('SessionManager', () => {
  it('throws for unknown adapter', async () => {
    const manager = new SessionManager();
    await expect(
      manager.startSession('nonexistent', { prompt: 'test', cwd: '/tmp' }),
    ).rejects.toThrow('Adapter "nonexistent" not registered');
  });

  it('lists registered adapters', () => {
    const manager = new SessionManager();
    manager.registerAdapter(new MockAdapter());
    expect(manager.listAdapters()).toEqual(['mock']);
  });

  it('gets a registered adapter', () => {
    const manager = new SessionManager();
    const adapter = new MockAdapter();
    manager.registerAdapter(adapter);
    expect(manager.getAdapter('mock')).toBe(adapter);
    expect(manager.getAdapter('nonexistent')).toBeUndefined();
  });

  it('activeSessions returns only running sessions', async () => {
    const manager = new SessionManager();
    manager.registerAdapter(new MockAdapter());

    const info = await manager.startSession('mock', { prompt: 'test', cwd: '/tmp' });
    const active = manager.activeSessions();
    expect(active.length).toBeGreaterThanOrEqual(1);
    expect(active.some((s) => s.sessionId === info.sessionId)).toBe(true);

    // Wait for completion
    await new Promise((r) => setTimeout(r, 50));
    const activeAfter = manager.activeSessions();
    expect(activeAfter.some((s) => s.sessionId === info.sessionId)).toBe(false);
  });

  it('totalCost sums across sessions', async () => {
    const manager = new SessionManager();
    manager.registerAdapter(new MockAdapter());

    await manager.startSession('mock', { prompt: 'test1', cwd: '/tmp' });
    await manager.startSession('mock', { prompt: 'test2', cwd: '/tmp' });

    await new Promise((r) => setTimeout(r, 50));

    expect(manager.totalCost()).toBeCloseTo(0.01, 3);
  });

  it('session status transitions correctly', async () => {
    const manager = new SessionManager();
    manager.registerAdapter(new MockAdapter());

    const info = await manager.startSession('mock', { prompt: 'test', cwd: '/tmp' });
    // Should be running (session_start fires synchronously in mock)
    expect(info.status).toBe('running');

    await new Promise((r) => setTimeout(r, 50));
    const session = manager.getSession(info.sessionId);
    expect(session!.status).toBe('completed');
  });

  it('does not overwrite completed status (BUG-4 regression)', async () => {
    // Adapter that completes synchronously
    class InstantAdapter implements Adapter {
      readonly manifest: AdapterManifest = { id: 'instant', name: 'Instant', version: '1.0.0', runtime: 'instant' };
      async checkAvailability() { return null; }
      async startSession(config: SessionConfig, onEvent: (event: AgentEvent) => void): Promise<SessionHandle> {
        const sessionId = config.sessionId;
        onEvent({ id: randomUUID(), sessionId, timestamp: new Date().toISOString(), type: 'session_start', model: 'instant', cwd: config.cwd });
        onEvent({ id: randomUUID(), sessionId, timestamp: new Date().toISOString(), type: 'session_end', result: 'success', costUsd: 0, durationMs: 0, tokensIn: 0, tokensOut: 0 });
        return { sessionId, interrupt() {}, terminate() {}, kill() {}, done: Promise.resolve() };
      }
    }

    const manager = new SessionManager();
    manager.registerAdapter(new InstantAdapter());
    const info = await manager.startSession('instant', { prompt: 'fast', cwd: '/tmp' });

    // Status should be 'completed', NOT 'running'
    expect(info.status).toBe('completed');
  });

  describe('concurrent sessions', () => {
    it('isolates events between sessions', async () => {
      const manager = new SessionManager();
      manager.registerAdapter(new MockAdapter());

      const s1Events: AgentEvent[] = [];
      const s2Events: AgentEvent[] = [];

      manager.bus.on('', () => {}); // just to exercise

      const info1 = await manager.startSession('mock', { prompt: 'session1', cwd: '/tmp' });
      const info2 = await manager.startSession('mock', { prompt: 'session2', cwd: '/tmp' });

      manager.bus.on(info1.sessionId, (e) => s1Events.push(e));
      manager.bus.on(info2.sessionId, (e) => s2Events.push(e));

      await new Promise((r) => setTimeout(r, 50));

      // Each session should have received its own events
      const s1 = manager.getSession(info1.sessionId)!;
      const s2 = manager.getSession(info2.sessionId)!;
      expect(s1.events.every((e) => e.sessionId === info1.sessionId)).toBe(true);
      expect(s2.events.every((e) => e.sessionId === info2.sessionId)).toBe(true);
      expect(s1.status).toBe('completed');
      expect(s2.status).toBe('completed');
    });
  });
});

// ---------------------------------------------------------------------------
// ClaudeCliAdapter — buildArgs tests (GAP-5)
// ---------------------------------------------------------------------------

describe('ClaudeCliAdapter.buildArgs', () => {
  // Access private buildArgs via a wrapper
  function getArgs(config: SessionConfig): string[] {
    const adapter = new ClaudeCliAdapter();
    return (adapter as any).buildArgs(config);
  }

  it('includes basic -p and --output-format', () => {
    const args = getArgs({ sessionId: 's1', prompt: 'hello', cwd: '/tmp' });
    expect(args).toContain('-p');
    expect(args).toContain('hello');
    expect(args).toContain('--output-format');
    expect(args).toContain('stream-json');
  });

  it('includes --model when specified', () => {
    const args = getArgs({ sessionId: 's1', prompt: 'test', cwd: '/tmp', model: 'claude-opus' });
    expect(args).toContain('--model');
    expect(args).toContain('claude-opus');
  });

  it('includes --max-budget-usd when specified', () => {
    const args = getArgs({ sessionId: 's1', prompt: 'test', cwd: '/tmp', maxBudgetUsd: 5.0 });
    expect(args).toContain('--max-budget-usd');
    expect(args).toContain('5');
  });

  it('includes --allowedTools when specified', () => {
    const args = getArgs({ sessionId: 's1', prompt: 'test', cwd: '/tmp', allowedTools: ['Read', 'Edit'] });
    expect(args).toContain('--allowedTools');
    expect(args).toContain('Read,Edit');
  });

  it('includes --disallowedTools when specified', () => {
    const args = getArgs({ sessionId: 's1', prompt: 'test', cwd: '/tmp', disallowedTools: ['Bash'] });
    expect(args).toContain('--disallowedTools');
    expect(args).toContain('Bash');
  });

  it('includes --permission-mode when specified', () => {
    const args = getArgs({ sessionId: 's1', prompt: 'test', cwd: '/tmp', permissionMode: 'bypassPermissions' });
    expect(args).toContain('--permission-mode');
    expect(args).toContain('bypassPermissions');
  });

  it('includes --resume and --session-id when resumeSessionId specified', () => {
    const args = getArgs({ sessionId: 's1', prompt: 'test', cwd: '/tmp', resumeSessionId: 'prev-123' });
    expect(args).toContain('--resume');
    expect(args).toContain('--session-id');
    expect(args).toContain('prev-123');
  });

  it('omits optional flags when not specified', () => {
    const args = getArgs({ sessionId: 's1', prompt: 'test', cwd: '/tmp' });
    expect(args).not.toContain('--model');
    expect(args).not.toContain('--max-budget-usd');
    expect(args).not.toContain('--allowedTools');
    expect(args).not.toContain('--permission-mode');
    expect(args).not.toContain('--resume');
  });
});

// ---------------------------------------------------------------------------
// ClaudeCliAdapter — exit code handling (GAP-6)
// ---------------------------------------------------------------------------

describe('ClaudeCliAdapter exit handling', () => {
  it('emits session_end with error on non-zero exit code', async () => {
    const path = createFakeClaude([INIT_MESSAGE], 1);
    const events: AgentEvent[] = [];
    const adapter = new ClaudeCliAdapter({ claudeBinary: path });

    const handle = await adapter.startSession(
      { sessionId: 'exit-test', prompt: 'test', cwd: '/tmp' },
      (event) => events.push(event),
    );

    try {
      await handle.done;
    } catch {
      // Expected rejection
    }

    const end = events.find((e) => e.type === 'session_end');
    expect(end).toBeDefined();
    if (end?.type === 'session_end') {
      expect(end.result).toBe('error');
    }
  });

  it('emits session_start from system.init with correct model (BUG-6 regression)', async () => {
    const path = createFakeClaude([INIT_MESSAGE, RESULT_SUCCESS]);
    const events: AgentEvent[] = [];
    const adapter = new ClaudeCliAdapter({ claudeBinary: path });

    const handle = await adapter.startSession(
      { sessionId: 'model-test', prompt: 'test', cwd: '/tmp' },
      (event) => events.push(event),
    );
    await handle.done;

    const start = events.find((e) => e.type === 'session_start');
    expect(start).toBeDefined();
    if (start?.type === 'session_start') {
      expect(start.model).toBe('claude-sonnet-4-5-20250929');
      expect(start.cwd).toBe('/tmp');
    }
  });

  it('emits fallback session_start if process dies before system.init', async () => {
    // Script that exits immediately without output
    const dir = join(tmpdir(), `claude-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(dir, { recursive: true });
    tempDirs.push(dir);
    const scriptPath = join(dir, 'claude');
    writeFileSync(scriptPath, '#!/bin/sh\nexit 1\n', { mode: 0o755 });

    const events: AgentEvent[] = [];
    const adapter = new ClaudeCliAdapter({ claudeBinary: scriptPath });

    const handle = await adapter.startSession(
      { sessionId: 'fallback-test', prompt: 'test', cwd: '/tmp' },
      (event) => events.push(event),
    );

    try { await handle.done; } catch {}

    const start = events.find((e) => e.type === 'session_start');
    expect(start).toBeDefined();
    if (start?.type === 'session_start') {
      expect(start.model).toBe('unknown');
    }
  });

  it('skips invalid JSON messages from CLI (TYPE_SAFETY-4 regression)', async () => {
    // Create a script that outputs a valid message then an invalid one
    const dir = join(tmpdir(), `claude-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(dir, { recursive: true });
    tempDirs.push(dir);
    const scriptPath = join(dir, 'claude');
    const lines = [
      JSON.stringify(INIT_MESSAGE),
      JSON.stringify({ type: 'unknown_future_type', data: 123 }),
      JSON.stringify(RESULT_SUCCESS),
    ].join('\n');
    writeFileSync(scriptPath, `#!/bin/sh\ncat <<'NDJSON_EOF'\n${lines}\nNDJSON_EOF\n`, { mode: 0o755 });

    const events: AgentEvent[] = [];
    const adapter = new ClaudeCliAdapter({ claudeBinary: scriptPath });

    const handle = await adapter.startSession(
      { sessionId: 'skip-test', prompt: 'test', cwd: '/tmp' },
      (event) => events.push(event),
    );
    await handle.done;

    // Should still get session_start and session_end, unknown message skipped
    expect(events.some((e) => e.type === 'session_start')).toBe(true);
    expect(events.some((e) => e.type === 'session_end')).toBe(true);
  });
});
