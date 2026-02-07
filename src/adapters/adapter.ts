// The adapter interface. Every agent runtime (Claude CLI, GSD, MetaMorph, etc.)
// implements this contract. The host doesn't know or care what's underneath.

import type { AgentEvent } from '../types/events.ts';

// ---------------------------------------------------------------------------
// Adapter manifest — declares what the adapter can do
// ---------------------------------------------------------------------------

export interface AdapterManifest {
  /** Unique adapter ID (e.g. "claude-cli", "gsd", "metamorph") */
  id: string;
  /** Human-readable name */
  name: string;
  /** Adapter version */
  version: string;
  /** What command this adapter wraps (for display/debug) */
  runtime: string;
}

// ---------------------------------------------------------------------------
// Session configuration — what the host passes when starting a session
// ---------------------------------------------------------------------------

export interface SessionConfig {
  /** Unique session ID (host-assigned) */
  sessionId: string;
  /** The prompt / task for the agent */
  prompt: string;
  /** Working directory for the agent */
  cwd: string;
  /** Optional: model to use */
  model?: string;
  /** Optional: max budget in USD */
  maxBudgetUsd?: number;
  /** Optional: allowed tools whitelist */
  allowedTools?: string[];
  /** Optional: disallowed tools blacklist */
  disallowedTools?: string[];
  /** Optional: permission mode */
  permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan';
  /** Optional: resume a previous session */
  resumeSessionId?: string;
  /** Optional: additional CLI flags / adapter-specific config */
  extra?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Session handle — returned when a session is started
// ---------------------------------------------------------------------------

export interface SessionHandle {
  /** The session ID */
  sessionId: string;
  /** Send SIGINT to the agent (graceful interrupt) */
  interrupt(): void;
  /** Terminate the agent process */
  terminate(): void;
  /** Force kill */
  kill(): void;
  /** Promise that resolves when the session ends */
  done: Promise<void>;
}

// ---------------------------------------------------------------------------
// The Adapter interface
// ---------------------------------------------------------------------------

export interface Adapter {
  /** Adapter metadata */
  readonly manifest: AdapterManifest;

  /**
   * Start a new agent session. The adapter spawns the underlying process
   * and begins emitting AgentEvents via the onEvent callback.
   */
  startSession(
    config: SessionConfig,
    onEvent: (event: AgentEvent) => void,
  ): Promise<SessionHandle>;

  /**
   * Check if the adapter's runtime is available (e.g. `claude` binary exists).
   * Returns an error message if not available, or null if ready.
   */
  checkAvailability(): Promise<string | null>;
}
