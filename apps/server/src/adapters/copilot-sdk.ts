import { randomUUID } from 'node:crypto';
import type { Adapter, SessionHandle } from './adapter.js';
import type {
  AgentEvent,
  AdapterManifest,
  SessionConfig,
} from '@agent-manager/shared';

// ---------------------------------------------------------------------------
// Types for the @github/copilot-sdk package
//
// We declare minimal type interfaces rather than importing from the package
// directly so that TypeScript compilation doesn't require the package to be
// installed at type-check time.  The actual implementation uses dynamic
// import() at runtime.
// ---------------------------------------------------------------------------

interface CopilotClientOptions {
  cliPath?: string;
  port?: number;
  useStdio?: boolean;
  autoStart?: boolean;
  autoRestart?: boolean;
  githubToken?: string;
  useLoggedInUser?: boolean;
}

interface CopilotSessionConfig {
  model?: string;
  streaming?: boolean;
  reasoningEffort?: 'low' | 'medium' | 'high' | 'xhigh';
}

interface CopilotSessionEventData {
  type: string;
  data?: Record<string, unknown>;
}

interface CopilotSession {
  sessionId: string;
  send(options: { prompt: string }): Promise<string>;
  on(handler: (event: CopilotSessionEventData) => void): () => void;
  on(eventType: string, handler: (event: CopilotSessionEventData) => void): () => void;
  abort(): Promise<void>;
  destroy(): Promise<void>;
  getMessages(): Promise<unknown[]>;
}

interface CopilotClient {
  start(): Promise<void>;
  stop(): Promise<unknown[]>;
  forceStop(): Promise<void>;
  createSession(config?: CopilotSessionConfig): Promise<CopilotSession>;
}

interface CopilotClientConstructor {
  new (options?: CopilotClientOptions): CopilotClient;
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export interface CopilotSdkAdapterOptions {
  /** Path to the `copilot` CLI binary. Defaults to "copilot" (from PATH). */
  cliPath?: string;
  /** GitHub token for authentication. If omitted, uses logged-in user. */
  githubToken?: string;
  /** Whether to enable streaming deltas. Defaults to true. */
  streaming?: boolean;
}

export class CopilotSdkAdapter implements Adapter {
  readonly manifest: AdapterManifest = {
    id: 'copilot-sdk',
    name: 'GitHub Copilot SDK',
    version: '0.1.0',
    runtime: 'copilot',
  };

  private cliPath: string;
  private githubToken: string | undefined;
  private streaming: boolean;

  constructor(options?: CopilotSdkAdapterOptions) {
    this.cliPath = options?.cliPath ?? 'copilot';
    this.githubToken = options?.githubToken;
    this.streaming = options?.streaming ?? true;
  }

  async checkAvailability(): Promise<string | null> {
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execFileAsync = promisify(execFile);

    try {
      await execFileAsync(this.cliPath, ['--version']);
      return null;
    } catch {
      return `Copilot CLI not found at "${this.cliPath}". Install it via: npm install -g @github/copilot`;
    }
  }

