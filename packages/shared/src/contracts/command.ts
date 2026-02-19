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

// ---------------------------------------------------------------------------
// Invocation mode — aligns with ACP's AvailableCommand.input pattern.
//
// ACP models this as: input field absent → one-off, input field present →
// requires user text. We make this explicit with a discriminated union so the
// UI knows how to render each command (button vs input-field).
// ---------------------------------------------------------------------------

export const immediateInvocationSchema = z.object({
  /** Fire-and-forget. One click/tap to execute. No user input required. */
  kind: z.literal('immediate'),
});

export const promptInvocationSchema = z.object({
  /** Requires free-form text input before execution. */
  kind: z.literal('prompt'),
  /** Placeholder hint shown in the input field (maps to ACP UnstructuredCommandInput.hint). */
  hint: z.string(),
});

export const formInvocationSchema = z.object({
  /** Requires structured parameter input (rendered as a mini-form). */
  kind: z.literal('form'),
  /** Which parameters from the command's `parameters` array are shown in the form. Omit to show all required params. */
  fields: z.array(z.string()).optional(),
});

export const invocationModeSchema = z.discriminatedUnion('kind', [
  immediateInvocationSchema,
  promptInvocationSchema,
  formInvocationSchema,
]);

export const commandContractSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  parameters: z.array(commandParameterSchema).default([]),
  /** How this command is invoked. Determines UI rendering (button vs input field vs form).
   *  Defaults to 'immediate' when absent — the command is a one-off action. */
  invocation: invocationModeSchema.optional(),
  keybinding: z.string().optional(),
  /** Whether this command should appear in the landing view action grid (curated surface).
   *  Non-featured commands still appear in the command palette (Cmd+K). */
  featured: z.boolean().default(false),
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
export type InvocationMode = z.infer<typeof invocationModeSchema>;
export type CommandContract = z.infer<typeof commandContractSchema>;
export type ClaudeCommandContract = z.infer<typeof claudeCommandContractSchema>;
export type GenericCommandContract = z.infer<typeof genericCommandContractSchema>;
export type SpecializedCommandContract = z.infer<typeof specializedCommandContractSchema>;
