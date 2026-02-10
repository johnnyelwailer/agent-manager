import { z } from 'zod';

// ---------------------------------------------------------------------------
// TaskContract — A unit of work with status, progress, and subtasks
// ---------------------------------------------------------------------------

export const taskContractStatusSchema = z.enum([
  'pending',
  'in_progress',
  'completed',
  'failed',
  'blocked',
  'cancelled',
]);

export const subtaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: taskContractStatusSchema,
});

export const taskContractSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  status: taskContractStatusSchema,
  progress: z.number().min(0).max(100).optional(),
  subtasks: z.array(subtaskSchema).default([]),
  sessionId: z.string().optional(),
  adapterId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  labels: z.array(z.string()).default([]),
});

// ---------------------------------------------------------------------------
// Agent-specific specializations
// ---------------------------------------------------------------------------

export const claudeTaskContractSchema = taskContractSchema.extend({
  specialization: z.literal('claude'),
  todoItems: z.array(z.object({
    content: z.string(),
    status: z.enum(['pending', 'in_progress', 'completed']),
  })).default([]),
});

export const gsdTaskContractSchema = taskContractSchema.extend({
  specialization: z.literal('gsd'),
  constitutionRef: z.string().optional(),
  phase: z.enum(['planning', 'execution', 'verification']).optional(),
  grade: z.enum(['A', 'B', 'C', 'D', 'F']).optional(),
});

export const genericTaskContractSchema = taskContractSchema.extend({
  specialization: z.literal('generic').default('generic'),
});

export const specializedTaskContractSchema = z.discriminatedUnion('specialization', [
  claudeTaskContractSchema,
  gsdTaskContractSchema,
  genericTaskContractSchema,
]);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TaskContractStatus = z.infer<typeof taskContractStatusSchema>;
export type Subtask = z.infer<typeof subtaskSchema>;
export type TaskContract = z.infer<typeof taskContractSchema>;
export type ClaudeTaskContract = z.infer<typeof claudeTaskContractSchema>;
export type GsdTaskContract = z.infer<typeof gsdTaskContractSchema>;
export type GenericTaskContract = z.infer<typeof genericTaskContractSchema>;
export type SpecializedTaskContract = z.infer<typeof specializedTaskContractSchema>;
