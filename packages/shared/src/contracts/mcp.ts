import { z } from 'zod';

// ---------------------------------------------------------------------------
// McpContract — MCP server/tool available to an agent
// ---------------------------------------------------------------------------

export const mcpConnectionStatusSchema = z.enum([
  'connected',
  'disconnected',
  'connecting',
  'error',
]);

export const mcpToolSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  inputSchema: z.record(z.unknown()).optional(),
});

export const mcpResourceSchema = z.object({
  uri: z.string(),
  name: z.string(),
  description: z.string().optional(),
  mimeType: z.string().optional(),
});

export const mcpPromptSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  arguments: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
    required: z.boolean().default(false),
  })).default([]),
});

export const mcpContractSchema = z.object({
  id: z.string(),
  name: z.string(),
  uri: z.string(),
  status: mcpConnectionStatusSchema,
  tools: z.array(mcpToolSchema).default([]),
  resources: z.array(mcpResourceSchema).default([]),
  prompts: z.array(mcpPromptSchema).default([]),
  adapterId: z.string(),
  version: z.string().optional(),
  lastConnectedAt: z.string().optional(),
  errorMessage: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type McpConnectionStatus = z.infer<typeof mcpConnectionStatusSchema>;
export type McpTool = z.infer<typeof mcpToolSchema>;
export type McpResource = z.infer<typeof mcpResourceSchema>;
export type McpPrompt = z.infer<typeof mcpPromptSchema>;
export type McpContract = z.infer<typeof mcpContractSchema>;
