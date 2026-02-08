import type { AgentEvent, AdapterManifest, SessionConfig } from '@agent-manager/shared';

export interface SessionHandle {
  sessionId: string;
  interrupt(): void;
  terminate(): void;
  kill(): void;
  done: Promise<void>;
}

export interface Adapter {
  readonly manifest: AdapterManifest;

  startSession(
    config: SessionConfig,
    onEvent: (event: AgentEvent) => void,
  ): Promise<SessionHandle>;

  checkAvailability(): Promise<string | null>;
}
