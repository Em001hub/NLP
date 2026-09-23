"""
Groq LLM Integration for NewsGraph.
Provides high-speed (<1.5s), high-precision entity extraction with full proper names,
roles, statistics, concise simplified graph relationships, and conversational Story Q&A.
"""
import json
import logging
import os
import re
from pathlib import Path
from typing import Dict, List, Optional
import requests
from dotenv import load_dotenv

from ..config import BASE_DIR, GROQ_API_KEY

logger = logging.getLogger(__name__)

GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions"
# Active high-throughput, low-latency models on Groq
DEFAULT_MODEL = "qwen/qwen3.8-27b"
FALLBACK_MODEL = "openai/gpt-oss-20b"
TERTIARY_MODEL = "openai/gpt-oss-120b"


def _get_api_key(custom_key: Optional[str] = None) -> Optional[str]:
    k = (custom_key or "").strip()
    if k:
        return k
    
    env_key = os.getenv("GROQ_API_KEY", "").strip()
    if env_key:
        return env_key
    
    load_dotenv(BASE_DIR / ".env", override=True)
    return (os.getenv("GROQ_API_KEY", "") or GROQ_API_KEY or "").strip() or None


def is_groq_available(custom_key: Optional[str] = None) -> bool:
    return bool(_get_api_key(custom_key))


