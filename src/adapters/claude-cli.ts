// Claude CLI adapter. Spawns `claude -p <prompt> --output-format stream-json`
// as a child process, parses NDJSON from stdout, and normalizes each message
// into the AgentEvent schema.
//
// Supports subscription auth (the user's own `claude` binary handles auth).

import { randomUUID } from 'node:crypto';
import { ProcessManager } from '../core/process-manager.ts';
import type { Adapter, AdapterManifest, SessionConfig, SessionHandle } from './adapter.ts';
import type { AgentEvent } from '../types/events.ts';
import type {
  ClaudeStreamMessage,
  ClaudeAssistantMessage,
  ClaudeUserMessage,
  ClaudeContentBlock,
} from '../types/claude-cli.ts';

// ---------------------------------------------------------------------------
// Adapter implementation
// ---------------------------------------------------------------------------

export class ClaudeCliAdapter implements Adapter {
  readonly manifest: AdapterManifest = {
    id: 'claude-cli',
    name: 'Claude Code CLI',
    version: '0.1.0',
    runtime: 'claude',
  };

  private processManager: ProcessManager;
  private claudeBinary: string;

  constructor(options?: { claudeBinary?: string }) {
    this.processManager = new ProcessManager();
    this.claudeBinary = options?.claudeBinary ?? 'claude';
  }

  async checkAvailability(): Promise<string | null> {
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execFileAsync = promisify(execFile);

    try {
      await execFileAsync(this.claudeBinary, ['--version']);
      return null;
    } catch {
      return `Claude CLI not found at "${this.claudeBinary}". Install it or provide the path.`;
    }
  }

  async startSession(
    config: SessionConfig,
    onEvent: (event: AgentEvent) => void,
  ): Promise<SessionHandle> {
    const sessionId = config.sessionId;
    const args = this.buildArgs(config);

    let resolveSession: () => void;
    let rejectSession: (err: Error) => void;
    const done = new Promise<void>((resolve, reject) => {
      resolveSession = resolve;
      rejectSession = reject;
    });

    const startTime = Date.now();
    let model = 'unknown';
    let cwd = config.cwd;

    const managed = this.processManager.spawn({
      command: this.claudeBinary,
      args,
      cwd: config.cwd,
      onMessage: (raw) => {
        const msg = raw as ClaudeStreamMessage;
        const events = this.normalize(sessionId, msg, startTime);

        // Capture model and cwd from init message
        if (msg.type === 'system' && msg.subtype === 'init') {
          model = msg.model;
          if (msg.cwd) cwd = msg.cwd;
        }

        for (const event of events) {
          onEvent(event);
        }
      },
      onStderr: (line) => {
        // Stderr lines become error events (but many are just progress/debug info)
        if (line.trim()) {
          onEvent({
            id: randomUUID(),
            sessionId,
            timestamp: new Date().toISOString(),
            type: 'error',
            message: line,
            code: 'stderr',
          });
        }
      },
      onExit: (code, signal) => {
        if (signal === 'SIGINT' || signal === 'SIGTERM') {
          // Intentional interrupt — emit session_end with interrupted status
          onEvent({
            id: randomUUID(),
            sessionId,
            timestamp: new Date().toISOString(),
            type: 'session_end',
            result: 'interrupted',
            costUsd: 0,
            durationMs: Date.now() - startTime,
            tokensIn: 0,
            tokensOut: 0,
          });
          resolveSession!();
        } else if (code !== 0 && code !== null) {
          // Unexpected exit
          onEvent({
            id: randomUUID(),
            sessionId,
            timestamp: new Date().toISOString(),
            type: 'session_end',
            result: 'error',
            costUsd: 0,
            durationMs: Date.now() - startTime,
            tokensIn: 0,
            tokensOut: 0,
          });
          rejectSession!(new Error(`Claude process exited with code ${code}`));
        } else {
          // Normal exit (result message should have already been emitted)
          resolveSession!();
        }
      },
    });

    // Emit session_start immediately
    onEvent({
      id: randomUUID(),
      sessionId,
      timestamp: new Date().toISOString(),
      type: 'session_start',
      model,
      cwd,
    });

    return {
      sessionId,
      interrupt: () => managed.interrupt(),
      terminate: () => managed.terminate(),
      kill: () => managed.kill(),
      done,
    };
  }

  // -------------------------------------------------------------------------
  // CLI argument builder
  // -------------------------------------------------------------------------

