// Public API — everything consumers need to orchestrate agents.

// Core
export { EventBus } from './core/event-bus.ts';
export { ProcessManager } from './core/process-manager.ts';
export { SessionManager } from './core/session-manager.ts';
export type { SessionInfo } from './core/session-manager.ts';

// Adapters
export { ClaudeCliAdapter } from './adapters/claude-cli.ts';
export type { Adapter, AdapterManifest, SessionConfig, SessionHandle } from './adapters/adapter.ts';

// Types
export type {
  AgentEvent,
  AgentSessionStart,
  AgentSessionEnd,
  AgentTextDelta,
  AgentThinking,
  AgentToolCall,
  AgentToolResult,
  AgentError,
  AgentCostUpdate,
  AgentSubagentStart,
  AgentSubagentEnd,
} from './types/events.ts';
