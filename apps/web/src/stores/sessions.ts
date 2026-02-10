import { create } from 'zustand';
import type { SessionSummary, SessionInfo, AgentEvent } from '@agent-manager/shared';

interface SessionsState {
  sessions: SessionSummary[];
  activeSessionId: string | null;
  activeSession: SessionInfo | null;
  loading: boolean;
  error: string | null;

  // Actions
  fetchSessions: () => Promise<void>;
  fetchSession: (sessionId: string) => Promise<void>;
  setActiveSessionId: (sessionId: string | null) => void;
  handleEvent: (event: AgentEvent) => void;
  startSession: (params: { adapterId: string; prompt: string; cwd: string }) => Promise<void>;
}

export const useSessionsStore = create<SessionsState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  activeSession: null,
  loading: false,
  error: null,

  fetchSessions: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch('/api/sessions');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      set({ sessions: data, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  fetchSession: async (sessionId) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`/api/sessions/${sessionId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      set({ activeSession: data, activeSessionId: sessionId, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  setActiveSessionId: (sessionId) => {
    set({ activeSessionId: sessionId });
    if (sessionId) {
      get().fetchSession(sessionId);
    } else {
      set({ activeSession: null });
    }
  },

  handleEvent: (event) => {
    const { activeSession, sessions } = get();

    // Update active session with new events
    if (activeSession && event.sessionId === activeSession.sessionId) {
      set({
        activeSession: {
          ...activeSession,
          events: [...activeSession.events, event],
          ...(event.type === 'cost_update' ? {
            costUsd: event.costUsd,
            tokensIn: event.tokensIn,
            tokensOut: event.tokensOut,
          } : {}),
          ...(event.type === 'session_end' ? {
            status: event.result === 'success' ? 'completed' as const : 'failed' as const,
            endedAt: event.timestamp,
          } : {}),
        },
      });
    }

    // Update session list summary
    if (event.type === 'session_end') {
      set({
        sessions: sessions.map((s) =>
          s.sessionId === event.sessionId
            ? {
                ...s,
                status: event.result === 'success' ? 'completed' as const : 'failed' as const,
                endedAt: event.timestamp,
                costUsd: event.costUsd,
                tokensIn: event.tokensIn,
                tokensOut: event.tokensOut,
              }
            : s,
        ),
      });
    }

    if (event.type === 'cost_update') {
      set({
        sessions: sessions.map((s) =>
          s.sessionId === event.sessionId
            ? { ...s, costUsd: event.costUsd, tokensIn: event.tokensIn, tokensOut: event.tokensOut }
            : s,
        ),
      });
    }
  },

  startSession: async (params) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      set({ loading: false });
      // Refresh sessions list and open the new one
      await get().fetchSessions();
      get().setActiveSessionId(data.sessionId);
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },
}));
