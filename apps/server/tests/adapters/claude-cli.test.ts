import { describe, it, expect, afterEach } from 'bun:test';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ClaudeCliAdapter } from '../../src/adapters/claude-cli.js';
import { SessionManager } from '../../src/core/session-manager.js';
import type { AgentEvent } from '@agent-manager/shared';

// ---------------------------------------------------------------------------
// Helper: Create a fake "claude" script that emits canned NDJSON
// ---------------------------------------------------------------------------

const tempDirs: string[] = [];

function createFakeClaude(lines: object[]): string {
  const dir = join(tmpdir(), `claude-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);

  const ndjson = lines.map((l) => JSON.stringify(l)).join('\n');
  const scriptPath = join(dir, 'claude');

  writeFileSync(
    scriptPath,
    `#!/bin/sh\ncat <<'NDJSON_EOF'\n${ndjson}\nNDJSON_EOF\n`,
    { mode: 0o755 },
  );

  return scriptPath;
}

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs.length = 0;
});

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const MOCK_SESSION_ID = 'test-sess-001';

const INIT_MESSAGE = {
  type: 'system',
  subtype: 'init',
  session_id: 'claude-session-abc',
  tools: ['Read', 'Edit', 'Bash', 'Grep', 'Glob'],
  model: 'claude-sonnet-4-5-20250929',
  cwd: '/home/user/project',
};

const ASSISTANT_TEXT = {
  type: 'assistant',
  message: {
    id: 'msg_001',
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text: "I'll fix the bug in auth.ts." }],
    model: 'claude-sonnet-4-5-20250929',
    stop_reason: null,
  },
  session_id: 'claude-session-abc',
};

const ASSISTANT_TOOL_USE = {
  type: 'assistant',
  message: {
    id: 'msg_002',
    type: 'message',
    role: 'assistant',
    content: [
      { type: 'text', text: 'Let me read the file first.' },
      {
        type: 'tool_use',
        id: 'tool_001',
        name: 'Read',
        input: { file_path: '/home/user/project/src/auth.ts' },
      },
    ],
    model: 'claude-sonnet-4-5-20250929',
    stop_reason: 'tool_use',
  },
  session_id: 'claude-session-abc',
};

const USER_TOOL_RESULT = {
  type: 'user',
  message: {
    role: 'user',
    content: [
      {
        type: 'tool_result',
        tool_use_id: 'tool_001',
        content: 'export function login() { /* ... */ }',
        is_error: false,
      },
    ],
  },
  session_id: 'claude-session-abc',
};

const ASSISTANT_THINKING = {
  type: 'assistant',
  message: {
    id: 'msg_003',
    type: 'message',
    role: 'assistant',
    content: [
      { type: 'thinking', thinking: 'The login function is missing error handling.' },
      { type: 'text', text: 'I see the issue.' },
    ],
    model: 'claude-sonnet-4-5-20250929',
    stop_reason: null,
  },
  session_id: 'claude-session-abc',
};

