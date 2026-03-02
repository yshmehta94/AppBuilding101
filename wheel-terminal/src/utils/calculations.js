// ─── Core Calculations ─────────────────────────────────────────────────────

export const capturePct = (pos) => {
  if (!pos.premium || pos.premium === 0) return 0;
  const pct = ((pos.premium - (pos.currentPremium ?? pos.premium)) / pos.premium) * 100;
  return Math.max(0, Math.min(100, pct));
};

export const pnlFor = (pos) => {
  const cp = pos.currentPremium ?? pos.premium;
  return (pos.premium - cp) * (pos.contracts || 1) * 100;
};

export const daysTo = (expiry) => {
  if (!expiry) return 999;
  const diff = new Date(expiry + 'T23:59:59') - new Date();
  return Math.max(0, Math.ceil(diff / 86400000));
};

export const strikeDistancePct = (pos, stockPrice) => {
  if (!stockPrice || !pos.strike) return 999;
  if (pos.type === 'CSP') {
    return ((stockPrice - pos.strike) / stockPrice) * 100;
  }
  // CC
  return ((pos.strike - stockPrice) / stockPrice) * 100;
};

// ─── Status Engine ──────────────────────────────────────────────────────────

export const STATUS = {
  CLOSE_NOW: 'CLOSE_NOW',
  DANGER: 'DANGER',
  ROLL_NOW: 'ROLL_NOW',
  CHECK_21: 'CHECK_21',
  WATCH: 'WATCH',
  HOLD: 'HOLD',
};

export const STATUS_ORDER = [
  STATUS.DANGER,
  STATUS.CLOSE_NOW,
  STATUS.ROLL_NOW,
  STATUS.CHECK_21,
  STATUS.WATCH,
  STATUS.HOLD,
];

export const getStatus = (pos, stockPrice) => {
  const cap = capturePct(pos);
  const dte = daysTo(pos.expiry);
  const sdPct = strikeDistancePct(pos, stockPrice);

  if (cap >= 65) return STATUS.CLOSE_NOW;
  if (dte <= 7 && sdPct < 4) return STATUS.DANGER;
  if (dte <= 21 && sdPct < 6) return STATUS.ROLL_NOW;
  if (dte <= 21) return STATUS.CHECK_21;
  if (sdPct < 9 || (pos.delta || 0) >= 0.42) return STATUS.WATCH;
  return STATUS.HOLD;
};

export const getAdvice = (pos, stockPrice) => {
  const status = getStatus(pos, stockPrice);
  const cap = capturePct(pos).toFixed(1);
  const dte = daysTo(pos.expiry);
  const sdPct = strikeDistancePct(pos, stockPrice).toFixed(1);
  const triggerPrice = stockPrice
    ? pos.type === 'CSP'
      ? (stockPrice * 0.91).toFixed(2)
      : (stockPrice * 1.09).toFixed(2)
    : null;

  const adviceMap = {
    [STATUS.CLOSE_NOW]: {
      emoji: '✅',
      action: 'CLOSE NOW',
      color: '#00DC78',
      message: `${cap}% captured. Take profit now — buy back at GTC target and redeploy today.`,
    },
    [STATUS.DANGER]: {
      emoji: '🚨',
      action: 'EMERGENCY',
      color: '#FF4060',
      message: `Emergency: ${dte}d left, strike only ${sdPct}% away. Roll immediately or prepare for assignment.`,
    },
    [STATUS.ROLL_NOW]: {
      emoji: '🔄',
      action: 'ROLL NOW',
      color: '#FFB800',
      message: `21 DTE zone: ${dte}d left, ${sdPct}% from strike. Evaluate roll to next month for ≥$0.15 net credit.`,
    },
    [STATUS.CHECK_21]: {
      emoji: '📋',
      action: 'CHECK 21',
      color: '#5599FF',
      message: `Approaching 21 DTE (${dte}d). Review roll opportunity this week — strike is ${sdPct}% away.`,
    },
    [STATUS.WATCH]: {
      emoji: '👁',
      action: 'WATCH',
      color: '#FFB800',
      message: `${sdPct}% from strike. Set alert at ${triggerPrice ? '$' + triggerPrice : 'trigger'} and monitor daily.`,
    },
    [STATUS.HOLD]: {
      emoji: '⏳',
      action: 'HOLD',
      color: '#7A9A88',
      message: `Theta working. ${sdPct}% from strike, ${dte}d to expiry. No action needed.`,
    },
  };

  return { status, ...adviceMap[status] };
};

