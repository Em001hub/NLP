"""
NewsGraph backend entrypoint.
CORS is set to allow all origins for production flexibility.
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth_router, news_router, graph_router

app = FastAPI(
    title="NewsGraph API",
    description="Turns news articles into interactive entity-relationship graphs.",
    version="1.0.0",
)

# Allow all origins (production safe since API uses JWT authentication)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(news_router.router)
app.include_router(graph_router.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "newsgraph-backend"}
