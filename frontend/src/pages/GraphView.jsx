import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";
import Legend from "../components/Legend.jsx";
import GraphCanvas from "../components/GraphCanvas.jsx";
import { api } from "../api.js";

export default function GraphView() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const graph = state?.graph;
  const rawText = state?.rawText || "";

  // Inspector & Q&A state
  const [activeTab, setActiveTab] = useState("inspector"); // "inspector" | "qa"
  const [selectedElement, setSelectedElement] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [saveMsg, setSaveMsg] = useState("");

  // Q&A assistant state
  const [qaQuery, setQaQuery] = useState("");
  const [qaLoading, setQaLoading] = useState(false);
  const [qaHistory, setQaHistory] = useState([]);
  const [highlightedNodeIds, setHighlightedNodeIds] = useState([]);

  // Mobile drawer slider level: 0 = hidden (100% diagram), 1 = split (48vh), 2 = full (85vh)
  const [drawerLevel, setDrawerLevel] = useState(0);

  // Desktop sidebar collapse toggle
  const [desktopPanelVisible, setDesktopPanelVisible] = useState(true);

  if (!graph) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <Navbar />
        <div style={{ padding: 60, textAlign: "center", margin: "auto" }}>
          <div className="pulse-dot" style={{ margin: "0 auto 16px", width: 14, height: 14 }} />
          <p className="wire-label" style={{ fontSize: 14, color: "var(--neon-green)" }}>
            NO GRAPH DATA LOADED IN CURRENT SESSION.
          </p>
          <button className="btn btn-primary" onClick={() => navigate("/")} style={{ marginTop: 16 }}>
            ← Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  async function handleSave() {
    try {
      const res = await api.saveGraph(graph.article_title.slice(0, 40), graph);
      setSaveMsg(`Saved as "${res.saved_as}"`);
      setTimeout(() => setSaveMsg(""), 3500);
    } catch (e) {
      setSaveMsg(e.message);
    }
  }

  async function handleAskQuestion(customQ) {
    const q = customQ || qaQuery;
    if (!q.trim()) return;
    setQaLoading(true);
    try {
      const resp = await api.askGraph({
        query: q,
        graph,
        articleText: rawText,
      });

      const newEntry = {
        question: q,
        answer: resp.answer,
        nodeIds: resp.relevant_node_ids || [],
        facts: resp.relevant_facts || [],
      };

      setQaHistory((prev) => [newEntry, ...prev]);
      if (resp.relevant_node_ids?.length > 0) {
        setHighlightedNodeIds(resp.relevant_node_ids);
      }
      setQaQuery("");
    } catch (e) {
      setQaHistory((prev) => [
        { question: q, answer: `Error: ${e.message}`, nodeIds: [], facts: [] },
        ...prev,
      ]);
    } finally {
      setQaLoading(false);
    }
  }

  function handleSelectElement(el) {
    setSelectedElement(el);
    setActiveTab("inspector");
    // On mobile, slide open to split view if currently hidden so diagram is still visible
    if (drawerLevel === 0) {
      setDrawerLevel(1);
    }
  }

  function focusConnectedNode(targetId) {
    const targetNode = (graph.nodes || []).find((n) => n.id === targetId);
    if (targetNode) {
      setSelectedElement({ isEdge: false, id: targetNode.id, data: targetNode });
      setHighlightedNodeIds([targetNode.id]);
    }
  }

  // Filter nodes if categoryFilter is active
  const displayedGraph = React.useMemo(() => {
    if (categoryFilter === "ALL") return graph;
    const filteredNodes = (graph.nodes || []).filter((n) => n.type === categoryFilter);
    const validIds = new Set(filteredNodes.map((n) => n.id));
    const filteredEdges = (graph.edges || []).filter(
      (e) => validIds.has(e.source) && validIds.has(e.target)
    );
    return {
      ...graph,
      nodes: filteredNodes,
      edges: filteredEdges,
    };
  }, [graph, categoryFilter]);

  // Find connections for selected node
  const connectedEdges = React.useMemo(() => {
    if (!selectedElement || selectedElement.isEdge) return [];
    const nid = selectedElement.id;
    return (graph.edges || []).filter((e) => e.source === nid || e.target === nid);
  }, [graph, selectedElement]);

  const drawerClass =
    drawerLevel === 0 ? "drawer-hidden" : drawerLevel === 1 ? "drawer-split" : "drawer-full";

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <Navbar />

      {/* Top Header & Telemetry Bar */}
      <div
        className="mobile-compact-header"
        style={{
          padding: "10px 18px",
          borderBottom: "1px solid var(--hairline-bright)",
          background: "rgba(9, 15, 20, 0.95)",
          backdropFilter: "blur(12px)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          zIndex: 20,
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: "1 1 260px" }}>
            <div className="mobile-badges-row" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className="badge" style={{ background: "rgba(0,255,157,0.12)", color: "var(--neon-green)", border: "1px solid rgba(0,255,157,0.3)" }}>
                {graph.entity_count} Entities
              </span>
              <span className="badge" style={{ background: "rgba(0,240,255,0.12)", color: "var(--neon-cyan)", border: "1px solid rgba(0,240,255,0.3)" }}>
                {graph.edges.length} Relations
              </span>
              <span className="badge hide-mobile" style={{ background: "rgba(255,183,3,0.12)", color: "var(--neon-amber)", border: "1px solid rgba(255,183,3,0.3)" }}>
                {graph.sentence_count} Sentences
              </span>
            </div>

            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(15px, 2vw, 19px)",
                fontWeight: 700,
                margin: 0,
                color: "#ffffff",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: "75vw",
              }}
              title={graph.article_title}
            >
              {graph.article_title}
            </h1>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {graph.article_url && (
              <a
                href={graph.article_url}
                target="_blank"
                rel="noreferrer"
                className="btn hide-mobile"
                style={{ fontSize: 11, padding: "5px 10px" }}
              >
                Article ↗
              </a>
            )}
            <button className="btn" onClick={handleSave} style={{ fontSize: 11, padding: "5px 10px" }}>
              💾 Save
            </button>
            <button
              className="btn btn-primary"
              onClick={() => navigate("/")}
              style={{ fontSize: 11, padding: "5px 10px" }}
            >
              ← Back
            </button>
            <button
              className="btn hide-mobile"
              onClick={() => setDesktopPanelVisible((v) => !v)}
              style={{ fontSize: 11, padding: "5px 10px" }}
              title="Toggle sidebar to maximize diagram space"
            >
              {desktopPanelVisible ? "⇥ Hide Panel" : "⇤ Show Panel"}
            </button>
          </div>
        </div>

        {/* Filter & Legend Controls */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flex: "1 1 200px", maxWidth: 320 }}>
            <input
              placeholder="Filter graph nodes / numbers…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: "100%", padding: "4px 8px", fontSize: 12 }}
            />
            {searchQuery && (
              <button
                className="btn"
                style={{ padding: "3px 7px", fontSize: 10 }}
                onClick={() => setSearchQuery("")}
              >
                Clear
              </button>
            )}
          </div>

          <div className="hide-mobile">
            <Legend />
          </div>
        </div>

        {saveMsg && (
          <div className="wire-label" style={{ color: "var(--neon-green)", fontSize: 10.5 }}>
            ✓ {saveMsg}
          </div>
        )}
      </div>

      {/* Main Content Area: Graph Canvas + Cyber HUD Inspector */}
      <div style={{ flex: 1, display: "flex", position: "relative", overflow: "hidden", width: "100%", height: "100%" }}>
        {/* Graph Canvas Container (Full size on all viewports) */}
        <div className="graph-canvas-container">
          <GraphCanvas
            graph={displayedGraph}
            searchQuery={searchQuery}
            highlightedNodeIds={highlightedNodeIds}
            onSelectElement={handleSelectElement}
            selectedElement={selectedElement}
          />

          {/* Quick Floating Slide HUD Controls on Mobile */}
          <div
            style={{
              position: "absolute",
              bottom: 14,
              right: 14,
              zIndex: 40,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              alignItems: "flex-end",
            }}
          >
            {drawerLevel === 0 && (
              <button
                className="btn btn-primary"
                style={{
                  fontSize: 12,
                  padding: "9px 15px",
                  boxShadow: "0 0 20px var(--neon-green-glow)",
                  borderRadius: 20,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
                onClick={() => setDrawerLevel(1)}
              >
                <span className="pulse-dot" />
                <span>⚡ Slide Intel Panel In</span>
              </button>
            )}
          </div>
        </div>

        {/* Cyber-HUD Side Panel / Slider Drawer */}
        {(desktopPanelVisible || drawerLevel > 0) && (
          <aside className={`cyber-panel scroll-thin graph-side-panel ${drawerClass}`}>
            {/* Mobile Drag / Slider Header Handle */}
            <div className="slide-drawer-handle" onClick={() => setDrawerLevel((prev) => (prev === 2 ? 0 : prev + 1))}>
              <div className="slide-grab-pill" />
              <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span className="wire-label" style={{ color: "var(--neon-green)", fontSize: 10 }}>
                    PANEL SLIDER //
                  </span>
                  <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text)" }}>
                    {drawerLevel === 1 ? "SPLIT VIEW (50%)" : "FULL VIEW (85%)"}
                  </span>
                </div>

                {/* Slider Level Controls */}
                <div style={{ display: "flex", alignItems: "center", gap: 4 }} onClick={(e) => e.stopPropagation()}>
                  <button
                    className="btn"
                    style={{
                      fontSize: 10,
                      padding: "2px 7px",
                      background: drawerLevel === 1 ? "var(--neon-green)" : "rgba(10,20,28,0.8)",
                      color: drawerLevel === 1 ? "#000" : "var(--text-dim)",
                    }}
                    onClick={() => setDrawerLevel(1)}
                  >
                    Half
                  </button>
                  <button
                    className="btn"
                    style={{
                      fontSize: 10,
                      padding: "2px 7px",
                      background: drawerLevel === 2 ? "var(--neon-green)" : "rgba(10,20,28,0.8)",
                      color: drawerLevel === 2 ? "#000" : "var(--text-dim)",
                    }}
                    onClick={() => setDrawerLevel(2)}
                  >
                    Full
                  </button>
                  <button
                    className="btn btn-danger"
                    style={{ fontSize: 10, padding: "2px 7px" }}
                    onClick={() => setDrawerLevel(0)}
                    title="Slide drawer down to view 100% diagram"
                  >
                    ✕ Slide Out
                  </button>
                </div>
              </div>
            </div>

            {/* HUD Tabs */}
            <div
              style={{
                display: "flex",
                borderBottom: "1px solid var(--hairline-bright)",
                background: "rgba(5, 9, 13, 0.8)",
                flexShrink: 0,
              }}
            >
              <button
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  background: activeTab === "inspector" ? "rgba(0, 255, 157, 0.1)" : "transparent",
                  color: activeTab === "inspector" ? "var(--neon-green)" : "var(--text-dim)",
                  border: "none",
                  borderBottom: activeTab === "inspector" ? "2px solid var(--neon-green)" : "2px solid transparent",
                  fontFamily: "var(--font-display)",
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: "pointer",
                  letterSpacing: "0.04em",
                }}
                onClick={() => setActiveTab("inspector")}
              >
                🔍 Entity Inspector
              </button>
              <button
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  background: activeTab === "qa" ? "rgba(0, 255, 157, 0.1)" : "transparent",
                  color: activeTab === "qa" ? "var(--neon-green)" : "var(--text-dim)",
                  border: "none",
                  borderBottom: activeTab === "qa" ? "2px solid var(--neon-green)" : "2px solid transparent",
                  fontFamily: "var(--font-display)",
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: "pointer",
                  letterSpacing: "0.04em",
                }}
                onClick={() => setActiveTab("qa")}
              >
                ⚡ Story Q&A Assistant
              </button>
            </div>

            {/* TAB 1: INSPECTOR */}
            {activeTab === "inspector" && (
              <div style={{ padding: 16, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
                {!selectedElement ? (
                  <div style={{ textAlign: "center", padding: "20px 10px", color: "var(--text-dim)" }}>
                    <div className="pulse-dot" style={{ margin: "0 auto 10px" }} />
                    <p className="wire-label" style={{ fontSize: 11 }}>
                      TAP ANY NODE OR EDGE IN THE DIAGRAM TO INSPECT DETAILS & NUMBERS
                    </p>
                  </div>
                ) : !selectedElement.isEdge ? (
                  /* Node Details */
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <span className="badge" style={{ background: "rgba(0, 255, 157, 0.15)", color: "var(--neon-green)", border: "1px solid rgba(0, 255, 157, 0.3)" }}>
                          {selectedElement.data?.type || "ENTITY"}
                        </span>
                        {selectedElement.data?.role && (
                          <span className="badge" style={{ background: "rgba(0, 240, 255, 0.15)", color: "var(--neon-cyan)" }}>
                            {selectedElement.data.role}
                          </span>
                        )}
                      </div>
                      <h2 style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 800, margin: "4px 0 0", color: "#ffffff" }}>
                        {selectedElement.data?.label}
                      </h2>
                    </div>

                    {/* Numbers & Quantitative Facts */}
                    {selectedElement.data?.numbers?.length > 0 && (
                      <div style={{ background: "rgba(255, 42, 95, 0.1)", border: "1px solid rgba(255, 42, 95, 0.35)", borderRadius: 6, padding: 10 }}>
                        <div className="wire-label" style={{ color: "var(--neon-red)", marginBottom: 6 }}>
                          ⚡ QUANTITATIVE FACTS / CASUALTY FIGURES
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                          {selectedElement.data.numbers.map((num, idx) => (
                            <div key={idx} style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, fontWeight: 700, color: "#ffffff", display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ color: "var(--neon-red)" }}>▶</span>
                              <span>{num}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Telemetry stats */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div style={{ background: "rgba(12, 22, 30, 0.8)", padding: "7px 10px", borderRadius: 4, border: "1px solid var(--hairline)" }}>
                        <div className="wire-label">MENTIONS</div>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
                          {selectedElement.data?.mentions || 1}
                        </div>
                      </div>
                      <div style={{ background: "rgba(12, 22, 30, 0.8)", padding: "7px 10px", borderRadius: 4, border: "1px solid var(--hairline)" }}>
                        <div className="wire-label">CONFIDENCE</div>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: "var(--neon-green)" }}>
                          {Math.round((selectedElement.data?.confidence || 0.95) * 100)}%
                        </div>
                      </div>
                    </div>

                    {/* Connected Entities */}
                    {connectedEdges.length > 0 && (
                      <div>
                        <div className="wire-label" style={{ marginBottom: 6, color: "var(--neon-cyan)" }}>
                          CONNECTED NETWORK NODES ({connectedEdges.length})
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                          {connectedEdges.map((e) => {
                            const otherId = e.source === selectedElement.id ? e.target : e.source;
                            const otherNode = (graph.nodes || []).find((n) => n.id === otherId);
                            if (!otherNode) return null;
                            return (
                              <div
                                key={e.id}
                                onClick={() => focusConnectedNode(otherId)}
                                style={{
                                  background: "rgba(14, 25, 33, 0.75)",
                                  border: "1px solid var(--hairline-bright)",
                                  borderRadius: 5,
                                  padding: "6px 9px",
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  cursor: "pointer",
                                  transition: "all 0.15s ease",
                                }}
                              >
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--muted)" }}>
                                    {e.relation} →
                                  </span>
                                  <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, color: "#ffffff" }}>
                                    {otherNode.label}
                                  </span>
                                </div>
                                <span className="wire-label" style={{ fontSize: 9, color: "var(--neon-green)" }}>
                                  JUMP ↗
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Extracted Context Facts */}
                    {selectedElement.data?.facts?.length > 0 && (
                      <div>
                        <div className="wire-label" style={{ marginBottom: 6 }}>
                          SOURCE EXTRACTS & QUOTES
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {selectedElement.data.facts.map((fact, idx) => (
                            <div
                              key={idx}
                              style={{
                                background: "rgba(10, 18, 25, 0.8)",
                                borderLeft: "2px solid var(--neon-green)",
                                padding: "7px 9px",
                                fontSize: 12,
                                lineHeight: 1.45,
                                color: "var(--text)",
                              }}
                            >
                              "{fact}"
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Ask AI quick trigger */}
                    <button
                      className="btn"
                      style={{ marginTop: 4, fontSize: 11.5 }}
                      onClick={() => {
                        setActiveTab("qa");
                        setQaQuery(`What is the role and key facts regarding ${selectedElement.data?.label}?`);
                      }}
                    >
                      ⚡ Ask AI Intelligence about {selectedElement.data?.label}
                    </button>
                  </div>
                ) : (
                  /* Edge Details */
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                      <span className="badge" style={{ background: "rgba(0, 240, 255, 0.15)", color: "var(--neon-cyan)" }}>
                        RELATIONSHIP EDGE
                      </span>
                      <h2 style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 800, margin: "4px 0 0", color: "#ffffff" }}>
                        {selectedElement.label || selectedElement.relation}
                      </h2>
                    </div>

                    <div style={{ background: "rgba(12, 22, 30, 0.8)", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--hairline)" }}>
                      <div className="wire-label">WEIGHT / STRENGTH</div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: "var(--neon-green)" }}>
                        {selectedElement.data?.weight || 1}x Dependency Strength
                      </div>
                    </div>

                    {selectedElement.data?.facts?.length > 0 && (
                      <div style={{ background: "rgba(255, 42, 95, 0.1)", border: "1px solid rgba(255, 42, 95, 0.35)", borderRadius: 6, padding: 8 }}>
                        <div className="wire-label" style={{ color: "var(--neon-red)", marginBottom: 4 }}>
                          ASSOCIATED FIGURES
                        </div>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#ffffff" }}>
                          {selectedElement.data.facts.join(", ")}
                        </div>
                      </div>
                    )}

                    {selectedElement.data?.sentence && (
                      <div>
                        <div className="wire-label" style={{ marginBottom: 4 }}>
                          VERBATIM SOURCE SENTENCE
                        </div>
                        <div
                          style={{
                            background: "rgba(10, 18, 25, 0.85)",
                            borderLeft: "2px solid var(--neon-cyan)",
                            padding: "8px 10px",
                            fontSize: 12.5,
                            lineHeight: 1.5,
                            color: "var(--text)",
                          }}
                        >
                          "{selectedElement.data.sentence}"
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: STORY Q&A ASSISTANT */}
            {activeTab === "qa" && (
              <div style={{ padding: 16, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <div className="wire-label" style={{ color: "var(--neon-green)", marginBottom: 4 }}>
                    AI STORY INTELLIGENCE
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-dim)", margin: 0 }}>
                    Ask questions grounded in the extracted graph nodes, death tolls, and relationships.
                  </p>
                </div>

                {/* Preset Query Chips */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {[
                    "What are the numbers & casualties?",
                    "Who are the key people involved?",
                    "Summarize the main events",
                  ].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      className="btn"
                      style={{ fontSize: 10, padding: "4px 7px" }}
                      onClick={() => handleAskQuestion(chip)}
                    >
                      {chip}
                    </button>
                  ))}
                </div>

                {/* Query Form */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleAskQuestion();
                  }}
                  style={{ display: "flex", gap: 6 }}
                >
                  <input
                    style={{ flex: 1, fontSize: 12.5, padding: "7px 9px" }}
                    placeholder="Ask a question about this story…"
                    value={qaQuery}
                    onChange={(e) => setQaQuery(e.target.value)}
                  />
                  <button className="btn btn-primary" type="submit" disabled={qaLoading} style={{ fontSize: 11.5, padding: "7px 11px" }}>
                    {qaLoading ? "..." : "Ask"}
                  </button>
                </form>

                {/* History Stream */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
                  {qaLoading && (
                    <div className="cyber-panel" style={{ padding: 10, textAlign: "center" }}>
                      <div className="pulse-dot" style={{ margin: "0 auto 4px" }} />
                      <span className="wire-label" style={{ color: "var(--neon-green)", fontSize: 10 }}>
                        ANALYZING STORY GRAPH...
                      </span>
                    </div>
                  )}

                  {qaHistory.map((item, idx) => (
                    <div
                      key={idx}
                      className="cyber-panel"
                      style={{
                        padding: 10,
                        border: "1px solid var(--hairline-bright)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12.5, color: "var(--neon-cyan)" }}>
                        Q: {item.question}
                      </div>
                      <div style={{ fontSize: 12, lineHeight: 1.45, color: "var(--text)" }}>
                        {item.answer}
                      </div>

                      {item.facts?.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 2 }}>
                          {item.facts.map((f, fIdx) => (
                            <span
                              key={fIdx}
                              className="badge"
                              style={{ background: "rgba(255,42,95,0.15)", color: "var(--neon-red)", fontSize: 9 }}
                            >
                              ⚡ {f}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}

