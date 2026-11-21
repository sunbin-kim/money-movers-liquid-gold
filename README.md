# 🪙 Liquid Gold

> **Your money. Clearer options. Your choice.**
> An AI investing companion for Gen Z beginners — built by Money Movers (IBM SkillsBuild).

---

## What it does

Liquid Gold takes three inputs from a beginner investor:
1. **Weekly amount** — how much they can set aside
2. **Hold period** — from 1 month to 5+ years
3. **Risk profile** — determined by a quick 3-question quiz

The AI agent (powered by OpenAI GPT-4o-mini) filters an investment universe, scores each option against the user's time horizon and risk comfort, and returns **three plain-language option cards** — each with a "Why it fits" explanation, a risk cue, and labeled historical return ranges.

Nothing happens until the user confirms. No money moves.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, React Router v6, Tailwind CSS |
| Backend | Node.js, Express 4 |
| AI Agent | OpenAI GPT-4o-mini (with deterministic fallback) |
| Market data | Alpha Vantage API (illustrative static data in MVP) |
| State | React Context API |
| Session store | In-memory (replace with PostgreSQL for production) |

---

## Project structure

```
liquid-gold/
├── backend/
│   ├── src/
│   │   ├── index.js              # Express app entry point
│   │   ├── routes/
│   │   │   ├── recommend.js      # POST /api/recommend
│   │   │   ├── history.js        # GET/POST /api/history
│   │   │   └── glossary.js       # GET /api/glossary/:term
│   │   ├── services/
│   │   │   ├── agentService.js   # Core AI agent logic
│   │   │   └── historyStore.js   # In-memory session store
│   │   └── data/
│   │       ├── investments.js    # Investment universe
│   │       └── glossary.js       # Plain-language definitions
│   ├── .env.example
│   └── package.json
└── frontend/
    ├── public/
    │   └── index.html
    ├── src/
    │   ├── App.js
    │   ├── index.js
    │   ├── index.css
    │   ├── pages/
    │   │   ├── BudgetPage.js     # Step 1: weekly amount + hold period
    │   │   ├── RiskCheckPage.js  # Step 2: 3-question risk quiz
    │   │   ├── ComparePage.js    # Step 3: 3 option cards + confirm
    │   │   └── DashboardPage.js  # Step 4: history + portfolio mix
    │   ├── components/
    │   │   ├── NavBar.js
    │   │   ├── RiskBadge.js
    │   │   └── GlossaryTerm.js   # Tap-to-explain glossary modal
    │   ├── hooks/
    │   │   └── useAppContext.js   # App-wide state (React Context)
    │   └── services/
    │       └── api.js            # Axios API client
    ├── tailwind.config.js
    └── package.json
```

---

## Quick start

### Prerequisites
- [Node.js](https://nodejs.org/) v18 or later
- npm v9 or later

### 1. Clone / open the project

```bash
cd liquid-gold
```

### 2. Install dependencies

```bash
# Install both backend and frontend
npm run install:all
```

Or separately:
```bash
cd backend && npm install
cd ../frontend && npm install
```

### 3. Configure environment

```bash
cd backend
cp .env.example .env
```

Open `backend/.env` and fill in:
```
OPENAI_API_KEY=sk-...          # Required for AI-generated explanations
ALPHA_VANTAGE_API_KEY=...      # Optional: live market data (not used in MVP)
FRONTEND_ORIGIN=http://localhost:3000
PORT=4000
```

> **No API key?** The agent automatically falls back to deterministic plain-language templates — the app still works fully without an OpenAI key.

### 4. Run the backend

```bash
cd backend
npm run dev   # development (nodemon auto-reload)
# or
npm start     # production
```

The API will be available at `http://localhost:4000`.

### 5. Run the frontend

```bash
cd frontend
npm start
```

Open [http://localhost:3000](http://localhost:3000). The React dev server proxies `/api/*` to the backend automatically.

---

## API reference

### `POST /api/recommend`

Request body:
```json
{
  "weeklyAmount": 25,
  "holdPeriodMonths": 6,
  "riskProfile": "balanced"
}
```

Response:
```json
{
  "guardrail": "ok",
  "options": [
    {
      "rank": 1,
      "id": "spy",
      "name": "S&P 500 Index Fund (SPY)",
      "riskLevel": "low",
      "stabilityLabel": "Long-term hold",
      "minAmount": 1,
      "returnRangeLow": 7,
      "returnRangeHigh": 12,
      "whyItFits": "...",
      "glossaryTerms": ["index fund", "ETF", "diversification"],
      "dataSource": "Alpha Vantage (illustrative)",
      "lastUpdated": "2026-11-06"
    }
  ],
  "disclaimer": "Labeled historical returns are examples, not promises. No money moves until you confirm.",
  "dataSource": "Alpha Vantage (illustrative)",
  "lastUpdated": "2026-11-06"
}
```

### `POST /api/history/confirm`

```json
{
  "optionId": "spy",
  "optionName": "S&P 500 Index Fund (SPY)",
  "amount": 25,
  "riskLevel": "low",
  "whyItFits": "..."
}
```

### `GET /api/history`

Returns all confirmed choices + portfolio summary for the session.

### `GET /api/glossary/:term`

E.g. `/api/glossary/etf` → `{ "term": "ETF", "definition": "..." }`

---

## User flow

```
/start          → Enter weekly amount + hold period
/risk-check     → 3-question risk quiz → Conservative / Balanced / Aggressive
/compare        → 3 AI-generated option cards → tap to select → confirm
/dashboard      → Progress, portfolio mix, full history
```

---

## Guardrails (trust layer)

- **Data freshness check** — agent pauses if market data is stale (production: Alpha Vantage timestamp check).
- **No money moves** — confirming only saves a paper record. No brokerage integration in MVP.
- **Returns are labeled history, never promises** — every card and disclaimer reiterates this.
- **Source + date on every card** — data provenance is always visible.
- **User always confirms** — the agent never acts autonomously.

---

## Roadmap (Weeks 7–8)

| Feature | Status |
|---|---|
| Budget-first input + hold period | ✅ MVP |
| 3-option shortlist with plain reasons | ✅ MVP |
| Risk cue on every card | ✅ MVP |
| Trust layer (source, date, user confirms) | ✅ MVP |
| Risk-tolerance quiz (3 questions) | ✅ MVP |
| Side-by-side compare view | ✅ MVP |
| Portfolio dashboard + history | ✅ MVP |
| Tap-to-explain glossary | ✅ MVP |
| Live Alpha Vantage market data | Week 7 |
| User auth + persistent database | Week 7 |
| Detailed history charts | Week 8 |
| Mobile-optimized PWA | Week 8 |

---

## Team

**Money Movers** · IBM SkillsBuild  
John DiFranco · Sunbin Kim · Rima Karimatukhoirin  
Week 5 of 10
