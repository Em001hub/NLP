const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

function authHeaders() {
  const token = localStorage.getItem("ng_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function getStoredGroqKey() {
  return localStorage.getItem("ng_groq_key") || "";
}

async function handle(res) {
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || JSON.stringify(body);
    } catch (_) {}
    throw new Error(detail);
  }
  return res.json();
}

export const api = {
  async login(username, password) {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    return handle(res);
  },
  async signup(username, password) {
    const res = await fetch(`${API_BASE}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    return handle(res);
  },
  async me() {
    const res = await fetch(`${API_BASE}/api/auth/me`, { headers: authHeaders() });
    return handle(res);
  },
  async headlines({ country = "in", category = "general", language = "en", max_results = 15 }) {
    const params = new URLSearchParams({ country, category, language, max_results });
    const res = await fetch(`${API_BASE}/api/news/headlines?${params}`, { headers: authHeaders() });
    return handle(res);
  },
  async searchNews({ q, country, language = "en", max_results = 15 }) {
    const params = new URLSearchParams({ q, language, max_results });
    if (country) params.set("country", country);
    const res = await fetch(`${API_BASE}/api/news/search?${params}`, { headers: authHeaders() });
    return handle(res);
  },
  async analyze({ text, title, url, groqApiKey }) {
    const groq_api_key = groqApiKey || getStoredGroqKey() || null;
    const res = await fetch(`${API_BASE}/api/graph/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ text, title, url, groq_api_key }),
    });
    return handle(res);
  },
  async analyzeUrl({ url, groqApiKey }) {
    const groq_api_key = groqApiKey || getStoredGroqKey() || null;
    const res = await fetch(`${API_BASE}/api/graph/analyze-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ url, groq_api_key }),
    });
    return handle(res);
  },
  async askGraph({ query, graph, articleText, groqApiKey }) {
    const groq_api_key = groqApiKey || getStoredGroqKey() || null;
    const res = await fetch(`${API_BASE}/api/graph/qa`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ query, graph, article_text: articleText || "", groq_api_key }),
    });
    return handle(res);
  },
  async saveGraph(name, graph) {
    const res = await fetch(`${API_BASE}/api/graph/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ name, graph }),
    });
    return handle(res);
  },
  async listSaved() {
    const res = await fetch(`${API_BASE}/api/graph/saved`, { headers: authHeaders() });
    return handle(res);
  },
  async getSaved(name) {
    const res = await fetch(`${API_BASE}/api/graph/saved/${encodeURIComponent(name)}`, {
      headers: authHeaders(),
    });
    return handle(res);
  },
};