// ─── Portfolio Aggregates ────────────────────────────────────────────────────

export const calcPortfolio = (positions, stockPrices, settings) => {
  const totalCapital = settings?.totalCapital || 100000;
  const monthlyTarget = settings?.monthlyTarget || 3500;

  const totalCollateral = positions.reduce((s, p) => s + (p.collateral || 0), 0);
  const totalPnl = positions.reduce((s, p) => s + pnlFor(p), 0);
  const cashAvailable = totalCapital - totalCollateral;
  const monthlyProgress = monthlyTarget > 0 ? (totalPnl / monthlyTarget) * 100 : 0;

  const alerts = positions.filter((p) => {
    const sp = stockPrices[p.ticker];
    return getStatus(p, sp?.price) !== STATUS.HOLD;
  });

  return { totalCollateral, totalPnl, cashAvailable, monthlyProgress, alerts };
};

// ─── Sample Data ─────────────────────────────────────────────────────────────

export const SAMPLE_POSITIONS = [
  {
    id: 1,
    ticker: 'HIMS',
    type: 'CC',
    strike: 17,
    expiry: '2026-03-27',
    premium: 0.82,
    currentPremium: 0.65,
    contracts: 1,
    delta: 0.37,
    collateral: 1700,
    costBasis: 41.13,
    rollCount: 0,
    openDate: '2026-02-10',
    notes: '',
  },
  {
    id: 2,
    ticker: 'EOSE',
    type: 'CC',
    strike: 7,
    expiry: '2026-03-27',
    premium: 0.34,
    currentPremium: 0.28,
    contracts: 2,
    delta: 0.38,
    collateral: 1400,
    costBasis: 13.07,
    rollCount: 0,
    openDate: '2026-02-10',
    notes: '',
  },
];

export const DEFAULT_SETTINGS = {
  avKey: 'E8BVICYTQ4UDLKUN',
  totalCapital: 100000,
  monthlyTarget: 3500,
  maxPositions: 6,
  targetCspDelta: 0.30,
  targetCcDelta: 0.28,
  profitCloseTarget: 65,
  rollDte: 21,
};

// ─── LocalStorage helpers ────────────────────────────────────────────────────

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
  } catch {
    // storage unavailable – silently ignore
  }
};

// ─── CSV Export ──────────────────────────────────────────────────────────────

export const exportCSV = (closedTrades) => {
  const headers = [
    'closeDate', 'ticker', 'type', 'strike', 'openPremium',
    'closePremium', 'realizedPnl', 'daysHeld', 'closeReason', 'contracts',
  ];
  const rows = closedTrades.map((t) => [
    t.closeDate || '',
    t.ticker || '',
    t.type || '',
    t.strike || '',
    t.premium || '',
    t.closePremium || '',
    (t.realizedPnl || 0).toFixed(2),
    t.daysHeld || '',
    t.closeReason || '',
    t.contracts || 1,
  ]);
  const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
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

// ─── Formatting ──────────────────────────────────────────────────────────────

export const fmt$ = (n, decimals = 2) => {
  const abs = Math.abs(n || 0).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return (n < 0 ? '-$' : '$') + abs;
};

export const fmtPct = (n, decimals = 1) =>
  `${(n || 0).toFixed(decimals)}%`;
