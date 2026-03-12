import { useMemo } from 'react';
import { Search, Plus } from 'lucide-react';
import useStore from '../../store';
import {
  getActiveLeg, getCapturePct, getStatus,
  getMonthlyRealized, fmt$, fmtPct, STATUS, getChainSummary,
} from '../../utils/calculations';

// ─── Status dot + label (per PRD color system) ────────────────────────────────

const STATUS_CONFIG = {
  [STATUS.CLOSE]:  { dot: '#22c55e', label: '→ CLOSE',  labelColor: '#22c55e' },
  [STATUS.GREEN]:  { dot: '#22c55e', label: '→ HOLD',   labelColor: '#22c55e' },
  [STATUS.YELLOW]: { dot: '#f59e0b', label: '→ HOLD',   labelColor: '#7A9A88' },
  [STATUS.WATCH]:  { dot: '#ef4444', label: '→ WATCH',  labelColor: '#ef4444' },
  [STATUS.ACT]:    { dot: '#ef4444', label: '→ ACT',    labelColor: '#ef4444' },
};

function PositionRow({ chain, onTap }) {
  const active = getActiveLeg(chain);
  if (!active) return null;

  const capPct = getCapturePct(chain, active.currentPremium);
  const status = getStatus(chain, active.currentPremium);
  const cfg = STATUS_CONFIG[status];

  const expiryStr = active.expiration
    ? new Date(active.expiration + 'T00:00:00').toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })
    : '';

  const pnlColor = capPct >= 0 ? '#22c55e' : '#ef4444';

  return (
    <button
      onClick={onTap}
      className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/5 transition-colors"
    >
      <span className="shrink-0 w-2 h-2 rounded-full" style={{ background: cfg.dot }} />
      <div className="flex-1 min-w-0 text-left">
        <span className="font-bold text-sm text-primary-text">{chain.ticker}</span>
        <span className="text-muted-text text-xs ml-2">
          ${active.strike}{active.optionType === 'CSP' ? 'P' : 'C'} {expiryStr}
        </span>
      </div>
      <span className="text-xs font-bold shrink-0" style={{ color: pnlColor }}>
        {capPct >= 0 ? '+' : ''}{capPct.toFixed(0)}%
      </span>
      <span className="text-xs font-bold shrink-0 w-16 text-right" style={{ color: cfg.labelColor }}>
        {cfg.label}
      </span>
    </button>
  );
}

function MonthlyBar({ realized, target, daysLeft }) {
  const pct = target > 0 ? Math.min(100, (realized / target) * 100) : 0;
  const dailyNeed = daysLeft > 0 ? Math.max(0, target - realized) / daysLeft : 0;
  const daysElapsed = 31 - daysLeft;
  const expectedByNow = target > 0 ? (daysElapsed / 31) * target : 0;
  const onPace = realized >= expectedByNow * 0.80;

  const barColor = pct >= 75 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#ef4444';
  const statusText = onPace ? 'On pace' : pct >= 50 ? 'Slightly behind' : 'Behind pace';

  return (
    <div className="rounded-xl p-4 border border-white/07 bg-[#0D1410]">
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-muted-text text-xs uppercase tracking-widest">Monthly Income</span>
        <span className="text-xs font-bold" style={{ color: barColor }}>{statusText}</span>
      </div>
      <div className="flex items-baseline gap-1 mb-2">
        <span className="font-bold text-2xl" style={{ color: barColor }}>{fmt$(realized, 0)}</span>
        <span className="text-muted-text text-sm">/ {fmt$(target, 0)}</span>
      </div>
      <div className="relative h-2.5 rounded-full overflow-hidden mb-2" style={{ background: 'rgba(255,255,255,0.07)' }}>
        <div className="progress-bar-fill h-full rounded-full" style={{ width: `${pct}%`, background: barColor }} />
      </div>
      <div className="flex justify-between text-xs text-muted-text">
        <span>{fmtPct(pct, 0)} complete</span>
        <span>{daysLeft}d left · need {fmt$(dailyNeed, 0)}/day</span>
      </div>
    </div>
  );
}

