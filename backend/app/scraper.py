"""
Web Article Scraper for NewsGraph.
Extracts title, main article text, author, lead image, and publication date from any news URL.

Supports:
- Google News redirect URLs (resolves to actual article)
- Anti-bot sites via rotating User-Agents and proper headers
- Multiple extraction strategies (article tag, semantic selectors, readability-like fallback)
- Paywalled / 403 sites: graceful degradation with partial content
"""
import base64
import json
import re
import random
import struct
from typing import Dict, Optional
from urllib.parse import urlparse, urljoin, unquote

import requests
from bs4 import BeautifulSoup

# Rotating User-Agents to bypass basic bot detection
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15",
]

GOOGLE_NEWS_DOMAINS = {"news.google.com"}


def _make_headers(referer: str = "") -> dict:
    ua = random.choice(USER_AGENTS)
    h = {
        "User-Agent": ua,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,hi;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        "DNT": "1",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Cache-Control": "max-age=0",
    }
    if referer:
        h["Referer"] = referer
    return h


def _decode_google_news_url(url: str) -> str:
    """
    Google News RSS article links encode the actual article URL inside the path
    using a base64-encoded protobuf-like structure (CBM...= encoded string).
    This function decodes it directly without making an HTTP request.
    
    Format: https://news.google.com/rss/articles/CBMi<base64data>
    The base64 decoded bytes contain the real URL after a small binary header.
    """
    try:
        parsed = urlparse(url)
        # Extract the encoded part from the path
        path = parsed.path  # e.g. /rss/articles/CBMi...
        segments = path.split("/")
        encoded_part = segments[-1] if segments else ""
        
        if not encoded_part:
            return url
        
        # Add padding if needed
        padding = 4 - len(encoded_part) % 4
        if padding != 4:
            encoded_part += "=" * padding
        
        # Replace URL-safe chars
        encoded_part = encoded_part.replace("-", "+").replace("_", "/")
        
        try:
            decoded = base64.b64decode(encoded_part)
        except Exception:
            return url
        
        # The real URL appears as a UTF-8 string inside the decoded bytes
        # Try to find "https://" in the decoded bytes
        text = decoded.decode("latin-1", errors="replace")
        
        # Search for a URL pattern
        for pattern in [
            r'https?://[^\x00-\x1f\x7f-\xff]{10,}',
            r'https?://\S+',
        ]:
            matches = re.findall(pattern, text)
            if matches:
                # Return the longest match that looks like a real URL
                candidates = [m.rstrip("\"'\\) ") for m in matches if "google.com" not in m]
                if candidates:
                    return max(candidates, key=len)
        
        return url
    except Exception:
        return url


def _resolve_google_news_url(url: str) -> str:
    """
    Google News RSS links are opaque redirect URLs.
    First tries to decode the URL from the base64 encoded path.
    Falls back to following HTTP redirects if decode fails.
    """
    # Try direct decode first (faster, no network request)
    decoded = _decode_google_news_url(url)
    if decoded != url and "news.google.com" not in decoded:
        return decoded
    
    # Fallback: follow redirects
    try:
        sess = requests.Session()
        resp = sess.get(
            url,
            headers=_make_headers("https://news.google.com/"),
            timeout=15,
            allow_redirects=True,
        )
        final_url = resp.url

        if "news.google.com" not in final_url:
            return final_url

        soup = BeautifulSoup(resp.content, "html.parser")

        # Try canonical tag
        canonical = soup.find("link", rel="canonical")
        if canonical and canonical.get("href") and "news.google.com" not in canonical["href"]:
            return canonical["href"]

        # Try og:url
        og_url = soup.find("meta", property="og:url")
        if og_url and og_url.get("content") and "news.google.com" not in og_url["content"]:
            return og_url["content"]

        # Try meta http-equiv refresh
        refresh = soup.find("meta", attrs={"http-equiv": re.compile(r"refresh", re.I)})
        if refresh and refresh.get("content"):
            m = re.search(r"url=(.+)", refresh["content"], re.I)
            if m:
                candidate = m.group(1).strip().strip("'\"")
                if candidate.startswith("http") and "news.google.com" not in candidate:
                    return candidate

        # Try any <a> that links to a real article
        for a in soup.find_all("a", href=True):
            href = a["href"]
            if href.startswith("http") and "news.google.com" not in href and len(href) > 30:
                if any(ext in href for ext in ["/news/", "/article", "/story", "/world/", "/business/", "/india/"]):
                    return href

        # Try JS redirect patterns
        for script in soup.find_all("script"):
            if not script.string:
                continue
            for pattern in [
                r'window\.location(?:\.href)?\s*=\s*["\']([^"\']+)["\']',
                r'location\.replace\(["\']([^"\']+)["\']',
                r'"url"\s*:\s*"(https?://[^"]+)"',
            ]:
                m = re.search(pattern, script.string)
                if m:
                    candidate = m.group(1)
                    if candidate.startswith("http") and "news.google.com" not in candidate:
                        return candidate

        return final_url
    except Exception:
        return url


