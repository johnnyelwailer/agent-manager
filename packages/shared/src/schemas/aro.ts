import { z } from 'zod';

// ---------------------------------------------------------------------------
// Risk levels & security rules
// ---------------------------------------------------------------------------

export const aroRiskLevelSchema = z.enum(['low', 'medium', 'high', 'critical']);
export type AroRiskLevel = z.infer<typeof aroRiskLevelSchema>;

export const aroSecurityActionSchema = z.enum(['allow', 'block', 'require_approval']);
export type AroSecurityAction = z.infer<typeof aroSecurityActionSchema>;

export const aroSecurityRuleSchema = z.object({
  id: z.string(),
  pattern: z.string(),
  riskLevel: aroRiskLevelSchema,
  action: aroSecurityActionSchema,
  reason: z.string(),
});
export type AroSecurityRule = z.infer<typeof aroSecurityRuleSchema>;

// ---------------------------------------------------------------------------
// Security policy
// ---------------------------------------------------------------------------

export const aroSecurityPolicySchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  rules: z.array(aroSecurityRuleSchema),
  defaultRiskLevel: aroRiskLevelSchema,
  defaultAction: aroSecurityActionSchema,
  allowedPaths: z.array(z.string()),
  blockedCommands: z.array(z.string()),
  maxConcurrentCommands: z.number(),
  sessionTimeoutMs: z.number(),
});
export type AroSecurityPolicy = z.infer<typeof aroSecurityPolicySchema>;

// ---------------------------------------------------------------------------
// Security verdict (per plan step)
// ---------------------------------------------------------------------------

export const aroSecurityVerdictSchema = z.enum(['approved', 'blocked', 'needs_approval']);
export type AroSecurityVerdict = z.infer<typeof aroSecurityVerdictSchema>;

// ---------------------------------------------------------------------------
// Host connection
// ---------------------------------------------------------------------------

export const aroHostStatusSchema = z.enum(['online', 'offline', 'connecting', 'error']);
export type AroHostStatus = z.infer<typeof aroHostStatusSchema>;

export const aroHostOsSchema = z.enum(['linux', 'darwin', 'windows']);
export type AroHostOs = z.infer<typeof aroHostOsSchema>;

export const aroHostConnectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  hostname: z.string(),
  os: aroHostOsSchema,
  arch: z.string(),
  tailscaleIp: z.string().optional(),
  directAddress: z.string().optional(),
  daemonPort: z.number().default(9741),
  status: aroHostStatusSchema,
  lastSeenAt: z.string(),
  version: z.string(),
  capabilities: z.array(z.string()),
});
export type AroHostConnection = z.infer<typeof aroHostConnectionSchema>;

// ---------------------------------------------------------------------------
// ROI (Region of Interest) frame
// ---------------------------------------------------------------------------

export const aroBoundingBoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});
export type AroBoundingBox = z.infer<typeof aroBoundingBoxSchema>;

export const aroRoiFormatSchema = z.enum(['jpeg', 'webp', 'png']);
export type AroRoiFormat = z.infer<typeof aroRoiFormatSchema>;

export const aroRoiFrameSchema = z.object({
  hostId: z.string(),
  region: aroBoundingBoxSchema,
  imageBase64: z.string(),
  format: aroRoiFormatSchema,
  sizeBytes: z.number(),
  capturedAt: z.string(),
  isDelta: z.boolean(),
});
export type AroRoiFrame = z.infer<typeof aroRoiFrameSchema>;

// ---------------------------------------------------------------------------
// Execution plan step
// ---------------------------------------------------------------------------

export const aroPlanStepTypeSchema = z.enum([
  'shell_command',
  'file_read',
  'file_write',
  'process_signal',
  'screenshot',
  'roi_capture',
  'analysis',
]);
export type AroPlanStepType = z.infer<typeof aroPlanStepTypeSchema>;

export const aroPlanStepSchema = z.object({
  id: z.string(),
  type: aroPlanStepTypeSchema,
  description: z.string(),
  command: z.string().optional(),
  cwd: z.string().optional(),
  dependsOn: z.array(z.string()).default([]),
});
export type AroPlanStep = z.infer<typeof aroPlanStepSchema>;

export const aroExecutionPlanSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  hostId: z.string(),
  intent: z.string(),
  steps: z.array(aroPlanStepSchema),
  createdAt: z.string(),
});
export type AroExecutionPlan = z.infer<typeof aroExecutionPlanSchema>;

// ---------------------------------------------------------------------------
// Monitor loop configuration
// ---------------------------------------------------------------------------

export const aroMonitorTypeSchema = z.enum([
  'cpu_spike',
  'memory_threshold',
  'disk_threshold',
  'process_crash',
  'log_pattern',
  'custom',
]);
export type AroMonitorType = z.infer<typeof aroMonitorTypeSchema>;

export const aroMonitorConfigSchema = z.object({
  id: z.string(),
  type: aroMonitorTypeSchema,
  hostId: z.string(),
  intervalMs: z.number().default(5000),
  config: z.record(z.unknown()),
  enabled: z.boolean().default(true),
});
export type AroMonitorConfig = z.infer<typeof aroMonitorConfigSchema>;

// ---------------------------------------------------------------------------
// Alert (from monitor loops)
// ---------------------------------------------------------------------------

export const aroAlertSeveritySchema = z.enum(['info', 'warning', 'error', 'critical']);
export type AroAlertSeverity = z.infer<typeof aroAlertSeveritySchema>;

export const aroAlertSchema = z.object({
  id: z.string(),
  hostId: z.string(),
  monitorId: z.string().optional(),
  alertType: z.string(),
  message: z.string(),
  severity: aroAlertSeveritySchema,
  timestamp: z.string(),
  acknowledged: z.boolean().default(false),
});
export type AroAlert = z.infer<typeof aroAlertSchema>;

// ---------------------------------------------------------------------------
// Session extra config (passed via SessionConfig.extra.aro)
// ---------------------------------------------------------------------------

export const aroSessionExtraSchema = z.object({
  hostId: z.string(),
  securityPolicyId: z.string(),
  roiEnabled: z.boolean().default(true),
  monitorLoops: z.array(z.string()).default([]),
});
export type AroSessionExtra = z.infer<typeof aroSessionExtraSchema>;
