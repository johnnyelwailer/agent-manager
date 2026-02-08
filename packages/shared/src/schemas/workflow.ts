import { z } from 'zod';

// ---------------------------------------------------------------------------
// Issue (external work item — Jira ticket, GitHub issue)
// ---------------------------------------------------------------------------

export const issuePrioritySchema = z.enum(['critical', 'high', 'medium', 'low']);
export const issueStatusSchema = z.enum(['backlog', 'ready', 'in_progress', 'in_review', 'done']);

export const issueSchema = z.object({
  id: z.string(),
  externalId: z.string().optional(),
  title: z.string(),
  description: z.string(),
  priority: issuePrioritySchema,
  status: issueStatusSchema,
  labels: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Issue = z.infer<typeof issueSchema>;
export type IssuePriority = z.infer<typeof issuePrioritySchema>;
export type IssueStatus = z.infer<typeof issueStatusSchema>;

// ---------------------------------------------------------------------------
// Task (local agent work unit — one issue → many tasks)
// ---------------------------------------------------------------------------

export const taskStatusSchema = z.enum([
  'pending',
  'running',
  'completed',
  'failed',
  'blocked',
]);

export const taskSchema = z.object({
  id: z.string(),
  issueId: z.string(),
  sessionId: z.string().optional(),
  title: z.string(),
  description: z.string(),
  status: taskStatusSchema,
  adapterId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Task = z.infer<typeof taskSchema>;
export type TaskStatus = z.infer<typeof taskStatusSchema>;

// ---------------------------------------------------------------------------
// Plan (analysis output for an issue)
// ---------------------------------------------------------------------------

export const planStepSchema = z.object({
  id: z.string(),
  description: z.string(),
  completed: z.boolean(),
});

export const planSchema = z.object({
  id: z.string(),
  issueId: z.string(),
  steps: z.array(planStepSchema),
  affectedRepos: z.array(z.string()),
  complexity: z.enum(['trivial', 'simple', 'moderate', 'complex']),
  risks: z.array(z.string()),
  createdAt: z.string(),
});

export type Plan = z.infer<typeof planSchema>;
export type PlanStep = z.infer<typeof planStepSchema>;

// ---------------------------------------------------------------------------
// Verification pipeline
// ---------------------------------------------------------------------------

export const verificationStageSchema = z.enum([
  'prechecks',
  'ai_review',
  'pull_request',
  'approval',
]);

export const verificationResultSchema = z.enum([
  'pending',
  'running',
  'passed',
  'failed',
  'skipped',
]);

export const verificationStepSchema = z.object({
  stage: verificationStageSchema,
  result: verificationResultSchema,
  details: z.string().optional(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
});

export const verificationPipelineSchema = z.object({
  taskId: z.string(),
  steps: z.array(verificationStepSchema),
});

export type VerificationStage = z.infer<typeof verificationStageSchema>;
export type VerificationResult = z.infer<typeof verificationResultSchema>;
export type VerificationStep = z.infer<typeof verificationStepSchema>;
export type VerificationPipeline = z.infer<typeof verificationPipelineSchema>;
