// EngineProvider — React context that manages the connection to the
// agent-manager engine and provides mapped workflow data to all child
// components. Falls back to mock data when the engine is unavailable.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { EngineClient } from './engine-client.ts';
import type {
  AgentEvent,
  SessionInfo,
  AdapterManifest,
  StartSessionRequest,
  ConnectionStatus,
} from './engine-types.ts';
import {
  mapEngineState,
  type MappedWorkflowState,
} from './workflow-mapper.ts';

import {
  mapEngineToPrimitives,
  type MappedPrimitivesState,
} from './primitives-mapper.ts';

// Mock data fallback (workflow)
import {
  issues as mockIssues,
  agents as mockAgents,
  project as mockProject,
  repos as mockRepos,
  tasks as mockTasks,
  totalCost as mockTotalCost,
  getAgent as mockGetAgent,
  getRepo as mockGetRepo,
} from '../data/workflow-mock.ts';

// Mock data fallback (primitives)
import {
  agents as mockPrimAgents,
  executions as mockExecutions,
  verifications as mockVerifications,
  strategies as mockStrategies,
} from '../data/mock.ts';

// ---------------------------------------------------------------------------
// Context value type
// ---------------------------------------------------------------------------

export interface EngineContextValue {
  // Connection
  status: ConnectionStatus;
  isLive: boolean;

  // Workflow data (either live or mock)
  state: MappedWorkflowState;

  // Primitives data (either live or mock)
  primitives: MappedPrimitivesState;

  // Raw session/event data for advanced consumers
  sessions: SessionInfo[];
  sessionEvents: Map<string, AgentEvent[]>;

  // Helpers that work with both live and mock data
  getAgent: (agentId: string) => MappedWorkflowState['agents'][number] | undefined;
  getRepo: (repoId: string) => MappedWorkflowState['repos'][number] | undefined;

  // Actions (only work in live mode)
  startSession: (request: StartSessionRequest) => Promise<SessionInfo>;
  interruptSession: (sessionId: string) => Promise<void>;
  terminateSession: (sessionId: string) => Promise<void>;
  killSession: (sessionId: string) => Promise<void>;

  // Engine client for advanced use
  client: EngineClient;
}

// ---------------------------------------------------------------------------
// Default mock state
// ---------------------------------------------------------------------------

const mockState: MappedWorkflowState = {
  project: mockProject,
  repos: mockRepos,
  issues: mockIssues,
  tasks: mockTasks,
  agents: mockAgents,
  totalCost: mockTotalCost(),
};

