import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [groqKeyInput, setGroqKeyInput] = useState(() => localStorage.getItem("ng_groq_key") || "");
  const [savedStatus, setSavedStatus] = useState(false);

  function handleSaveKey(e) {
    e.preventDefault();
    if (groqKeyInput.trim()) {
      localStorage.setItem("ng_groq_key", groqKeyInput.trim());
    } else {
      localStorage.removeItem("ng_groq_key");
    }
    setSavedStatus(true);
    setTimeout(() => {
      setSavedStatus(false);
      setShowKeyModal(false);
    }, 1200);
  }

  const hasGroqKey = Boolean(localStorage.getItem("ng_groq_key"));

  return (
    <>
      <header
        style={{
          borderBottom: "1px solid var(--hairline-bright)",
          background: "rgba(5, 8, 11, 0.92)",
          backdropFilter: "blur(14px)",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div
          style={{
            maxWidth: 1360,
            margin: "0 auto",
            padding: "12px 20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Link to="/" style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  background: "linear-gradient(135deg, rgba(0,255,157,0.2) 0%, rgba(0,240,255,0.2) 100%)",
                  border: "1px solid var(--neon-green)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 0 12px var(--neon-green-glow)",
                }}
              >
                <span style={{ fontSize: 16 }}>⚡</span>
              </div>
              <div>
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 800,
                    fontSize: 18,
                    letterSpacing: "0.08em",
                    color: "var(--neon-green)",
                    textShadow: "0 0 10px rgba(0,255,157,0.4)",
                  }}
                >
                  NEWSGRAPH
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 9.5,
                    color: "var(--neon-cyan)",
                    marginLeft: 6,
                    padding: "1px 5px",
                    border: "1px solid rgba(0,240,255,0.3)",
                    borderRadius: 3,
                  }}
                >
                  CYBER-HUD
                </span>
              </div>
            </Link>

            <div className="hide-mobile" style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 16 }}>
              <div className="pulse-dot" />
              <span className="wire-label" style={{ color: "var(--text-dim)", fontSize: 10.5 }}>
                NETWORK ONLINE
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              className="btn"
              onClick={() => setShowKeyModal(true)}
              style={{
                fontSize: 11.5,
                padding: "6px 12px",
                borderColor: hasGroqKey ? "var(--neon-green)" : "var(--hairline-bright)",
                background: hasGroqKey ? "rgba(0, 255, 157, 0.08)" : "rgba(15, 25, 33, 0.6)",
              }}
              title="Configure Groq API Key for ultra-fast AI Graph Extraction and Q&A"
            >
              <span style={{ color: hasGroqKey ? "var(--neon-green)" : "var(--muted)" }}>🔑</span>
              <span>{hasGroqKey ? "Groq AI Active" : "Add Groq Key"}</span>
            </button>

            {user ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="wire-label hide-mobile" style={{ color: "var(--neon-cyan)" }}>
                  SYS://{user.username}
                </span>
                <button
                  className="btn"
                  style={{ fontSize: 11.5, padding: "6px 12px" }}
                  onClick={() => {
                    logout();
                    navigate("/login");
                  }}
                >
                  Logout
                </button>
              </div>
            ) : (
              <Link to="/login" className="btn btn-primary" style={{ fontSize: 11.5, padding: "6px 14px" }}>
                Login
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Groq Key Modal */}
      {showKeyModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(3, 6, 8, 0.85)",
            backdropFilter: "blur(10px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999,
            padding: 16,
          }}
          onClick={() => setShowKeyModal(false)}
        >
          <div
            className="cyber-panel"
            style={{
              maxWidth: 480,
              width: "100%",
              padding: 24,
              border: "1px solid var(--neon-green-border)",
              boxShadow: "0 0 30px rgba(0, 255, 157, 0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 20 }}>⚡</span>
                <h3 style={{ margin: 0, fontFamily: "var(--font-display)", color: "var(--neon-green)", fontSize: 17 }}>
                  Groq AI Intelligence Config
                </h3>
              </div>
              <button
                onClick={() => setShowKeyModal(false)}
                style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 18 }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-dim)", marginBottom: 16 }}>
              Provide a free <strong>Groq API key</strong> (from <a href="https://console.groq.com" target="_blank" rel="noreferrer" style={{ color: "var(--neon-green)", textDecoration: "underline" }}>console.groq.com</a>) to enable <strong>ultra-accurate 100% fact & number extraction</strong> and real-time graph Q&A. If omitted, the local offline NLP pipeline will be used.
            </p>

            <form onSubmit={handleSaveKey} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label className="wire-label" style={{ display: "block", marginBottom: 6 }}>
                  GROQ API KEY (gsk_...)
                </label>
                <input
                  type="password"
                  placeholder="gsk_xxxxxxxxxxxxxxxxxxxxxxxx"
                  value={groqKeyInput}
                  onChange={(e) => setGroqKeyInput(e.target.value)}
                  style={{ width: "100%", fontFamily: "var(--font-mono)", fontSize: 13 }}
                />
              </div>

              {savedStatus && (
                <div className="wire-label" style={{ color: "var(--neon-green)", textAlign: "center" }}>
                  ✓ Settings Saved Successfully!
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                {groqKeyInput && (
                  <button
                    type="button"
                    className="btn btn-danger"
                    style={{ fontSize: 12 }}
                    onClick={() => {
                      localStorage.removeItem("ng_groq_key");
                      setGroqKeyInput("");
                      setSavedStatus(true);
                      setTimeout(() => setSavedStatus(false), 1200);
                    }}
                  >
                    Clear Key
                  </button>
                )}
                <button type="submit" className="btn btn-primary" style={{ fontSize: 12 }}>
                  Save Configuration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
