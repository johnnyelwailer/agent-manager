// Tests for ClaudeCliAdapter — validates NDJSON normalization without needing
// a real `claude` binary. We mock the child process with a helper that writes
// NDJSON to stdout.

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ClaudeCliAdapter } from './claude-cli.ts';
import type { AgentEvent } from '../types/events.ts';

// ---------------------------------------------------------------------------
// Helper: Create a fake "claude" script that emits canned NDJSON
// ---------------------------------------------------------------------------

function createFakeClaude(lines: object[]): string {
  const dir = join(tmpdir(), `claude-test-${Date.now()}`);
  mkdirSync(dir, { recursive: true });

  const ndjson = lines.map((l) => JSON.stringify(l)).join('\n');
  const scriptPath = join(dir, 'claude');

  // Shell script that ignores all args and just emits the NDJSON
  writeFileSync(
    scriptPath,
    `#!/bin/sh\ncat <<'NDJSON_EOF'\n${ndjson}\nNDJSON_EOF\n`,
    { mode: 0o755 },
  );

  return scriptPath;
}

// ---------------------------------------------------------------------------
// Test data: realistic stream-json messages
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
  let scriptPath: string;

  describe('normalizes a full session', () => {
    const events: AgentEvent[] = [];
    let sessionDone: Promise<void>;

    before(async () => {
      scriptPath = createFakeClaude([
        INIT_MESSAGE,
        ASSISTANT_TEXT,
        ASSISTANT_TOOL_USE,
        USER_TOOL_RESULT,
        ASSISTANT_THINKING,
        RESULT_SUCCESS,
      ]);

      const adapter = new ClaudeCliAdapter({ claudeBinary: scriptPath });
      const handle = await adapter.startSession(
        {
          sessionId: MOCK_SESSION_ID,
          prompt: 'fix the auth bug',
          cwd: '/tmp',
        },
        (event) => events.push(event),
      );
      sessionDone = handle.done;
      await sessionDone;
    });

    after(() => {
      rmSync(scriptPath.replace(/\/claude$/, ''), { recursive: true, force: true });
    });

    it('emits session_start as the first event', () => {
      const start = events.find((e) => e.type === 'session_start');
      assert.ok(start, 'should have a session_start event');
      assert.equal(start.sessionId, MOCK_SESSION_ID);
    });

    it('emits text_delta for text blocks', () => {
      const texts = events.filter((e) => e.type === 'text_delta');
      assert.ok(texts.length >= 1, 'should have text_delta events');
      const first = texts[0];
      assert.equal(first.type, 'text_delta');
      if (first.type === 'text_delta') {
        assert.equal(first.text, "I'll fix the bug in auth.ts.");
      }
    });

    it('emits tool_call for tool_use blocks', () => {
      const calls = events.filter((e) => e.type === 'tool_call');
      assert.equal(calls.length, 1, 'should have exactly one tool_call');
      const call = calls[0];
      if (call.type === 'tool_call') {
        assert.equal(call.toolName, 'Read');
        assert.equal(call.toolUseId, 'tool_001');
        assert.deepEqual(call.input, { file_path: '/home/user/project/src/auth.ts' });
      }
    });

    it('emits tool_result for tool result blocks', () => {
      const results = events.filter((e) => e.type === 'tool_result');
      assert.ok(results.length >= 1, 'should have tool_result events');
      const result = results[0];
      if (result.type === 'tool_result') {
        assert.equal(result.toolUseId, 'tool_001');
        assert.equal(result.isError, false);
        assert.ok(result.output.includes('login'));
      }
    });

    it('emits thinking for thinking blocks', () => {
      const thoughts = events.filter((e) => e.type === 'thinking');
      assert.equal(thoughts.length, 1);
      if (thoughts[0].type === 'thinking') {
        assert.ok(thoughts[0].text.includes('error handling'));
      }
    });

    it('emits session_end with cost and token data', () => {
      const ends = events.filter((e) => e.type === 'session_end');
      assert.equal(ends.length, 1, 'should have exactly one session_end');
      const end = ends[0];
      if (end.type === 'session_end') {
        assert.equal(end.result, 'success');
        assert.equal(end.costUsd, 0.0042);
        assert.equal(end.tokensIn, 4200);
        assert.equal(end.tokensOut, 830);
        assert.equal(end.durationMs, 15230);
      }
    });

    it('all events have the correct sessionId', () => {
      for (const event of events) {
        assert.equal(event.sessionId, MOCK_SESSION_ID);
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

      try {
        const adapter = new ClaudeCliAdapter({ claudeBinary: path });
        const handle = await adapter.startSession(
          { sessionId: 'budget-test', prompt: 'test', cwd: '/tmp' },
          (event) => events.push(event),
        );
        await handle.done;
      } finally {
        rmSync(path.replace(/\/claude$/, ''), { recursive: true, force: true });
      }

      const end = events.find((e) => e.type === 'session_end');
      assert.ok(end);
      if (end?.type === 'session_end') {
        assert.equal(end.result, 'budget_exceeded');
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

      try {
        const adapter = new ClaudeCliAdapter({ claudeBinary: path });
        const handle = await adapter.startSession(
          { sessionId: 'turns-test', prompt: 'test', cwd: '/tmp' },
          (event) => events.push(event),
        );
        await handle.done;
      } finally {
        rmSync(path.replace(/\/claude$/, ''), { recursive: true, force: true });
      }

      const end = events.find((e) => e.type === 'session_end');
      assert.ok(end);
      if (end?.type === 'session_end') {
        assert.equal(end.result, 'max_turns');
      }
    });
  });
});

describe('EventBus integration', () => {
  it('routes events from SessionManager', async () => {
    // This test validates the full flow: adapter → session manager → event bus
    const { SessionManager } = await import('../core/session-manager.ts');

    const path = createFakeClaude([
      INIT_MESSAGE,
      ASSISTANT_TEXT,
      RESULT_SUCCESS,
    ]);

    const busEvents: AgentEvent[] = [];

    try {
      const manager = new SessionManager();
      const adapter = new ClaudeCliAdapter({ claudeBinary: path });
      manager.registerAdapter(adapter);

      // Subscribe to all events on the bus
      manager.bus.onAll((event) => busEvents.push(event));

      const info = await manager.startSession('claude-cli', {
        prompt: 'hello',
        cwd: '/tmp',
      });

      // Wait for completion
      const handle = manager['handles'].get(info.sessionId);
      await handle?.done;

      // Verify events flowed through the bus
      assert.ok(busEvents.length >= 3, `expected >= 3 events, got ${busEvents.length}`);
      assert.ok(busEvents.some((e) => e.type === 'session_start'));
      assert.ok(busEvents.some((e) => e.type === 'text_delta'));
      assert.ok(busEvents.some((e) => e.type === 'session_end'));

      // Verify session info was updated
      const session = manager.getSession(info.sessionId);
      assert.ok(session);
      assert.equal(session.status, 'completed');
      assert.equal(session.costUsd, 0.0042);
    } finally {
      rmSync(path.replace(/\/claude$/, ''), { recursive: true, force: true });
    }
  });
});
