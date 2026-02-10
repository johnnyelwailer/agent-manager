import { z } from 'zod';

// ---------------------------------------------------------------------------
// SkillContract — A higher-level capability with context
// ---------------------------------------------------------------------------

export const skillTriggerSchema = z.object({
  type: z.enum(['keyword', 'file_pattern', 'event', 'manual']),
  value: z.string(),
});

export const skillContractSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  triggers: z.array(skillTriggerSchema).default([]),
  autoDiscoverable: z.boolean().default(false),
  enabled: z.boolean().default(true),
  adapterId: z.string(),
  category: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

// ---------------------------------------------------------------------------
// Agent-specific specializations
// ---------------------------------------------------------------------------

export const claudeSkillContractSchema = skillContractSchema.extend({
  specialization: z.literal('claude'),
  source: z.enum(['autodiscovered', 'user_defined', 'project']),
  slashCommand: z.string().optional(),
  globs: z.array(z.string()).default([]),
});

export const gsdSkillContractSchema = skillContractSchema.extend({
  specialization: z.literal('gsd'),
  constitutionRef: z.string().optional(),
  phase: z.enum(['plan', 'execute', 'verify']).optional(),
});

export const genericSkillContractSchema = skillContractSchema.extend({
  specialization: z.literal('generic').default('generic'),
});

export const specializedSkillContractSchema = z.discriminatedUnion('specialization', [
  claudeSkillContractSchema,
  gsdSkillContractSchema,
  genericSkillContractSchema,
]);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SkillTrigger = z.infer<typeof skillTriggerSchema>;
export type SkillContract = z.infer<typeof skillContractSchema>;
export type ClaudeSkillContract = z.infer<typeof claudeSkillContractSchema>;
export type GsdSkillContract = z.infer<typeof gsdSkillContractSchema>;
export type GenericSkillContract = z.infer<typeof genericSkillContractSchema>;
export type SpecializedSkillContract = z.infer<typeof specializedSkillContractSchema>;
