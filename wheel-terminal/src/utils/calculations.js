// ─── Chain Model Helpers ─────────────────────────────────────────────────────

/** Returns the currently active (open) leg of a chain */
export const getActiveLeg = (chain) => {
  if (!chain.legs || !chain.legs.length) return null;
  const opens = chain.legs.filter(l => l.legType === 'open' || l.legType === 'roll_open');
  return opens[opens.length - 1] || null;
};

/** Full chain financial summary */
export const getChainSummary = (chain) => {
  const legs = chain.legs || [];
  let totalCollected = 0;
  let totalPaid = 0;

  legs.forEach(leg => {
    const c = leg.contracts || 1;
    totalCollected += (leg.premiumCollected || 0) * c * 100;
    totalPaid += (leg.premiumPaid || 0) * c * 100;
  });

  const netRealized = totalCollected - totalPaid;
  return { totalCollected, totalPaid, netRealized };
};

/** Unrealized P&L on the active leg */
export const getUnrealized = (chain, currentOptionPrice) => {
  const active = getActiveLeg(chain);
  if (!active || chain.status === 'closed') return 0;
  const mktPrice = currentOptionPrice ?? active.currentPremium ?? active.premiumCollected;
  return (active.premiumCollected - mktPrice) * (active.contracts || 1) * 100;
};

/** Net chain P&L = realized + unrealized */
export const getChainPnL = (chain, currentOptionPrice) => {
  const { netRealized } = getChainSummary(chain);
  if (chain.status === 'closed') return netRealized;
  return netRealized + getUnrealized(chain, currentOptionPrice);
};

/** True cost basis if assigned (per share) */
export const getTrueCostBasis = (chain) => {
  const active = getActiveLeg(chain);
  if (!active) return null;
  const { netRealized } = getChainSummary(chain);
  const perShare = netRealized / ((active.contracts || 1) * 100);
  return active.strike - perShare;
};

/** Profit % on the active leg relative to premium collected (can go negative) */
export const getCapturePct = (chain, currentOptionPrice) => {
  const active = getActiveLeg(chain);
  if (!active || active.premiumCollected === 0) return 0;
  const mktPrice = currentOptionPrice ?? active.currentPremium ?? active.premiumCollected;
  return ((active.premiumCollected - mktPrice) / active.premiumCollected) * 100;
};

// ─── Status Engine (per PRD) ──────────────────────────────────────────────────
// 🟢 CLOSE = ≥ 50% profit
// 🟢 GREEN = ≥ 25% profit (→ HOLD)
// 🟡 YELLOW = 0–25% profit
// 🔴 ACT   = ≥ 50% loss + dte ≤ 21
// 🔴 WATCH = ≥ 50% loss

export const STATUS = {
  CLOSE:  'CLOSE',
  GREEN:  'GREEN',
  YELLOW: 'YELLOW',
  ACT:    'ACT',
  WATCH:  'WATCH',
};

export const STATUS_ORDER = [
  STATUS.ACT,
  STATUS.WATCH,
  STATUS.CLOSE,
  STATUS.YELLOW,
  STATUS.GREEN,
];

export const getStatus = (chain, currentOptionPrice) => {
  const capPct = getCapturePct(chain, currentOptionPrice);
  const active = getActiveLeg(chain);
  const dte = active ? daysTo(active.expiration) : 999;

  if (capPct >= 50)               return STATUS.CLOSE;
  if (capPct >= 25)               return STATUS.GREEN;
  if (capPct <= -50 && dte <= 21) return STATUS.ACT;
  if (capPct <= -50)              return STATUS.WATCH;
  return STATUS.YELLOW;
};

// ─── DTE ─────────────────────────────────────────────────────────────────────

export const daysTo = (expiry) => {
  if (!expiry) return 999;
  const diff = new Date(expiry + 'T23:59:59') - new Date();
  return Math.max(0, Math.ceil(diff / 86400000));
};

// ─── Strike distance from stock price ────────────────────────────────────────

export const strikeDistancePct = (chain, stockPrice) => {
  const active = getActiveLeg(chain);
  if (!stockPrice || !active?.strike) return 999;
  const type = chain.type || active.optionType;
  if (type === 'CSP') {
    return ((stockPrice - active.strike) / stockPrice) * 100;
  }
  return ((active.strike - stockPrice) / stockPrice) * 100;
};

// ─── Monthly Income (realized closed premium only) ────────────────────────────

export const getMonthlyRealized = (chains, year, month) => {
  return chains
    .filter(c => {
      if (c.status !== 'closed' || !c.closeDate) return false;
      const d = new Date(c.closeDate);
      return d.getFullYear() === year && d.getMonth() === month;
    })
    .reduce((sum, c) => {
      const { netRealized } = getChainSummary(c);
      return sum + netRealized;
    }, 0);
};

// ─── Portfolio Aggregates ────────────────────────────────────────────────────

