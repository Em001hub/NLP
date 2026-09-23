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
import html
import re
import time
from typing import List, Optional
import xml.etree.ElementTree as ET

import requests
from bs4 import BeautifulSoup

from .config import GNEWS_API_KEY
from .schemas import NewsArticle

GNEWS_BASE = "https://gnews.io/api/v4"

# In-memory cache
_cache = {}
_CACHE_TTL_SECONDS = 300

TOPIC_MAP = {
    "world": "WORLD",
    "nation": "NATION",
    "business": "BUSINESS",
    "technology": "TECHNOLOGY",
    "entertainment": "ENTERTAINMENT",
    "sports": "SPORTS",
    "science": "SCIENCE",
    "health": "HEALTH",
}


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


def _fetch_from_google_rss(
    country: str = "in",
    category: Optional[str] = None,
    language: str = "en",
    query: Optional[str] = None,
    max_results: int = 15,
) -> List[NewsArticle]:
    """Fallback to Google News RSS when GNews is rate limited or unavailable."""
    gl = country.upper()
    hl = f"{language.lower()}-{gl}" if language.lower() != "hi" else "hi"
    ceid = f"{gl}:{language.lower()}"

    if query:
        encoded_q = requests.utils.quote(query)
        url = f"https://news.google.com/rss/search?q={encoded_q}&hl={hl}&gl={gl}&ceid={ceid}"
    elif category and category.lower() in TOPIC_MAP:
        topic = TOPIC_MAP[category.lower()]
        url = f"https://news.google.com/rss/headlines/section/topic/{topic}?hl={hl}&gl={gl}&ceid={ceid}"
    else:
        url = f"https://news.google.com/rss?hl={hl}&gl={gl}&ceid={ceid}"

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    resp = requests.get(url, headers=headers, timeout=12)
    resp.raise_for_status()

    root = ET.fromstring(resp.content)
    # Google News RSS uses bare <link> text nodes that ElementTree can't parse as child elements.
    # Pre-extract all article links from raw XML as a fallback index.
    raw_xml = resp.text
    # Match <link> content between items: captures the URL inside each <item>...</item> block
    item_link_pattern = re.compile(
        r'<item>.*?<link>(https?://[^<]+)</link>',
        re.DOTALL
    )
    item_links = item_link_pattern.findall(raw_xml)

    articles = []

    for idx, item in enumerate(root.findall(".//item")[:max_results]):
        title = item.findtext("title") or "Untitled Story"
        # <link> is the Google News redirect URL which resolves to the actual article.
        # <source url="..."> is the publisher's HOMEPAGE, not the article — do NOT use it as the article URL.
        source_tag = item.find("source")
        source_name = source_tag.text if source_tag is not None and source_tag.text else "Google News"
        # ElementTree can't parse Google RSS bare <link> nodes — use regex-extracted list instead
        gnews_link = item_links[idx] if idx < len(item_links) else (item.findtext("link") or "")
        link = gnews_link  # always use the per-article redirect link

        pub_date = item.findtext("pubDate") or ""

        # Clean description HTML if present
        raw_desc = item.findtext("description") or ""
        desc_text = ""
        if raw_desc:
            try:
                soup = BeautifulSoup(raw_desc, "html.parser")
                desc_text = soup.get_text(separator=" ").strip()
            except Exception:
                desc_text = re.sub("<[^<]+?>", "", raw_desc).strip()

        if not desc_text:
            desc_text = title

        uid = hashlib.sha256(link.encode()).hexdigest()[:16]
        articles.append(
            NewsArticle(
                id=uid,
                title=title,
                description=desc_text,
                content=desc_text,
                url=link,
                image=None,
                publishedAt=pub_date,
                source=source_name,
                language=language,
            )
        )

    return articles


def fetch_top_headlines(
    country: str = "in",
    category: str = "general",
    language: str = "en",
    max_results: int = 15,
) -> List[NewsArticle]:
    key = _cache_key(kind="top", country=country, category=category, language=language, n=max_results)
    cached = _cache.get(key)
    if cached and time.time() - cached["ts"] < _CACHE_TTL_SECONDS:
        return cached["data"]

    # Try GNews API first
    if GNEWS_API_KEY:
        try:
            params = {
                "country": country,
                "category": category,
                "lang": language,
                "max": max_results,
                "apikey": GNEWS_API_KEY,
            }
            resp = requests.get(f"{GNEWS_BASE}/top-headlines", params=params, timeout=10)
            if resp.status_code == 200:
                payload = resp.json()
                raw_articles = payload.get("articles", [])
                if raw_articles:
                    articles = [_to_article(a, language) for a in raw_articles]
                    _cache[key] = {"ts": time.time(), "data": articles}
                    return articles
        except Exception:
            pass  # Fall back to Google News RSS

    # RSS Fallback
    try:
        articles = _fetch_from_google_rss(
            country=country,
            category=category,
            language=language,
            max_results=max_results,
        )
        if articles:
            _cache[key] = {"ts": time.time(), "data": articles}
            return articles
    except Exception as e:
        raise RuntimeError(f"Could not fetch news headlines: {e}")

    return []


def search_news(
    query: str,
    country: Optional[str] = None,
    language: str = "en",
    max_results: int = 15,
) -> List[NewsArticle]:
    key = _cache_key(kind="search", q=query, country=country, language=language, n=max_results)
    cached = _cache.get(key)
    if cached and time.time() - cached["ts"] < _CACHE_TTL_SECONDS:
        return cached["data"]

    # Try GNews API first
    if GNEWS_API_KEY:
        try:
            params = {"q": query, "lang": language, "max": max_results, "apikey": GNEWS_API_KEY}
            if country:
                params["country"] = country
            resp = requests.get(f"{GNEWS_BASE}/search", params=params, timeout=10)
            if resp.status_code == 200:
                payload = resp.json()
                raw_articles = payload.get("articles", [])
                if raw_articles:
                    articles = [_to_article(a, language) for a in raw_articles]
                    _cache[key] = {"ts": time.time(), "data": articles}
                    return articles
        except Exception:
            pass  # Fall back to RSS

    # RSS Fallback
    try:
        articles = _fetch_from_google_rss(
            country=country or "in",
            language=language,
            query=query,
            max_results=max_results,
        )
        if articles:
            _cache[key] = {"ts": time.time(), "data": articles}
            return articles
    except Exception as e:
        raise RuntimeError(f"Could not search news: {e}")

    return []
