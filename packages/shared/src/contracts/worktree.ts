import { z } from 'zod';

// ---------------------------------------------------------------------------
// WorktreeContract — A git worktree or workspace context
// ---------------------------------------------------------------------------

export const worktreeStatusSchema = z.enum([
  'clean',
  'dirty',
  'conflict',
  'detached',
]);

export const worktreeContractSchema = z.object({
  id: z.string(),
  path: z.string(),
  branch: z.string(),
  repo: z.string(),
  status: worktreeStatusSchema,
  isMain: z.boolean().default(false),
  sessionId: z.string().optional(),
  createdAt: z.string(),
  lastActivityAt: z.string().optional(),
  changedFiles: z.number().default(0),
  aheadBehind: z.object({
    ahead: z.number(),
    behind: z.number(),
  }).optional(),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WorktreeStatus = z.infer<typeof worktreeStatusSchema>;
export type WorktreeContract = z.infer<typeof worktreeContractSchema>;