  private buildArgs(config: SessionConfig): string[] {
    const args: string[] = [
      '-p', config.prompt,
      '--output-format', 'stream-json',
    ];

    if (config.model) {
      args.push('--model', config.model);
    }

    if (config.maxBudgetUsd !== undefined) {
      args.push('--max-budget-usd', String(config.maxBudgetUsd));
    }

    if (config.allowedTools?.length) {
      args.push('--allowedTools', config.allowedTools.join(','));
    }

    if (config.disallowedTools?.length) {
      args.push('--disallowedTools', config.disallowedTools.join(','));
    }

    if (config.permissionMode) {
      args.push('--permission-mode', config.permissionMode);
    }

    if (config.resumeSessionId) {
      args.push('--resume', '--session-id', config.resumeSessionId);
    }

    return args;
  }

  // -------------------------------------------------------------------------
  // Normalizer: Claude stream-json → AgentEvent[]
  // -------------------------------------------------------------------------

  private normalize(
    sessionId: string,
    msg: ClaudeStreamMessage,
    _startTime: number,
  ): AgentEvent[] {
    const events: AgentEvent[] = [];
    const ts = new Date().toISOString();

    switch (msg.type) {
      case 'system':
        // Init message — session_start was already emitted by startSession.
        // We could update it with model info, but for now we skip.
        break;

      case 'assistant':
        events.push(...this.normalizeAssistant(sessionId, msg, ts));
        break;

      case 'user':
        events.push(...this.normalizeUser(sessionId, msg, ts));
        break;

      case 'result':
        events.push({
          id: randomUUID(),
          sessionId,
          timestamp: ts,
          type: 'session_end',
          result: this.mapResultSubtype(msg.subtype),
          costUsd: msg.total_cost_usd ?? msg.cost_usd,
          durationMs: msg.duration_ms,
          tokensIn: msg.usage?.input_tokens ?? 0,
          tokensOut: msg.usage?.output_tokens ?? 0,
        });
        break;
    }

    return events;
  }

  private normalizeAssistant(
    sessionId: string,
    msg: ClaudeAssistantMessage,
    ts: string,
  ): AgentEvent[] {
    const events: AgentEvent[] = [];

    for (const block of msg.message.content) {
      events.push(...this.normalizeContentBlock(sessionId, block, ts));
    }

    return events;
  }

  private normalizeUser(
    sessionId: string,
    msg: ClaudeUserMessage,
    ts: string,
  ): AgentEvent[] {
    const events: AgentEvent[] = [];

    for (const block of msg.message.content) {
      // User messages contain tool_result blocks (agent fed tool output back)
      if (block.type === 'tool_result') {
        events.push({
          id: randomUUID(),
          sessionId,
          timestamp: ts,
          type: 'tool_result',
          toolUseId: block.tool_use_id,
          toolName: '', // tool name not in result block; consumer can correlate via toolUseId
          output: typeof block.content === 'string' ? block.content : JSON.stringify(block.content),
          isError: block.is_error,
        });
      }
    }

    return events;
  }

  private normalizeContentBlock(
    sessionId: string,
    block: ClaudeContentBlock,
    ts: string,
  ): AgentEvent[] {
    switch (block.type) {
      case 'text':
        return [{
          id: randomUUID(),
          sessionId,
          timestamp: ts,
          type: 'text_delta',
          text: block.text,
        }];

      case 'thinking':
        return [{
          id: randomUUID(),
          sessionId,
          timestamp: ts,
          type: 'thinking',
          text: block.thinking,
        }];

      case 'tool_use':
        return [{
          id: randomUUID(),
          sessionId,
          timestamp: ts,
          type: 'tool_call',
          toolUseId: block.id,
          toolName: block.name,
          input: block.input,
        }];

      case 'tool_result':
        return [{
          id: randomUUID(),
          sessionId,
          timestamp: ts,
          type: 'tool_result',
          toolUseId: block.tool_use_id,
          toolName: '',
          output: typeof block.content === 'string' ? block.content : JSON.stringify(block.content),
          isError: block.is_error,
        }];

      default:
        return [];
    }
  }

  private mapResultSubtype(
    subtype: string,
  ): 'success' | 'error' | 'interrupted' | 'budget_exceeded' | 'max_turns' {
    switch (subtype) {
      case 'success': return 'success';
      case 'error_max_turns': return 'max_turns';
      case 'error_max_budget_usd': return 'budget_exceeded';
      default: return 'error';
    }
  }
}
