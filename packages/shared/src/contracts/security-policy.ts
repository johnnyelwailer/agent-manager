import { z } from 'zod';
import {
  aroRiskLevelSchema,
  aroSecurityActionSchema,
  aroSecurityRuleSchema,
} from '../schemas/aro.js';

// ---------------------------------------------------------------------------
// SecurityPolicyContract — Defines what commands/actions are allowed on a host
// ---------------------------------------------------------------------------

export const securityPolicyContractSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  version: z.string(),

  // Rule evaluation (first match wins)
  rules: z.array(aroSecurityRuleSchema),

  // Defaults when no rule matches
  defaultRiskLevel: aroRiskLevelSchema,
  defaultAction: aroSecurityActionSchema,

  // Path-based access control
  allowedPaths: z.array(z.string()),
  blockedPaths: z.array(z.string()).default([]),

  // Command blocklist (exact match, evaluated before rules)
  blockedCommands: z.array(z.string()),

  // Operational limits
  maxConcurrentCommands: z.number().default(5),
  sessionTimeoutMs: z.number().default(300_000),
  commandTimeoutMs: z.number().default(60_000),

  // Audit
  createdAt: z.string(),
  updatedAt: z.string(),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SecurityPolicyContract = z.infer<typeof securityPolicyContractSchema>;