  async startSession(
    config: SessionConfig,
    onEvent: (event: AgentEvent) => void,
  ): Promise<SessionHandle> {
    const sessionId = config.sessionId;
    const startTime = Date.now();

    // Dynamically import the SDK so the module can still be loaded even
    // when @github/copilot-sdk isn't installed (checkAvailability will
    // report the issue).
    const { CopilotClient } = await import('@github/copilot-sdk') as {
      CopilotClient: CopilotClientConstructor;
    };

    const client = new CopilotClient({
      cliPath: this.cliPath,
      useStdio: true,
      autoStart: true,
      autoRestart: false,
      ...(this.githubToken ? { githubToken: this.githubToken, useLoggedInUser: false } : { useLoggedInUser: true }),
    });

    let resolveSession: () => void;
    let rejectSession: (err: Error) => void;
    const done = new Promise<void>((resolve, reject) => {
      resolveSession = resolve;
      rejectSession = reject;
    });

    try {
      await client.start();
    } catch (err) {
      onEvent({
        id: randomUUID(),
        sessionId,
        timestamp: new Date().toISOString(),
        type: 'session_start',
        model: config.model ?? 'unknown',
        cwd: config.cwd,
      });
      onEvent({
        id: randomUUID(),
        sessionId,
        timestamp: new Date().toISOString(),
        type: 'error',
        message: `Failed to start Copilot client: ${err instanceof Error ? err.message : String(err)}`,
        code: 'client_start_error',
      });
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
      rejectSession!(new Error(`Failed to start Copilot client: ${err instanceof Error ? err.message : String(err)}`));
      return {
        sessionId,
        interrupt: () => {},
        terminate: () => {},
        kill: () => {},
        done,
      };
    }

    const sessionConfig: CopilotSessionConfig = {
      streaming: this.streaming,
    };

    if (config.model) {
      sessionConfig.model = config.model;
    }

    // Map permissionMode reasoning levels if provided via extra
    if (config.extra?.reasoningEffort) {
      sessionConfig.reasoningEffort = config.extra.reasoningEffort as CopilotSessionConfig['reasoningEffort'];
    }

    let copilotSession: CopilotSession;

    try {
      copilotSession = await client.createSession(sessionConfig);
    } catch (err) {
      onEvent({
        id: randomUUID(),
        sessionId,
        timestamp: new Date().toISOString(),
        type: 'session_start',
        model: config.model ?? 'unknown',
        cwd: config.cwd,
      });
      onEvent({
        id: randomUUID(),
        sessionId,
        timestamp: new Date().toISOString(),
        type: 'error',
        message: `Failed to create Copilot session: ${err instanceof Error ? err.message : String(err)}`,
        code: 'session_create_error',
      });
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
      await client.stop().catch(() => {});
      rejectSession!(new Error(`Failed to create Copilot session: ${err instanceof Error ? err.message : String(err)}`));
      return {
        sessionId,
        interrupt: () => {},
        terminate: () => {},
        kill: () => {},
        done,
      };
    }

    // Emit session_start
    onEvent({
      id: randomUUID(),
      sessionId,
      timestamp: new Date().toISOString(),
      type: 'session_start',
      model: config.model ?? 'copilot',
      cwd: config.cwd,
    });

    // Subscribe to all session events and normalize them
    let aborted = false;

    copilotSession.on((event: CopilotSessionEventData) => {
      const events = this.normalize(sessionId, event);
      for (const ev of events) {
        onEvent(ev);
      }

      // When the session goes idle after we've sent a prompt, that signals
      // the agent has finished its work.
      if (event.type === 'session.idle' && !aborted) {
        onEvent({
          id: randomUUID(),
          sessionId,
          timestamp: new Date().toISOString(),
          type: 'session_end',
          result: 'success',
          costUsd: 0,
          durationMs: Date.now() - startTime,
          tokensIn: 0,
          tokensOut: 0,
        });

        // Clean up in the background
        copilotSession.destroy().catch(() => {});
        client.stop().catch(() => {});
        resolveSession!();
      }
    });

    // Send the prompt (fire-and-forget; events arrive via the handler)
    copilotSession.send({ prompt: config.prompt }).catch((err) => {
      if (!aborted) {
        onEvent({
          id: randomUUID(),
          sessionId,
          timestamp: new Date().toISOString(),
          type: 'error',
          message: `Send failed: ${err instanceof Error ? err.message : String(err)}`,
          code: 'send_error',
        });
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
        copilotSession.destroy().catch(() => {});
        client.stop().catch(() => {});
        rejectSession!(new Error(`Send failed: ${err instanceof Error ? err.message : String(err)}`));
      }
    });

    const handle: SessionHandle = {
      sessionId,
      interrupt() {
        aborted = true;
        copilotSession.abort().catch(() => {});
      },
      terminate() {
        aborted = true;
        copilotSession.destroy().then(() => client.stop()).catch(() => {});
      },
      kill() {
        aborted = true;
        client.forceStop().catch(() => {});
      },
      done,
    };

    return handle;
  }

  // ---------------------------------------------------------------------------
  // Event normalization
  // ---------------------------------------------------------------------------

  private normalize(
    sessionId: string,
    event: CopilotSessionEventData,
  ): AgentEvent[] {
    const ts = new Date().toISOString();

    switch (event.type) {
      case 'assistant.message':
        return [{
          id: randomUUID(),
          sessionId,
          timestamp: ts,
          type: 'text_delta',
          text: String(event.data?.content ?? ''),
        }];

      case 'assistant.message_delta':
        return [{
          id: randomUUID(),
          sessionId,
          timestamp: ts,
          type: 'text_delta',
          text: String(event.data?.deltaContent ?? ''),
        }];

      case 'assistant.reasoning':
        return [{
          id: randomUUID(),
          sessionId,
          timestamp: ts,
          type: 'thinking',
          text: String(event.data?.content ?? ''),
        }];

      case 'assistant.reasoning_delta':
        return [{
          id: randomUUID(),
          sessionId,
          timestamp: ts,
          type: 'thinking',
          text: String(event.data?.deltaContent ?? ''),
        }];

      case 'tool.execution_start':
        return [{
          id: randomUUID(),
          sessionId,
          timestamp: ts,
          type: 'tool_call',
          toolUseId: String(event.data?.toolUseId ?? randomUUID()),
          toolName: String(event.data?.toolName ?? 'unknown'),
          input: (event.data?.input as Record<string, unknown>) ?? {},
        }];

      case 'tool.execution_complete':
        return [{
          id: randomUUID(),
          sessionId,
          timestamp: ts,
          type: 'tool_result',
          toolUseId: String(event.data?.toolUseId ?? ''),
          toolName: String(event.data?.toolName ?? ''),
          output: String(event.data?.output ?? ''),
          isError: Boolean(event.data?.isError),
        }];

      case 'user.message':
        // User messages are prompts we sent; no need to normalize
        return [];

      case 'session.idle':
        // Handled in the event handler above (triggers session_end)
        return [];

      default:
        return [];
    }
  }
}
