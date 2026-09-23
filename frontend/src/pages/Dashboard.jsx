import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";
import NewsCard from "../components/NewsCard.jsx";
import { api } from "../api.js";

const COUNTRIES = [
  { code: "in", label: "India" },
  { code: "us", label: "United States" },
  { code: "gb", label: "United Kingdom" },
  { code: "au", label: "Australia" },
  { code: "ca", label: "Canada" },
  { code: "fr", label: "France" },
  { code: "de", label: "Germany" },
  { code: "jp", label: "Japan" },
  { code: "cn", label: "China" },
  { code: "br", label: "Brazil" },
];

const CATEGORIES = [
  "general",
  "world",
  "nation",
  "business",
  "technology",
  "entertainment",
  "sports",
  "science",
  "health",
];

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi (हिन्दी)" },
];

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("headlines"); // "headlines" | "url" | "text"
  const [country, setCountry] = useState("in");
  const [category, setCategory] = useState("general");
  const [language, setLanguage] = useState("en");
  const [query, setQuery] = useState("");
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  // URL Scraping state
  const [inputUrl, setInputUrl] = useState("");

  // Text pasting state
  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteText, setPasteText] = useState("");

  const navigate = useNavigate();

  async function loadHeadlines() {
    setLoading(true);
    setError("");
    try {
      const data = await api.headlines({ country, category, language, max_results: 18 });
      setArticles(data);
    } catch (e) {
      setError(e.message);
      setArticles([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === "headlines") {
      loadHeadlines();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country, category, language, activeTab]);

  async function doSearch(e) {
    e.preventDefault();
    if (!query.trim()) return loadHeadlines();
    setLoading(true);
    setError("");
    try {
      const data = await api.searchNews({ q: query, country, language, max_results: 18 });
      setArticles(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function visualizeArticle(article) {
    setBusyId(article.id);
    setError("");
    try {
      const text = [article.title, article.description, article.content].filter(Boolean).join(". ");
      const graph = await api.analyze({ text, title: article.title, url: article.url });
      navigate("/graph", { state: { graph, rawText: text } });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleAnalyzeUrl(e) {
    e.preventDefault();
    if (!inputUrl.trim()) return;
    setBusyId("url");
    setError("");
    try {
      const graph = await api.analyzeUrl({ url: inputUrl.trim() });
      navigate("/graph", { state: { graph } });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleAnalyzeText(e) {
    e.preventDefault();
    if (!pasteText.trim()) return;
    setBusyId("paste");
    setError("");
    try {
      const graph = await api.analyze({
        text: pasteText.trim(),
        title: pasteTitle.trim() || "Pasted Intelligence Report",
        url: null,
      });
      navigate("/graph", { state: { graph, rawText: pasteText } });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Navbar />

      <main style={{ maxWidth: 1360, margin: "0 auto", padding: "24px 20px 60px", width: "100%" }}>
        {/* Top Header Banner */}
        <div
          className="cyber-panel"
          style={{
            padding: "24px 28px",
            marginBottom: 24,
            display: "flex",
            flexDirection: "column",
            gap: 16,
            background: "linear-gradient(135deg, rgba(11, 20, 28, 0.95) 0%, rgba(5, 12, 17, 0.95) 100%)",
            border: "1px solid var(--neon-green-border)",
            boxShadow: "0 0 24px rgba(0, 255, 157, 0.08)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span className="pulse-dot" />
                <span className="wire-label" style={{ color: "var(--neon-green)", letterSpacing: "0.08em" }}>
                  INTELLIGENCE STREAM // ACTIVE
                </span>
              </div>
              <h1
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(22px, 3.5vw, 30px)",
                  fontWeight: 800,
                  margin: 0,
                  color: "#ffffff",
                  letterSpacing: "0.02em",
                }}
              >
                Neural News Knowledge Graph
              </h1>
              <p style={{ margin: "6px 0 0", color: "var(--text-dim)", fontSize: 13.5, maxWidth: 720 }}>
                Transform breaking news and articles into high-precision, interactive entity graphs. Accurately tracks people, organizations, death tolls, casualty figures, and factual timelines.
              </p>
            </div>

            {/* Ingestion Mode Tabs */}
            <div
              style={{
                display: "inline-flex",
                background: "rgba(7, 14, 20, 0.9)",
                border: "1px solid var(--hairline-bright)",
                borderRadius: 6,
                padding: 3,
                gap: 4,
              }}
            >
              <button
                type="button"
                className="btn"
                style={{
                  fontSize: 11.5,
                  padding: "6px 14px",
                  background: activeTab === "headlines" ? "var(--neon-green)" : "transparent",
                  color: activeTab === "headlines" ? "#03120b" : "var(--text-dim)",
                  borderColor: "transparent",
                  boxShadow: activeTab === "headlines" ? "0 0 12px var(--neon-green-glow)" : "none",
                }}
                onClick={() => setActiveTab("headlines")}
              >
                📡 Live Wire
              </button>
              <button
                type="button"
                className="btn"
                style={{
                  fontSize: 11.5,
                  padding: "6px 14px",
                  background: activeTab === "url" ? "var(--neon-green)" : "transparent",
                  color: activeTab === "url" ? "#03120b" : "var(--text-dim)",
                  borderColor: "transparent",
                  boxShadow: activeTab === "url" ? "0 0 12px var(--neon-green-glow)" : "none",
                }}
                onClick={() => setActiveTab("url")}
              >
                🔗 Paste URL
              </button>
              <button
                type="button"
                className="btn"
                style={{
                  fontSize: 11.5,
                  padding: "6px 14px",
                  background: activeTab === "text" ? "var(--neon-green)" : "transparent",
                  color: activeTab === "text" ? "#03120b" : "var(--text-dim)",
                  borderColor: "transparent",
                  boxShadow: activeTab === "text" ? "0 0 12px var(--neon-green-glow)" : "none",
                }}
                onClick={() => setActiveTab("text")}
              >
                📝 Paste Text
              </button>
            </div>
          </div>
        </div>

        {/* Tab 1: Paste Article URL */}
        {activeTab === "url" && (
          <div
            className="cyber-panel"
            style={{
              padding: 24,
              marginBottom: 24,
              border: "1px solid var(--neon-green-border)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 18 }}>🔗</span>
              <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 16, color: "var(--neon-green)" }}>
                Extract & Graph Any News Article from URL
              </h3>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 8 }}>
              Works best with: <strong style={{ color: "var(--neon-cyan)" }}>BBC, CNN, Times of India, The Hindu, Al Jazeera, AP News, The Guardian</strong>.
              Sites like Reuters/NDTV block scrapers — use the <strong style={{ color: "var(--neon-green)" }}>📝 Paste Text</strong> tab for those.
            </p>

            <form onSubmit={handleAnalyzeUrl} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input
                type="url"
                required
                placeholder="https://www.bbc.com/news/...  or  https://timesofindia.indiatimes.com/..."
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                style={{ flex: "1 1 340px", fontFamily: "var(--font-mono)", fontSize: 13 }}
              />
              <button className="btn btn-primary" type="submit" disabled={busyId === "url"}>
                {busyId === "url" ? (
                  <>
                    <span className="pulse-dot" />
                    <span>Scraping & Graphing...</span>
                  </>
                ) : (
                  <>
                    <span>Extract & Graph</span>
                    <span>⚡</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Tab 2: Paste Raw Article Text */}
        {activeTab === "text" && (
          <div
            className="cyber-panel"
            style={{
              padding: 24,
              marginBottom: 24,
              border: "1px solid var(--neon-green-border)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 18 }}>📝</span>
              <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 16, color: "var(--neon-green)" }}>
                Analyze Custom Article Text (English, Hindi, Marathi)
              </h3>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 16 }}>
              Ideal for private reports, multilingual press releases, or Devanagari text.
            </p>

            <form onSubmit={handleAnalyzeText} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input
                placeholder="Report / Article Title (optional)"
                value={pasteTitle}
                onChange={(e) => setPasteTitle(e.target.value)}
              />
              <textarea
                rows={7}
                required
                placeholder="Paste news text here (e.g. 'President Jane Doe announced 1,090 casualties following the explosion in Sector 7...')"
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                style={{ lineHeight: 1.6 }}
              />
              <button
                className="btn btn-primary"
                type="submit"
                style={{ alignSelf: "flex-start" }}
                disabled={busyId === "paste"}
              >
                {busyId === "paste" ? (
                  <>
                    <span className="pulse-dot" />
                    <span>Analyzing Neural Graph...</span>
                  </>
                ) : (
                  <>
                    <span>Generate Graph</span>
                    <span>⚡</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Tab 3: Live Wire & Headlines */}
        {activeTab === "headlines" && (
          <>
            {/* Filter & Search Bar */}
            <form onSubmit={doSearch} style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
              <input
                style={{ flex: "1 1 280px" }}
                placeholder="Search topics… e.g. Elections, Maharashtra, Technology, Disasters"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <select value={country} onChange={(e) => setCountry(e.target.value)}>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c[0].toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </select>
              <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
              <button className="btn btn-primary" type="submit">
                <span>Filter Stream</span>
                <span>🔍</span>
              </button>
            </form>

            {/* Error Message */}
            {error && (
              <div
                className="cyber-panel"
                style={{
                  background: "rgba(255, 42, 95, 0.12)",
                  border: "1px solid var(--neon-red)",
                  color: "#ff8fa9",
                  padding: "12px 16px",
                  marginBottom: 20,
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                }}
              >
                <strong>ERROR //</strong> {error}
                {(activeTab === "url" && (error.toLowerCase().includes("block") || error.toLowerCase().includes("paywall") || error.toLowerCase().includes("forbidden") || error.toLowerCase().includes("access denied") || error.toLowerCase().includes("scraper") || error.toLowerCase().includes("extract"))) && (
                  <div style={{ marginTop: 8, fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-dim)" }}>
                    💡 TIP: Switch to{" "}
                    <button
                      type="button"
                      onClick={() => { setActiveTab("text"); setError(""); }}
                      style={{ background: "none", border: "none", color: "var(--neon-green)", cursor: "pointer", padding: 0, fontWeight: 700, textDecoration: "underline", fontSize: 12 }}
                    >
                      📝 Paste Text
                    </button>{" "}
                    and paste the article content directly instead.
                  </div>
                )}
              </div>
            )}

            {/* Articles Grid */}
            {loading ? (
              <div
                className="cyber-panel"
                style={{
                  padding: 48,
                  textAlign: "center",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div className="pulse-dot" style={{ width: 14, height: 14 }} />
                <div className="wire-label" style={{ color: "var(--neon-green)", fontSize: 12 }}>
                  INGESTING NEURAL HEADLINES STREAM...
                </div>
              </div>
            ) : articles.length === 0 ? (
              <div
                className="cyber-panel"
                style={{ padding: 40, textAlign: "center", color: "var(--text-dim)" }}
              >
                <p className="wire-label" style={{ fontSize: 13 }}>
                  NO ARTICLES FOUND FOR THIS SELECTION. TRY ANOTHER REGION OR CATEGORY.
                </p>
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                  gap: 20,
                }}
              >
                {articles.map((a) => (
                  <NewsCard
                    key={a.id}
                    article={a}
                    onVisualize={visualizeArticle}
                    busy={busyId === a.id}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