def _fetch_html(url: str, timeout: int = 15) -> tuple[str, str]:
    """Fetch HTML with robust headers. Returns (html, final_url)."""
    sess = requests.Session()

    parsed = urlparse(url)
    referer = f"{parsed.scheme}://{parsed.netloc}/"

    # Try multiple header strategies in order — some sites block complex browser headers (anti-bot),
    # others block simple ones. Try minimal first, then full browser headers.
    strategies = [
        # Strategy 1: Clean minimal headers — works for most Indian news sites (TOI, Hindu, NDTV)
        {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Connection": "keep-alive",
        },
        # Strategy 2: Googlebot — gets past many paywalls
        {
            "User-Agent": "Googlebot/2.1 (+http://www.google.com/bot.html)",
            "Accept": "text/html",
        },
        # Strategy 3: Full browser headers — works for sites that require them
        _make_headers(referer),
    ]

    last_exc = None
    best_resp = None

    for headers in strategies:
        try:
            resp = sess.get(url, headers=headers, timeout=timeout, allow_redirects=True)
            # Accept 403/401 responses that may still contain content
            if resp.ok or resp.status_code in (403, 401):
                resp.encoding = resp.apparent_encoding or "utf-8"
                # Pick the response with the most content
                if best_resp is None or len(resp.content) > len(best_resp.content):
                    best_resp = resp
                # If we got meaningful content (ld+json or paragraphs), stop early
                if b'application/ld+json' in resp.content or b'articleBody' in resp.content:
                    return resp.text, resp.url
        except requests.exceptions.SSLError:
            try:
                resp = sess.get(url, headers=headers, timeout=timeout, allow_redirects=True, verify=False)
                resp.encoding = resp.apparent_encoding or "utf-8"
                if best_resp is None or len(resp.content) > len(best_resp.content):
                    best_resp = resp
            except Exception as e:
                last_exc = e
        except requests.exceptions.TooManyRedirects:
            raise ValueError(f"Too many redirects for URL: {url}")
        except requests.exceptions.ConnectionError as e:
            last_exc = e
        except requests.exceptions.Timeout:
            raise ValueError(f"Request timed out for URL: {url}")
        except requests.exceptions.RequestException as e:
            last_exc = e

    if best_resp is not None:
        return best_resp.text, best_resp.url

    if last_exc:
        raise ValueError(f"Failed to fetch URL ({url}): {str(last_exc)}")
    raise ValueError(f"Failed to fetch URL: {url}")


