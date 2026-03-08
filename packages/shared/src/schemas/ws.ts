import { z } from 'zod';

// ---------------------------------------------------------------------------
// WebSocket command schemas (client → server)
// ---------------------------------------------------------------------------

export const wsSubscribeAllSchema = z.object({
  type: z.literal('subscribe'),
  scope: z.literal('all'),
});

export const wsSubscribeSessionSchema = z.object({
  type: z.literal('subscribe'),
  scope: z.literal('session'),
  sessionId: z.string(),
});

export const wsUnsubscribeAllSchema = z.object({
  type: z.literal('unsubscribe'),
  scope: z.literal('all'),
});

export const wsUnsubscribeSessionSchema = z.object({
  type: z.literal('unsubscribe'),
  scope: z.literal('session'),
  sessionId: z.string(),
});

// ---------------------------------------------------------------------------
// ARO-specific commands (client → server)
// ---------------------------------------------------------------------------

export const wsSubscribeHostSchema = z.object({
  type: z.literal('subscribe_host'),
  hostId: z.string(),
});

export const wsApproveStepSchema = z.object({
  type: z.literal('approve_step'),
  sessionId: z.string(),
  stepId: z.string(),
  approved: z.boolean(),
});

export const wsRequestRoiSchema = z.object({
  type: z.literal('request_roi'),
  sessionId: z.string(),
  hostId: z.string(),
  selector: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Combined command union
// ---------------------------------------------------------------------------

export const wsCommandSchema = z.union([
  wsSubscribeAllSchema,
  wsSubscribeSessionSchema,
  wsUnsubscribeAllSchema,
  wsUnsubscribeSessionSchema,
  // ARO commands
  wsSubscribeHostSchema,
  wsApproveStepSchema,
  wsRequestRoiSchema,
]);

export type WsCommand = z.infer<typeof wsCommandSchema>;
export type WsSubscribeHost = z.infer<typeof wsSubscribeHostSchema>;
export type WsApproveStep = z.infer<typeof wsApproveStepSchema>;
export type WsRequestRoi = z.infer<typeof wsRequestRoiSchema>;
export type WsSubscribeAll = z.infer<typeof wsSubscribeAllSchema>;
export type WsSubscribeSession = z.infer<typeof wsSubscribeSessionSchema>;
export type WsUnsubscribeAll = z.infer<typeof wsUnsubscribeAllSchema>;
export type WsUnsubscribeSession = z.infer<typeof wsUnsubscribeSessionSchema>;

// ---------------------------------------------------------------------------
// WebSocket response schemas (server → client)
// ---------------------------------------------------------------------------

export const wsSubscribedSchema = z.object({
  type: z.literal('subscribed'),
  scope: z.enum(['all', 'session']),
  sessionId: z.string().optional(),
});

export const wsUnsubscribedSchema = z.object({
  type: z.literal('unsubscribed'),
  scope: z.enum(['all', 'session']),
  sessionId: z.string().optional(),
});

export const wsErrorSchema = z.object({
  type: z.literal('error'),
  message: z.string(),
});

export type WsSubscribed = z.infer<typeof wsSubscribedSchema>;
export type WsUnsubscribed = z.infer<typeof wsUnsubscribedSchema>;
export type WsError = z.infer<typeof wsErrorSchema>;