export const calcPortfolio = (chains, settings) => {
  const totalCapital = settings?.totalCapital || 100000;
  const openChains = chains.filter(c => c.status === 'open');
  const totalCollateral = openChains.reduce((s, c) => {
    const active = getActiveLeg(c);
    if (!active) return s;
    return s + active.strike * (active.contracts || 1) * 100;
  }, 0);
  const cashAvailable = totalCapital - totalCollateral;
  const deployedPct = totalCapital > 0 ? (totalCollateral / totalCapital) * 100 : 0;
  return { totalCollateral, cashAvailable, deployedPct };
};

// ─── Rule Compliance Alerts ───────────────────────────────────────────────────

export const getRuleAlerts = (chains, stockPrices, settings) => {
  const alerts = [];
  const totalCapital = settings?.totalCapital || 100000;
  const openChains = chains.filter(c => c.status === 'open');

  openChains.forEach(chain => {
    const active = getActiveLeg(chain);
    if (!active) return;
    const capPct = getCapturePct(chain, active.currentPremium);
    const dte = daysTo(active.expiration);
    const collateral = active.strike * (active.contracts || 1) * 100;

    if (capPct >= 50) {
      alerts.push({ id: `profit-${chain.id}`, type: 'profit_target', chain, severity: 'green',
        msg: `${chain.ticker} hit 50% profit target (${capPct.toFixed(0)}%) — close now` });
    }
    if (capPct <= -50 && dte <= 21) {
      alerts.push({ id: `act-${chain.id}`, type: 'loss_act', chain, severity: 'red',
        msg: `${chain.ticker} at ${Math.abs(capPct).toFixed(0)}% loss, only ${dte}d left — act now` });
    } else if (capPct <= -50) {
      alerts.push({ id: `roll-${chain.id}`, type: 'loss_roll', chain, severity: 'red',
        msg: `${chain.ticker} at ${Math.abs(capPct).toFixed(0)}% loss — roll trigger` });
    }
    if (dte <= 21 && capPct >= 25 && capPct < 50) {
      alerts.push({ id: `dte-${chain.id}`, type: 'dte_warning', chain, severity: 'yellow',
        msg: `${chain.ticker} <21 DTE (${dte}d), ${capPct.toFixed(0)}% profit — evaluate roll/close` });
    }
    if (collateral > totalCapital * 0.20) {
      alerts.push({ id: `sizing-${chain.id}`, type: 'position_sizing', chain, severity: 'yellow',
        msg: `${chain.ticker} collateral $${collateral.toLocaleString()} exceeds 20% of portfolio` });
    }
  });

  const totalCollateral = openChains.reduce((s, c) => {
    const a = getActiveLeg(c);
    return s + (a ? a.strike * (a.contracts || 1) * 100 : 0);
  }, 0);
  if (totalCollateral > totalCapital * 0.90) {
    alerts.push({ id: 'cash-buffer', type: 'cash_buffer', chain: null, severity: 'red',
      msg: `Capital deployed >90% — reduce exposure` });
  }

  return alerts;
};

// ─── CSV Export ───────────────────────────────────────────────────────────────

export const exportCSV = (chains) => {
  const headers = ['ticker', 'type', 'status', 'openDate', 'closeDate',
    'legs', 'totalCollected', 'totalPaid', 'netRealized'];
  const rows = chains.map(c => {
    const { totalCollected, totalPaid, netRealized } = getChainSummary(c);
    return [c.ticker, c.type, c.status, c.openDate || '', c.closeDate || '',
      (c.legs || []).length, totalCollected.toFixed(2), totalPaid.toFixed(2), netRealized.toFixed(2)];
  });
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const now = new Date();
  const fname = `wheel-trades-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}.csv`;
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fname;
  a.click();
  URL.revokeObjectURL(url);
};

// ─── Formatting ───────────────────────────────────────────────────────────────

export const fmt$ = (n, decimals = 2) => {
  const abs = Math.abs(n || 0).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return (n < 0 ? '-$' : '$') + abs;
};

export const fmtPct = (n, decimals = 1) => `${(n || 0).toFixed(decimals)}%`;

// ─── LocalStorage helpers ─────────────────────────────────────────────────────

export const lsGet = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

export const lsSet = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* storage unavailable */ }
};

// ─── Sample Data (Chain Model) ────────────────────────────────────────────────

