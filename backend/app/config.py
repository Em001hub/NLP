"""
Central configuration. Reads from a local .env file - nothing is hard-coded,
nothing is sent anywhere except the news API and huggingface's model hub
(only at first run, to download NLP models - after that everything is 100%
local/offline).
"""
import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)
SAVED_GRAPHS_DIR = DATA_DIR / "saved_graphs"
SAVED_GRAPHS_DIR.mkdir(exist_ok=True)
USERS_FILE = DATA_DIR / "users.json"

GNEWS_API_KEY = os.getenv("GNEWS_API_KEY", "")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "720"))
