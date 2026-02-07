// Raw message types emitted by `claude --output-format stream-json`.
// Each line of stdout is a JSON object matching one of these shapes.
// Reference: Claude Code CLI NDJSON streaming format.

// ---------------------------------------------------------------------------
// Top-level message envelope
// ---------------------------------------------------------------------------

export type ClaudeStreamMessage =
  | ClaudeSystemMessage
  | ClaudeAssistantMessage
  | ClaudeUserMessage
  | ClaudeResultMessage;

// ---------------------------------------------------------------------------
// System message (session init)
// ---------------------------------------------------------------------------

export interface ClaudeSystemMessage {
  type: 'system';
  subtype: 'init';
  session_id: string;
  tools: string[];
  model: string;
  cwd?: string;
}

// ---------------------------------------------------------------------------
// Assistant message (agent response — contains content blocks)
// ---------------------------------------------------------------------------

export interface ClaudeAssistantMessage {
  type: 'assistant';
  message: {
    id: string;
    type: 'message';
    role: 'assistant';
    content: ClaudeContentBlock[];
    model: string;
    stop_reason: string | null;
    usage?: { input_tokens: number; output_tokens: number };
  };
  session_id: string;
}

// ---------------------------------------------------------------------------
// User message (tool results fed back to the model)
// ---------------------------------------------------------------------------

export interface ClaudeUserMessage {
  type: 'user';
  message: {
    role: 'user';
    content: ClaudeContentBlock[];
  };
  session_id: string;
}

// ---------------------------------------------------------------------------
// Result message (terminal — session complete)
// ---------------------------------------------------------------------------

export interface ClaudeResultMessage {
  type: 'result';
  subtype: 'success' | 'error_max_turns' | 'error_during_execution' | 'error_max_budget_usd';
  cost_usd: number;
  duration_ms: number;
  duration_api_ms: number;
  is_error: boolean;
  num_turns: number;
  session_id: string;
  total_cost_usd?: number;
  usage?: { input_tokens: number; output_tokens: number };
}

// ---------------------------------------------------------------------------
// Content blocks (inside assistant/user messages)
// ---------------------------------------------------------------------------

export type ClaudeContentBlock =
  | ClaudeTextBlock
  | ClaudeThinkingBlock
  | ClaudeToolUseBlock
  | ClaudeToolResultBlock;

export interface ClaudeTextBlock {
  type: 'text';
  text: string;
}

export interface ClaudeThinkingBlock {
  type: 'thinking';
  thinking: string;
}

export interface ClaudeToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ClaudeToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error: boolean;
}
