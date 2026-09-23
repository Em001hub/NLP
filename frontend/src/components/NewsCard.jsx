import React from "react";

function formatRelativeDate(rawDate) {
  if (!rawDate) return "Live Wire";

  const date = new Date(rawDate);
  if (isNaN(date.getTime())) return "Recent";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Future or very recent (< 5 mins)
  if (diffMs < 0 || diffMins < 5) {
    return "Just now";
  }
  // Less than 60 mins
  if (diffMins < 60) {
    return `${diffMins}m ago`;
  }
  // Less than 24 hours
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  // Yesterday
  if (diffDays === 1) {
    return "Yesterday";
  }
  // Within a week
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  // Format with user's local date
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

export default function NewsCard({ article, onVisualize, busy }) {
  const rawDate = article.publishedAt || article.published_at || article.pubDate || article.date;
  const displayDate = formatRelativeDate(rawDate);
  const fullDateTitle = rawDate && !isNaN(new Date(rawDate).getTime()) ? new Date(rawDate).toLocaleString() : "";

  return (
    <article
      className="cyber-panel"
      style={{
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        transition: "all 0.25s ease",
        height: "100%",
        position: "relative",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--neon-green)";
        e.currentTarget.style.boxShadow = "0 8px 24px rgba(0, 255, 157, 0.15)";
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--hairline-bright)";
        e.currentTarget.style.boxShadow = "0 8px 32px rgba(0, 0, 0, 0.45)";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      {article.image && (
        <div style={{ width: "100%", height: 140, overflow: "hidden", background: "#080e13", position: "relative" }}>
          <img
            src={article.image}
            alt=""
            loading="lazy"
            style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.85 }}
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(to top, rgba(11, 19, 26, 0.95) 0%, transparent 60%)",
            }}
          />
        </div>
      )}

      <div style={{ padding: "16px 18px 18px", display: "flex", flexDirection: "column", flex: 1, gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <span
            className="badge"
            style={{
              background: "rgba(0, 255, 157, 0.1)",
              color: "var(--neon-green)",
              border: "1px solid rgba(0, 255, 157, 0.25)",
            }}
          >
            {article.source || "WIRE"}
          </span>
          <span className="wire-label" style={{ fontSize: 10, color: "var(--neon-cyan)" }} title={fullDateTitle}>
            🕒 {displayDate}
          </span>
        </div>

        <h3
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 15.5,
            fontWeight: 700,
            lineHeight: 1.35,
            margin: 0,
            color: "var(--text)",
          }}
        >
          {article.title}
        </h3>

        {article.description && (
          <p
            style={{
              fontSize: 12.5,
              lineHeight: 1.5,
              color: "var(--text-dim)",
              margin: 0,
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {article.description}
          </p>
        )}

        <div style={{ marginTop: "auto", paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          {article.url && (
            <a
              href={article.url}
              target="_blank"
              rel="noreferrer"
              className="wire-label"
              style={{ color: "var(--neon-cyan)", textDecoration: "underline", fontSize: 11 }}
            >
              Source Link ↗
            </a>
          )}
          <button
            className="btn btn-primary"
            style={{ fontSize: 11.5, padding: "7px 14px", marginLeft: "auto" }}
            onClick={() => onVisualize(article)}
            disabled={busy}
          >
            {busy ? (
              <>
                <span className="pulse-dot" style={{ width: 6, height: 6 }} />
                <span>BUILDING...</span>
              </>
            ) : (
              <>
                <span>GRAPH STORY</span>
                <span>→</span>
              </>
            )}
          </button>
        </div>
      </div>
    </article>
  );
}

