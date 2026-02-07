// Core primitive types from research plan

export interface ContextPrimitive {
  id: string;
  title: string;
  content: string;
  sourceFile: string;
  tags: string[];
  lastModified: number;
}

export interface StrategyPrimitive {
  id: string;
  title: string;
  status: 'draft' | 'active' | 'completed' | 'abandoned';
  children: StrategyPrimitive[];
  sourceFile: string;
  sourceRange?: { start: number; end: number };
  metadata: Record<string, unknown>;
}

export interface ExecutionPrimitive {
  id: string;
  title: string;
  status: 'queued' | 'running' | 'paused' | 'completed' | 'failed';
  assignedAgent?: string;
  parentStrategyId?: string;
  log: ExecutionLogEntry[];
  artifacts: string[];
  startedAt?: number;
  completedAt?: number;
  costUsd?: number;
}

export interface ExecutionLogEntry {
  timestamp: number;
  type: 'tool_call' | 'tool_result' | 'text' | 'error' | 'thinking';
  content: string;
  toolName?: string;
  metadata?: Record<string, unknown>;
}

export interface VerificationPrimitive {
  id: string;
  executionId: string;
  type: 'diff_review' | 'test_run' | 'lint' | 'human_approval';
  status: 'pending' | 'passed' | 'failed' | 'needs_review';
  details: string;
  sourceFile?: string;
}

export interface AgentInfo {
  id: string;
  name: string;
  model: string;
  status: 'idle' | 'running' | 'paused' | 'errored';
  sessionId?: string;
  currentTask?: string;
  costUsd: number;
  tokensUsed: number;
}
