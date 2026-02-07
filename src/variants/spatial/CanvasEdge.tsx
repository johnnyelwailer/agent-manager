interface CanvasEdgeProps {
  from: { x: number; y: number };
  to: { x: number; y: number };
  color: string;
}

export default function CanvasEdge({ from, to, color }: CanvasEdgeProps) {
  const NODE_WIDTH = 240;
  const NODE_HEIGHT = 90;

  // Start from right-center of source node
  const x1 = from.x + NODE_WIDTH;
  const y1 = from.y + NODE_HEIGHT / 2;

  // End at left-center of target node
  const x2 = to.x;
  const y2 = to.y + NODE_HEIGHT / 2;

  // Quadratic bezier control point — offset horizontally for a gentle curve
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;

  const markerId = `arrow-${Math.round(x1)}-${Math.round(y1)}-${Math.round(x2)}-${Math.round(y2)}`;

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        overflow: 'visible',
        pointerEvents: 'none',
      }}
      width="1"
      height="1"
    >
      <defs>
        <marker
          id={markerId}
          markerWidth="8"
          markerHeight="6"
          refX="8"
          refY="3"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <polygon points="0 0, 8 3, 0 6" fill={color} />
        </marker>
      </defs>
      <path
        d={`M ${x1},${y1} Q ${cx},${cy} ${x2},${y2}`}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeOpacity={0.6}
        markerEnd={`url(#${markerId})`}
      />
    </svg>
  );
}
