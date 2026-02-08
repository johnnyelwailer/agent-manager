// Primitives mapper — converts engine sessions into the primitives types
// used by the StartupBrief view (ExecutionPrimitive, AgentInfo, etc.).
//
// Strategies and contexts are not derivable from engine sessions, so those
// continue to use mock data as fallback.

import type { AgentEvent, SessionInfo, AdapterManifest } from './engine-types.ts';
import type {
  ExecutionPrimitive,
  ExecutionLogEntry,
  VerificationPrimitive,
  AgentInfo,
} from '../types/primitives.ts';

// ---------------------------------------------------------------------------
// Session → ExecutionPrimitive
// ---------------------------------------------------------------------------

function mapSessionStatus(
  status: SessionInfo['status'],
): ExecutionPrimitive['status'] {
  switch (status) {
    case 'starting': return 'queued';
    case 'running': return 'running';
    case 'completed': return 'completed';
    case 'failed': return 'failed';
    case 'interrupted': return 'paused';
  }
}

function mapEventsToExecutionLog(events: AgentEvent[]): ExecutionLogEntry[] {
  const log: ExecutionLogEntry[] = [];

  for (const event of events) {
    const timestamp = new Date(event.timestamp).getTime();

    switch (event.type) {
      case 'text_delta':
        log.push({ timestamp, type: 'text', content: event.text });
        break;
      case 'thinking':
        log.push({ timestamp, type: 'thinking', content: event.text });
        break;
      case 'tool_call':
        log.push({
          timestamp,
          type: 'tool_call',
          content: summarizeToolInput(event.toolName, event.input),
          toolName: event.toolName,
        });
        break;
      case 'tool_result':
        log.push({
          timestamp,
          type: event.isError ? 'error' : 'tool_result',
          content: event.output.slice(0, 200),
          toolName: event.toolName,
        });
        break;
      case 'error':
        log.push({ timestamp, type: 'error', content: event.message });
        break;
    }
  }

  return log;
}

export function sessionToExecution(
  session: SessionInfo,
  events: AgentEvent[],
): ExecutionPrimitive {
  const log = mapEventsToExecutionLog(events);

  // Extract file artifacts from tool calls
  const artifacts: string[] = [];
  for (const event of events) {
    if (event.type === 'tool_call') {
      const path = String(event.input.file_path ?? event.input.path ?? '');
      if (path && !artifacts.includes(path)) {
        artifacts.push(path);
      }
    }
  }

  return {
    id: `exec-${session.sessionId}`,
    title: session.prompt.slice(0, 80),
    status: mapSessionStatus(session.status),
    assignedAgent: `agent-${session.adapterId}`,
    log,
    artifacts,
    startedAt: new Date(session.startedAt).getTime(),
    completedAt: session.endedAt ? new Date(session.endedAt).getTime() : undefined,
    costUsd: session.costUsd,
  };
}

// ---------------------------------------------------------------------------
// Session → VerificationPrimitive
// ---------------------------------------------------------------------------

export function sessionToVerifications(
  session: SessionInfo,
): VerificationPrimitive[] {
  const verifications: VerificationPrimitive[] = [];
  const execId = `exec-${session.sessionId}`;

  if (session.status === 'completed') {
    verifications.push({
      id: `ver-${session.sessionId}-test`,
      executionId: execId,
      type: 'test_run',
      status: 'passed',
      details: `Session completed successfully ($${session.costUsd.toFixed(2)})`,
    });
  } else if (session.status === 'failed') {
    verifications.push({
      id: `ver-${session.sessionId}-test`,
      executionId: execId,
      type: 'test_run',
      status: 'failed',
      details: 'Session failed — check logs for details',
    });
  } else if (session.status === 'running') {
    verifications.push({
      id: `ver-${session.sessionId}-review`,
      executionId: execId,
      type: 'diff_review',
      status: 'pending',
      details: 'Session in progress — awaiting completion for review',
    });
  }

  return verifications;
}

// ---------------------------------------------------------------------------
// Adapter → AgentInfo
// ---------------------------------------------------------------------------

export function adapterToAgentInfo(
  manifest: AdapterManifest,
  sessions: SessionInfo[],
): AgentInfo {
  const adapterSessions = sessions.filter((s) => s.adapterId === manifest.id);
  const activeSessions = adapterSessions.filter(
    (s) => s.status === 'running' || s.status === 'starting',
  );

  const totalCost = adapterSessions.reduce((sum, s) => sum + s.costUsd, 0);
  const totalTokens = adapterSessions.reduce(
    (sum, s) => sum + s.tokensIn + s.tokensOut,
    0,
  );

  return {
    id: `agent-${manifest.id}`,
    name: manifest.name,
    model: manifest.runtime,
    status: activeSessions.length > 0 ? 'running' : 'idle',
    currentTask: activeSessions[0]
      ? `exec-${activeSessions[0].sessionId}`
      : undefined,
    costUsd: totalCost,
    tokensUsed: totalTokens,
  };
}

// ---------------------------------------------------------------------------
// Complete state mapping
// ---------------------------------------------------------------------------

export interface MappedPrimitivesState {
  agents: AgentInfo[];
  executions: ExecutionPrimitive[];
  verifications: VerificationPrimitive[];
}

export function mapEngineToPrimitives(
  sessions: SessionInfo[],
  sessionEvents: Map<string, AgentEvent[]>,
  adapters: AdapterManifest[],
): MappedPrimitivesState {
  const executions = sessions.map((session) => {
    const events = sessionEvents.get(session.sessionId) ?? [];
    return sessionToExecution(session, events);
  });

  const verifications = sessions.flatMap((session) =>
    sessionToVerifications(session),
  );

  const agents = adapters.map((a) => adapterToAgentInfo(a, sessions));

  return { agents, executions, verifications };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function summarizeToolInput(
  toolName: string,
  input: Record<string, unknown>,
): string {
  if (toolName === 'Read' || toolName === 'read') {
    return `Reading ${input.file_path ?? input.path ?? 'file'}`;
  }
  if (toolName === 'Edit' || toolName === 'edit') {
    return `Editing ${input.file_path ?? input.path ?? 'file'}`;
  }
  if (toolName === 'Write' || toolName === 'write') {
    return `Writing ${input.file_path ?? input.path ?? 'file'}`;
  }
  if (toolName === 'Bash' || toolName === 'bash') {
    return String(input.command ?? '').slice(0, 100);
  }
  return `${toolName}(...)`;
}
