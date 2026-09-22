from pydantic import BaseModel
from typing import List, Optional, Literal


class SignupRequest(BaseModel):
    username: str
    password: str


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str


class NewsArticle(BaseModel):
    id: str
    title: str
    description: Optional[str] = ""
    content: Optional[str] = ""
    url: str
    image: Optional[str] = None
    publishedAt: Optional[str] = None
    source: Optional[str] = None
    language: Optional[str] = "en"


class GraphNode(BaseModel):
    id: str
    label: str
    type: str  # PERSON, ORG, LOC, EVENT, NUMBER, STAT, MONEY, DATE, MISC
    language: str = "en"
    mentions: int = 1
    confidence: float = 0.95
    facts: List[str] = []
    numbers: List[str] = []
    role: Optional[str] = None


class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    relation: str
    sentence: str = ""
    weight: int = 1
    facts: List[str] = []


class GraphResult(BaseModel):
    article_title: str
    article_url: Optional[str] = None
    detected_languages: List[str] = ["en"]
    nodes: List[GraphNode]
    edges: List[GraphEdge]
    sentence_count: int = 0
    entity_count: int = 0
    summary: Optional[str] = None
    warnings: List[str] = []


class AnalyzeTextRequest(BaseModel):
    text: str
    title: Optional[str] = "Untitled"
    url: Optional[str] = None
    groq_api_key: Optional[str] = None


class ScrapeUrlRequest(BaseModel):
    url: str
    groq_api_key: Optional[str] = None


class AskGraphQuestionRequest(BaseModel):
    query: str
    graph: GraphResult
    article_text: Optional[str] = ""
    groq_api_key: Optional[str] = None


class AskGraphQuestionResponse(BaseModel):
    answer: str
    relevant_node_ids: List[str] = []
    relevant_facts: List[str] = []


class SaveGraphRequest(BaseModel):
    name: str
    graph: GraphResult
