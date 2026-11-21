# 🪙 Liquid Gold

> **Your money. Clearer options. Your choice.**
> An AI investing companion for Gen Z beginners — built by Money Movers (IBM SkillsBuild).

---

## What it does

Liquid Gold takes three inputs from a beginner investor:
1. **Weekly amount** — how much they can set aside
2. **Hold period** — from 1 month to 5+ years
3. **Risk profile** — determined by a quick 3-question quiz

The AI agent (powered by IBM watsonx.ai with IBM Granite) filters an investment universe, scores each option against the user's time horizon and risk comfort, and returns **three plain-language option cards** — each with a "Why it fits" explanation, a risk cue, and labeled historical return ranges.

Nothing happens until the user confirms. No money moves.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, React Router v6, Tailwind CSS |
| Backend | Node.js, Express 4 |
| AI Agent | IBM watsonx.ai · `ibm/granite-3-8b-instruct` (with deterministic fallback) |
| AI SDK | `@ibm-cloud/watsonx-ai` Node.js SDK |
| Database | SQLite via `better-sqlite3` |
| Market data | Alpha Vantage API (illustrative static data in MVP) |
| State | React Context API |

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

> **⚠️ Windows users:** `better-sqlite3` requires a C++ compiler to build. Run the following in **PowerShell as Administrator** before `npm install`:
> ```powershell
> npm install --global windows-build-tools
> ```
> VS Code alone is not enough — this installs the actual C++ build tools separately.

> **⚠️ macOS users:** If `npm start` in the frontend fails with `allowedHosts` error, create a file `frontend/.env` with:
> ```
> DANGEROUSLY_DISABLE_HOST_CHECK=true
> ```
> This is caused by macOS setting a `HOST` shell variable that conflicts with `react-scripts`.

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

#### Getting your IBM watsonx.ai credentials

You need two things: an **API key** and a **Project ID**.

**Step 1 — IBM Cloud API key**
1. Go to [https://cloud.ibm.com](https://cloud.ibm.com) and sign in
2. Click your profile icon (top right) → **Manage → Access (IAM)**
3. In the left sidebar click **API keys**
4. Click **Create** → give it a name → **Create**
5. Copy the key immediately — it is only shown once

**Step 2 — watsonx.ai Project ID**
1. Go to [https://dataplatform.cloud.ibm.com](https://dataplatform.cloud.ibm.com) and sign in
2. Click **View all projects** → open your project (or create one)
3. Click the **Manage** tab → copy the **Project ID** shown under General

**Step 3 — fill in `backend/.env`**

```
# IBM watsonx.ai — powers the AI recommendation cards
WATSONX_API_KEY=your_ibm_cloud_api_key_here
WATSONX_PROJECT_ID=your_watsonx_project_id_here
WATSONX_URL=https://us-south.ml.cloud.ibm.com
WATSONX_MODEL_ID=ibm/granite-3-8b-instruct

# Alpha Vantage — strongly recommended for full functionality
# Powers: stock price charts, real P&L calculations, latest prices on holdings
# Without this key, charts will be empty and P&L will use illustrative estimates
# Free API key: https://www.alphavantage.co/support/#api-key
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key_here

FRONTEND_ORIGIN=http://localhost:3000
PORT=4000
```

> **No watsonx.ai key?** The AI agent falls back to deterministic plain-language templates — recommendations still work.

> **No Alpha Vantage key?** The app runs but **stock charts will be empty** and portfolio P&L will use a fixed 4.5% illustrative estimate instead of real prices. Get a free key at [alphavantage.co](https://www.alphavantage.co/support/#api-key) — it takes under a minute.

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

## Features delivered

| Feature | Status |
|---|---|
| Budget-first input + hold period | ✅ Done |
| 3-option shortlist with plain reasons | ✅ Done |
| Risk cue on every card | ✅ Done |
| Trust layer (source, date, user confirms) | ✅ Done |
| Risk-tolerance quiz (3 questions) | ✅ Done |
| Side-by-side compare view | ✅ Done |
| Portfolio dashboard + history | ✅ Done |
| Tap-to-explain glossary | ✅ Done |
| User auth + persistent database (SQLite) | ✅ Done |
| Multiple named portfolios | ✅ Done |
| Stock price charts (Alpha Vantage) | ✅ Done |
| Friends / social leaderboard | ✅ Done |
| Awards & trophies | ✅ Done |
| Browse investments | ✅ Done |
| Cash balance · deposit, withdraw, reinvest | ✅ Done |
| IBM watsonx.ai integration (Granite model) | ✅ Done |

---

## Team

**Money Movers** · IBM SkillsBuild  
John DiFranco · Sunbin Kim · Rima Karimatukhoirin  
Final Submission