export default function Dashboard({ setActiveTab }) {
  const { chains, settings } = useStore();

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const openChains = useMemo(() => chains.filter(c => c.status === 'open'), [chains]);

  const monthlyRealized = getMonthlyRealized(chains, now.getFullYear(), now.getMonth());

  const target = settings.monthlyTarget || 3750;
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = lastDay - now.getDate();

  const sortedChains = useMemo(() => {
    const order = { ACT: 0, WATCH: 1, CLOSE: 2, YELLOW: 3, GREEN: 4 };
    return [...openChains].sort((a, b) => {
      const aActive = getActiveLeg(a);
      const bActive = getActiveLeg(b);
      const sa = getStatus(a, aActive?.currentPremium);
      const sb = getStatus(b, bActive?.currentPremium);
      return (order[sa] ?? 5) - (order[sb] ?? 5);
    });
  }, [openChains]);

  const attentionCount = useMemo(
    () => sortedChains.filter(c => {
      const active = getActiveLeg(c);
      const s = getStatus(c, active?.currentPremium);
      return s === STATUS.ACT || s === STATUS.WATCH || s === STATUS.CLOSE;
    }).length,
    [sortedChains]
  );

  const nowYear = now.getFullYear();
  const nowMonth = now.getMonth();
  const closedThisMonth = useMemo(
    () => chains.filter(c => {
      if (c.status !== 'closed' || !c.closeDate) return false;
      const d = new Date(c.closeDate);
      return d.getFullYear() === nowYear && d.getMonth() === nowMonth;
    }),
    [chains, nowYear, nowMonth]
  );

  return (
    <div className="animate-fade-up px-4 pt-5 pb-6 flex flex-col gap-4">

      {/* Greeting */}
      <div>
        <h1 className="text-primary-text font-bold text-base">{greeting}, Yash</h1>
        <p className="text-muted-text text-xs mt-0.5">
          {dateStr}
          <span className="mx-2 opacity-30">·</span>
          VIX: <span className="text-primary-text font-bold">—</span>
        </p>
      </div>

      {/* Monthly income bar — realized only */}
      <MonthlyBar realized={monthlyRealized} target={target} daysLeft={daysLeft} />

      {/* Positions list */}
      <div className="rounded-xl border border-white/07 bg-[#0D1410] overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/07">
          <span className="text-muted-text text-xs uppercase tracking-widest">
            Positions ({openChains.length} open)
          </span>
          {attentionCount > 0 && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
              ⚠️ {attentionCount} need attention
            </span>
          )}
        </div>
        {sortedChains.length === 0 ? (
          <div className="px-3 py-8 text-center text-muted-text text-xs">
            No open positions. Tap Log Trade to add one.
          </div>
        ) : (
          <div className="divide-y divide-white/05">
            {sortedChains.map(chain => (
              <PositionRow key={chain.id} chain={chain} onTap={() => setActiveTab('positions')} />
            ))}
          </div>
        )}
      </div>

      {/* Quick action buttons */}
      <div className="flex gap-3">
        <button
          onClick={() => setActiveTab('scan')}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm border border-white/12 text-primary-text hover:bg-white/05 transition-colors"
          style={{ minHeight: 52 }}
        >
          <Search size={16} />
          Daily Scan
        </button>
        <button
          onClick={() => setActiveTab('log')}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm"
          style={{ background: '#00DC78', color: '#070C09', minHeight: 52 }}
        >
          <Plus size={16} />
          Log Trade
        </button>
      </div>

      {/* Closed this month recap */}
      {closedThisMonth.length > 0 && (
        <div className="rounded-xl border border-white/07 bg-[#0D1410] overflow-hidden">
          <div className="px-3 py-2.5 border-b border-white/07">
            <span className="text-muted-text text-xs uppercase tracking-widest">Closed This Month</span>
          </div>
          <div className="divide-y divide-white/05">
            {closedThisMonth.map(c => {
              const { netRealized } = getChainSummary(c);
              return (
                <div key={c.id} className="flex items-center justify-between px-3 py-2 text-xs">
                  <span className="text-muted-text w-20 shrink-0">{c.closeDate}</span>
                  <span className="text-primary-text font-bold flex-1">{c.ticker}</span>
                  <span className="font-bold" style={{ color: netRealized >= 0 ? '#22c55e' : '#ef4444' }}>
                    {netRealized >= 0 ? '+' : ''}{fmt$(netRealized)}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between items-center px-3 py-2.5 border-t border-white/07">
            <span className="text-muted-text text-xs">Total realized</span>
            <span className="font-bold text-sm" style={{ color: monthlyRealized >= 0 ? '#22c55e' : '#ef4444' }}>
              {monthlyRealized >= 0 ? '+' : ''}{fmt$(monthlyRealized)}
            </span>
          </div>
        </div>
      )}

    </div>
  );
}
