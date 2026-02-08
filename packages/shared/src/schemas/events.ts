import { z } from 'zod';

// ---------------------------------------------------------------------------
// Base event schema
// ---------------------------------------------------------------------------

const baseEventSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  timestamp: z.string(),
});

// ---------------------------------------------------------------------------
// Agent event schemas
// ---------------------------------------------------------------------------

export const agentSessionStartSchema = baseEventSchema.extend({
  type: z.literal('session_start'),
  model: z.string(),
  cwd: z.string(),
});

export const agentSessionEndSchema = baseEventSchema.extend({
  type: z.literal('session_end'),
  result: z.enum(['success', 'error', 'interrupted', 'budget_exceeded', 'max_turns']),
  costUsd: z.number(),
  durationMs: z.number(),
  tokensIn: z.number(),
  tokensOut: z.number(),
});

export const agentTextDeltaSchema = baseEventSchema.extend({
  type: z.literal('text_delta'),
  text: z.string(),
});

export const agentThinkingSchema = baseEventSchema.extend({
  type: z.literal('thinking'),
  text: z.string(),
});

export const agentToolCallSchema = baseEventSchema.extend({
  type: z.literal('tool_call'),
  toolUseId: z.string(),
  toolName: z.string(),
  input: z.record(z.unknown()),
});

export const agentToolResultSchema = baseEventSchema.extend({
  type: z.literal('tool_result'),
  toolUseId: z.string(),
  toolName: z.string(),
  output: z.string(),
  isError: z.boolean(),
});

export const agentErrorSchema = baseEventSchema.extend({
  type: z.literal('error'),
  message: z.string(),
  code: z.string().optional(),
});

export const agentCostUpdateSchema = baseEventSchema.extend({
  type: z.literal('cost_update'),
  costUsd: z.number(),
  tokensIn: z.number(),
  tokensOut: z.number(),
});

export const agentSubagentStartSchema = baseEventSchema.extend({
  type: z.literal('subagent_start'),
  subagentSessionId: z.string(),
  parentSessionId: z.string(),
});

export const agentSubagentEndSchema = baseEventSchema.extend({
  type: z.literal('subagent_end'),
  subagentSessionId: z.string(),
  parentSessionId: z.string(),
  result: z.enum(['success', 'error']),
  costUsd: z.number(),
});

// ---------------------------------------------------------------------------
// Discriminated union
// ---------------------------------------------------------------------------

export const agentEventSchema = z.discriminatedUnion('type', [
  agentSessionStartSchema,
  agentSessionEndSchema,
  agentTextDeltaSchema,
  agentThinkingSchema,
  agentToolCallSchema,
  agentToolResultSchema,
  agentErrorSchema,
  agentCostUpdateSchema,
  agentSubagentStartSchema,
  agentSubagentEndSchema,
]);

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type AgentEvent = z.infer<typeof agentEventSchema>;
export type AgentSessionStart = z.infer<typeof agentSessionStartSchema>;
export type AgentSessionEnd = z.infer<typeof agentSessionEndSchema>;
export type AgentTextDelta = z.infer<typeof agentTextDeltaSchema>;
export type AgentThinking = z.infer<typeof agentThinkingSchema>;
export type AgentToolCall = z.infer<typeof agentToolCallSchema>;
export type AgentToolResult = z.infer<typeof agentToolResultSchema>;
export type AgentError = z.infer<typeof agentErrorSchema>;
export type AgentCostUpdate = z.infer<typeof agentCostUpdateSchema>;
export type AgentSubagentStart = z.infer<typeof agentSubagentStartSchema>;
export type AgentSubagentEnd = z.infer<typeof agentSubagentEndSchema>;
