import { z } from 'zod';

// ---------------------------------------------------------------------------
// Content blocks (inside assistant/user messages)
// ---------------------------------------------------------------------------

export const claudeTextBlockSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
});

export const claudeThinkingBlockSchema = z.object({
  type: z.literal('thinking'),
  thinking: z.string(),
});

export const claudeToolUseBlockSchema = z.object({
  type: z.literal('tool_use'),
  id: z.string(),
  name: z.string(),
  input: z.record(z.unknown()),
});

export const claudeToolResultBlockSchema = z.object({
  type: z.literal('tool_result'),
  tool_use_id: z.string(),
  content: z.string(),
  is_error: z.boolean(),
});

export const claudeContentBlockSchema = z.discriminatedUnion('type', [
  claudeTextBlockSchema,
  claudeThinkingBlockSchema,
  claudeToolUseBlockSchema,
  claudeToolResultBlockSchema,
]);

export type ClaudeContentBlock = z.infer<typeof claudeContentBlockSchema>;

// ---------------------------------------------------------------------------
// Top-level message types
// ---------------------------------------------------------------------------

export const claudeSystemMessageSchema = z.object({
  type: z.literal('system'),
  subtype: z.literal('init'),
  session_id: z.string(),
  tools: z.array(z.string()),
  model: z.string(),
  cwd: z.string().optional(),
});

export const claudeAssistantMessageSchema = z.object({
  type: z.literal('assistant'),
  message: z.object({
    id: z.string(),
    type: z.literal('message'),
    role: z.literal('assistant'),
    content: z.array(claudeContentBlockSchema),
    model: z.string(),
    stop_reason: z.string().nullable(),
    usage: z.object({
      input_tokens: z.number(),
      output_tokens: z.number(),
    }).optional(),
  }),
  session_id: z.string(),
});

export const claudeUserMessageSchema = z.object({
  type: z.literal('user'),
  message: z.object({
    role: z.literal('user'),
    content: z.array(claudeContentBlockSchema),
  }),
  session_id: z.string(),
});

export const claudeResultMessageSchema = z.object({
  type: z.literal('result'),
  subtype: z.enum(['success', 'error_max_turns', 'error_during_execution', 'error_max_budget_usd']),
  cost_usd: z.number(),
  duration_ms: z.number(),
  duration_api_ms: z.number(),
  is_error: z.boolean(),
  num_turns: z.number(),
  session_id: z.string(),
  total_cost_usd: z.number().optional(),
  usage: z.object({
    input_tokens: z.number(),
    output_tokens: z.number(),
  }).optional(),
});

export const claudeStreamMessageSchema = z.discriminatedUnion('type', [
  claudeSystemMessageSchema,
  claudeAssistantMessageSchema,
  claudeUserMessageSchema,
  claudeResultMessageSchema,
]);

export type ClaudeStreamMessage = z.infer<typeof claudeStreamMessageSchema>;
export type ClaudeSystemMessage = z.infer<typeof claudeSystemMessageSchema>;
export type ClaudeAssistantMessage = z.infer<typeof claudeAssistantMessageSchema>;
export type ClaudeUserMessage = z.infer<typeof claudeUserMessageSchema>;
export type ClaudeResultMessage = z.infer<typeof claudeResultMessageSchema>;
