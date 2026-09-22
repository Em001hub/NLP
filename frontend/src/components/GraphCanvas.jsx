import React, { useMemo, useCallback } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  MarkerType,
  useNodesState,
  useEdgesState,
} from "reactflow";
import "reactflow/dist/style.css";
import dagre from "dagre";

const TYPE_COLORS = {
  PERSON: "#00ff9d",
  ORG: "#00f0ff",
  LOC: "#ffb703",
  STAT: "#ff2a5f",
  NUMBER: "#ff2a5f",
  EVENT: "#fb8500",
  DATE: "#8ecae6",
  MISC: "#b5179e",
};

const NODE_W = 220;
const NODE_H = 75;

function layout(nodes, edges) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 75, ranksep: 140 });

  nodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  edges.forEach((e) => g.setEdge(e.source, e.target));

  dagre.layout(g);

  return nodes.map((n) => {
    const pos = g.node(n.id);
    return {
      ...n,
      position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 },
    };
  });
}

function CustomEntityNode({ data }) {
  const color = TYPE_COLORS[data.type] || TYPE_COLORS.MISC;
  const isSelected = data.isSelected;
  const isDimmed = data.isDimmed;
  const isHighlighted = data.isHighlighted;

  const numbersList = data.numbers || [];
  const primaryNumber = numbersList.length > 0 ? numbersList[0] : null;

  return (
    <div
      style={{
        width: NODE_W,
        minHeight: NODE_H,
        background: isHighlighted
          ? "rgba(18, 38, 48, 0.98)"
          : isSelected
          ? "rgba(15, 30, 40, 0.95)"
          : "rgba(11, 20, 28, 0.92)",
        backdropFilter: "blur(12px)",
        border: `1.5px solid ${isHighlighted ? "var(--neon-green)" : isSelected ? color : `${color}66`}`,
        borderRadius: 8,
        padding: "10px 12px",
        boxShadow: isHighlighted
          ? `0 0 20px rgba(0, 255, 157, 0.6), inset 0 0 10px rgba(0, 255, 157, 0.2)`
          : isSelected
          ? `0 0 16px ${color}80, inset 0 0 8px ${color}30`
          : `0 4px 16px rgba(0,0,0,0.6), 0 0 8px ${color}20`,
        opacity: isDimmed ? 0.3 : 1.0,
        transform: isHighlighted ? "scale(1.04)" : "scale(1)",
        transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
        cursor: "pointer",
        position: "relative",
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{
          background: color,
          width: 8,
          height: 8,
          border: "2px solid #05080b",
          boxShadow: `0 0 8px ${color}`,
        }}
      />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: color,
              boxShadow: `0 0 8px ${color}`,
            }}
          />
          <span
            className="wire-label"
            style={{
              color,
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: "0.05em",
            }}
          >
            {data.type}
          </span>
        </div>

        {data.role && (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              color: "var(--neon-cyan)",
              background: "rgba(0, 240, 255, 0.1)",
              padding: "1px 5px",
              borderRadius: 3,
              maxWidth: 90,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={data.role}
          >
            {data.role}
          </span>
        )}
      </div>

      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 13.5,
          fontWeight: 700,
          color: isHighlighted ? "#ffffff" : "var(--text)",
          lineHeight: 1.25,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={data.label}
      >
        {data.label}
      </div>

      {primaryNumber && (
        <div
          style={{
            marginTop: 4,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            background: "rgba(255, 42, 95, 0.15)",
            border: "1px solid rgba(255, 42, 95, 0.4)",
            borderRadius: 3,
            padding: "1px 5px",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            fontWeight: 700,
            color: "var(--neon-red)",
            boxShadow: "0 0 6px rgba(255, 42, 95, 0.2)",
          }}
        >
          <span>⚡</span>
          <span>{primaryNumber}</span>
        </div>
      )}

      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9.5,
          color: "var(--muted)",
          marginTop: primaryNumber ? 3 : 4,
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>{data.mentions} mention{data.mentions === 1 ? "" : "s"}</span>
        <span>{Math.round((data.confidence || 0.95) * 100)}% conf</span>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: color,
          width: 8,
          height: 8,
          border: "2px solid #05080b",
          boxShadow: `0 0 8px ${color}`,
        }}
      />
    </div>
  );
}

