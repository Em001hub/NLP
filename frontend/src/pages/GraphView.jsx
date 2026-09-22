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

  // Mobile drawer collapse state
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

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
    setMobileDrawerOpen(true);
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

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <Navbar />

      {/* Top Header & Telemetry Bar */}
      <div
        style={{
          padding: "12px 20px",
          borderBottom: "1px solid var(--hairline-bright)",
          background: "rgba(9, 15, 20, 0.95)",
          backdropFilter: "blur(12px)",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          zIndex: 20,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, flex: "1 1 300px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span className="badge" style={{ background: "rgba(0,255,157,0.12)", color: "var(--neon-green)", border: "1px solid rgba(0,255,157,0.3)" }}>
                {graph.entity_count} Entities
              </span>
              <span className="badge" style={{ background: "rgba(0,240,255,0.12)", color: "var(--neon-cyan)", border: "1px solid rgba(0,240,255,0.3)" }}>
                {graph.edges.length} Relationships
              </span>
              <span className="badge" style={{ background: "rgba(255,183,3,0.12)", color: "var(--neon-amber)", border: "1px solid rgba(255,183,3,0.3)" }}>
                {graph.sentence_count} Sentences
              </span>
              <span className="wire-label hide-mobile" style={{ color: "var(--muted)" }}>
                LANG: {graph.detected_languages?.join(", ").toUpperCase() || "EN"}
              </span>
            </div>

            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(16px, 2.2vw, 20px)",
                fontWeight: 700,
                margin: 0,
                color: "#ffffff",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: "80vw",
              }}
              title={graph.article_title}
            >
              {graph.article_title}
            </h1>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            {graph.article_url && (
              <a
                href={graph.article_url}
                target="_blank"
                rel="noreferrer"
                className="btn hide-mobile"
                style={{ fontSize: 11.5, padding: "6px 12px" }}
              >
                Article URL ↗
              </a>
            )}
            <button className="btn" onClick={handleSave} style={{ fontSize: 11.5, padding: "6px 12px" }}>
              💾 Save
            </button>
            <button
              className="btn btn-primary"
              onClick={() => navigate("/")}
              style={{ fontSize: 11.5, padding: "6px 12px" }}
            >
              ← Dashboard
            </button>
          </div>
        </div>

        {/* Filter & Legend Controls */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {/* Query Filter Input */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "1 1 240px", maxWidth: 360 }}>
            <input
              placeholder="Filter graph nodes / numbers…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: "100%", padding: "5px 10px", fontSize: 12.5 }}
            />
            {searchQuery && (
              <button
                className="btn"
                style={{ padding: "4px 8px", fontSize: 11 }}
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
          <div className="wire-label" style={{ color: "var(--neon-green)", fontSize: 11 }}>
            ✓ {saveMsg}
          </div>
        )}
      </div>

      {/* Main Content Area: Graph Canvas + Cyber HUD Inspector */}
      <div style={{ flex: 1, display: "flex", position: "relative", overflow: "hidden" }}>
        {/* Graph Canvas */}
        <div style={{ flex: 1, position: "relative", height: "100%" }}>
          <GraphCanvas
            graph={displayedGraph}
            searchQuery={searchQuery}
            highlightedNodeIds={highlightedNodeIds}
            onSelectElement={handleSelectElement}
            selectedElement={selectedElement}
          />

          {/* Quick Floating HUD Toggle on Mobile */}
          <button
            className="btn btn-primary"
            style={{
              position: "absolute",
              bottom: 16,
              right: 16,
              zIndex: 30,
              fontSize: 12,
              padding: "8px 14px",
              boxShadow: "0 0 16px var(--neon-green-glow)",
            }}
            onClick={() => setMobileDrawerOpen((v) => !v)}
          >
            {mobileDrawerOpen ? "✕ Close HUD" : "⚡ Open Intelligence HUD"}
          </button>
        </div>

        {/* Cyber-HUD Side Panel / Drawer */}
        <aside
          className="cyber-panel scroll-thin"
          style={{
            width: "clamp(320px, 30vw, 420px)",
            borderLeft: "1px solid var(--hairline-bright)",
            borderTop: "none",
            borderRight: "none",
            borderBottom: "none",
            borderRadius: 0,
            background: "rgba(8, 14, 20, 0.96)",
            display: "flex",
            flexDirection: "column",
            zIndex: 35,
            transition: "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
            position: "relative",
            ...(mobileDrawerOpen ? {} : {}),
          }}
        >
          {/* HUD Tabs */}
          <div
            style={{
              display: "flex",
              borderBottom: "1px solid var(--hairline-bright)",
              background: "rgba(5, 9, 13, 0.8)",
            }}
          >
            <button
              style={{
                flex: 1,
                padding: "12px 14px",
                background: activeTab === "inspector" ? "rgba(0, 255, 157, 0.1)" : "transparent",
                color: activeTab === "inspector" ? "var(--neon-green)" : "var(--text-dim)",
                border: "none",
                borderBottom: activeTab === "inspector" ? "2px solid var(--neon-green)" : "2px solid transparent",
                fontFamily: "var(--font-display)",
                fontSize: 12,
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
                padding: "12px 14px",
                background: activeTab === "qa" ? "rgba(0, 255, 157, 0.1)" : "transparent",
                color: activeTab === "qa" ? "var(--neon-green)" : "var(--text-dim)",
                border: "none",
                borderBottom: activeTab === "qa" ? "2px solid var(--neon-green)" : "2px solid transparent",
                fontFamily: "var(--font-display)",
                fontSize: 12,
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
            <div style={{ padding: 18, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
              {!selectedElement ? (
                <div style={{ textAlign: "center", padding: "30px 10px", color: "var(--text-dim)" }}>
                  <div className="pulse-dot" style={{ margin: "0 auto 12px" }} />
                  <p className="wire-label" style={{ fontSize: 11.5 }}>
                    SELECT ANY GRAPH NODE OR RELATIONSHIP EDGE TO INSPECT FACTS, NUMBERS & CONTEXT
                  </p>
                </div>
              ) : !selectedElement.isEdge ? (
                /* Node Details */
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
                    <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 800, margin: "6px 0 0", color: "#ffffff" }}>
                      {selectedElement.data?.label}
                    </h2>
                  </div>

                  {/* Numbers & Quantitative Facts */}
                  {selectedElement.data?.numbers?.length > 0 && (
                    <div style={{ background: "rgba(255, 42, 95, 0.1)", border: "1px solid rgba(255, 42, 95, 0.35)", borderRadius: 6, padding: 12 }}>
                      <div className="wire-label" style={{ color: "var(--neon-red)", marginBottom: 8 }}>
                        ⚡ QUANTITATIVE FACTS / CASUALTY FIGURES
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {selectedElement.data.numbers.map((num, idx) => (
                          <div key={idx} style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "#ffffff", display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ color: "var(--neon-red)" }}>▶</span>
                            <span>{num}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Telemetry stats */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div style={{ background: "rgba(12, 22, 30, 0.8)", padding: "8px 12px", borderRadius: 4, border: "1px solid var(--hairline)" }}>
                      <div className="wire-label">MENTIONS</div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
                        {selectedElement.data?.mentions || 1}
                      </div>
                    </div>
                    <div style={{ background: "rgba(12, 22, 30, 0.8)", padding: "8px 12px", borderRadius: 4, border: "1px solid var(--hairline)" }}>
                      <div className="wire-label">CONFIDENCE</div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 700, color: "var(--neon-green)" }}>
                        {Math.round((selectedElement.data?.confidence || 0.95) * 100)}%
                      </div>
                    </div>
                  </div>

                  {/* Connected Entities */}
                  {connectedEdges.length > 0 && (
                    <div>
                      <div className="wire-label" style={{ marginBottom: 8, color: "var(--neon-cyan)" }}>
                        CONNECTED NETWORK NODES ({connectedEdges.length})
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
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
                                padding: "7px 10px",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                              }}
                              onMouseEnter={(ev) => (ev.currentTarget.style.borderColor = "var(--neon-green)")}
                              onMouseLeave={(ev) => (ev.currentTarget.style.borderColor = "var(--hairline-bright)")}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)" }}>
                                  {e.relation} →
                                </span>
                                <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12.5, color: "#ffffff" }}>
                                  {otherNode.label}
                                </span>
                              </div>
                              <span className="wire-label" style={{ fontSize: 9.5, color: "var(--neon-green)" }}>
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
                      <div className="wire-label" style={{ marginBottom: 8 }}>
                        SOURCE EXTRACTS & QUOTES
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {selectedElement.data.facts.map((fact, idx) => (
                          <div
                            key={idx}
                            style={{
                              background: "rgba(10, 18, 25, 0.8)",
                              borderLeft: "2px solid var(--neon-green)",
                              padding: "8px 10px",
                              fontSize: 12.5,
                              lineHeight: 1.5,
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
                    style={{ marginTop: 6, fontSize: 12 }}
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
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div>
                    <span className="badge" style={{ background: "rgba(0, 240, 255, 0.15)", color: "var(--neon-cyan)" }}>
                      RELATIONSHIP EDGE
                    </span>
                    <h2 style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 800, margin: "6px 0 0", color: "#ffffff" }}>
                      {selectedElement.label || selectedElement.relation}
                    </h2>
                  </div>

                  <div style={{ background: "rgba(12, 22, 30, 0.8)", padding: "10px 14px", borderRadius: 6, border: "1px solid var(--hairline)" }}>
                    <div className="wire-label">WEIGHT / STRENGTH</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 700, color: "var(--neon-green)" }}>
                      {selectedElement.data?.weight || 1}x Dependency Strength
                    </div>
                  </div>

                  {selectedElement.data?.facts?.length > 0 && (
                    <div style={{ background: "rgba(255, 42, 95, 0.1)", border: "1px solid rgba(255, 42, 95, 0.35)", borderRadius: 6, padding: 10 }}>
                      <div className="wire-label" style={{ color: "var(--neon-red)", marginBottom: 4 }}>
                        ASSOCIATED FIGURES
                      </div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "#ffffff" }}>
                        {selectedElement.data.facts.join(", ")}
                      </div>
                    </div>
                  )}

                  {selectedElement.data?.sentence && (
                    <div>
                      <div className="wire-label" style={{ marginBottom: 6 }}>
                        VERBATIM SOURCE SENTENCE
                      </div>
                      <div
                        style={{
                          background: "rgba(10, 18, 25, 0.85)",
                          borderLeft: "2px solid var(--neon-cyan)",
                          padding: "10px 12px",
                          fontSize: 13,
                          lineHeight: 1.6,
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
            <div style={{ padding: 18, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div className="wire-label" style={{ color: "var(--neon-green)", marginBottom: 6 }}>
                  AI STORY INTELLIGENCE
                </div>
                <p style={{ fontSize: 12.5, color: "var(--text-dim)", margin: 0 }}>
                  Ask questions grounded in the extracted graph nodes, death tolls, casualties, and relations.
                </p>
              </div>

              {/* Preset Query Chips */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {[
                  "What are the numbers & casualties?",
                  "Who are the key people involved?",
                  "Summarize the main events",
                ].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    className="btn"
                    style={{ fontSize: 10.5, padding: "4px 8px" }}
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
                style={{ display: "flex", gap: 8 }}
              >
                <input
                  style={{ flex: 1, fontSize: 13, padding: "8px 10px" }}
                  placeholder="Ask a question about this story…"
                  value={qaQuery}
                  onChange={(e) => setQaQuery(e.target.value)}
                />
                <button className="btn btn-primary" type="submit" disabled={qaLoading} style={{ fontSize: 12, padding: "8px 12px" }}>
                  {qaLoading ? "..." : "Ask"}
                </button>
              </form>

              {/* History Stream */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 6 }}>
                {qaLoading && (
                  <div className="cyber-panel" style={{ padding: 12, textAlign: "center" }}>
                    <div className="pulse-dot" style={{ margin: "0 auto 6px" }} />
                    <span className="wire-label" style={{ color: "var(--neon-green)", fontSize: 10.5 }}>
                      ANALYZING STORY GRAPH...
                    </span>
                  </div>
                )}

                {qaHistory.map((item, idx) => (
                  <div
                    key={idx}
                    className="cyber-panel"
                    style={{
                      padding: 12,
                      border: "1px solid var(--hairline-bright)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, color: "var(--neon-cyan)" }}>
                      Q: {item.question}
                    </div>
                    <div style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--text)" }}>
                      {item.answer}
                    </div>

                    {item.facts?.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                        {item.facts.map((f, fIdx) => (
                          <span
                            key={fIdx}
                            className="badge"
                            style={{ background: "rgba(255,42,95,0.15)", color: "var(--neon-red)" }}
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
      </div>
    </div>
  );
}
