# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**WheelTerminal** — a mobile-first PWA for tracking a wheel options strategy. Single user (@wheelsniper). Lives in `wheel-terminal/`. All development happens there.

## Commands

```bash
cd wheel-terminal

npm run dev          # dev server at localhost:5173
npm run dev -- --host  # also exposes on LAN (for iPhone testing)
npm run build        # production build (must pass before committing)
npm run lint         # eslint check (must be clean before committing)
npm run preview      # preview production build locally
```

## Architecture

### State — Zustand store (`src/store/index.js`)
Single store, persisted to `localStorage` under key `wheel-terminal-v2`. All components read/write state through `useStore()`. Do not use prop drilling or local useState for shared data. Key state: `chains`, `settings`, `stockPrices`, `banner`.

### Data model — Trade Chains + Legs
The fundamental unit is a **chain** (not an individual option contract). A chain represents a position from open through any number of rolls to close:

```
chain {
  id, ticker, type (CSP|CC), thesis, conviction, status (open|closed),
  openDate, closeDate,
  legs: [
    { id, legType (open|roll_close|roll_open|close), optionType,
      strike, expiration, contracts,
      premiumCollected, premiumPaid, currentPremium,
      filledAt, delta, notes }
  ]
}
```

The **active leg** = last leg with `legType === 'open'` or `'roll_open'`. All P&L math flows from this structure via `src/utils/calculations.js`.

### Calculations (`src/utils/calculations.js`)
All financial logic lives here. Key functions:
- `getActiveLeg(chain)` — returns the current open leg
- `getChainSummary(chain)` → `{ totalCollected, totalPaid, netRealized }`
- `getCapturePct(chain, currentOptionPrice)` — profit % on active leg (can go negative)
- `getStatus(chain, currentOptionPrice)` → `STATUS.*` (CLOSE|GREEN|YELLOW|WATCH|ACT)
- `getMonthlyRealized(chains, year, month)` — **realized closed premium only** (not open P&L)
- `getRuleAlerts(chains, stockPrices, settings)` — rule compliance engine

### Navigation (`src/App.jsx`)
5-tab bottom nav: `dashboard | positions | log | scan | analytics`. Settings is a modal overlay triggered from the top-bar gear icon. The `alerts` tab exists but is not in the main nav (accessible via `setActiveTab('alerts')`).

### Color system (Tailwind custom colors)
```
bg: #070C09          card: #0D1410       primary-green: #00DC78
danger-red: #FF4060  warning-yellow: #FFB800  info-blue: #5599FF
primary-text: #E0F0E8  muted-text: #7A9A88
```
PRD status colors (used directly, not via Tailwind): green `#22c55e`, yellow `#f59e0b`, red `#ef4444`.

### Status badge logic (per PRD)
- `CLOSE` (≥50% profit) → green dot, `→ CLOSE`
- `GREEN` (≥25% profit) → green dot, `→ HOLD`
- `YELLOW` (0–25%) → yellow dot, `→ HOLD`
- `WATCH` (≤-50% loss) → red dot, `→ WATCH`
- `ACT` (≤-50% loss + DTE ≤21) → red dot, `→ ACT`

### Monthly income rule
The dashboard progress bar and monthly income tracker count **only realized closed premium** (chains with `status === 'closed'` and `closeDate` in the current month). Open position unrealized P&L is never included in the monthly target progress.

### Market data
Alpha Vantage API for **stock prices** only (configured via `settings.avKey`). Option premium (`currentPremium` on the active leg) is updated manually by the user. Live option pricing is planned for Phase 2 via Tradier API.

### PWA
`public/manifest.json` + `public/sw.js`. Service worker registered in `index.html`. Add to iPhone home screen via Safari → Share → Add to Home Screen.

## Phase Roadmap
- **Phase 1** (current): Chain model, trade logger, monthly income, rule compliance, dashboard, PWA
- **Phase 2**: Claude API daily scan (`src/components/tabs/ScanTab.jsx` is the placeholder), Tradier/Polygon for live option prices + IVR + earnings, roll decision assistant
- **Phase 3**: Push notifications, watchlist manager, @WheelSniper content generator, performance polish
