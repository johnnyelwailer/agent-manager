import { useState, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PanelProps {
  /** Unique panel identifier */
  id: string;
  /** Panel content */
  children: React.ReactNode;
  /** Default width in pixels (used for sidebars/detail panels) */
  defaultWidth?: number;
  /** Minimum width in pixels */
  minWidth?: number;
  /** Maximum width in pixels */
  maxWidth?: number;
  /** Whether this panel can be collapsed */
  collapsible?: boolean;
  /** Controlled collapsed state */
  collapsed?: boolean;
  /** Callback when collapsed state changes */
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Which side the collapse handle appears on */
  collapseSide?: 'left' | 'right';
  /** Whether this panel can be resized via drag handle */
  resizable?: boolean;
  /** Which side the resize handle appears on */
  resizeSide?: 'left' | 'right';
  /** Hide below this breakpoint (Tailwind responsive prefix) */
  hideBelow?: 'sm' | 'md' | 'lg' | 'xl';
  /** Whether panel takes remaining space (flex-1) */
  grow?: boolean;
  /** Optional header element */
  header?: React.ReactNode;
  /** Optional footer element */
  footer?: React.ReactNode;
  /** Additional class names */
  className?: string;
  /** Test ID for snapshot testing */
  'data-testid'?: string;
}

// ---------------------------------------------------------------------------
// Responsive hide class map
// ---------------------------------------------------------------------------

const hideClasses: Record<string, string> = {
  sm: 'max-sm:hidden',
  md: 'max-md:hidden',
  lg: 'max-lg:hidden',
  xl: 'max-xl:hidden',
};

// ---------------------------------------------------------------------------
// Panel component
// ---------------------------------------------------------------------------

export function Panel({
  id,
  children,
  defaultWidth,
  minWidth = 200,
  maxWidth = 600,
  collapsible = false,
  collapsed: controlledCollapsed,
  onCollapsedChange,
  collapseSide = 'right',
  resizable = false,
  resizeSide = 'right',
  hideBelow,
  grow = false,
  header,
  footer,
  className,
  'data-testid': testId,
}: PanelProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const [width, setWidth] = useState(defaultWidth ?? 256);
  const panelRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const collapsed = controlledCollapsed ?? internalCollapsed;

  const toggleCollapse = useCallback(() => {
    const next = !collapsed;
    setInternalCollapsed(next);
    onCollapsedChange?.(next);
  }, [collapsed, onCollapsedChange]);

  // Drag-to-resize logic
  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      startX.current = e.clientX;
      startWidth.current = width;

      const onMouseMove = (ev: MouseEvent) => {
        if (!isDragging.current) return;
        const delta = resizeSide === 'right'
          ? ev.clientX - startX.current
          : startX.current - ev.clientX;
        const newWidth = Math.min(maxWidth, Math.max(minWidth, startWidth.current + delta));
        setWidth(newWidth);
      };

      const onMouseUp = () => {
        isDragging.current = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [width, minWidth, maxWidth, resizeSide],
  );

  // Width style — only applied to fixed-width panels (not grow panels)
  const widthStyle = grow
    ? undefined
    : { width: collapsed ? 48 : width, minWidth: collapsed ? 48 : undefined };

  return (
    <div
      ref={panelRef}
      data-testid={testId}
      data-panel-id={id}
      data-collapsed={collapsed}
      className={cn(
        'relative flex flex-col overflow-hidden transition-[width] duration-200',
        hideBelow && hideClasses[hideBelow],
        grow && 'flex-1',
        !grow && 'shrink-0',
        className,
      )}
      style={widthStyle}
    >
      {/* Collapse toggle button */}
      {collapsible && (
        <button
          onClick={toggleCollapse}
          className={cn(
            'absolute top-3 z-20 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground',
            collapseSide === 'right' ? '-right-3' : '-left-3',
          )}
          title={collapsed ? 'Expand panel' : 'Collapse panel'}
        >
          {collapsed
            ? (collapseSide === 'right' ? <ChevronRight className="size-3" /> : <ChevronLeft className="size-3" />)
            : (collapseSide === 'right' ? <ChevronLeft className="size-3" /> : <ChevronRight className="size-3" />)}
        </button>
      )}

      {/* Panel content */}
      {!collapsed && (
        <>
          {header && (
            <div className="shrink-0 border-b border-border">
              {header}
            </div>
          )}
          <div className="flex-1 overflow-hidden">
            {children}
          </div>
          {footer && (
            <div className="shrink-0 border-t border-border">
              {footer}
            </div>
          )}
        </>
      )}

      {/* Collapsed indicator */}
      {collapsed && (
        <div className="flex h-full w-full items-center justify-center">
          <div className="h-8 w-1 rounded-full bg-muted" />
        </div>
      )}

      {/* Resize handle */}
      {resizable && !collapsed && (
        <div
          onMouseDown={onMouseDown}
          className={cn(
            'absolute top-0 bottom-0 z-10 flex w-1 cursor-col-resize items-center justify-center opacity-0 transition-opacity hover:opacity-100',
            resizeSide === 'right' ? 'right-0' : 'left-0',
          )}
        >
          <div className="h-8 w-1 rounded-full bg-ring/40" />
        </div>
      )}
    </div>
  );
}
