import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Layout mode types
// ---------------------------------------------------------------------------

export type LayoutMode =
  | 'sidebar-main'          // Classic 2-panel: sidebar + main content
  | 'sidebar-main-detail'   // 3-panel: sidebar + main + detail panel
  | 'focused'               // Single panel: just main content (distraction-free)
  | 'dual';                 // 2-panel: equal split (e.g., two chat sessions)

export interface AppShellConfig {
  layout: LayoutMode;
  sidebarCollapsed: boolean;
  detailCollapsed: boolean;
}

// ---------------------------------------------------------------------------
// Context for shell-wide state
// ---------------------------------------------------------------------------

interface AppShellContextValue {
  config: AppShellConfig;
  setLayout: (mode: LayoutMode) => void;
  toggleSidebar: () => void;
  toggleDetail: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setDetailCollapsed: (collapsed: boolean) => void;
}

const AppShellContext = createContext<AppShellContextValue | null>(null);

export function useAppShell() {
  const ctx = useContext(AppShellContext);
  if (!ctx) throw new Error('useAppShell must be used inside <AppShell>');
  return ctx;
}

// ---------------------------------------------------------------------------
// AppShell props
// ---------------------------------------------------------------------------

export interface AppShellProps {
  /** The top navigation / toolbar bar */
  navbar?: React.ReactNode;
  /** Left sidebar content */
  sidebar?: React.ReactNode;
  /** Primary main content area */
  children: React.ReactNode;
  /** Right detail / auxiliary panel content */
  detail?: React.ReactNode;
  /** Bottom status bar */
  statusBar?: React.ReactNode;
  /** Initial layout mode */
  defaultLayout?: LayoutMode;
  /** Initial sidebar collapsed state */
  defaultSidebarCollapsed?: boolean;
  /** Initial detail collapsed state */
  defaultDetailCollapsed?: boolean;
  /** Additional class names */
  className?: string;
  /** Test ID */
  'data-testid'?: string;
}

// ---------------------------------------------------------------------------
// AppShell component
// ---------------------------------------------------------------------------

export function AppShell({
  navbar,
  sidebar,
  children,
  detail,
  statusBar,
  defaultLayout = 'sidebar-main',
  defaultSidebarCollapsed = false,
  defaultDetailCollapsed = false,
  className,
  'data-testid': testId,
}: AppShellProps) {
  const [config, setConfig] = useState<AppShellConfig>({
    layout: defaultLayout,
    sidebarCollapsed: defaultSidebarCollapsed,
    detailCollapsed: defaultDetailCollapsed,
  });

  const setLayout = useCallback((mode: LayoutMode) => {
    setConfig((prev) => ({ ...prev, layout: mode }));
  }, []);

  const toggleSidebar = useCallback(() => {
    setConfig((prev) => ({ ...prev, sidebarCollapsed: !prev.sidebarCollapsed }));
  }, []);

  const toggleDetail = useCallback(() => {
    setConfig((prev) => ({ ...prev, detailCollapsed: !prev.detailCollapsed }));
  }, []);

  const setSidebarCollapsed = useCallback((collapsed: boolean) => {
    setConfig((prev) => ({ ...prev, sidebarCollapsed: collapsed }));
  }, []);

  const setDetailCollapsed = useCallback((collapsed: boolean) => {
    setConfig((prev) => ({ ...prev, detailCollapsed: collapsed }));
  }, []);

  const ctx = useMemo<AppShellContextValue>(
    () => ({ config, setLayout, toggleSidebar, toggleDetail, setSidebarCollapsed, setDetailCollapsed }),
    [config, setLayout, toggleSidebar, toggleDetail, setSidebarCollapsed, setDetailCollapsed],
  );

  const { layout, sidebarCollapsed, detailCollapsed } = config;

  const showSidebar = sidebar && layout !== 'focused';
  const showDetail = detail && (layout === 'sidebar-main-detail' || layout === 'dual');

  return (
    <AppShellContext.Provider value={ctx}>
      <div
        data-testid={testId}
        data-layout={layout}
        className={cn('flex h-full flex-col bg-background', className)}
      >
        {/* Navbar */}
        {navbar && (
          <div className="shrink-0">
            {navbar}
          </div>
        )}

        {/* Body: sidebar + main + detail */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          {showSidebar && (
            <aside
              data-testid="app-shell-sidebar"
              className={cn(
                'shrink-0 border-r border-border bg-sidebar transition-[width] duration-200 max-md:hidden overflow-hidden',
                sidebarCollapsed ? 'w-12' : 'w-64',
              )}
            >
              {!sidebarCollapsed && sidebar}
              {sidebarCollapsed && (
                <div className="flex h-full items-center justify-center">
                  <div className="h-8 w-1 rounded-full bg-sidebar-border" />
                </div>
              )}
            </aside>
          )}

          {/* Main content */}
          <main
            data-testid="app-shell-main"
            className={cn(
              'flex-1 overflow-hidden',
              layout === 'dual' && 'flex',
            )}
          >
            {children}
          </main>

          {/* Detail panel */}
          {showDetail && (
            <aside
              data-testid="app-shell-detail"
              className={cn(
                'shrink-0 border-l border-border bg-card transition-[width] duration-200 max-lg:hidden overflow-hidden',
                detailCollapsed ? 'w-12' : 'w-80',
              )}
            >
              {!detailCollapsed && detail}
              {detailCollapsed && (
                <div className="flex h-full items-center justify-center">
                  <div className="h-8 w-1 rounded-full bg-border" />
                </div>
              )}
            </aside>
          )}
        </div>

        {/* Status bar */}
        {statusBar && (
          <div className="shrink-0 border-t border-border">
            {statusBar}
          </div>
        )}
      </div>
    </AppShellContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Navbar sub-component for common nav bar pattern
// ---------------------------------------------------------------------------

export interface ShellNavbarProps {
  /** Leading content (logo, breadcrumbs, etc.) */
  leading?: React.ReactNode;
  /** Center content (navigation links, search, etc.) */
  center?: React.ReactNode;
  /** Trailing content (status indicators, user menu, etc.) */
  trailing?: React.ReactNode;
  className?: string;
}

export function ShellNavbar({ leading, center, trailing, className }: ShellNavbarProps) {
  return (
    <nav className={cn('flex items-center justify-between border-b border-border px-4 py-2', className)}>
      <div className="flex items-center gap-2">
        {leading}
      </div>
      {center && (
        <div className="flex items-center gap-1">
          {center}
        </div>
      )}
      <div className="flex items-center gap-2">
        {trailing}
      </div>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Status bar sub-component
// ---------------------------------------------------------------------------

export interface ShellStatusBarProps {
  children: React.ReactNode;
  className?: string;
}

export function ShellStatusBar({ children, className }: ShellStatusBarProps) {
  return (
    <div className={cn('flex items-center gap-3 bg-muted/50 px-4 py-1 text-xs text-muted-foreground', className)}>
      {children}
    </div>
  );
}