export const SAMPLE_CHAINS = [
  {
    id: 1,
    ticker: 'IREN',
    type: 'CSP',
    thesis: 'AI infrastructure / Bitcoin mining. High IV, strong support.',
    conviction: 'high',
    status: 'open',
    openDate: '2026-02-15',
    closeDate: null,
    legs: [
      {
        id: 101,
        legType: 'open',
        optionType: 'CSP',
        strike: 35,
        expiration: '2026-04-17',
        contracts: 1,
        premiumCollected: 2.10,
        premiumPaid: 0,
        currentPremium: 1.53,
        filledAt: '2026-02-15',
        delta: 0.28,
        notes: '',
      },
    ],
  },
  {
    id: 2,
    ticker: 'IREN',
    type: 'CSP',
    thesis: 'Secondary IREN position — tighter strike, near expiry.',
    conviction: 'high',
    status: 'open',
    openDate: '2026-03-01',
    closeDate: null,
    legs: [
      {
        id: 201,
        legType: 'open',
        optionType: 'CSP',
        strike: 50,
        expiration: '2026-04-02',
        contracts: 1,
        premiumCollected: 1.80,
        premiumPaid: 0,
        currentPremium: 1.58,
        filledAt: '2026-03-01',
        delta: 0.32,
        notes: '',
      },
    ],
  },
  {
    id: 3,
    ticker: 'SOFI',
    type: 'CSP',
    thesis: 'Fintech recovery play. Strong $25 support, high IV.',
    conviction: 'medium',
    status: 'open',
    openDate: '2026-02-01',
    closeDate: null,
    legs: [
      {
        id: 301,
        legType: 'open',
        optionType: 'CSP',
        strike: 25,
        expiration: '2026-03-06',
        contracts: 1,
        premiumCollected: 2.10,
        premiumPaid: 5.94,
        currentPremium: 0,
        filledAt: '2026-02-01',
        delta: 0.30,
        notes: 'Initial position at high IV',
      },
      {
        id: 302,
        legType: 'roll_open',
        optionType: 'CSP',
        strike: 25,
        expiration: '2026-04-10',
        contracts: 1,
        premiumCollected: 5.94,
        premiumPaid: 0,
        currentPremium: 6.63,
        filledAt: '2026-03-06',
        delta: 0.55,
        notes: 'Net debit roll — stock continued lower',
      },
    ],
  },
  {
    id: 4,
    ticker: 'NBIS',
    type: 'CC',
    thesis: 'CC on shares. Targeting $125 call-away.',
    conviction: 'low',
    status: 'open',
    openDate: '2026-02-20',
    closeDate: null,
    legs: [
      {
        id: 401,
        legType: 'open',
        optionType: 'CC',
        strike: 125,
        expiration: '2026-04-24',
        contracts: 2,
        premiumCollected: 1.50,
        premiumPaid: 0,
        currentPremium: 4.77,
        filledAt: '2026-02-20',
        delta: 0.25,
        notes: '',
      },
    ],
  },
];

// Closed chains for monthly income sample
export const SAMPLE_CLOSED_CHAINS = [
  {
    id: 10,
    ticker: 'IREN',
    type: 'CSP',
    thesis: 'IREN CSP closed at 50% profit.',
    conviction: 'high',
    status: 'closed',
    openDate: '2026-03-01',
    closeDate: '2026-03-11',
    legs: [
      {
        id: 1001,
        legType: 'open',
        optionType: 'CSP',
        strike: 35,
        expiration: '2026-04-02',
        contracts: 1,
        premiumCollected: 2.00,
        premiumPaid: 1.00,
        currentPremium: 1.00,
        filledAt: '2026-03-01',
        delta: 0.25,
        notes: '50% profit close',
      },
    ],
  },
  {
    id: 11,
    ticker: 'ASTS',
    type: 'CC',
    thesis: 'ASTS covered call, closed early.',
    conviction: 'medium',
    status: 'closed',
    openDate: '2026-03-05',
    closeDate: '2026-03-10',
    legs: [
      {
        id: 1101,
        legType: 'open',
        optionType: 'CC',
        strike: 110,
        expiration: '2026-04-02',
        contracts: 1,
        premiumCollected: 1.40,
        premiumPaid: 0.70,
        currentPremium: 0.70,
        filledAt: '2026-03-05',
        delta: 0.22,
        notes: '50% profit close',
      },
    ],
  },
  {
    id: 12,
    ticker: 'NBIS',
    type: 'CSP',
    thesis: 'NBIS CSP closed at profit.',
    conviction: 'medium',
    status: 'closed',
    openDate: '2026-02-20',
    closeDate: '2026-03-10',
    legs: [
      {
        id: 1201,
        legType: 'open',
        optionType: 'CSP',
        strike: 85,
        expiration: '2026-04-17',
        contracts: 1,
        premiumCollected: 2.50,
        premiumPaid: 1.25,
        currentPremium: 1.25,
        filledAt: '2026-02-20',
        delta: 0.28,
        notes: '',
      },
    ],
  },
];

export const DEFAULT_SETTINGS = {
  avKey: '',
  totalCapital: 100000,
  monthlyTarget: 3750,
  targetLow: 3500,
  targetHigh: 4000,
  profitCloseTarget: 50,
  rollDte: 21,
  maxPositionPct: 20,
  maxDeployedPct: 90,
};