def _extract_text_from_soup(soup: BeautifulSoup) -> str:
    """Multi-strategy article body extraction."""

    # Strategy 0: application/ld+json structured data (used by TOI, many JS-heavy sites)
    # This is the most reliable source when available — full articleBody, no JS needed.
    for script in soup.find_all("script", type="application/ld+json"):
        if not script.string:
            continue
        try:
            data = json.loads(script.string)
            # Handle both single object and @graph array
            items = data if isinstance(data, list) else [data]
            for item in items:
                body = item.get("articleBody") or item.get("description")
                if body and len(body) > 100:
                    return body.strip()
        except Exception:
            continue

    # Strategy 1: <article> tag
    article_body = soup.find("article")
    
    # Strategy 2: Schema.org articleBody
    if not article_body:
        article_body = soup.find(attrs={"itemprop": "articleBody"})
    
    # Strategy 3: Common CSS class patterns
    if not article_body:
        patterns = [
            r"article[-_]?(body|content|text)",
            r"story[-_]?(body|content|text)",
            r"post[-_]?(body|content|text)",
            r"entry[-_]?(body|content|text)",
            r"(main|page)[-_]?content",
            r"content[-_]?(body|main|article)",
            r"news[-_]?(body|content|article)",
            r"(c-article|article-wrap|article__body|storyContent|articleBody|article-detail)",
        ]
        combined_pattern = "|".join(patterns)
        article_body = soup.find(
            class_=re.compile(combined_pattern, re.I)
        ) or soup.find(
            id=re.compile(combined_pattern, re.I)
        )
    
    # Strategy 4: data-testid patterns used by Reuters, BBC, etc.
    if not article_body:
        article_body = soup.find(attrs={"data-testid": re.compile(r"article|story|content", re.I)})
    
    # Strategy 5: <main> tag
    if not article_body:
        article_body = soup.find("main")
    
    # Strategy 6: div with most paragraph children (readability heuristic)
    if not article_body:
        all_divs = soup.find_all("div")
        best_div = None
        best_count = 0
        for div in all_divs:
            paragraphs = [p for p in div.find_all("p", recursive=False) if len(p.get_text().strip()) > 30]
            if len(paragraphs) > best_count:
                best_count = len(paragraphs)
                best_div = div
        if best_count >= 3:
            article_body = best_div
    
    NOISE_PATTERN = re.compile(
        r"(cookie|subscribe|sign.?up|newsletter|copyright|advertisement|follow us|share this|related article|read more|download app|get the app|privacy policy|terms of service)",
        re.I
    )
    
    paragraphs = []
    container = article_body if article_body else soup
    
    for p in container.find_all("p"):
        text = p.get_text(separator=" ").strip()
        if len(text) > 25 and not NOISE_PATTERN.search(text):
            paragraphs.append(text)
    
    full_text = "\n\n".join(paragraphs).strip()
    
    # Final fallback: use all paragraphs from document
    if len(paragraphs) < 2:
        all_paragraphs = []
        for p in soup.find_all("p"):
            text = p.get_text(separator=" ").strip()
            if len(text) > 35 and not NOISE_PATTERN.search(text):
                all_paragraphs.append(text)
        full_text = "\n\n".join(all_paragraphs).strip()
    
    # Last resort: body text dump
    if not full_text and soup.body:
        # Remove noisy tags
        for tag in soup.body.find_all(["script", "style", "nav", "header", "footer", "aside", "noscript", "form", "iframe"]):
            tag.decompose()
        body_text = soup.body.get_text(separator=" ", strip=True)
        full_text = re.sub(r"\s+", " ", body_text)[:5000]
    
    return full_text


