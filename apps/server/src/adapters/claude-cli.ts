import { randomUUID } from 'node:crypto';
import { ProcessManager } from '../core/process-manager.js';
import type { Adapter, SessionHandle } from './adapter.js';
import {
  claudeStreamMessageSchema,
  type AgentEvent,
  type AdapterManifest,
  type SessionConfig,
  type ClaudeStreamMessage,
  type ClaudeAssistantMessage,
  type ClaudeUserMessage,
  type ClaudeContentBlock,
} from '@agent-manager/shared';

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
    let sessionStartEmitted = false;

    const managed = this.processManager.spawn({
      command: this.claudeBinary,
      args,
      cwd: config.cwd,
      onMessage: (raw) => {
        const parsed = claudeStreamMessageSchema.safeParse(raw);
        if (!parsed.success) {
          return;
        }
        const msg = parsed.data;

        // Emit session_start when we receive system.init (with real model/cwd)
        if (msg.type === 'system' && msg.subtype === 'init') {
          sessionStartEmitted = true;
          onEvent({
            id: randomUUID(),
            sessionId,
            timestamp: new Date().toISOString(),
            type: 'session_start',
            model: msg.model,
            cwd: msg.cwd ?? config.cwd,
          });
        }

        const events = this.normalize(sessionId, msg, startTime);
        for (const event of events) {
          onEvent(event);
        }
      },
      onStderr: (line) => {
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
        // If process dies before system.init, emit session_start with fallback values
        if (!sessionStartEmitted) {
          sessionStartEmitted = true;
          onEvent({
            id: randomUUID(),
            sessionId,
            timestamp: new Date().toISOString(),
            type: 'session_start',
            model: 'unknown',
            cwd: config.cwd,
          });
        }

        if (signal === 'SIGINT' || signal === 'SIGTERM') {
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
          resolveSession!();
        }
      },
    });

    return {
      sessionId,
      interrupt: () => managed.interrupt(),
      terminate: () => managed.terminate(),
      kill: () => managed.kill(),
      done,
    };
  }

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

  private normalize(
    sessionId: string,
    msg: ClaudeStreamMessage,
    _startTime: number,
  ): AgentEvent[] {
    const events: AgentEvent[] = [];
    const ts = new Date().toISOString();

    switch (msg.type) {
      case 'system':
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
      if (block.type === 'tool_result') {
        events.push({
          id: randomUUID(),
          sessionId,
          timestamp: ts,
          type: 'tool_result',
          toolUseId: block.tool_use_id,
          toolName: '',
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
