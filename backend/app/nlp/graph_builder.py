"""
Orchestrates the full pipeline:
- Groq AI extraction when configured (instant, high-precision entities, numbers & relationships)
- Local transformer/heuristic extraction with fallback (offline, privacy-preserving)
Outputs enriched GraphResult with nodes, edges, facts, numbers, and summary.
"""
import hashlib
import re
from collections import defaultdict
from typing import List, Optional

from .groq_service import extract_graph_with_groq
from .language_utils import detect_language, split_sentences_generic
from .ner_engine import extract_entities
from .relation_extractor import extract_relations_for_sentence

MIN_SENTENCE_LEN = 3


def _norm(text: str) -> str:
    t = re.sub(r"\s+", " ", text).strip()
    return t.lower()


def _node_id(norm_text: str) -> str:
    return "n_" + hashlib.md5(norm_text.encode("utf-8")).hexdigest()[:10]


def build_graph(
    text: str,
    title: str = "Untitled",
    url: Optional[str] = None,
    groq_api_key: Optional[str] = None,
) -> dict:
    # 1. Try Groq AI extraction first if key is present
    groq_result = extract_graph_with_groq(text, title=title, url=url, custom_key=groq_api_key)
    if groq_result and len(groq_result.get("nodes", [])) > 0:
        return groq_result

    # 2. Local NLP extraction pipeline
    warnings = []
    sentences = split_sentences_generic(text)
    sentences = [s for s in sentences if len(s) >= MIN_SENTENCE_LEN]

    if not sentences:
        warnings.append("No usable sentences were found in this article's text.")

    nodes = {}  # norm_text -> node dict
    edges = defaultdict(lambda: {"weight": 0, "relations": set(), "sentence": "", "facts": []})
    detected_languages = set()

    for sent in sentences:
        lang = detect_language(sent)
        detected_languages.add(lang)

        entities = extract_entities(sent)
        if not entities:
            continue

        # Extract any numbers or statistics present in this sentence
        sentence_numbers = [e["text"] for e in entities if e["label"] == "STAT"]

        # Register / update nodes
        for e in entities:
            key = _norm(e["text"])
            if not key:
                continue
            if key not in nodes:
                nodes[key] = {
                    "id": _node_id(key),
                    "label": e["text"],
                    "type": e["label"],
                    "language": lang,
                    "mentions": 0,
                    "score_sum": 0.0,
                    "score_n": 0,
                    "facts": [],
                    "numbers": [],
                    "role": None,
                }
            nodes[key]["mentions"] += 1
            nodes[key]["score_sum"] += e.get("score", 0.9)
            nodes[key]["score_n"] += 1

            # Attach sentence numbers and facts
            for num in sentence_numbers:
                if num != e["text"] and num not in nodes[key]["numbers"]:
                    nodes[key]["numbers"].append(num)

            # Add context sentence if informative
            if len(nodes[key]["facts"]) < 3 and len(sent) < 200 and sent not in nodes[key]["facts"]:
                nodes[key]["facts"].append(sent)

        # Build relationships between entities
        relatable = [e for e in entities if e["label"] != "DATE"]
        rels = extract_relations_for_sentence(sent, relatable, lang)

        for r in rels:
            sk, tk = _norm(r["source_text"]), _norm(r["target_text"])
            if sk not in nodes or tk not in nodes:
                continue
            edge_key = (nodes[sk]["id"], nodes[tk]["id"], r["relation"].lower())
            edges[edge_key]["weight"] += r["weight"]
            edges[edge_key]["relations"].add(r["relation"])
            edges[edge_key]["sentence"] = sent
            edges[edge_key]["source"] = nodes[sk]["id"]
            edges[edge_key]["target"] = nodes[tk]["id"]
            if sentence_numbers:
                for num in sentence_numbers:
                    if num not in edges[edge_key]["facts"]:
                        edges[edge_key]["facts"].append(num)

    node_list = []
    for n in nodes.values():
        avg_score = round(n["score_sum"] / max(n["score_n"], 1), 3)
        node_list.append(
            {
                "id": n["id"],
                "label": n["label"],
                "type": n["type"],
                "language": n["language"],
                "mentions": n["mentions"],
                "confidence": avg_score,
                "facts": n["facts"],
                "numbers": n["numbers"],
                "role": n["role"],
            }
        )

    edge_list = []
    for i, (key, e) in enumerate(edges.items()):
        edge_list.append(
            {
                "id": f"e_{i}",
                "source": e["source"],
                "target": e["target"],
                "relation": key[2],
                "sentence": e["sentence"],
                "weight": e["weight"],
                "facts": e["facts"],
            }
        )

    if len(node_list) == 0:
        warnings.append(
            "No named entities or numbers were confidently detected in this text. Try a longer article or connect Groq API key in Settings."
        )

    return {
        "article_title": title,
        "article_url": url,
        "detected_languages": sorted(detected_languages) or ["en"],
        "nodes": node_list,
        "edges": edge_list,
        "sentence_count": len(sentences),
        "entity_count": len(node_list),
        "summary": None,
        "warnings": warnings,
    }
