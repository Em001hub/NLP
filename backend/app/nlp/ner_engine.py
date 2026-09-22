"""
Named Entity & Quantitative Fact Recognition engine.
On production servers, heavy ML libraries (torch/transformers) may not be installed.
In that case, entity extraction gracefully degrades to regex-only mode.
The Groq AI path (groq_service.py) handles all production entity extraction.
"""
import re
import threading
from typing import List, Dict

try:
    from transformers import pipeline as hf_pipeline
    HAS_TRANSFORMERS = True
except ImportError:
    hf_pipeline = None
    HAS_TRANSFORMERS = False

try:
    from .language_utils import script_of
except Exception:
    def script_of(text):
        return "latin"

_lock = threading.Lock()
_pipelines: Dict[str, object] = {}

INDIC_MODEL = "ai4bharat/IndicNER"
ENGLISH_MODEL = "dslim/bert-base-NER"

LABEL_MAP = {
    "PER": "PERSON",
    "PERSON": "PERSON",
    "LOC": "LOC",
    "ORG": "ORG",
    "MISC": "MISC",
    "EVENT": "EVENT",
}

DATE_PATTERNS = [
    r"\b\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+\d{4}\b",
    r"\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b",
    r"\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b",
]
DATE_RE = re.compile("|".join(DATE_PATTERNS), re.I)

FACT_NUM_PATTERNS = [
    r"\b(?:\d{1,3}(?:,\d{3})+|\d+)\s+(?:people\s+)?(?:killed|dead|fatalities|deaths|injured|wounded|casualties|hospitalized|displaced|arrested|trapped|rescued|missing|lives\s+lost)\b",
    r"(?:[$€£₹]|Rs\.?|INR|USD)\s*(?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d+)?\s*(?:billion|million|trillion|crore|lakh|cr|k|m|b)?\b",
    r"\b\d+(?:\.\d+)?\s*(?:%|percent|magnitude|km/h|mph|tons|tonnes)\b",
]
FACT_NUM_RE = re.compile("|".join(FACT_NUM_PATTERNS), re.I)

PERSON_TITLE_PREFIXES = (
    r"(?:Mr\.?|Mrs\.?|Ms\.?|Dr\.?|Prof\.?|President|Prime\s+Minister|PM|Chief\s+Minister|CM|"
    r"Governor|General|Senator|Minister|Secretary|King|Queen|Judge|Justice|Shri|Smt\.?)\s+"
)
PERSON_TITLE_RE = re.compile(
    r"\b" + PERSON_TITLE_PREFIXES + r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b"
)


def _get_pipeline(model_name: str):
    if not HAS_TRANSFORMERS:
        return None
    with _lock:
        if model_name not in _pipelines:
            try:
                _pipelines[model_name] = hf_pipeline(
                    "ner",
                    model=model_name,
                    aggregation_strategy="simple",
                )
            except Exception:
                _pipelines[model_name] = None
        return _pipelines[model_name]


def _pick_model_for(text: str) -> str:
    try:
        return INDIC_MODEL if script_of(text) == "devanagari" else ENGLISH_MODEL
    except Exception:
        return ENGLISH_MODEL


def extract_entities(text: str) -> List[dict]:
    """
    Extracts entities using transformer models if available, or regex fallback.
    On production (Groq-first) deployments, this is rarely called.
    """
    text = text.strip()
    if not text:
        return []

    entities = []
    covered_spans = []

    if HAS_TRANSFORMERS:
        model_name = _pick_model_for(text)
        ner_pipeline = _get_pipeline(model_name)

        if ner_pipeline:
            try:
                raw_entities = ner_pipeline(text)
                for ent in raw_entities:
                    label = LABEL_MAP.get(ent.get("entity_group", "MISC"), "MISC")
                    word = ent.get("word", "").strip()
                    word = word.replace(" ##", "").replace("##", "").strip(" .,'\"")
                    if not word or len(word) < 2:
                        continue
                    start = int(ent.get("start", 0))
                    end = int(ent.get("end", 0))

                    while start > 0 and text[start - 1].isalnum():
                        start -= 1
                    while end < len(text) and text[end].isalnum():
                        end += 1
                    cleaned_word = text[start:end].strip(" .,'\"")

                    if cleaned_word:
                        entities.append(
                            {
                                "text": cleaned_word,
                                "label": label,
                                "start": start,
                                "end": end,
                                "score": round(float(ent.get("score", 0.0)), 3),
                            }
                        )
                        covered_spans.append((start, end))
            except Exception:
                pass

    # Regex: Title-anchored Person Names
    for m in PERSON_TITLE_RE.finditer(text):
        full_match = m.group(0).strip()
        start, end = m.start(), m.end()
        if not any(s <= start and end <= e for s, e in covered_spans):
            entities.append({"text": full_match, "label": "PERSON", "start": start, "end": end, "score": 0.96})
            covered_spans.append((start, end))

    # Regex: Numbers/Stats
    for m in FACT_NUM_RE.finditer(text):
        entities.append({"text": m.group(0).strip(), "label": "STAT", "start": m.start(), "end": m.end(), "score": 0.99})

    # Regex: Dates
    for m in DATE_RE.finditer(text):
        entities.append({"text": m.group(0).strip(), "label": "DATE", "start": m.start(), "end": m.end(), "score": 0.99})

    # Deduplicate
    entities.sort(key=lambda x: (x["start"], -(x["end"] - x["start"])))
    merged = []
    for ent in entities:
        if not any(ex["start"] <= ent["start"] and ent["end"] <= ex["end"] for ex in merged):
            merged.append(ent)

    full_person_names = [e["text"].lower() for e in merged if e["label"] == "PERSON" and len(e["text"].split()) >= 2]
    final = []
    for ent in merged:
        t_low = ent["text"].lower()
        if ent["label"] == "PERSON" and len(ent["text"].split()) == 1:
            if any(t_low in fn.split() for fn in full_person_names) or len(ent["text"]) <= 3:
                continue
        final.append(ent)

    return final
