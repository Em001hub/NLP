"""
Fetches live news from GNews (https://gnews.io) - a free news API with a
generous free tier (100 requests/day) that, unlike most free news APIs,
supports fetching in Hindi (language=hi) as well as English and filtering by
country. Get a free key at https://gnews.io/register and put it in
backend/.env as GNEWS_API_KEY.

No database: results are simply returned to the frontend and optionally
cached in-memory for the running process.
"""
import hashlib
import time
from typing import List, Optional

import requests

from .config import GNEWS_API_KEY
from .schemas import NewsArticle

GNEWS_BASE = "https://gnews.io/api/v4"

# Small in-memory cache (process lifetime only, resets on restart - no DB)
_cache = {}
_CACHE_TTL_SECONDS = 300


def _cache_key(**kwargs) -> str:
    raw = "|".join(f"{k}={v}" for k, v in sorted(kwargs.items()))
    return hashlib.sha256(raw.encode()).hexdigest()


def _to_article(raw: dict, language: str) -> NewsArticle:
    uid = hashlib.sha256(raw.get("url", "").encode()).hexdigest()[:16]
    return NewsArticle(
        id=uid,
        title=raw.get("title", ""),
        description=raw.get("description", "") or "",
        content=raw.get("content", "") or raw.get("description", "") or "",
        url=raw.get("url", ""),
        image=raw.get("image"),
        publishedAt=raw.get("publishedAt"),
        source=(raw.get("source") or {}).get("name", "Unknown"),
        language=language,
    )


def fetch_top_headlines(
    country: str = "in",
    category: str = "general",
    language: str = "en",
    max_results: int = 15,
) -> List[NewsArticle]:
    if not GNEWS_API_KEY:
        raise RuntimeError(
            "No GNEWS_API_KEY configured. Add a free key from https://gnews.io "
            "to backend/.env (see .env.example)."
        )

    key = _cache_key(kind="top", country=country, category=category, language=language, n=max_results)
    cached = _cache.get(key)
    if cached and time.time() - cached["ts"] < _CACHE_TTL_SECONDS:
        return cached["data"]

    params = {
        "country": country,
        "category": category,
        "lang": language,
        "max": max_results,
        "apikey": GNEWS_API_KEY,
    }
    resp = requests.get(f"{GNEWS_BASE}/top-headlines", params=params, timeout=15)
    resp.raise_for_status()
    payload = resp.json()
    articles = [_to_article(a, language) for a in payload.get("articles", [])]
    _cache[key] = {"ts": time.time(), "data": articles}
    return articles


def search_news(
    query: str,
    country: Optional[str] = None,
    language: str = "en",
    max_results: int = 15,
) -> List[NewsArticle]:
    if not GNEWS_API_KEY:
        raise RuntimeError(
            "No GNEWS_API_KEY configured. Add a free key from https://gnews.io "
            "to backend/.env (see .env.example)."
        )

    key = _cache_key(kind="search", q=query, country=country, language=language, n=max_results)
    cached = _cache.get(key)
    if cached and time.time() - cached["ts"] < _CACHE_TTL_SECONDS:
        return cached["data"]

    params = {"q": query, "lang": language, "max": max_results, "apikey": GNEWS_API_KEY}
    if country:
        params["country"] = country
    resp = requests.get(f"{GNEWS_BASE}/search", params=params, timeout=15)
    resp.raise_for_status()
    payload = resp.json()
    articles = [_to_article(a, language) for a in payload.get("articles", [])]
    _cache[key] = {"ts": time.time(), "data": articles}
    return articles
