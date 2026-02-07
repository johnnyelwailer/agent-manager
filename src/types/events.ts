// Normalized agent events — the universal contract between adapters and the host.
// Every adapter (Claude CLI, GSD, MetaMorph, etc.) emits these events regardless
// of what the underlying runtime produces.

// ---------------------------------------------------------------------------
// Agent Events (emitted by adapters → consumed by host/UI)
// ---------------------------------------------------------------------------

export type AgentEvent =
  | AgentSessionStart
  | AgentSessionEnd
  | AgentTextDelta
  | AgentThinking
  | AgentToolCall
  | AgentToolResult
  | AgentError
  | AgentCostUpdate
  | AgentSubagentStart
  | AgentSubagentEnd;

interface BaseEvent {
  /** Unique event ID */
  id: string;
  /** Session this event belongs to */
  sessionId: string;
  /** ISO timestamp */
  timestamp: string;
}

export interface AgentSessionStart extends BaseEvent {
  type: 'session_start';
  model: string;
  /** The working directory for this session */
  cwd: string;
}

export interface AgentSessionEnd extends BaseEvent {
  type: 'session_end';
  result: 'success' | 'error' | 'interrupted' | 'budget_exceeded' | 'max_turns';
  /** Total cost for the session in USD */
  costUsd: number;
  durationMs: number;
  tokensIn: number;
  tokensOut: number;
}

export interface AgentTextDelta extends BaseEvent {
  type: 'text_delta';
  text: string;
}

export interface AgentThinking extends BaseEvent {
  type: 'thinking';
  text: string;
}

export interface AgentToolCall extends BaseEvent {
  type: 'tool_call';
  toolUseId: string;
  toolName: string;
  input: Record<string, unknown>;
}

export interface AgentToolResult extends BaseEvent {
  type: 'tool_result';
  toolUseId: string;
  toolName: string;
  output: string;
  isError: boolean;
}

export interface AgentError extends BaseEvent {
  type: 'error';
  message: string;
  code?: string;
}

export interface AgentCostUpdate extends BaseEvent {
  type: 'cost_update';
  costUsd: number;
  tokensIn: number;
  tokensOut: number;
}

export interface AgentSubagentStart extends BaseEvent {
  type: 'subagent_start';
  subagentSessionId: string;
  parentSessionId: string;
}

export interface AgentSubagentEnd extends BaseEvent {
  type: 'subagent_end';
  subagentSessionId: string;
  parentSessionId: string;
  result: 'success' | 'error';
  costUsd: number;
}
