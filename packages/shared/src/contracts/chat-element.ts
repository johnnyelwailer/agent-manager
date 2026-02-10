import { z } from 'zod';

// ---------------------------------------------------------------------------
// ChatElementContract — Interactive elements within agent conversation stream
// ---------------------------------------------------------------------------

// Choice Picker: Agent presents options, user selects
export const choiceElementSchema = z.object({
  type: z.literal('choice'),
  id: z.string(),
  prompt: z.string(),
  options: z.array(z.object({
    id: z.string(),
    label: z.string(),
    description: z.string().optional(),
  })),
  multiSelect: z.boolean().default(false),
  selectedIds: z.array(z.string()).default([]),
});

// Confirmation: Agent requests yes/no approval
export const confirmationElementSchema = z.object({
  type: z.literal('confirmation'),
  id: z.string(),
  prompt: z.string(),
  details: z.string().optional(),
  result: z.enum(['pending', 'approved', 'rejected']).default('pending'),
});

// File Selector: Agent asks user to pick files/paths
export const fileSelectorElementSchema = z.object({
  type: z.literal('file_selector'),
  id: z.string(),
  prompt: z.string(),
  rootPath: z.string().optional(),
  allowMultiple: z.boolean().default(false),
  fileFilter: z.string().optional(),
  selectedPaths: z.array(z.string()).default([]),
});

// Progress Indicator: Long-running operation feedback
export const progressElementSchema = z.object({
  type: z.literal('progress'),
  id: z.string(),
  label: z.string(),
  progress: z.number().min(0).max(100),
  status: z.enum(['running', 'completed', 'failed', 'cancelled']),
  details: z.string().optional(),
});

// Code Block: Syntax-highlighted code with actions
export const codeBlockElementSchema = z.object({
  type: z.literal('code_block'),
  id: z.string(),
  language: z.string(),
  code: z.string(),
  filePath: z.string().optional(),
  startLine: z.number().optional(),
  actions: z.array(z.enum(['copy', 'apply', 'diff', 'expand'])).default(['copy']),
});

// Tool Call: Visualize agent tool usage
export const toolCallElementSchema = z.object({
  type: z.literal('tool_call'),
  id: z.string(),
  toolName: z.string(),
  input: z.record(z.unknown()),
  output: z.string().optional(),
  isError: z.boolean().default(false),
  durationMs: z.number().optional(),
  collapsed: z.boolean().default(true),
});

// Cost Ticker: Running token/cost display
export const costTickerElementSchema = z.object({
  type: z.literal('cost_ticker'),
  id: z.string(),
  costUsd: z.number(),
  tokensIn: z.number(),
  tokensOut: z.number(),
  model: z.string().optional(),
});

// Diff View: Show proposed changes
export const diffViewElementSchema = z.object({
  type: z.literal('diff'),
  id: z.string(),
  filePath: z.string(),
  hunks: z.array(z.object({
    oldStart: z.number(),
    oldLines: z.number(),
    newStart: z.number(),
    newLines: z.number(),
    content: z.string(),
  })),
  mode: z.enum(['unified', 'split']).default('unified'),
  result: z.enum(['pending', 'accepted', 'rejected']).default('pending'),
});

// Form: Structured input collection
export const formFieldSchema = z.object({
  name: z.string(),
  label: z.string(),
  type: z.enum(['text', 'number', 'boolean', 'select', 'textarea']),
  required: z.boolean().default(false),
  choices: z.array(z.string()).optional(),
  default: z.unknown().optional(),
  value: z.unknown().optional(),
});

export const formElementSchema = z.object({
  type: z.literal('form'),
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  fields: z.array(formFieldSchema),
  submitted: z.boolean().default(false),
});

// ---------------------------------------------------------------------------
// Discriminated union of all chat elements
// ---------------------------------------------------------------------------

export const chatElementContractSchema = z.discriminatedUnion('type', [
  choiceElementSchema,
  confirmationElementSchema,
  fileSelectorElementSchema,
  progressElementSchema,
  codeBlockElementSchema,
  toolCallElementSchema,
  costTickerElementSchema,
  diffViewElementSchema,
  formElementSchema,
]);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChoiceElement = z.infer<typeof choiceElementSchema>;
export type ConfirmationElement = z.infer<typeof confirmationElementSchema>;
export type FileSelectorElement = z.infer<typeof fileSelectorElementSchema>;
export type ProgressElement = z.infer<typeof progressElementSchema>;
export type CodeBlockElement = z.infer<typeof codeBlockElementSchema>;
export type ToolCallElement = z.infer<typeof toolCallElementSchema>;
export type CostTickerElement = z.infer<typeof costTickerElementSchema>;
export type DiffViewElement = z.infer<typeof diffViewElementSchema>;
export type FormField = z.infer<typeof formFieldSchema>;
export type FormElement = z.infer<typeof formElementSchema>;
export type ChatElementContract = z.infer<typeof chatElementContractSchema>;
