"""
Relationship extraction between entities using Stanza dependency parsing.
Avoids combinatorial edge explosions by keeping the relationship graph concise,
accurate, and human-readable.
"""
import threading
from typing import List, Dict, Tuple

try:
    import stanza
    HAS_STANZA = True
except ImportError:
    stanza = None
    HAS_STANZA = False

_lock = threading.Lock()
_stanza_pipelines: Dict[str, "stanza.Pipeline"] = {}

SUBJECT_RELS = {"nsubj", "nsubj:pass", "csubj", "csubj:pass"}
OBJECT_RELS = {"obj", "iobj", "obl", "obl:agent", "obl:tmod", "nmod", "dobj"}
SUPPORTED_STANZA_LANGS = {"en", "hi", "mr"}


def _get_stanza_pipeline(lang: str):
    if not HAS_STANZA:
        return None
    lang = lang if lang in SUPPORTED_STANZA_LANGS else "en"
    with _lock:
        if lang not in _stanza_pipelines:
            try:
                stanza.download(lang, verbose=False)
            except Exception:
                pass
            try:
                _stanza_pipelines[lang] = stanza.Pipeline(
                    lang=lang,
                    processors="tokenize,pos,lemma,depparse",
                    verbose=False,
                    use_gpu=False,
                )
            except Exception:
                _stanza_pipelines[lang] = None
        return _stanza_pipelines.get(lang)


def _entity_token_span(entity: dict, sent_tokens) -> Tuple[int, int]:
    start, end = entity["start"], entity["end"]
    idxs = [
        i
        for i, tok in enumerate(sent_tokens)
        if tok.start_char is not None
        and tok.end_char is not None
        and tok.start_char < end
        and tok.end_char > start
    ]
    if not idxs:
        return (-1, -1)
    return (min(idxs), max(idxs))


def extract_relations_for_sentence(sentence_text: str, entities: List[dict], lang: str) -> List[dict]:
    """
    Extracts direct, meaningful directed verb relationships between entities.
    Caps relations per sentence to avoid messy over-connected spiderwebs.
    """
    if len(entities) < 2:
        return []

    try:
        nlp = _get_stanza_pipeline(lang)
        doc = nlp(sentence_text) if nlp else None
    except Exception:
        doc = None

    if not doc or not doc.sentences:
        return _fallback_cooccurrence(entities)

    sent = doc.sentences[0]
    tokens = sent.words

    ent_spans = []
    for e in entities:
        span = _entity_token_span(e, tokens)
        if span != (-1, -1):
            ent_spans.append((e, span))

    if len(ent_spans) < 2:
        return _fallback_cooccurrence(entities)

    relations = []
    found_pairs = set()

    for verb in tokens:
        if verb.upos not in ("VERB", "AUX"):
            continue
        verb_id = verb.id

        subj_entities = []
        obj_entities = []
        for ent, (lo, hi) in ent_spans:
            tok = tokens[lo]
            if tok.head == verb_id and tok.deprel.split(":")[0] in {r.split(":")[0] for r in SUBJECT_RELS}:
                subj_entities.append(ent)
            elif tok.head == verb_id and tok.deprel.split(":")[0] in {r.split(":")[0] for r in OBJECT_RELS}:
                obj_entities.append(ent)

        for s in subj_entities:
            for o in obj_entities:
                if s["text"] == o["text"]:
                    continue
                pair_key = (s["text"], o["text"])
                if pair_key in found_pairs:
                    continue
                found_pairs.add(pair_key)
                relations.append(
                    {
                        "source_text": s["text"],
                        "target_text": o["text"],
                        "relation": verb.lemma or verb.text,
                        "weight": 2,
                    }
                )

    # If no verb relation was found, only add 1 direct adjacent connection between the top two entities
    if not relations and len(entities) >= 2:
        relations.append(
            {
                "source_text": entities[0]["text"],
                "target_text": entities[1]["text"],
                "relation": "associated with",
                "weight": 1,
            }
        )

    return relations[:4]  # Keep graph clean and focused


def _fallback_cooccurrence(entities: List[dict]) -> List[dict]:
    if len(entities) < 2:
        return []
    # Link adjacent entities only (linear chain, not full quadratic mesh)
    relations = []
    for i in range(min(len(entities) - 1, 2)):
        relations.append(
            {
                "source_text": entities[i]["text"],
                "target_text": entities[i + 1]["text"],
                "relation": "associated with",
                "weight": 1,
            }
        )
    return relations