def extract_graph_with_groq(
    text: str,
    title: str = "Untitled",
    url: Optional[str] = None,
    custom_key: Optional[str] = None,
) -> Optional[dict]:
    """
    Extracts a clean, high-precision, and interconnected knowledge graph using Groq AI.
    Accurately captures:
    - Full proper names with titles (e.g. 'Justice Yogesh Khanna', 'Subhash Chandra', 'Venu Srinivasan')
    - Canonical entity consolidation (never split first/last names or titles)
    - Specific roles and occupations for people
    - Meaningful, descriptive action verbs for relationships (e.g. 'appealed against', 'presided by', 'chaired')
    - Connected graph topology without isolated key entities
    """
    api_key = _get_api_key(custom_key)
    if not api_key:
        return None

    system_prompt = (
        "You are an expert Cyber-Intelligence Knowledge Graph Engine for news analysis.\n"
        "Your task is to extract a HIGH-PRECISION, FAST, and MEANINGFULLY CONNECTED knowledge graph from the given news article.\n\n"
        "CRITICAL EXTRACTION RULES:\n"
        "1. FULL PROPER NAMES & TITLES (PERSON):\n"
        "   - Always extract complete full proper names (e.g. 'Subhash Chandra', 'Justice Yogesh Khanna', 'Venu Srinivasan', 'Barun Mitra').\n"
        "   - NEVER separate titles into standalone entities (e.g. NEVER make 'Justice' or 'Judge' or 'Dr' its own entity).\n"
        "   - Consolidate references: if an individual is referred to by first name, last name, or pronoun, map back to their single canonical full name node.\n"
        "   - NEVER create duplicate or fragmented nodes for the same person.\n"
        "   - Always populate the 'role' field with their designation (e.g. 'Former Zee Chairman', 'NCLAT Judge', 'Chairman Emeritus of TVS Motor').\n"
        "2. CORE KEY ENTITIES (8 to 15 nodes):\n"
        "   - Extract key Persons, Organizations, Tribunals/Courts, Locations, and vital Numbers/Monetary stats (e.g. '₹6.5 crore', '66 percent stake').\n"
        "   - Exclude trivial noise or generic buzzwords.\n"
        "3. ACCURATE, RICH RELATIONSHIPS (8 to 16 edges):\n"
        "   - Connect key entities with accurate, descriptive action verbs (e.g. 'appealed against', 'presided over', 'chaired by', 'holds majority stake in', 'succeeded', 'represented lenders against', 'stayed assets of').\n"
        "   - AVOID vague 'associated with' or 'connected with' whenever a clear action or role relationship exists.\n"
        "   - Ensure major people are linked to their organizations, courts, or counterparts so key entities are NOT orphaned.\n"
        "4. STRICT JSON OUTPUT matching the schema."
    )

    json_schema_prompt = """
Respond with a JSON object strictly following this schema:
{
  "summary": "2-3 sentence clear factual summary of the article.",
  "detected_languages": ["en"],
  "nodes": [
    {
      "id": "n_1",
      "label": "Full Proper Name or Entity Name",
      "type": "PERSON" | "ORG" | "LOC" | "EVENT" | "NUMBER" | "STAT" | "DATE" | "MISC",
      "language": "en",
      "mentions": 1,
      "confidence": 0.99,
      "role": "Role or designation (e.g. NCLAT Judge, Chairman Emeritus)",
      "facts": ["Key factual statement about this entity from the article"],
      "numbers": ["Key numbers or figures associated if any"]
    }
  ],
  "edges": [
    {
      "id": "e_1",
      "source": "n_1",
      "target": "n_2",
      "relation": "specific action verb (e.g. appealed to, presided over, chaired by, holds stake in)",
      "sentence": "Direct concise sentence stating this relation",
      "weight": 2,
      "facts": []
    }
  ]
}
"""

    user_prompt = f"Article Title: {title}\n\nArticle Body:\n{text[:10000]}\n\n{json_schema_prompt}"

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": DEFAULT_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.1,
        "max_tokens": 2500,
    }

    try:
        resp = requests.post(GROQ_ENDPOINT, headers=headers, json=payload, timeout=12)
        if resp.status_code != 200:
            payload["model"] = FALLBACK_MODEL
            resp = requests.post(GROQ_ENDPOINT, headers=headers, json=payload, timeout=12)
            if resp.status_code != 200:
                payload["model"] = TERTIARY_MODEL
                resp = requests.post(GROQ_ENDPOINT, headers=headers, json=payload, timeout=15)
        resp.raise_for_status()

        data = resp.json()
        if "choices" not in data or not data["choices"]:
            logger.warning("Groq extraction: unexpected response body: %s", str(data)[:300])
            return None
        raw_content = data["choices"][0]["message"]["content"]
        parsed = json.loads(raw_content)

        valid_nodes = []
        node_id_map = {}
        seen_labels = {}

        for idx, n in enumerate(parsed.get("nodes", [])):
            nid = str(n.get("id") or f"n_{idx+1}")
            label = str(n.get("label", "")).strip()
            if not label or len(label) < 2:
                continue

            norm_label = label.lower()
            if norm_label in seen_labels:
                node_id_map[nid] = seen_labels[norm_label]
                continue

            ntype = str(n.get("type", "MISC")).upper()
            if ntype not in ["PERSON", "ORG", "LOC", "EVENT", "NUMBER", "STAT", "DATE", "MISC"]:
                ntype = "MISC"

            node_obj = {
                "id": nid,
                "label": label,
                "type": ntype,
                "language": n.get("language", "en"),
                "mentions": int(n.get("mentions", 1)),
                "confidence": float(n.get("confidence", 0.98)),
                "role": n.get("role"),
                "facts": [str(f) for f in n.get("facts", []) if f],
                "numbers": [str(num) for num in n.get("numbers", []) if num],
            }
            valid_nodes.append(node_obj)
            node_id_map[nid] = nid
            seen_labels[norm_label] = nid

        valid_edges = []
        seen_edge_pairs = set()
        for idx, e in enumerate(parsed.get("edges", [])):
            src_raw = str(e.get("source", ""))
            tgt_raw = str(e.get("target", ""))
            src = node_id_map.get(src_raw, src_raw)
            tgt = node_id_map.get(tgt_raw, tgt_raw)

            if src not in node_id_map.values() or tgt not in node_id_map.values() or src == tgt:
                continue

            pair = (src, tgt, str(e.get("relation", "")).lower())
            if pair in seen_edge_pairs:
                continue
            seen_edge_pairs.add(pair)

            valid_edges.append(
                {
                    "id": str(e.get("id") or f"e_{len(valid_edges)+1}"),
                    "source": src,
                    "target": tgt,
                    "relation": str(e.get("relation", "connected with")),
                    "sentence": str(e.get("sentence", "")),
                    "weight": int(e.get("weight", 2)),
                    "facts": [str(f) for f in e.get("facts", []) if f],
                }
            )

        sentences = [s.strip() for s in re.split(r"[.!?।]+", text) if len(s.strip()) > 5]

        return {
            "article_title": title,
            "article_url": url,
            "detected_languages": parsed.get("detected_languages", ["en"]),
            "nodes": valid_nodes,
            "edges": valid_edges,
            "sentence_count": len(sentences),
            "entity_count": len(valid_nodes),
            "summary": parsed.get("summary", ""),
            "warnings": [],
        }
    except Exception as e:
        logger.warning("Groq extraction failed, falling back to local pipeline: %s", e)
        return None


