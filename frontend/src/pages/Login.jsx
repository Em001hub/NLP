import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Login() {
  const [mode, setMode] = useState("login"); // 'login' | 'signup'
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, signup } = useAuth();
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") await login(username, password);
      else await signup(username, password);
      navigate("/");
    } catch (err) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        position: "relative",
      }}
    >
      <div style={{ maxWidth: 420, width: "100%", position: "relative", zIndex: 10 }}>
        <div style={{ marginBottom: 28, textAlign: "center" }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 10,
              background: "linear-gradient(135deg, rgba(0,255,157,0.2) 0%, rgba(0,240,255,0.2) 100%)",
              border: "1px solid var(--neon-green)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 14px",
              boxShadow: "0 0 20px var(--neon-green-glow)",
            }}
          >
            <span style={{ fontSize: 24 }}>⚡</span>
          </div>

          <div className="wire-label" style={{ color: "var(--neon-green)", marginBottom: 4 }}>
            NEURAL CYBER-INTELLIGENCE
          </div>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 34,
              fontWeight: 800,
              margin: 0,
              color: "#ffffff",
              letterSpacing: "0.04em",
              textShadow: "0 0 16px rgba(0, 255, 157, 0.4)",
            }}
          >
            NEWSGRAPH
          </h1>
          <p style={{ color: "var(--text-dim)", marginTop: 8, fontSize: 13.5, lineHeight: 1.5 }}>
            Transform breaking stories into hyper-accurate knowledge graphs with entity recognition, factual statistics, and AI Q&A.
          </p>
        </div>

        <form
          onSubmit={submit}
          className="cyber-panel"
          style={{
            padding: "28px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
            border: "1px solid var(--neon-green-border)",
            boxShadow: "0 0 32px rgba(0, 255, 157, 0.12)",
          }}
        >
          <div
            style={{
              display: "flex",
              background: "rgba(7, 14, 20, 0.9)",
              border: "1px solid var(--hairline-bright)",
              borderRadius: 6,
              padding: 3,
            }}
          >
            <button
              type="button"
              className="wire-label"
              onClick={() => setMode("login")}
              style={{
                flex: 1,
                padding: "8px 0",
                background: mode === "login" ? "var(--neon-green)" : "transparent",
                color: mode === "login" ? "#03120b" : "var(--text-dim)",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 11.5,
              }}
            >
              Log In
            </button>
            <button
              type="button"
              className="wire-label"
              onClick={() => setMode("signup")}
              style={{
                flex: 1,
                padding: "8px 0",
                background: mode === "signup" ? "var(--neon-green)" : "transparent",
                color: mode === "signup" ? "#03120b" : "var(--text-dim)",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 11.5,
              }}
            >
              Create Account
            </button>
          </div>

          <div>
            <label className="wire-label" htmlFor="username" style={{ display: "block", marginBottom: 6 }}>
              OPERATOR HANDLE // USERNAME
            </label>
            <input
              id="username"
              style={{ width: "100%" }}
              placeholder="e.g. analyst_01"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <div>
            <label className="wire-label" htmlFor="password" style={{ display: "block", marginBottom: 6 }}>
              CIPHER KEY // PASSWORD
            </label>
            <input
              id="password"
              type="password"
              style={{ width: "100%" }}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
            />
          </div>

          {error && (
            <div
              style={{
                color: "var(--neon-red)",
                fontSize: 12.5,
                fontFamily: "var(--font-mono)",
                background: "rgba(255, 42, 95, 0.1)",
                border: "1px solid var(--neon-red)",
                padding: "8px 12px",
                borderRadius: 4,
              }}
            >
              ⚠ {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: 6 }}>
            {loading ? "AUTHENTICATING..." : mode === "login" ? "INITIALIZE SESSION →" : "CREATE OPERATOR ID →"}
          </button>

          <div className="wire-label" style={{ textAlign: "center", fontSize: 10.5, color: "var(--muted)" }}>
            LOCAL PRIVACY ENCLAVE // ALL DATA SAVED LOCALLY
          </div>
        </form>
      </div>
    </div>
  );
}
