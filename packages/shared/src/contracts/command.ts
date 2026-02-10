import { z } from 'zod';

// ---------------------------------------------------------------------------
// CommandContract — An imperative action an agent can perform
// ---------------------------------------------------------------------------

export const commandParameterSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  type: z.enum(['string', 'number', 'boolean', 'file', 'choice']),
  required: z.boolean().default(false),
  choices: z.array(z.string()).optional(),
  default: z.unknown().optional(),
});

export const commandContractSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  parameters: z.array(commandParameterSchema).default([]),
  keybinding: z.string().optional(),
  source: z.enum(['built_in', 'user_defined', 'plugin', 'autodiscovered']),
  adapterId: z.string(),
  category: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Agent-specific specializations (discriminated by `specialization`)
// ---------------------------------------------------------------------------

export const claudeCommandContractSchema = commandContractSchema.extend({
  specialization: z.literal('claude'),
  slashCommand: z.string(),
  requiresSession: z.boolean().default(false),
});

export const genericCommandContractSchema = commandContractSchema.extend({
  specialization: z.literal('generic').default('generic'),
});

export const specializedCommandContractSchema = z.discriminatedUnion('specialization', [
  claudeCommandContractSchema,
  genericCommandContractSchema,
]);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CommandParameter = z.infer<typeof commandParameterSchema>;
export type CommandContract = z.infer<typeof commandContractSchema>;
export type ClaudeCommandContract = z.infer<typeof claudeCommandContractSchema>;
export type GenericCommandContract = z.infer<typeof genericCommandContractSchema>;
export type SpecializedCommandContract = z.infer<typeof specializedCommandContractSchema>;
