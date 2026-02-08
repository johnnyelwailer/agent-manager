// Engine types — mirrors the server's AgentEvent types so the frontend can
// consume them without importing from the engine package directly.
//
// These MUST stay in sync with src/types/events.ts in the engine.

// ---------------------------------------------------------------------------
// Agent Events
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
  id: string;
  sessionId: string;
  timestamp: string;
}

export interface AgentSessionStart extends BaseEvent {
  type: 'session_start';
  model: string;
  cwd: string;
}

export interface AgentSessionEnd extends BaseEvent {
  type: 'session_end';
  result: 'success' | 'error' | 'interrupted' | 'budget_exceeded' | 'max_turns';
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

// ---------------------------------------------------------------------------
// Session Info (from REST API)
// ---------------------------------------------------------------------------

export interface SessionInfo {
  sessionId: string;
  adapterId: string;
  prompt: string;
  cwd: string;
  model?: string;
  status: 'starting' | 'running' | 'completed' | 'failed' | 'interrupted';
  startedAt: string;
  endedAt?: string;
  costUsd: number;
  tokensIn: number;
  tokensOut: number;
  events?: AgentEvent[];
  eventCount?: number;
}

// ---------------------------------------------------------------------------
// Adapter Info (from REST API)
// ---------------------------------------------------------------------------

export interface AdapterManifest {
  id: string;
  name: string;
  version: string;
  runtime: string;
}

// ---------------------------------------------------------------------------
// Start Session Request
// ---------------------------------------------------------------------------

export interface StartSessionRequest {
  adapterId: string;
  prompt: string;
  cwd: string;
  model?: string;
  maxBudgetUsd?: number;
  allowedTools?: string[];
  disallowedTools?: string[];
  permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan';
  resumeSessionId?: string;
}

// ---------------------------------------------------------------------------
// WebSocket Commands
// ---------------------------------------------------------------------------

export type WsCommand =
  | { type: 'subscribe'; scope: 'all' }
  | { type: 'subscribe'; scope: 'session'; sessionId: string }
  | { type: 'unsubscribe'; scope: 'all' }
  | { type: 'unsubscribe'; scope: 'session'; sessionId: string };

// ---------------------------------------------------------------------------
// Connection Status
// ---------------------------------------------------------------------------

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
