import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';

const CommandCenter = lazy(() => import('./variants/command-center/CommandCenter'));
const Flow = lazy(() => import('./variants/flow/Flow'));
const Spatial = lazy(() => import('./variants/spatial/Spatial'));

const navStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '8px 16px',
  background: '#0d1117',
  borderBottom: '1px solid #30363d',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontSize: 13,
  position: 'relative',
  zIndex: 1000,
};

const logoStyle: React.CSSProperties = {
  color: '#e6edf3',
  fontWeight: 700,
  fontSize: 14,
  marginRight: 16,
  whiteSpace: 'nowrap',
};

const linkBaseStyle: React.CSSProperties = {
  padding: '4px 12px',
  borderRadius: 6,
  textDecoration: 'none',
  color: '#8b949e',
  transition: 'all 0.15s',
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
        <span style={logoStyle}>Universal Agent Host</span>
        <NavItem to="/command-center">A: Command Center</NavItem>
        <NavItem to="/flow">B: Flow</NavItem>
        <NavItem to="/spatial">C: Spatial</NavItem>
      </nav>
      <Suspense
        fallback={
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh', color: '#8b949e' }}>
            Loading...
          </div>
        }
      >
        <Routes>
          <Route path="/command-center" element={<CommandCenter />} />
          <Route path="/flow" element={<Flow />} />
          <Route path="/spatial" element={<Spatial />} />
          <Route path="*" element={<Navigate to="/command-center" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
