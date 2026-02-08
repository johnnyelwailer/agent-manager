import { z } from 'zod';
import { agentEventSchema } from './events.js';

// ---------------------------------------------------------------------------
// Adapter manifest
// ---------------------------------------------------------------------------

export const adapterManifestSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  runtime: z.string(),
});

export type AdapterManifest = z.infer<typeof adapterManifestSchema>;

// ---------------------------------------------------------------------------
// Session configuration (what the host passes when starting a session)
// ---------------------------------------------------------------------------

export const sessionConfigSchema = z.object({
  sessionId: z.string(),
  prompt: z.string(),
  cwd: z.string(),
  model: z.string().optional(),
  maxBudgetUsd: z.number().optional(),
  allowedTools: z.array(z.string()).optional(),
  disallowedTools: z.array(z.string()).optional(),
  permissionMode: z.enum(['default', 'acceptEdits', 'bypassPermissions', 'plan']).optional(),
  resumeSessionId: z.string().optional(),
  extra: z.record(z.unknown()).optional(),
});

export type SessionConfig = z.infer<typeof sessionConfigSchema>;

// ---------------------------------------------------------------------------
// Session status
// ---------------------------------------------------------------------------

export const sessionStatusSchema = z.enum([
  'starting',
  'running',
  'completed',
  'failed',
  'interrupted',
]);

export type SessionStatus = z.infer<typeof sessionStatusSchema>;

// ---------------------------------------------------------------------------
// Session info (runtime state of an agent execution)
// ---------------------------------------------------------------------------

export const sessionInfoSchema = z.object({
  sessionId: z.string(),
  adapterId: z.string(),
  prompt: z.string(),
  cwd: z.string(),
  model: z.string().optional(),
  status: sessionStatusSchema,
  startedAt: z.string(),
  endedAt: z.string().optional(),
  costUsd: z.number(),
  tokensIn: z.number(),
  tokensOut: z.number(),
  events: z.array(agentEventSchema),
});

export type SessionInfo = z.infer<typeof sessionInfoSchema>;

// ---------------------------------------------------------------------------
// Session summary (for list views — omits events)
// ---------------------------------------------------------------------------

export const sessionSummarySchema = sessionInfoSchema
  .omit({ events: true })
  .extend({ eventCount: z.number() });

export type SessionSummary = z.infer<typeof sessionSummarySchema>;

// ---------------------------------------------------------------------------
// Start session request body
// ---------------------------------------------------------------------------

export const startSessionBodySchema = z.object({
  adapterId: z.string(),
  prompt: z.string(),
  cwd: z.string(),
  model: z.string().optional(),
  maxBudgetUsd: z.number().optional(),
  allowedTools: z.array(z.string()).optional(),
  disallowedTools: z.array(z.string()).optional(),
  permissionMode: z.enum(['default', 'acceptEdits', 'bypassPermissions', 'plan']).optional(),
  resumeSessionId: z.string().optional(),
});

export type StartSessionBody = z.infer<typeof startSessionBodySchema>;
