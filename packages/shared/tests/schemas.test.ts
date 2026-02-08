import { describe, it, expect } from 'bun:test';
import {
  agentEventSchema,
  sessionInfoSchema,
  sessionConfigSchema,
  startSessionBodySchema,
  adapterManifestSchema,
  claudeStreamMessageSchema,
} from '../src/index.js';

describe('agentEventSchema', () => {
  it('parses a valid session_start event', () => {
    const event = {
      id: '1', sessionId: 's1', timestamp: '2026-01-01T00:00:00Z',
      type: 'session_start', model: 'claude-sonnet', cwd: '/tmp',
    };
    const result = agentEventSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it('parses a valid session_end event', () => {
    const event = {
      id: '1', sessionId: 's1', timestamp: '2026-01-01T00:00:00Z',
      type: 'session_end', result: 'success', costUsd: 0.01,
      durationMs: 1000, tokensIn: 100, tokensOut: 50,
    };
    const result = agentEventSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it('parses a valid text_delta event', () => {
    const event = {
      id: '1', sessionId: 's1', timestamp: '2026-01-01T00:00:00Z',
      type: 'text_delta', text: 'hello world',
    };
    const result = agentEventSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it('parses a valid tool_call event', () => {
    const event = {
      id: '1', sessionId: 's1', timestamp: '2026-01-01T00:00:00Z',
      type: 'tool_call', toolUseId: 'tu1', toolName: 'Read',
      input: { file_path: '/tmp/file.ts' },
    };
    const result = agentEventSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it('parses a valid tool_result event', () => {
    const event = {
      id: '1', sessionId: 's1', timestamp: '2026-01-01T00:00:00Z',
      type: 'tool_result', toolUseId: 'tu1', toolName: 'Read',
      output: 'file contents', isError: false,
    };
    const result = agentEventSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it('parses a valid thinking event', () => {
    const event = {
      id: '1', sessionId: 's1', timestamp: '2026-01-01T00:00:00Z',
      type: 'thinking', text: 'analyzing the code...',
    };
    const result = agentEventSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it('parses a valid error event', () => {
    const event = {
      id: '1', sessionId: 's1', timestamp: '2026-01-01T00:00:00Z',
      type: 'error', message: 'something failed', code: 'ERR_001',
    };
    const result = agentEventSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it('parses error event without optional code', () => {
    const event = {
      id: '1', sessionId: 's1', timestamp: '2026-01-01T00:00:00Z',
      type: 'error', message: 'something failed',
    };
    const result = agentEventSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it('parses a valid cost_update event', () => {
    const event = {
      id: '1', sessionId: 's1', timestamp: '2026-01-01T00:00:00Z',
      type: 'cost_update', costUsd: 0.01, tokensIn: 500, tokensOut: 100,
    };
    const result = agentEventSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it('parses a valid subagent_start event', () => {
    const event = {
      id: '1', sessionId: 's1', timestamp: '2026-01-01T00:00:00Z',
      type: 'subagent_start', subagentSessionId: 'sub1', parentSessionId: 's1',
    };
    const result = agentEventSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it('parses a valid subagent_end event', () => {
    const event = {
      id: '1', sessionId: 's1', timestamp: '2026-01-01T00:00:00Z',
      type: 'subagent_end', subagentSessionId: 'sub1', parentSessionId: 's1',
      result: 'success', costUsd: 0.005,
    };
    const result = agentEventSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it('rejects unknown event types', () => {
    const event = {
      id: '1', sessionId: 's1', timestamp: '2026-01-01T00:00:00Z',
      type: 'unknown_type',
    };
    const result = agentEventSchema.safeParse(event);
    expect(result.success).toBe(false);
  });

  it('rejects events missing required fields', () => {
    const event = { type: 'session_start' };
    const result = agentEventSchema.safeParse(event);
    expect(result.success).toBe(false);
  });

  it('rejects invalid session_end result', () => {
    const event = {
      id: '1', sessionId: 's1', timestamp: '2026-01-01T00:00:00Z',
      type: 'session_end', result: 'unknown_result', costUsd: 0,
      durationMs: 0, tokensIn: 0, tokensOut: 0,
    };
    const result = agentEventSchema.safeParse(event);
    expect(result.success).toBe(false);
  });
});

describe('sessionConfigSchema', () => {
  it('parses a minimal config', () => {
    const config = { sessionId: 's1', prompt: 'do stuff', cwd: '/tmp' };
    const result = sessionConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it('parses a full config', () => {
    const config = {
      sessionId: 's1', prompt: 'do stuff', cwd: '/tmp',
      model: 'claude-sonnet', maxBudgetUsd: 1.0,
      allowedTools: ['Read', 'Edit'], disallowedTools: ['Bash'],
      permissionMode: 'acceptEdits' as const,
      resumeSessionId: 'prev-session',
      extra: { foo: 'bar' },
    };
    const result = sessionConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it('rejects invalid permission mode', () => {
    const config = {
      sessionId: 's1', prompt: 'do stuff', cwd: '/tmp',
      permissionMode: 'invalid',
    };
    const result = sessionConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });
});

describe('startSessionBodySchema', () => {
  it('parses valid start session body', () => {
    const body = { adapterId: 'claude-cli', prompt: 'test', cwd: '/tmp' };
    const result = startSessionBodySchema.safeParse(body);
    expect(result.success).toBe(true);
  });

  it('rejects missing adapterId', () => {
    const body = { prompt: 'test', cwd: '/tmp' };
    const result = startSessionBodySchema.safeParse(body);
    expect(result.success).toBe(false);
  });
});

describe('adapterManifestSchema', () => {
  it('parses a valid manifest', () => {
    const manifest = { id: 'test', name: 'Test', version: '1.0.0', runtime: 'test' };
    const result = adapterManifestSchema.safeParse(manifest);
    expect(result.success).toBe(true);
  });
});

describe('claudeStreamMessageSchema', () => {
  it('parses a system init message', () => {
    const msg = {
      type: 'system', subtype: 'init', session_id: 's1',
      tools: ['Read'], model: 'claude-sonnet',
    };
    const result = claudeStreamMessageSchema.safeParse(msg);
    expect(result.success).toBe(true);
  });

  it('parses a result message', () => {
    const msg = {
      type: 'result', subtype: 'success', cost_usd: 0.01,
      duration_ms: 1000, duration_api_ms: 800, is_error: false,
      num_turns: 2, session_id: 's1',
      usage: { input_tokens: 100, output_tokens: 50 },
    };
    const result = claudeStreamMessageSchema.safeParse(msg);
    expect(result.success).toBe(true);
  });

  it('parses an assistant message with tool_use', () => {
    const msg = {
      type: 'assistant',
      message: {
        id: 'msg_1', type: 'message', role: 'assistant',
        content: [
          { type: 'text', text: 'Let me read that file.' },
          { type: 'tool_use', id: 'tu_1', name: 'Read', input: { file_path: '/tmp/f.ts' } },
        ],
        model: 'claude-sonnet', stop_reason: 'tool_use',
      },
      session_id: 's1',
    };
    const result = claudeStreamMessageSchema.safeParse(msg);
    expect(result.success).toBe(true);
  });
});
