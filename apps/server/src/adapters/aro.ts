import { randomUUID } from 'node:crypto';
import type { AgentEvent, SessionConfig, AroSessionExtra } from '@agent-manager/shared';
import { aroSessionExtraSchema } from '@agent-manager/shared';
import type { Adapter, SessionHandle } from './adapter.js';

/**
 * AroAdapter — Autonomous Remote Orchestration adapter.
 *
 * Orchestrates a multi-agent DAG (Orchestrator → Security Auditor → Task
 * Executor / Visual Observer) to execute natural-language commands on remote
 * hosts via the ARO Host Daemon.
 *
 * This is the skeleton implementation. The full pipeline will be built in
 * subsequent phases.
 */
export class AroAdapter implements Adapter {
  readonly manifest = {
    id: 'aro',
    name: 'Autonomous Remote Orchestration',
    version: '0.1.0',
    runtime: 'aro-daemon',
  } as const;

  async startSession(
    config: SessionConfig,
    onEvent: (event: AgentEvent) => void,
  ): Promise<SessionHandle> {
    // Parse ARO-specific config from the generic extra field
    const aroExtra = aroSessionExtraSchema.parse(
      (config.extra as Record<string, unknown> | undefined)?.aro,
    );

    const sessionId = config.sessionId;
    const now = () => new Date().toISOString();

    // Emit session start
    onEvent({
      id: randomUUID(),
      sessionId,
      timestamp: now(),
      type: 'session_start',
      model: config.model ?? 'aro-orchestrator',
      cwd: config.cwd,
    });

    let aborted = false;

    // The execution pipeline will be implemented in Phase 3.
    // For now, emit a placeholder text delta indicating the adapter is loaded.
    const pipeline = (async () => {
      try {
        onEvent({
          id: randomUUID(),
          sessionId,
          timestamp: now(),
          type: 'text_delta',
          text: `[ARO] Connected to host "${aroExtra.hostId}" with policy "${aroExtra.securityPolicyId}". Pipeline not yet implemented.\n`,
        });

        // TODO Phase 3: Orchestrator → Security Auditor → Task Executor → Visual Observer

        if (!aborted) {
          onEvent({
            id: randomUUID(),
            sessionId,
            timestamp: now(),
            type: 'session_end',
            result: 'success',
            costUsd: 0,
            durationMs: 0,
            tokensIn: 0,
            tokensOut: 0,
          });
        }
      } catch (err) {
        onEvent({
          id: randomUUID(),
          sessionId,
          timestamp: now(),
          type: 'error',
          message: err instanceof Error ? err.message : String(err),
        });
        onEvent({
          id: randomUUID(),
          sessionId,
          timestamp: now(),
          type: 'session_end',
          result: 'error',
          costUsd: 0,
          durationMs: 0,
          tokensIn: 0,
          tokensOut: 0,
        });
      }
    })();

    const handle: SessionHandle = {
      sessionId,
      interrupt() {
        aborted = true;
      },
      terminate() {
        aborted = true;
      },
      kill() {
        aborted = true;
      },
      done: pipeline,
    };

    return handle;
  }

  async checkAvailability(): Promise<string | null> {
    // TODO: Verify at least one host daemon is reachable via the tunnel
    return null;
  }
}
