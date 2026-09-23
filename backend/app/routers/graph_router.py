from fastapi import APIRouter, HTTPException, Depends
from typing import Optional

from .. import auth, storage
from ..schemas import (
    AnalyzeTextRequest,
    GraphResult,
    SaveGraphRequest,
    ScrapeUrlRequest,
    AskGraphQuestionRequest,
    AskGraphQuestionResponse,
)
from ..nlp.graph_builder import build_graph
from ..nlp.groq_service import ask_graph_question
from ..scraper import scrape_article_from_url

router = APIRouter(prefix="/api/graph", tags=["graph"])


@router.post("/analyze", response_model=GraphResult)
def analyze(req: AnalyzeTextRequest, username: str = Depends(auth.get_current_username)):
    full_text = req.text.strip()
    if not full_text:
        raise HTTPException(400, "No text provided to analyze")
    result = build_graph(
        full_text,
        title=req.title or "Untitled",
        url=req.url,
        groq_api_key=req.groq_api_key,
    )
    return result


@router.post("/analyze-url", response_model=GraphResult)
def analyze_url(req: ScrapeUrlRequest, username: str = Depends(auth.get_current_username)):
    url = req.url.strip()
    if not url:
        raise HTTPException(400, "No URL provided")
    try:
        scraped = scrape_article_from_url(url)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(502, f"Scraper error for URL: {str(e)}")

    if not scraped.get("text") or len(scraped["text"]) < 50:
        raise HTTPException(400,
            "The article at this URL appears to be empty or blocked. "
            "Try the 'Paste Text' tab to paste the article content directly."
        )

    result = build_graph(
        text=scraped["text"],
        title=scraped["title"],
        url=scraped["url"],
        groq_api_key=req.groq_api_key,
    )
    return result


@router.post("/qa", response_model=AskGraphQuestionResponse)
def ask_question(req: AskGraphQuestionRequest, username: str = Depends(auth.get_current_username)):
    if not req.query.strip():
        raise HTTPException(400, "Query cannot be empty")
    
    answer_data = ask_graph_question(
        query=req.query,
        graph=req.graph.model_dump(),
        article_text=req.article_text or "",
        custom_key=req.groq_api_key,
    )
    return AskGraphQuestionResponse(
        answer=answer_data.get("answer", ""),
        relevant_node_ids=answer_data.get("relevant_node_ids", []),
        relevant_facts=answer_data.get("relevant_facts", []),
    )


@router.post("/save")
def save(req: SaveGraphRequest, username: str = Depends(auth.get_current_username)):
    saved_name = storage.save_graph(f"{username}_{req.name}", req.graph.model_dump())
    return {"saved_as": saved_name}


@router.get("/saved")
def list_saved(username: str = Depends(auth.get_current_username)):
    return [n for n in storage.list_saved_graphs() if n.startswith(f"{username}_")]


@router.get("/saved/{name}")
def get_saved(name: str, username: str = Depends(auth.get_current_username)):
    data = storage.load_graph(name)
    if not data:
        raise HTTPException(404, "Saved graph not found")
    return data