const RESULT_SUCCESS = {
  type: 'result',
  subtype: 'success',
  cost_usd: 0.0042,
  total_cost_usd: 0.0042,
  duration_ms: 15230,
  duration_api_ms: 12100,
  is_error: false,
  num_turns: 3,
  session_id: 'claude-session-abc',
  usage: { input_tokens: 4200, output_tokens: 830 },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ClaudeCliAdapter', () => {
  describe('normalizes a full session', () => {
    it('produces correct event sequence', async () => {
      const scriptPath = createFakeClaude([
        INIT_MESSAGE,
        ASSISTANT_TEXT,
        ASSISTANT_TOOL_USE,
        USER_TOOL_RESULT,
        ASSISTANT_THINKING,
        RESULT_SUCCESS,
      ]);

      const events: AgentEvent[] = [];
      const adapter = new ClaudeCliAdapter({ claudeBinary: scriptPath });
      const handle = await adapter.startSession(
        { sessionId: MOCK_SESSION_ID, prompt: 'fix the auth bug', cwd: '/tmp' },
        (event) => events.push(event),
      );
      await handle.done;

      // session_start emitted first
      const start = events.find((e) => e.type === 'session_start');
      expect(start).toBeDefined();
      expect(start!.sessionId).toBe(MOCK_SESSION_ID);

      // text_delta events
      const texts = events.filter((e) => e.type === 'text_delta');
      expect(texts.length).toBeGreaterThanOrEqual(1);
      const firstText = texts[0]!;
      expect(firstText.type).toBe('text_delta');
      if (firstText.type === 'text_delta') {
        expect(firstText.text).toBe("I'll fix the bug in auth.ts.");
      }

      // tool_call events
      const calls = events.filter((e) => e.type === 'tool_call');
      expect(calls).toHaveLength(1);
      if (calls[0]!.type === 'tool_call') {
        expect(calls[0]!.toolName).toBe('Read');
        expect(calls[0]!.toolUseId).toBe('tool_001');
      }

      // tool_result events
      const results = events.filter((e) => e.type === 'tool_result');
      expect(results.length).toBeGreaterThanOrEqual(1);
      if (results[0]!.type === 'tool_result') {
        expect(results[0]!.toolUseId).toBe('tool_001');
        expect(results[0]!.isError).toBe(false);
      }

      // thinking events
      const thoughts = events.filter((e) => e.type === 'thinking');
      expect(thoughts).toHaveLength(1);
      if (thoughts[0]!.type === 'thinking') {
        expect(thoughts[0]!.text).toContain('error handling');
      }

      // session_end
      const ends = events.filter((e) => e.type === 'session_end');
      expect(ends).toHaveLength(1);
      if (ends[0]!.type === 'session_end') {
        expect(ends[0]!.result).toBe('success');
        expect(ends[0]!.costUsd).toBe(0.0042);
        expect(ends[0]!.tokensIn).toBe(4200);
        expect(ends[0]!.tokensOut).toBe(830);
        expect(ends[0]!.durationMs).toBe(15230);
      }

      // all events have correct sessionId
      for (const event of events) {
        expect(event.sessionId).toBe(MOCK_SESSION_ID);
      }
    });
  });

  describe('handles error results', () => {
    it('maps budget exceeded correctly', async () => {
      const budgetResult = {
        ...RESULT_SUCCESS,
        subtype: 'error_max_budget_usd',
        is_error: true,
      };

      const path = createFakeClaude([INIT_MESSAGE, budgetResult]);
      const events: AgentEvent[] = [];
      const adapter = new ClaudeCliAdapter({ claudeBinary: path });
      const handle = await adapter.startSession(
        { sessionId: 'budget-test', prompt: 'test', cwd: '/tmp' },
        (event) => events.push(event),
      );
      await handle.done;

      const end = events.find((e) => e.type === 'session_end');
      expect(end).toBeDefined();
      if (end?.type === 'session_end') {
        expect(end.result).toBe('budget_exceeded');
      }
    });

    it('maps max turns correctly', async () => {
      const turnsResult = {
        ...RESULT_SUCCESS,
        subtype: 'error_max_turns',
        is_error: true,
      };

      const path = createFakeClaude([INIT_MESSAGE, turnsResult]);
      const events: AgentEvent[] = [];
      const adapter = new ClaudeCliAdapter({ claudeBinary: path });
      const handle = await adapter.startSession(
        { sessionId: 'turns-test', prompt: 'test', cwd: '/tmp' },
        (event) => events.push(event),
      );
      await handle.done;

      const end = events.find((e) => e.type === 'session_end');
      expect(end).toBeDefined();
      if (end?.type === 'session_end') {
        expect(end.result).toBe('max_turns');
      }
    });
  });
});

describe('EventBus integration', () => {
  it('routes events from SessionManager through the bus', async () => {
    const path = createFakeClaude([
      INIT_MESSAGE,
      ASSISTANT_TEXT,
      RESULT_SUCCESS,
    ]);

    const busEvents: AgentEvent[] = [];
    const manager = new SessionManager();
    const adapter = new ClaudeCliAdapter({ claudeBinary: path });
    manager.registerAdapter(adapter);

    manager.bus.onAll((event) => busEvents.push(event));

    const info = await manager.startSession('claude-cli', {
      prompt: 'hello',
      cwd: '/tmp',
    });

    // Access private handle for awaiting completion
    const handle = (manager as any).handles.get(info.sessionId);
    await handle?.done;

    expect(busEvents.length).toBeGreaterThanOrEqual(3);
    expect(busEvents.some((e) => e.type === 'session_start')).toBe(true);
    expect(busEvents.some((e) => e.type === 'text_delta')).toBe(true);
    expect(busEvents.some((e) => e.type === 'session_end')).toBe(true);

    const session = manager.getSession(info.sessionId);
    expect(session).toBeDefined();
    expect(session!.status).toBe('completed');
    expect(session!.costUsd).toBe(0.0042);
  });
});
