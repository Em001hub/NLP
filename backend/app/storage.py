"""
Zero-database local storage. Everything lives in flat JSON files under
backend/data/. This keeps the whole project runnable on a laptop with no
Postgres/Mongo/etc, exactly as requested.
"""
import json
import threading
from pathlib import Path
from typing import Any, Dict, List
from .config import USERS_FILE, SAVED_GRAPHS_DIR

_lock = threading.Lock()


def _read_json(path: Path, default):
    if not path.exists():
        return default
    with open(path, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return default


def _write_json(path: Path, data: Any):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def get_users() -> Dict[str, Dict[str, Any]]:
    with _lock:
        return _read_json(USERS_FILE, {})


def save_user(username: str, hashed_password: str):
    with _lock:
        users = _read_json(USERS_FILE, {})
        users[username] = {"username": username, "hashed_password": hashed_password}
        _write_json(USERS_FILE, users)


def user_exists(username: str) -> bool:
    return username in get_users()


def save_graph(name: str, graph_dict: Dict[str, Any]) -> str:
    safe_name = "".join(c if c.isalnum() or c in "-_ " else "_" for c in name).strip()
    safe_name = safe_name or "graph"
    path = SAVED_GRAPHS_DIR / f"{safe_name}.json"
    with _lock:
        _write_json(path, graph_dict)
    return safe_name


def list_saved_graphs() -> List[str]:
    return sorted(p.stem for p in SAVED_GRAPHS_DIR.glob("*.json"))


def load_graph(name: str) -> Dict[str, Any]:
    path = SAVED_GRAPHS_DIR / f"{name}.json"
    return _read_json(path, {})
