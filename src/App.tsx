import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';

const CommandCenter = lazy(() => import('./variants/command-center/CommandCenter'));
const Flow = lazy(() => import('./variants/flow/Flow'));
const Spatial = lazy(() => import('./variants/spatial/Spatial'));
const AgentOS = lazy(() => import('./variants/agent-os/AgentOS'));
const Hive = lazy(() => import('./variants/hive/Hive'));
const Pipeline = lazy(() => import('./variants/pipeline/Pipeline'));
const NerveCenter = lazy(() => import('./variants/nerve-center/NerveCenter'));
const Mosaic = lazy(() => import('./variants/mosaic/Mosaic'));
const StartupChat = lazy(() => import('./variants/startup-chat/StartupChat'));
const StartupDashboard = lazy(() => import('./variants/startup-dashboard/StartupDashboard'));
const StartupCommand = lazy(() => import('./variants/startup-command/StartupCommand'));
const StartupBrief = lazy(() => import('./variants/startup-brief/StartupBrief'));
const Ops = lazy(() => import('./variants/ops/Ops'));
const Kanban = lazy(() => import('./variants/kanban/Kanban'));

const navStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 2,
  padding: '8px 12px',
  background: '#0d1117',
  borderBottom: '1px solid #30363d',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontSize: 12,
  position: 'relative',
  zIndex: 1000,
  overflowX: 'auto',
};

const logoStyle: React.CSSProperties = {
  color: '#e6edf3',
  fontWeight: 700,
  fontSize: 13,
  marginRight: 8,
  whiteSpace: 'nowrap',
};

const separatorStyle: React.CSSProperties = {
  width: 1,
  height: 16,
  background: '#30363d',
  margin: '0 6px',
  flexShrink: 0,
};

const linkBaseStyle: React.CSSProperties = {
  padding: '4px 8px',
  borderRadius: 6,
  textDecoration: 'none',
  color: '#8b949e',
  transition: 'all 0.15s',
  whiteSpace: 'nowrap',
};

function NavItem({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        ...linkBaseStyle,
        color: isActive ? '#e6edf3' : '#8b949e',
        background: isActive ? '#21262d' : 'transparent',
      })}
    >
      {children}
    </NavLink>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <nav style={navStyle} data-testid="variant-nav">
        <span style={logoStyle}>UAH</span>
        <NavItem to="/agent-os">AgentOS</NavItem>
        <NavItem to="/hive">Hive</NavItem>
        <NavItem to="/pipeline">Pipeline</NavItem>
        <NavItem to="/nerve-center">Nerve Center</NavItem>
        <NavItem to="/mosaic">Mosaic</NavItem>
        <NavItem to="/command-center">Command Center</NavItem>
        <NavItem to="/flow">Flow</NavItem>
        <NavItem to="/spatial">Spatial</NavItem>
        <span style={separatorStyle} />
        <NavItem to="/startup-chat">Chat</NavItem>
        <NavItem to="/startup-dashboard">Dashboard</NavItem>
        <NavItem to="/startup-command">Command</NavItem>
        <NavItem to="/startup-brief">Brief</NavItem>
        <span style={separatorStyle} />
        <NavItem to="/ops">Ops</NavItem>
        <NavItem to="/kanban">Kanban</NavItem>
      </nav>
      <Suspense
        fallback={
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh', color: '#8b949e' }}>
            Loading...
          </div>
        }
      >
        <Routes>
          <Route path="/agent-os" element={<AgentOS />} />
          <Route path="/hive" element={<Hive />} />
          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="/nerve-center" element={<NerveCenter />} />
          <Route path="/mosaic" element={<Mosaic />} />
          <Route path="/command-center" element={<CommandCenter />} />
          <Route path="/flow" element={<Flow />} />
          <Route path="/spatial" element={<Spatial />} />
          <Route path="/startup-chat" element={<StartupChat />} />
          <Route path="/startup-dashboard" element={<StartupDashboard />} />
          <Route path="/startup-command" element={<StartupCommand />} />
          <Route path="/startup-brief" element={<StartupBrief />} />
          <Route path="/ops" element={<Ops />} />
          <Route path="/kanban" element={<Kanban />} />
          <Route path="*" element={<Navigate to="/agent-os" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