def scrape_article_from_url(url: str) -> Dict[str, Optional[str]]:
    """
    Fetches and parses a news article from a given web URL.
    Handles 403 blocking, paywalls, and diverse site layouts.
    Returns a dictionary with title, text, image, source, published_at, url.
    """
    if not url.startswith("http://") and not url.startswith("https://"):
        url = "https://" + url

    parsed_url = urlparse(url)

    # Resolve Google News redirect URLs to the actual article URL
    if parsed_url.netloc in GOOGLE_NEWS_DOMAINS:
        url = _resolve_google_news_url(url)
        parsed_url = urlparse(url)
        # If still on Google News after resolution, give a helpful error
        if parsed_url.netloc in GOOGLE_NEWS_DOMAINS:
            raise ValueError(
                "Could not resolve this Google News link to the original article. "
                "Please open the article in your browser, copy the final URL from the address bar, "
                "and paste that instead. Or use the 'Paste Text' tab."
            )

    # Fetch HTML
    try:
        html, final_url = _fetch_html(url)
    except ValueError as e:
        raise ValueError(str(e))
    except Exception as e:
        raise ValueError(f"Failed to fetch news article from URL ({url}): {str(e)}")

    soup = BeautifulSoup(html, "html.parser")

    # ── Extract ld+json BEFORE stripping scripts ─────────────────
    # Many JS-heavy sites (TOI, etc.) embed full articleBody in structured data
    ld_json_text = ""
    for script in soup.find_all("script", type="application/ld+json"):
        if not script.string:
            continue
        try:
            data = json.loads(script.string)
            items = data if isinstance(data, list) else [data]
            for item in items:
                body = item.get("articleBody") or item.get("description")
                if body and len(body.strip()) > 100:
                    ld_json_text = body.strip()
                    break
        except Exception:
            continue
        if ld_json_text:
            break

    # Remove non-content elements (scripts removed AFTER ld+json extracted above)
    for tag in soup(["script", "style", "nav", "header", "footer", "aside", "noscript", "form", "iframe", "svg", "button"]):
        tag.decompose()

    # ── Title ────────────────────────────────────────────────────
    title = ""
    og_title = soup.find("meta", property="og:title") or soup.find("meta", attrs={"name": "twitter:title"})
    if og_title and og_title.get("content"):
        title = og_title["content"].strip()
    elif soup.title and soup.title.string:
        title = soup.title.string.strip()
    elif soup.find("h1"):
        title = soup.find("h1").get_text().strip()
    
    # Clean title suffixes (e.g. " | CNN", " - The Hindu")
    if title:
        title = re.sub(r"\s*[-|–—]\s*[^–—|-]{1,40}$", "", title).strip() or title

    # ── Image ────────────────────────────────────────────────────
    image = None
    og_image = soup.find("meta", property="og:image") or soup.find("meta", attrs={"name": "twitter:image"})
    if og_image and og_image.get("content"):
        image = og_image["content"].strip()

    # ── Published Time ───────────────────────────────────────────
    published_at = None
    time_meta = (
        soup.find("meta", property="article:published_time")
        or soup.find("meta", attrs={"name": "publish-date"})
        or soup.find("meta", attrs={"name": "date"})
        or soup.find("meta", property="datePublished")
    )
    if time_meta and time_meta.get("content"):
        published_at = time_meta["content"].strip()
    elif soup.find("time"):
        t = soup.find("time")
        published_at = t.get("datetime") or t.get_text().strip()

    # ── Source ───────────────────────────────────────────────────
    source = ""
    og_site = soup.find("meta", property="og:site_name")
    if og_site and og_site.get("content"):
        source = og_site["content"].strip()
    else:
        domain_match = re.search(r"https?://(?:www\.)?([^/]+)", final_url)
        source = domain_match.group(1) if domain_match else "Web Article"

    # ── Article Text ─────────────────────────────────────────────
    # Priority 1: ld+json articleBody (pre-extracted before script removal)
    if ld_json_text:
        full_text = ld_json_text
    else:
        full_text = _extract_text_from_soup(soup)

    # Last-resort fallback: use meta description (better than nothing for JS-rendered sites)
    if not full_text or len(full_text) < 50:
        meta_desc = (
            soup.find("meta", attrs={"name": "description"})
            or soup.find("meta", property="og:description")
            or soup.find("meta", attrs={"name": "twitter:description"})
        )
        if meta_desc and meta_desc.get("content") and len(meta_desc["content"].strip()) > 30:
            full_text = meta_desc["content"].strip()

    if not full_text or len(full_text) < 50:
        raise ValueError(
            f"Could not extract readable article text from this URL. "
            f"The site may be paywalled, require JavaScript, or block web scrapers. "
            f"Try the 'Paste Text' option instead."
        )

    return {
        "title": title or "News Article",
        "text": full_text,
        "image": image,
        "source": source,
        "published_at": published_at,
        "url": final_url,
    }
