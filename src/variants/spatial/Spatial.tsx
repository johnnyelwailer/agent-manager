import { useState, useCallback, useRef } from 'react';
import type {
  StrategyPrimitive,
  ExecutionPrimitive,
  VerificationPrimitive,
  ContextPrimitive,
  AgentInfo,
} from '../../types/primitives';
import {
  strategies,
  executions,
  verifications,
  contexts,
  agents,
} from '../../data/mock';
import CanvasNode from './CanvasNode';
import CanvasEdge from './CanvasEdge';
import DetailSidebar from './DetailSidebar';
import styles from './Spatial.module.css';

/* ── types ────────────────────────────────────────────────────── */

type NodeType = 'strategy' | 'execution' | 'verification' | 'context' | 'agent';

interface CanvasNodeEntry {
  id: string;
  type: NodeType;
  data: StrategyPrimitive | ExecutionPrimitive | VerificationPrimitive | ContextPrimitive | AgentInfo;
  position: { x: number; y: number };
}

interface EdgeDef {
  fromId: string;
  toId: string;
  color: string;
}

/* ── flatten strategy tree ────────────────────────────────────── */

function flattenStrategies(list: StrategyPrimitive[]): StrategyPrimitive[] {
  const result: StrategyPrimitive[] = [];
  function walk(node: StrategyPrimitive) {
    result.push(node);
    node.children.forEach(walk);
  }
  list.forEach(walk);
  return result;
}

/* ── static data: nodes + positions ──────────────────────────── */

const allStrategies = flattenStrategies(strategies);

const NODE_POSITIONS: Record<string, { x: number; y: number }> = {
  // ── Column 1: Connected strategy nodes (left-to-right flow) ──
  'strat-1a':    { x: 80, y: 80 },
  'strat-1b-ii': { x: 80, y: 280 },
  'strat-1b':    { x: 80, y: 470 },

  // ── Column 2: Execution nodes ──
  'exec-1': { x: 400, y: 80 },
  'exec-2': { x: 400, y: 280 },
  'exec-5': { x: 400, y: 430 },
  'exec-6': { x: 400, y: 560 },

  // ── Column 3: Verification nodes ──
  'ver-1': { x: 720, y: 40 },
  'ver-2': { x: 720, y: 150 },
  'ver-3': { x: 720, y: 240 },
  'ver-4': { x: 720, y: 350 },
  'ver-5': { x: 720, y: 430 },
  'ver-6': { x: 720, y: 560 },

  // ── Remaining strategy nodes (below the flow) ──
  'strat-1':     { x: 80, y: 700 },
  'strat-1b-i':  { x: 80, y: 820 },
  'strat-1c':    { x: 80, y: 940 },
  'strat-2':     { x: 300, y: 700 },
  'strat-2a':    { x: 300, y: 820 },
  'strat-2b':    { x: 300, y: 940 },
  'strat-2c':    { x: 300, y: 1060 },
  'strat-3':     { x: 520, y: 700 },
  'strat-3a':    { x: 520, y: 820 },
  'strat-3b':    { x: 520, y: 940 },

  // ── Remaining execution nodes ──
  'exec-3': { x: 740, y: 700 },
  'exec-4': { x: 740, y: 820 },

  // ── Context nodes (floating, bottom area) ──
  'ctx-1': { x: 80,  y: 1200 },
  'ctx-2': { x: 350, y: 1200 },
  'ctx-3': { x: 620, y: 1200 },
  'ctx-4': { x: 890, y: 1200 },

  // ── Agent nodes ──
  'agent-1': { x: 80,  y: 1380 },
  'agent-2': { x: 350, y: 1380 },
  'agent-3': { x: 620, y: 1380 },
};

/* ── build canvas node list ──────────────────────────────────── */

const canvasNodes: CanvasNodeEntry[] = [
  ...allStrategies.map((s) => ({
    id: s.id,
    type: 'strategy' as NodeType,
    data: s,
    position: NODE_POSITIONS[s.id] ?? { x: 0, y: 0 },
  })),
  ...executions.map((e) => ({
    id: e.id,
    type: 'execution' as NodeType,
    data: e,
    position: NODE_POSITIONS[e.id] ?? { x: 0, y: 0 },
  })),
  ...verifications.map((v) => ({
    id: v.id,
    type: 'verification' as NodeType,
    data: v,
    position: NODE_POSITIONS[v.id] ?? { x: 0, y: 0 },
  })),
  ...contexts.map((c) => ({
    id: c.id,
    type: 'context' as NodeType,
    data: c,
    position: NODE_POSITIONS[c.id] ?? { x: 0, y: 0 },
  })),
  ...agents.map((a) => ({
    id: a.id,
    type: 'agent' as NodeType,
    data: a,
    position: NODE_POSITIONS[a.id] ?? { x: 0, y: 0 },
  })),
];

/* ── edge definitions (colours match source type) ────────────── */

const STRATEGY_COLOR = '#3b82f6';
const EXECUTION_GREEN = '#22c55e';
const EXECUTION_AMBER = '#f59e0b';
const EXECUTION_RED = '#ef4444';

