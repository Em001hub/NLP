# NewsGraph

Turn any news article into an interactive, directed graph of the people,
places, and organizations behind the story — with NLP built specifically to
handle **Hindi and Marathi names/places** (Devanagari script) alongside
English, not as an afterthought.

```
React.js → Vite → FastAPI → Python → IndicNER + Stanza → React Flow → JSON → Uvicorn
```

No database. No cloud account. Everything — logins, saved graphs — is stored
in flat local JSON files on your machine.

---

## Before you start: please read this

You asked for entity/relationship extraction that "leaves no fact" and is
"100% accurate." I want to be straight with you: **no NLP system, from any
company, hits 100% on real news text** — names get missed, relationships get
mis-attributed, informal phrasing trips up parsers. That's true of every
production system, not a limitation specific to this build. What I *can* do,
and did, is pick the strongest openly-available tools for exactly your use
case instead of a generic one:

- **`ai4bharat/IndicNER`** for Hindi/Marathi entities — a model trained
  specifically on the Naamapadam dataset of Indian-language names and
  places, rather than a general multilingual model that treats Hindi as an
  afterthought.
- **`dslim/bert-base-NER`** for English entities.
- **Stanza** (Stanford NLP, not spaCy, per your request) for dependency
  parsing in English, Hindi *and* Marathi, used to figure out **who did what
  to whom** (not just "these two names appeared near each other").
- Every node in the graph carries a **confidence score**, and every edge
  carries the **exact source sentence** it was extracted from, so you can
  always verify a claim against the original text instead of trusting a
  black box.

## What's inside

```
newsgraph/
├── backend/           FastAPI + NLP pipeline
│   ├── main.py
│   ├── requirements.txt
│   ├── .env.example
│   └── app/
│       ├── nlp/        language detection, NER, relation extraction, graph builder
│       ├── routers/    auth, news, graph API endpoints
│       ├── auth.py     local username/password (bcrypt + JWT)
│       ├── news_service.py   GNews API client
│       └── storage.py  flat-JSON local storage (no DB)
└── frontend/          React + Vite + React Flow
    └── src/
        ├── pages/      Login, Dashboard, GraphView
        └── components/ GraphCanvas (the graph itself), NewsCard, Legend
```

## 1. Get a free news API key

This project uses **[GNews](https://gnews.io)** — unlike most free news
APIs, its free tier (100 requests/day) supports fetching news **in Hindi**
(`lang=hi`) as well as English, and filtering by country. Sign up free at
<https://gnews.io/register> and copy your API key.

## 2. Backend setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# then open .env and paste your GNEWS_API_KEY

uvicorn main:app --reload --port 8000
```

The first time you analyze an article, the backend will automatically
download the NER and parsing models (IndicNER, the English NER model, and
Stanza's en/hi/mr pipelines — a few hundred MB total). That needs internet,
once. Every run after that is 100% offline and local.

## 3. Frontend setup

```bash
cd frontend
npm install
cp .env.example .env   # only needed if your backend isn't on localhost:8000
npm run dev
```

Open the URL Vite prints (usually <http://localhost:5173>). Create a local
account (stored in `backend/data/users.json`, hashed — never sent anywhere),
log in, and you'll land on the dashboard.

## How to use it

- **Dashboard** — pick a country and category, or search a keyword, to pull
  live headlines via GNews. Click **Visualize graph** on any story.
- **Paste your own text** — since GNews doesn't offer a dedicated Marathi
  feed, use the "Paste your own article text" box on the dashboard to run
  the exact same pipeline on any Marathi (or Hindi/English) text you have —
  pasted from a newspaper site, a PDF, wherever.
- **Graph view** — nodes are entities (colour-coded by type: person,
  organization, place, date), directed arrows are relationships labelled
  with the actual verb connecting them (e.g. "met", "announced", "visited").
  Click any node or arrow to see exactly which sentence it came from and its
  confidence score. Save a graph to revisit it later — saved graphs live in
  `backend/data/saved_graphs/`.

## Honest limitations

- Entity linking is surface-form based (same spelling = same node). A person
  referred to once by full name and later by title only ("Modi" vs "the
  Prime Minister") will currently show as two separate nodes — proper
  coreference resolution is a much bigger project than this scope.
- Hindi vs. Marathi language *tagging* on a node uses a statistical
  detector (`langdetect`) that is good but not perfect on short phrases —
  it's shown transparently on each node rather than hidden.
- Relationship extraction depends on dependency parsing, which works best on
  clear, grammatical sentences (typical of professional news writing) and
  is weaker on fragments, headlines-as-sentences, or very informal text.
- Small/regional news outlets sometimes lack full-length content in the free
  GNews tier (`content` field may be a preview snippet); analysis quality
  follows how much real text is available.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React.js |
| Build tool | Vite |
| Visualization | React Flow + dagre (auto layout) |
| Backend | Python / FastAPI |
| NLP — entities | ai4bharat/IndicNER (Hindi/Marathi), dslim/bert-base-NER (English) — via Hugging Face `transformers`, **not spaCy** |
| NLP — relationships | Stanza (dependency parsing), **not spaCy** |
| Auth | Local username/password, bcrypt + JWT |
| Data | Flat local JSON files — no database |
| Server | Uvicorn |
| News source | GNews API (free tier) |
