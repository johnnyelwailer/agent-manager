import { createRouter, createRoute, createRootRoute, redirect, Outlet } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useConnectionStore } from './stores/connection.js';
import { useSessionsStore } from './stores/sessions.js';
import { useAdaptersStore } from './stores/adapters.js';
import { cn } from '@agent-manager/ui';
import { AppShell, ShellNavbar, ShellStatusBar } from './components/layout/app-shell.js';
import { Sidebar } from './components/layout/sidebar.js';
import { SessionPanel } from './components/layout/session-panel.js';
import { NewSessionForm } from './components/layout/new-session-form.js';
import { SnapshotsPage } from './pages/snapshots.js';

// ---------------------------------------------------------------------------
// Root layout — uses AppShell for the outer chrome
// ---------------------------------------------------------------------------

const rootRoute = createRootRoute({
  component: function RootLayout() {
    const { connect, connected } = useConnectionStore();
    const { fetchSessions, handleEvent } = useSessionsStore();
    const { fetchAdapters } = useAdaptersStore();
    const onEvent = useConnectionStore((s) => s.onEvent);

    useEffect(() => {
      connect();
      fetchSessions();
      fetchAdapters();
    }, [connect, fetchSessions, fetchAdapters]);

    useEffect(() => {
      const unsub = onEvent(handleEvent);
      return unsub;
    }, [onEvent, handleEvent]);

    return (
      <div className="flex h-screen flex-col bg-background">
        <ShellNavbar
          leading={
            <span className="text-sm font-semibold text-foreground">Agent Manager</span>
          }
          trailing={
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className={cn('h-2 w-2 rounded-full', connected ? 'bg-green-500' : 'bg-red-500')} />
              <span>{connected ? 'Connected' : 'Disconnected'}</span>
            </div>
          }
        />
        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
    );
  },
});

// ---------------------------------------------------------------------------
// Index → redirect to /ops
// ---------------------------------------------------------------------------

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/ops' });
  },
});

// ---------------------------------------------------------------------------
// /ops — primary working view
// ---------------------------------------------------------------------------

const opsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/ops',
  component: function OpsView() {
    const sessions = useSessionsStore((s) => s.sessions);
    const activeSessionId = useSessionsStore((s) => s.activeSessionId);
    const activeSession = useSessionsStore((s) => s.activeSession);
    const setActiveSessionId = useSessionsStore((s) => s.setActiveSessionId);
    const startSession = useSessionsStore((s) => s.startSession);
    const loading = useSessionsStore((s) => s.loading);
    const adapters = useAdaptersStore((s) => s.adapters);
    const connected = useConnectionStore((s) => s.connected);

    return (
      <div className="flex h-full">
        <Sidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={setActiveSessionId}
          connected={connected}
        />
        <div className="flex flex-1 flex-col">
          {activeSession ? (
            <SessionPanel session={activeSession} className="flex-1" />
          ) : (
            <div className="flex flex-1 items-center justify-center p-8">
              <div className="w-full max-w-md">
                <h2 className="mb-4 text-lg font-semibold text-foreground">New Session</h2>
                <NewSessionForm adapters={adapters} onSubmit={startSession} loading={loading} />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  },
});

// ---------------------------------------------------------------------------
// /sessions — all sessions list
// ---------------------------------------------------------------------------

const statusColors: Record<string, string> = {
  starting: 'bg-amber-500',
  running: 'bg-blue-500',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
  interrupted: 'bg-muted-foreground',
};

const sessionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sessions',
  component: function SessionsView() {
    const sessions = useSessionsStore((s) => s.sessions);
    const setActiveSessionId = useSessionsStore((s) => s.setActiveSessionId);

    return (
      <div className="h-full overflow-y-auto p-6">
        <h2 className="text-lg font-semibold text-foreground">All Sessions</h2>
        <p className="mt-1 text-sm text-muted-foreground">{sessions.length} total sessions</p>
        <div className="mt-6 space-y-2">
          {sessions.map((session) => (
            <button
              key={session.sessionId}
              onClick={() => setActiveSessionId(session.sessionId)}
              className="flex w-full items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-accent"
            >
              <div className={cn('h-2 w-2 shrink-0 rounded-full', statusColors[session.status] ?? 'bg-muted-foreground')} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-foreground">{session.prompt}</div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{session.adapterId}</span>
                  <span>&middot;</span>
                  <span>{session.status}</span>
                  <span>&middot;</span>
                  <span>{session.eventCount} events</span>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">{new Date(session.startedAt).toLocaleString()}</div>
            </button>
          ))}
          {sessions.length === 0 && (
            <p className="py-12 text-center text-sm text-muted-foreground">No sessions yet</p>
          )}
        </div>
      </div>
    );
  },
});

// ---------------------------------------------------------------------------
// /settings
// ---------------------------------------------------------------------------

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: function SettingsView() {
    const adapters = useAdaptersStore((s) => s.adapters);

    return (
      <div className="h-full overflow-y-auto p-6">
        <h2 className="text-lg font-semibold text-foreground">Settings</h2>
        <section className="mt-6">
          <h3 className="text-sm font-medium text-foreground">Adapters</h3>
          <div className="mt-3 space-y-2">
            {adapters.map((adapter) => (
              <div
                key={adapter.id}
                className="flex items-center justify-between rounded-xl border border-border bg-card p-4"
              >
                <div>
                  <div className="text-sm font-medium text-foreground">{adapter.name}</div>
                  <div className="text-xs text-muted-foreground">{adapter.runtime} v{adapter.version}</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className={cn('h-2 w-2 rounded-full', adapter.available ? 'bg-green-500' : 'bg-red-500')} />
                  <span className="text-xs text-muted-foreground">{adapter.available ? 'Available' : 'Not found'}</span>
                </div>
              </div>
            ))}
            {adapters.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">Loading adapters...</p>
            )}
          </div>
        </section>
      </div>
    );
  },
});

// ---------------------------------------------------------------------------
// /snapshots — component showcase
// ---------------------------------------------------------------------------

const snapshotsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/snapshots',
  component: SnapshotsPage,
});

// ---------------------------------------------------------------------------
// Route tree + Router
// ---------------------------------------------------------------------------

const routeTree = rootRoute.addChildren([indexRoute, opsRoute, sessionsRoute, settingsRoute, snapshotsRoute]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