const edges: EdgeDef[] = [
  // strategy → execution
  { fromId: 'strat-1a',    toId: 'exec-1', color: STRATEGY_COLOR },
  { fromId: 'strat-1b-ii', toId: 'exec-2', color: STRATEGY_COLOR },
  { fromId: 'strat-1b',    toId: 'exec-5', color: STRATEGY_COLOR },
  { fromId: 'strat-1b',    toId: 'exec-6', color: STRATEGY_COLOR },
  // execution → verification
  { fromId: 'exec-1', toId: 'ver-1', color: EXECUTION_GREEN },
  { fromId: 'exec-1', toId: 'ver-2', color: EXECUTION_GREEN },
  { fromId: 'exec-2', toId: 'ver-3', color: EXECUTION_AMBER },
  { fromId: 'exec-2', toId: 'ver-4', color: EXECUTION_AMBER },
  { fromId: 'exec-5', toId: 'ver-5', color: EXECUTION_RED },
  { fromId: 'exec-6', toId: 'ver-6', color: EXECUTION_AMBER },
];

/* ── helpers: position lookup ────────────────────────────────── */

function posOf(nodeId: string): { x: number; y: number } {
  return NODE_POSITIONS[nodeId] ?? { x: 0, y: 0 };
}

/* ── constants ────────────────────────────────────────────────── */

const MIN_ZOOM = 0.15;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.001;

/* ================================================================
   Spatial — main canvas component
   ================================================================ */

export default function Spatial() {
  /* ── pan / zoom state ──────────────────────────────────────── */
  const [pan, setPan] = useState({ x: 40, y: 20 });
  const [zoom, setZoom] = useState(0.85);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  /* ── selection state ───────────────────────────────────────── */
  const [selectedId, setSelectedId] = useState<string | null>(null);

  /* ── pan handlers ──────────────────────────────────────────── */
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // only primary button, and only on canvas (not on nodes)
      if (e.button !== 0) return;
      setIsPanning(true);
      panStart.current = {
        x: e.clientX,
        y: e.clientY,
        panX: pan.x,
        panY: pan.y,
      };
    },
    [pan],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isPanning) return;
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      setPan({
        x: panStart.current.panX + dx,
        y: panStart.current.panY + dy,
      });
    },
    [isPanning],
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsPanning(false);
  }, []);

  /* ── zoom handler (wheel) ──────────────────────────────────── */
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = -e.deltaY * ZOOM_STEP;
      setZoom((prev) => {
        const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev + delta));
        return Math.round(next * 100) / 100;
      });
    },
    [],
  );

  /* ── reset view ────────────────────────────────────────────── */
  const resetView = useCallback(() => {
    setPan({ x: 40, y: 20 });
    setZoom(0.85);
    setSelectedId(null);
  }, []);

  /* ── zoom buttons ──────────────────────────────────────────── */
  const zoomIn = useCallback(() => {
    setZoom((prev) => Math.min(MAX_ZOOM, Math.round((prev + 0.15) * 100) / 100));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((prev) => Math.max(MIN_ZOOM, Math.round((prev - 0.15) * 100) / 100));
  }, []);

  /* ── node click handler ────────────────────────────────────── */
  const handleNodeClick = useCallback((id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
  }, []);

  /* ── canvas click (deselect) ───────────────────────────────── */
  const handleCanvasClick = useCallback(() => {
    // only deselect if we didn't pan
    // (panning is already handled by mousedown/up without click)
  }, []);

  /* ── find selected node data ───────────────────────────────── */
  const selectedNode = selectedId
    ? canvasNodes.find((n) => n.id === selectedId) ?? null
    : null;

  /* ── render ────────────────────────────────────────────────── */
  return (
    <div
      data-testid="spatial-canvas"
      className={`${styles.canvas}${isPanning ? ` ${styles.panning}` : ''}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onWheel={handleWheel}
      onClick={handleCanvasClick}
    >
      {/* ── Transformed inner layer ──────────────────────────── */}
      <div
        className={styles.canvasInner}
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        }}
      >
        {/* ── Edge layer ───────────────────────────────────────── */}
        <div className={styles.edgeLayer}>
          {edges.map((edge) => (
            <CanvasEdge
              key={`${edge.fromId}-${edge.toId}`}
              from={posOf(edge.fromId)}
              to={posOf(edge.toId)}
              color={edge.color}
            />
          ))}
        </div>

        {/* ── Node layer ───────────────────────────────────────── */}
        {canvasNodes.map((node) => (
          <CanvasNode
            key={node.id}
            id={node.id}
            position={node.position}
            type={node.type}
            data={node.data}
            selected={selectedId === node.id}
            onClick={() => handleNodeClick(node.id)}
          />
        ))}
      </div>

      {/* ── Detail sidebar ───────────────────────────────────── */}
      {selectedNode && (
        <DetailSidebar
          nodeType={selectedNode.type}
          data={selectedNode.data}
          onClose={() => setSelectedId(null)}
        />
      )}

      {/* ── Bottom toolbar ───────────────────────────────────── */}
      <div className={styles.toolbar}>
        <button className={styles.toolbarBtn} onClick={zoomOut}>
          &minus;
        </button>
        <span className={styles.zoomLabel}>
          {Math.round(zoom * 100)}%
        </span>
        <button className={styles.toolbarBtn} onClick={zoomIn}>
          +
        </button>
        <div className={styles.toolbarDivider} />
        <button className={styles.toolbarBtn} onClick={resetView}>
          Reset View
        </button>
      </div>
    </div>
  );
}
