import { z } from 'zod';
import { aroHostOsSchema, aroHostStatusSchema } from '../schemas/aro.js';

// ---------------------------------------------------------------------------
// HostContract — Remote machine managed by ARO
// ---------------------------------------------------------------------------

export const hostContractSchema = z.object({
  id: z.string(),
  name: z.string(),
  hostname: z.string(),
  os: aroHostOsSchema,
  arch: z.string(),

  // Connection
  address: z.string(),
  daemonPort: z.number().default(9741),
  status: aroHostStatusSchema,
  lastSeenAt: z.string(),

  // Daemon info
  daemonVersion: z.string(),
  capabilities: z.array(z.string()),

  // Resource usage (populated by host.info RPC)
  cpuPercent: z.number().optional(),
  memoryPercent: z.number().optional(),
  diskPercent: z.number().optional(),
  uptime: z.number().optional(),

  // Tags for grouping/filtering
  tags: z.array(z.string()).default([]),

  // Security
  securityPolicyId: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HostContract = z.infer<typeof hostContractSchema>;
