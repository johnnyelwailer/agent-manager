import { z } from 'zod';

// ---------------------------------------------------------------------------
// ResearchDocContract — A knowledge artifact produced or consumed during work
// ---------------------------------------------------------------------------

export const researchDocRoleSchema = z.enum([
  'plan',
  'constitution',
  'analysis',
  'rules',
  'notes',
  'report',
  'specification',
  'custom',
]);

export const researchDocFormatSchema = z.enum([
  'markdown',
  'plain_text',
  'json',
  'yaml',
]);

export const researchDocContractSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  format: researchDocFormatSchema,
  role: researchDocRoleSchema,
  editable: z.boolean().default(false),
  adapterId: z.string(),
  sessionId: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).optional(),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ResearchDocRole = z.infer<typeof researchDocRoleSchema>;
export type ResearchDocFormat = z.infer<typeof researchDocFormatSchema>;
export type ResearchDocContract = z.infer<typeof researchDocContractSchema>;
