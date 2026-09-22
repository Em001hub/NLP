from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Query

from .. import auth, news_service
from ..schemas import NewsArticle
from typing import List

router = APIRouter(prefix="/api/news", tags=["news"])


@router.get("/headlines", response_model=List[NewsArticle])
def headlines(
    country: str = Query("in", description="2-letter country code, e.g. in, us, gb"),
    category: str = Query("general"),
    language: str = Query("en", description="e.g. en, hi"),
    max_results: int = Query(15, ge=1, le=50),
    username: str = Depends(auth.get_current_username),
):
    try:
        return news_service.fetch_top_headlines(country, category, language, max_results)
    except RuntimeError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(502, f"Could not reach news provider: {e}")


@router.get("/search", response_model=List[NewsArticle])
def search(
    q: str,
    country: Optional[str] = None,
    language: str = "en",
    max_results: int = Query(15, ge=1, le=50),
    username: str = Depends(auth.get_current_username),
):
    try:
        return news_service.search_news(q, country, language, max_results)
    except RuntimeError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(502, f"Could not reach news provider: {e}")
