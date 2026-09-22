"""
Web Article Scraper for NewsGraph.
Extracts title, main article text, author, lead image, and publication date from any news URL.
"""
import re
from typing import Dict, Optional
import requests
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9,hi;q=0.8,mr;q=0.7",
}


def scrape_article_from_url(url: str) -> Dict[str, Optional[str]]:
    """
    Fetches and parses a news article from a given web URL.
    Returns a dictionary with title, text, image, source, published_at.
    """
    if not url.startswith("http://") and not url.startswith("https://"):
        url = "https://" + url

    try:
        resp = requests.get(url, headers=HEADERS, timeout=12, allow_redirects=True)
        resp.raise_for_status()
        resp.encoding = resp.apparent_encoding or "utf-8"
        html = resp.text
    except Exception as e:
        raise ValueError(f"Failed to fetch news article from URL ({url}): {str(e)}")

    soup = BeautifulSoup(html, "html.parser")

    # Remove non-content elements
    for tag in soup(["script", "style", "nav", "header", "footer", "aside", "noscript", "form", "iframe", "svg"]):
        tag.decompose()

    # Extract Title
    title = ""
    og_title = soup.find("meta", property="og:title") or soup.find("meta", attrs={"name": "twitter:title"})
    if og_title and og_title.get("content"):
        title = og_title["content"].strip()
    elif soup.title and soup.title.string:
        title = soup.title.string.strip()
    elif soup.find("h1"):
        title = soup.find("h1").get_text().strip()

    # Clean title suffixes (e.g., " | CNN", " - The Hindu")
    if title:
        title = re.sub(r"\s*[-|–—]\s*[^–—|-]+$", "", title).strip() or title

    # Extract Image
    image = None
    og_image = soup.find("meta", property="og:image") or soup.find("meta", attrs={"name": "twitter:image"})
    if og_image and og_image.get("content"):
        image = og_image["content"].strip()

    # Extract Published Time
    published_at = None
    time_meta = soup.find("meta", property="article:published_time") or soup.find("meta", attrs={"name": "publish-date"})
    if time_meta and time_meta.get("content"):
        published_at = time_meta["content"].strip()
    elif soup.find("time"):
        t = soup.find("time")
        published_at = t.get("datetime") or t.get_text().strip()

    # Extract Source Name
    source = ""
    og_site = soup.find("meta", property="og:site_name")
    if og_site and og_site.get("content"):
        source = og_site["content"].strip()
    else:
        # Fallback to domain name
        domain_match = re.search(r"https?://(?:www\.)?([^/]+)", url)
        source = domain_match.group(1) if domain_match else "Web Article"

    # Extract main text body
    # Prefer article tag or semantic content container
    article_container = (
        soup.find("article")
        or soup.find(attrs={"itemprop": "articleBody"})
        or soup.find(class_=re.compile(r"article[-_]body|story[-_]content|post[-_]content|entry[-_]content|main[-_]content", re.I))
        or soup.find("main")
    )

    paragraphs = []
    if article_container:
        for p in article_container.find_all("p"):
            text = p.get_text().strip()
            if len(text) > 25 and not re.search(r"cookie|subscribe|sign up|copyright|advertisement", text, re.I):
                paragraphs.append(text)

    # Fallback to all document paragraphs if container yielded too little
    if len(paragraphs) < 2:
        paragraphs = []
        for p in soup.find_all("p"):
            text = p.get_text().strip()
            if len(text) > 30 and not re.search(r"cookie|subscribe|sign up|copyright|advertisement", text, re.I):
                paragraphs.append(text)

    full_text = "\n\n".join(paragraphs).strip()
    if not full_text:
        # Last resort fallback: get text from body
        body_text = soup.body.get_text(separator=" ", strip=True) if soup.body else ""
        cleaned = re.sub(r"\s+", " ", body_text)
        full_text = cleaned[:4000]

    if not full_text:
        raise ValueError("Could not extract readable article text from the URL.")

    return {
        "title": title or "News Article",
        "text": full_text,
        "image": image,
        "source": source,
        "published_at": published_at,
        "url": url,
    }
