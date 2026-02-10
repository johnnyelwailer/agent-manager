import { z } from 'zod';

// ---------------------------------------------------------------------------
// HookContract — Lifecycle event handler
// ---------------------------------------------------------------------------

export const hookEventSchema = z.enum([
  'session_start',
  'session_end',
  'pre_tool_use',
  'post_tool_use',
  'pre_commit',
  'post_commit',
  'on_error',
  'custom',
]);

export const hookContractSchema = z.object({
  id: z.string(),
  event: hookEventSchema,
  name: z.string(),
  description: z.string().optional(),
  handler: z.string(),
  enabled: z.boolean().default(true),
  adapterId: z.string(),
  timeout: z.number().optional(),
  lastRunAt: z.string().optional(),
  lastRunResult: z.enum(['success', 'failure', 'timeout', 'skipped']).optional(),
  runCount: z.number().default(0),
  matchPattern: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HookEvent = z.infer<typeof hookEventSchema>;
export type HookContract = z.infer<typeof hookContractSchema>;
