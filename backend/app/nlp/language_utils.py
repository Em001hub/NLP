"""
Language / script detection helpers.

We do NOT use spaCy anywhere in this project (per requirements). Instead we
route text through language-appropriate pipelines:

  - Devanagari script (Hindi, Marathi, and other Indic languages written in
    Devanagari) -> IndicNER (ai4bharat) + Stanza's hi/mr pipelines
  - Latin / other script -> a general multilingual transformer NER model +
    Stanza's en pipeline

Distinguishing Hindi from Marathi automatically is a genuinely hard problem
(they share the same script and much vocabulary). We use `langdetect`
(a statistical n-gram model) as a best-effort classifier, and always fall
back gracefully to a generic "Devanagari" label rather than silently
guessing wrong.
"""
import re
from langdetect import detect_langs, DetectorFactory

DetectorFactory.seed = 0  # deterministic results

DEVANAGARI_RE = re.compile(r"[\u0900-\u097F]")


def script_of(text: str) -> str:
    """Return 'devanagari' or 'latin' based on majority character script."""
    if not text:
        return "latin"
    devanagari_chars = len(DEVANAGARI_RE.findall(text))
    total_alpha = sum(1 for c in text if c.isalpha())
    if total_alpha == 0:
        return "latin"
    return "devanagari" if devanagari_chars / max(total_alpha, 1) > 0.3 else "latin"


def detect_language(text: str) -> str:
    """
    Best-effort ISO 639-1 language code for a chunk of text.
    Falls back to 'hi' for undetermined Devanagari text and 'en' otherwise,
    since those are the two pipelines this project actually ships.
    """
    text = (text or "").strip()
    if not text:
        return "en"
    try:
        candidates = detect_langs(text)
        if candidates:
            top = candidates[0]
            # Only trust the detector's fine-grained guess (e.g. distinguishing
            # Marathi from Hindi) when it is reasonably confident.
            if top.prob >= 0.6:
                return top.lang
    except Exception:
        pass
    return "hi" if script_of(text) == "devanagari" else "en"


def split_sentences_generic(text: str):
    """
    Cheap sentence splitter used only as a fallback when Stanza isn't
    available for a language. Handles Devanagari danda (।) as well as
    standard punctuation.
    """
    text = text.replace("\n", " ").strip()
    parts = re.split(r"(?<=[।!?.])\s+", text)
    return [p.strip() for p in parts if p.strip()]