const nodeTypes = { entity: CustomEntityNode };

export default function GraphCanvas({ graph, searchQuery = "", highlightedNodeIds = [], onSelectElement, selectedElement }) {
  const { processedNodes, processedEdges } = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const hlSet = new Set(highlightedNodeIds || []);

    const rawNodes = graph.nodes || [];
    const rawEdges = graph.edges || [];

    const rfNodes = rawNodes.map((n) => {
      const matchSearch = q ? n.label.toLowerCase().includes(q) || (n.facts || []).some((f) => f.toLowerCase().includes(q)) : false;
      const isHighlighted = hlSet.has(n.id) || (q.length > 1 && matchSearch);
      const isDimmed = (q.length > 1 || hlSet.size > 0) && !isHighlighted;
      const isSelected = selectedElement && !selectedElement.isEdge && selectedElement.id === n.id;

      return {
        id: n.id,
        type: "entity",
        data: {
          ...n,
          isSelected,
          isDimmed,
          isHighlighted,
        },
        position: { x: 0, y: 0 },
      };
    });

    const rfEdges = rawEdges.map((e) => {
      const isStrong = e.weight >= 2;
      const hasFacts = e.facts && e.facts.length > 0;
      const edgeLabel = hasFacts ? `${e.relation} (${e.facts[0]})` : e.relation;
      const isSelected = selectedElement && selectedElement.isEdge && selectedElement.id === e.id;

      return {
        id: e.id,
        source: e.source,
        target: e.target,
        label: edgeLabel,
        labelStyle: {
          fill: isSelected ? "var(--neon-green)" : "var(--text-dim)",
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          fontWeight: 600,
        },
        labelBgStyle: {
          fill: "#070e13",
          fillOpacity: 0.95,
          stroke: isSelected ? "var(--neon-green)" : "var(--hairline-bright)",
          strokeWidth: 1,
          rx: 4,
          ry: 4,
        },
        labelBgPadding: [6, 4],
        style: {
          stroke: isSelected ? "var(--neon-green)" : isStrong ? "var(--neon-cyan)" : "rgba(0, 255, 157, 0.3)",
          strokeWidth: isSelected ? 2.5 : isStrong ? 2 : 1.2,
          filter: isStrong ? "drop-shadow(0 0 6px rgba(0, 240, 255, 0.4))" : "none",
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isSelected ? "var(--neon-green)" : isStrong ? "var(--neon-cyan)" : "rgba(0, 255, 157, 0.4)",
        },
        animated: isStrong || isSelected,
        data: { ...e },
      };
    });

    const positionedNodes = layout(rfNodes, rfEdges);
    return { processedNodes: positionedNodes, processedEdges: rfEdges };
  }, [graph, searchQuery, highlightedNodeIds, selectedElement]);

  const [nodes, , onNodesChange] = useNodesState(processedNodes);
  const [edges, , onEdgesChange] = useEdgesState(processedEdges);

  // Sync state when processedNodes change
  React.useEffect(() => {
    onNodesChange(processedNodes.map((n) => ({ type: "reset", item: n })));
  }, [processedNodes, onNodesChange]);

  React.useEffect(() => {
    onEdgesChange(processedEdges.map((e) => ({ type: "reset", item: e })));
  }, [processedEdges, onEdgesChange]);

  const onEdgeClick = useCallback(
    (_, edge) => {
      if (onSelectElement) onSelectElement({ isEdge: true, ...edge });
    },
    [onSelectElement]
  );

  const onNodeClick = useCallback(
    (_, node) => {
      if (onSelectElement) onSelectElement({ isEdge: false, ...node });
    },
    [onSelectElement]
  );

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onEdgeClick={onEdgeClick}
        onNodeClick={onNodeClick}
        fitView
        minZoom={0.15}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#0c1720" gap={24} size={1.2} />
        <Controls showInteractive={false} position="bottom-left" />
        <MiniMap
          pannable
          zoomable
          maskColor="rgba(5, 8, 11, 0.85)"
          nodeColor={(n) => TYPE_COLORS[n.data?.type] || "#00ff9d"}
          style={{
            background: "rgba(11, 19, 26, 0.9)",
            border: "1px solid var(--hairline-bright)",
            borderRadius: 6,
          }}
          className="hide-mobile"
        />
      </ReactFlow>
    </div>
  );
}
