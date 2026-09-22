"""
Named Entity & Quantitative Fact Recognition engine.
Cleanly extracts people's names (with titles & honorifics), organizations,
locations, dates, and quantitative statistics without fragmented subwords.
"""
import re
import threading
from typing import List, Dict

from transformers import pipeline

from .language_utils import script_of

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

# Date Patterns (English & Devanagari)
DATE_PATTERNS = [
    r"\b\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+\d{4}\b",
    r"\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b",
    r"\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b",
    r"[\u0966-\u096F0-9]{1,2}\s+(?:जनवरी|फ़रवरी|फरवरी|मार्च|अप्रैल|मई|जून|जुलाई|अगस्त|सितंबर|अक्टूबर|नवंबर|दिसंबर)\s+[\u0966-\u096F0-9]{4}",
]
DATE_RE = re.compile("|".join(DATE_PATTERNS), re.I)

# Quantitative Facts / Casualties / Numbers / Statistics
FACT_NUM_PATTERNS = [
    r"\b(?:\d{1,3}(?:,\d{3})+|\d+)\s+(?:people\s+)?(?:killed|dead|fatalities|deaths|injured|wounded|casualties|hospitalized|displaced|arrested|trapped|rescued|missing|lives\s+lost)\b",
    r"[\u0966-\u096F0-9,]+\s+(?:मृत|जखमी|ठार|बळी|मृत्यू|मारले\s+गेले|जखमी\s+झाले|अटक)",
    r"(?:[$€£₹]|Rs\.?|INR|USD)\s*(?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d+)?\s*(?:billion|million|trillion|crore|lakh|cr|k|m|b)?\b",
    r"\b\d+(?:\.\d+)?\s*(?:%|percent|magnitude|km/h|mph|tons|tonnes)\b",
]
FACT_NUM_RE = re.compile("|".join(FACT_NUM_PATTERNS), re.I)

# Titles / Designations preceding Person names (English & Hindi/Marathi)
PERSON_TITLE_PREFIXES = (
    r"(?:Mr\.?|Mrs\.?|Ms\.?|Dr\.?|Prof\.?|President|Prime\s+Minister|PM|Chief\s+Minister|CM|"
    r"Governor|General|Senator|Minister|Secretary|King|Queen|Judge|Justice|Shri|Shrimant|Smt\.?|"
    r"श्री|श्रीमंत|डॉक्टर|पंतप्रधान|मुख्यमंत्री|राष्ट्रपती)\s+"
)
PERSON_TITLE_RE = re.compile(
    r"\b" + PERSON_TITLE_PREFIXES + r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b"
)
INDIC_PERSON_TITLE_RE = re.compile(
    r"(?:श्री|श्रीमंत|डॉक्टर|पंतप्रधान|मुख्यमंत्री|राष्ट्रपती)\s+([\u0900-\u097F]+(?:\s+[\u0900-\u097F]+){1,3})"
)


def _get_pipeline(model_name: str):
    with _lock:
        if model_name not in _pipelines:
            try:
                _pipelines[model_name] = pipeline(
                    "ner",
                    model=model_name,
                    aggregation_strategy="simple",
                )
            except Exception:
                _pipelines[model_name] = None
        return _pipelines[model_name]


def _pick_model_for(text: str) -> str:
    return INDIC_MODEL if script_of(text) == "devanagari" else ENGLISH_MODEL


def extract_entities(text: str) -> List[dict]:
    """
    Extracts entities with clean person names, organizations, and stats.
    Re-merges fragmented subwords and suppresses duplicate sub-names.
    """
    text = text.strip()
    if not text:
        return []

    model_name = _pick_model_for(text)
    ner_pipeline = _get_pipeline(model_name)

    entities = []
    covered_spans = []

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

                # Expand start/end to word boundaries in original text to avoid broken pieces like "a Chadha"
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

    # Title-anchored Person Name extractor
    for m in PERSON_TITLE_RE.finditer(text):
        full_match = m.group(0).strip()
        start, end = m.start(), m.end()
        if not any(s <= start and end <= e for s, e in covered_spans):
            entities.append(
                {
                    "text": full_match,
                    "label": "PERSON",
                    "start": start,
                    "end": end,
                    "score": 0.96,
                }
            )
            covered_spans.append((start, end))

    for m in INDIC_PERSON_TITLE_RE.finditer(text):
        full_match = m.group(0).strip()
        start, end = m.start(), m.end()
        if not any(s <= start and end <= e for s, e in covered_spans):
            entities.append(
                {
                    "text": full_match,
                    "label": "PERSON",
                    "start": start,
                    "end": end,
                    "score": 0.96,
                }
            )
            covered_spans.append((start, end))

    # Quantitative Facts / Numbers
    for m in FACT_NUM_RE.finditer(text):
        entities.append(
            {
                "text": m.group(0).strip(),
                "label": "STAT",
                "start": m.start(),
                "end": m.end(),
                "score": 0.99,
            }
        )

    # Dates
    for m in DATE_RE.finditer(text):
        entities.append(
            {
                "text": m.group(0).strip(),
                "label": "DATE",
                "start": m.start(),
                "end": m.end(),
                "score": 0.99,
            }
        )

    # 1. Sort by start offset and descending length
    entities.sort(key=lambda x: (x["start"], -(x["end"] - x["start"])))
    
    # 2. Merge overlapping spans
    merged_entities = []
    for ent in entities:
        is_subspan = False
        for existing in merged_entities:
            if existing["start"] <= ent["start"] and ent["end"] <= existing["end"]:
                is_subspan = True
                break
        if not is_subspan:
            merged_entities.append(ent)

    # 3. Suppress sub-name fragments (e.g. if "Richa Chadha" exists, drop "Rich" or "Chadha")
    full_person_names = [e["text"].lower() for e in merged_entities if e["label"] == "PERSON" and len(e["text"].split()) >= 2]
    final_entities = []
    for ent in merged_entities:
        t_low = ent["text"].lower()
        if ent["label"] == "PERSON" and len(ent["text"].split()) == 1:
            # Check if this single word is part of an already present multi-word name
            if any(t_low in full_name.split() for full_name in full_person_names) or len(ent["text"]) <= 3:
                continue
        final_entities.append(ent)

    return final_entities
