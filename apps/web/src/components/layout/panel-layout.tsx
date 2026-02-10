import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// PanelLayout — a convenience layout for arranging panels in rows/columns
// ---------------------------------------------------------------------------

export type PanelLayoutPreset =
  | 'sidebar-main'          // fixed sidebar + flex main
  | 'sidebar-main-detail'   // fixed sidebar + flex main + fixed detail
  | 'equal-split'           // two equal-width panels
  | 'triple-split'          // three equal-width panels
  | 'stacked';              // vertical stack (column direction)

export interface PanelLayoutProps {
  /** Layout preset controls flex direction and panel sizing defaults */
  preset?: PanelLayoutPreset;
  /** Panel children */
  children: React.ReactNode;
  /** Additional class names */
  className?: string;
  /** Gap between panels in pixels */
  gap?: number;
  /** Test ID */
  'data-testid'?: string;
}

export function PanelLayout({
  preset = 'sidebar-main',
  children,
  className,
  gap = 0,
  'data-testid': testId,
}: PanelLayoutProps) {
  const isStacked = preset === 'stacked';

  return (
    <div
      data-testid={testId}
      data-preset={preset}
      className={cn(
        'flex h-full overflow-hidden',
        isStacked ? 'flex-col' : 'flex-row',
        className,
      )}
      style={gap ? { gap } : undefined}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PanelSlot — a named slot within PanelLayout for semantic layout composition
// ---------------------------------------------------------------------------

export type PanelSlotRole = 'sidebar' | 'main' | 'detail' | 'header' | 'footer';

export interface PanelSlotProps {
  /** Semantic role for this slot */
  role: PanelSlotRole;
  /** Slot content */
  children: React.ReactNode;
  /** Fixed width (px) — only for sidebar/detail roles */
  width?: number;
  /** Whether this slot stretches to fill remaining space */
  grow?: boolean;
  /** Hide below this breakpoint */
  hideBelow?: 'sm' | 'md' | 'lg' | 'xl';
  /** Border style */
  border?: 'left' | 'right' | 'top' | 'bottom' | 'none';
  /** Additional class names */
  className?: string;
}

const hideMap: Record<string, string> = {
  sm: 'max-sm:hidden',
  md: 'max-md:hidden',
  lg: 'max-lg:hidden',
  xl: 'max-xl:hidden',
};

const borderMap: Record<string, string> = {
  left: 'border-l border-border',
  right: 'border-r border-border',
  top: 'border-t border-border',
  bottom: 'border-b border-border',
  none: '',
};

export function PanelSlot({
  role,
  children,
  width,
  grow = false,
  hideBelow,
  border = 'none',
  className,
}: PanelSlotProps) {
  return (
    <div
      data-slot={role}
      className={cn(
        'overflow-hidden',
        grow ? 'flex-1' : 'shrink-0',
        hideBelow && hideMap[hideBelow],
        borderMap[border],
        className,
      )}
      style={!grow && width ? { width } : undefined}
    >
      {children}
    </div>
  );
}
