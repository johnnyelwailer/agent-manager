import { z } from 'zod';

// ---------------------------------------------------------------------------
// Copilot SDK session event schemas
//
// These represent the events emitted by @github/copilot-sdk CopilotSession.
// The SDK communicates with the Copilot CLI server via JSON-RPC and surfaces
// events through typed handlers.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Assistant events
// ---------------------------------------------------------------------------

export const copilotAssistantMessageSchema = z.object({
  type: z.literal('assistant.message'),
  data: z.object({
    content: z.string(),
  }),
});

export const copilotAssistantMessageDeltaSchema = z.object({
  type: z.literal('assistant.message_delta'),
  data: z.object({
    deltaContent: z.string(),
  }),
});

export const copilotAssistantReasoningSchema = z.object({
  type: z.literal('assistant.reasoning'),
  data: z.object({
    content: z.string(),
  }),
});

export const copilotAssistantReasoningDeltaSchema = z.object({
  type: z.literal('assistant.reasoning_delta'),
  data: z.object({
    deltaContent: z.string(),
  }),
});

// ---------------------------------------------------------------------------
// Tool events
// ---------------------------------------------------------------------------

export const copilotToolExecutionStartSchema = z.object({
  type: z.literal('tool.execution_start'),
  data: z.object({
    toolUseId: z.string(),
    toolName: z.string(),
    input: z.record(z.unknown()),
  }),
});

export const copilotToolExecutionCompleteSchema = z.object({
  type: z.literal('tool.execution_complete'),
  data: z.object({
    toolUseId: z.string(),
    toolName: z.string(),
    output: z.string(),
    isError: z.boolean(),
  }),
});

// ---------------------------------------------------------------------------
// User events
// ---------------------------------------------------------------------------

export const copilotUserMessageSchema = z.object({
  type: z.literal('user.message'),
  data: z.object({
    content: z.string(),
  }),
});

// ---------------------------------------------------------------------------
// Session lifecycle events
// ---------------------------------------------------------------------------

export const copilotSessionIdleSchema = z.object({
  type: z.literal('session.idle'),
});

// ---------------------------------------------------------------------------
// Discriminated union of all Copilot SDK session events
// ---------------------------------------------------------------------------

export const copilotSessionEventSchema = z.discriminatedUnion('type', [
  copilotAssistantMessageSchema,
  copilotAssistantMessageDeltaSchema,
  copilotAssistantReasoningSchema,
  copilotAssistantReasoningDeltaSchema,
  copilotToolExecutionStartSchema,
  copilotToolExecutionCompleteSchema,
  copilotUserMessageSchema,
  copilotSessionIdleSchema,
]);

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type CopilotSessionEvent = z.infer<typeof copilotSessionEventSchema>;
export type CopilotAssistantMessage = z.infer<typeof copilotAssistantMessageSchema>;
export type CopilotAssistantMessageDelta = z.infer<typeof copilotAssistantMessageDeltaSchema>;
export type CopilotAssistantReasoning = z.infer<typeof copilotAssistantReasoningSchema>;
export type CopilotAssistantReasoningDelta = z.infer<typeof copilotAssistantReasoningDeltaSchema>;
export type CopilotToolExecutionStart = z.infer<typeof copilotToolExecutionStartSchema>;
export type CopilotToolExecutionComplete = z.infer<typeof copilotToolExecutionCompleteSchema>;
export type CopilotUserMessage = z.infer<typeof copilotUserMessageSchema>;
export type CopilotSessionIdle = z.infer<typeof copilotSessionIdleSchema>;