def ask_graph_question(
    query: str,
    graph: dict,
    article_text: Optional[str] = "",
    custom_key: Optional[str] = None,
) -> dict:
    """
    Answers user queries grounded in the story's knowledge graph.
    Returns clear, human-readable answers directly naming the people, roles, numbers, and events.
    """
    api_key = _get_api_key(custom_key)

    nodes = graph.get("nodes", [])
    edges = graph.get("edges", [])
    title = graph.get("article_title", "News Article")
    summary = graph.get("summary", "")

    nodes_summary = []
    for n in nodes:
        role_str = f" ({n.get('role')})" if n.get("role") else ""
        facts_str = f" | Facts: {'; '.join(n.get('facts', []))}" if n.get("facts") else ""
        nums_str = f" | Stats: {', '.join(n.get('numbers', []))}" if n.get("numbers") else ""
        nodes_summary.append(f"- [{n['id']}] {n['label']}{role_str} [{n['type']}]{facts_str}{nums_str}")

    edges_summary = []
    for e in edges:
        edges_summary.append(f"- {e['source']} --[{e['relation']}]--> {e['target']} (Quote: \"{e['sentence']}\")")

    if api_key:
        system_prompt = (
            "You are an expert AI Intelligence Assistant embedded in NewsGraph.\n"
            "Answer the user's question directly, clearly, and factually based on the extracted Knowledge Graph and Article context.\n\n"
            "GUIDELINES:\n"
            "1. If asked 'who are the people involved', clearly list the individuals by their full proper names, their roles, and what they did in the story.\n"
            "2. Cite any key numbers, statistics, or direct quotes accurately.\n"
            "3. In 'relevant_node_ids', return the exact IDs of the nodes that answer the question."
        )

        user_content = (
            f"Article Title: {title}\n"
            f"Article Summary: {summary}\n\n"
            f"KNOWLEDGE GRAPH ENTITIES:\n" + "\n".join(nodes_summary[:30]) + "\n\n"
            f"KNOWLEDGE GRAPH RELATIONSHIPS:\n" + "\n".join(edges_summary[:20]) + "\n\n"
            f"ARTICLE BODY EXCERPT:\n{article_text[:3500]}\n\n"
            f"USER QUERY: {query}\n\n"
            "Respond strictly in JSON format:\n"
            "{\n"
            '  "answer": "Clear, direct, nicely formatted answer.",\n'
            '  "relevant_node_ids": ["n_1", "n_2"],\n'
            '  "relevant_facts": ["Cited fact or quote"]\n'
            "}"
        )

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        payload = {
            "model": DEFAULT_MODEL,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.2,
            "max_tokens": 1200,
        }

        try:
            resp = requests.post(GROQ_ENDPOINT, headers=headers, json=payload, timeout=10)
            if resp.status_code != 200:
                payload["model"] = FALLBACK_MODEL
                resp = requests.post(GROQ_ENDPOINT, headers=headers, json=payload, timeout=10)
                if resp.status_code != 200:
                    payload["model"] = TERTIARY_MODEL
                    resp = requests.post(GROQ_ENDPOINT, headers=headers, json=payload, timeout=15)
            resp.raise_for_status()
            data = resp.json()
            if "choices" not in data or not data["choices"]:
                raise ValueError(f"Unexpected Groq response: {str(data)[:200]}")
            parsed = json.loads(data["choices"][0]["message"]["content"])
            return {
                "answer": parsed.get("answer", "No direct answer generated."),
                "relevant_node_ids": parsed.get("relevant_node_ids", []),
                "relevant_facts": parsed.get("relevant_facts", []),
            }
        except Exception as e:
            logger.warning("Groq QA API call failed: %s", e)

    # Local fallback query formatting
    q_lower = query.lower()
    is_asking_people = any(k in q_lower for k in ["who", "people", "person", "persons", "actors", "names"])
    person_nodes = [n for n in nodes if n.get("type") == "PERSON"]

    if is_asking_people and person_nodes:
        people_lines = []
        for p in person_nodes:
            role = f" ({p.get('role')})" if p.get("role") else ""
            fact = f" — {p['facts'][0]}" if p.get("facts") else ""
            people_lines.append(f"• **{p['label']}**{role}{fact}")
        
        return {
            "answer": "The primary people involved in this story are:\n\n" + "\n".join(people_lines),
            "relevant_node_ids": [p["id"] for p in person_nodes],
            "relevant_facts": [p["facts"][0] for p in person_nodes if p.get("facts")],
        }

    matching_nodes = []
    matched_facts = []
    for n in nodes:
        label = n.get("label", "").lower()
        if any(term in label for term in q_lower.split() if len(term) > 2):
            matching_nodes.append(n)
            matched_facts.extend(n.get("facts", []))

    if matching_nodes:
        found_names = [f"**{m['label']}** ({m.get('type')})" for m in matching_nodes[:6]]
        return {
            "answer": f"Relevant entities found in graph: {', '.join(found_names)}.",
            "relevant_node_ids": [m["id"] for m in matching_nodes[:6]],
            "relevant_facts": matched_facts[:4],
        }

    return {
        "answer": f"No direct graph matches for '{query}'. Connect Groq AI for full natural-language question answering.",
        "relevant_node_ids": [],
        "relevant_facts": [],
    }