const mockPrimitivesState: MappedPrimitivesState = {
  agents: mockPrimAgents,
  executions: mockExecutions,
  verifications: mockVerifications,
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const EngineContext = createContext<EngineContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export interface EngineProviderProps {
  /** Engine server URL (default: derive from window.location) */
  serverUrl?: string;
  /** If true, use mock data and don't connect to engine */
  mockMode?: boolean;
  children: React.ReactNode;
}

export function EngineProvider({ serverUrl, mockMode = false, children }: EngineProviderProps) {
  const clientRef = useRef<EngineClient | null>(null);
  if (!clientRef.current) {
    clientRef.current = new EngineClient(serverUrl);
  }
  const client = clientRef.current;

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [sessionEvents, setSessionEvents] = useState<Map<string, AgentEvent[]>>(new Map());
  const [adapters, setAdapters] = useState<AdapterManifest[]>([]);

  // Connect to engine on mount (unless mockMode)
  useEffect(() => {
    if (mockMode) return;

    // Listen for status changes
    const unsubStatus = client.onStatus((status) => {
      setConnectionStatus(status);
    });

    // Listen for events
    const unsubEvent = client.onEvent((event) => {
      // Update session events
      setSessionEvents((prev) => {
        const next = new Map(prev);
        const existing = next.get(event.sessionId) ?? [];
        next.set(event.sessionId, [...existing, event]);
        return next;
      });

      // Update session info from key events
      if (event.type === 'session_start') {
        setSessions((prev) =>
          prev.map((s) =>
            s.sessionId === event.sessionId
              ? { ...s, status: 'running' as const, model: event.model }
              : s,
          ),
        );
      } else if (event.type === 'session_end') {
        setSessions((prev) =>
          prev.map((s) =>
            s.sessionId === event.sessionId
              ? {
                  ...s,
                  status: event.result === 'success' ? 'completed' as const
                    : event.result === 'interrupted' ? 'interrupted' as const
                    : 'failed' as const,
                  endedAt: event.timestamp,
                  costUsd: event.costUsd,
                  tokensIn: event.tokensIn,
                  tokensOut: event.tokensOut,
                }
              : s,
          ),
        );
      } else if (event.type === 'cost_update') {
        setSessions((prev) =>
          prev.map((s) =>
            s.sessionId === event.sessionId
              ? {
                  ...s,
                  costUsd: event.costUsd,
                  tokensIn: event.tokensIn,
                  tokensOut: event.tokensOut,
                }
              : s,
          ),
        );
      }
    });

    // Connect
    client.connect();

    // Fetch initial data once connected
    const fetchInitialData = async () => {
      try {
        const [adapterList, sessionList] = await Promise.all([
          client.listAdapters(),
          client.listSessions(),
        ]);
        setAdapters(adapterList);
        setSessions(sessionList);
      } catch {
        // Engine not available — will use mock data
      }
    };

    // Poll for initial data (engine might not be ready yet)
    const pollTimer = setInterval(() => {
      if (client.status === 'connected') {
        fetchInitialData();
        clearInterval(pollTimer);
      }
    }, 1000);

    // Also try immediately
    fetchInitialData();

    return () => {
      unsubStatus();
      unsubEvent();
      clearInterval(pollTimer);
      client.disconnect();
    };
  }, [client, mockMode]);

  // Determine if we're using live data
  const isLive = connectionStatus === 'connected' && sessions.length > 0;

  // Map engine state to workflow types
  const liveState = useMemo(() => {
    if (!isLive) return null;
    return mapEngineState(sessions, sessionEvents, adapters);
  }, [isLive, sessions, sessionEvents, adapters]);

  // Map engine state to primitives types
  const livePrimitives = useMemo(() => {
    if (!isLive) return null;
    return mapEngineToPrimitives(sessions, sessionEvents, adapters);
  }, [isLive, sessions, sessionEvents, adapters]);

  // Use live state if available, otherwise mock
  const state = liveState ?? mockState;
  const primitives = livePrimitives ?? mockPrimitivesState;

  // Helper functions
  const getAgent = useCallback(
    (agentId: string) => {
      if (isLive) {
        return state.agents.find((a) => a.id === agentId);
      }
      return mockGetAgent(agentId) ?? undefined;
    },
    [isLive, state.agents],
  );

  const getRepo = useCallback(
    (repoId: string) => {
      if (isLive) {
        return state.repos.find((r) => r.id === repoId);
      }
      return mockGetRepo(repoId) ?? undefined;
    },
    [isLive, state.repos],
  );

  // Actions
  const startSession = useCallback(
    async (request: StartSessionRequest) => {
      const session = await client.startSession(request);
      setSessions((prev) => [...prev, session]);
      return session;
    },
    [client],
  );

  const interruptSession = useCallback(
    async (sessionId: string) => {
      await client.interruptSession(sessionId);
    },
    [client],
  );

  const terminateSession = useCallback(
    async (sessionId: string) => {
      await client.terminateSession(sessionId);
    },
    [client],
  );

  const killSession = useCallback(
    async (sessionId: string) => {
      await client.killSession(sessionId);
    },
    [client],
  );

  const value: EngineContextValue = useMemo(
    () => ({
      status: connectionStatus,
      isLive,
      state,
      primitives,
      sessions,
      sessionEvents,
      getAgent,
      getRepo,
      startSession,
      interruptSession,
      terminateSession,
      killSession,
      client,
    }),
    [
      connectionStatus,
      isLive,
      state,
      primitives,
      sessions,
      sessionEvents,
      getAgent,
      getRepo,
      startSession,
      interruptSession,
      terminateSession,
      killSession,
      client,
    ],
  );

  return <EngineContext.Provider value={value}>{children}</EngineContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/** Access the full engine context */
export function useEngine(): EngineContextValue {
  const ctx = useContext(EngineContext);
  if (!ctx) {
    throw new Error('useEngine must be used within an EngineProvider');
  }
  return ctx;
}

/** Access just the workflow data (issues, tasks, agents, etc.) */
export function useWorkflowData() {
  const { state, getAgent, getRepo } = useEngine();
  return { ...state, getAgent, getRepo };
}

/** Access connection status */
export function useConnectionStatus() {
  const { status, isLive } = useEngine();
  return { status, isLive };
}

/** Access session actions */
export function useSessionActions() {
  const { startSession, interruptSession, terminateSession, killSession } = useEngine();
  return { startSession, interruptSession, terminateSession, killSession };
}

/** Access primitives data (for Brief/startup views) */
export function usePrimitivesData() {
  const { primitives } = useEngine();
  return primitives;
}

/** Access strategies (always mock for now — strategies come from PLAN files, not engine) */
export function useStrategies() {
  return mockStrategies;
}
