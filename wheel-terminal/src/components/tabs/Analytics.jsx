import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ReferenceLine, ResponsiveContainer, Cell,
} from 'recharts';
import useStore from '../../store';
import {
  getChainSummary, getActiveLeg, fmt$, fmtPct, exportCSV,
} from '../../utils/calculations';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function ChartTooltip({ active, payload, label, target }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg p-2 border border-white/12" style={{ background: '#0D1410', fontSize: 11 }}>
      <p className="text-muted-text mb-1">{label}</p>
      <p className="font-bold" style={{ color: payload[0].value >= 0 ? '#22c55e' : '#ef4444' }}>
        {fmt$(payload[0].value)}
      </p>
      <p className="text-muted-text">Target: {fmt$(target)}</p>
    </div>
  );
}

function StatCard({ label, value, sub, color }) {
  return (
    <div className="rounded-xl p-3.5 border border-white/07 bg-[#0D1410]">
      <p className="text-muted-text text-xs uppercase tracking-wider mb-1">{label}</p>
      <p className="font-bold text-xl" style={{ color: color || '#E0F0E8' }}>{value}</p>
      {sub && <p className="text-muted-text text-xs mt-0.5">{sub}</p>}
    </div>
  );
}

export default function Analytics() {
  const { chains, settings } = useStore();

  const target = settings.monthlyTarget || 3750;
  const closedChains = useMemo(() => chains.filter(c => c.status === 'closed'), [chains]);
  const openChains = useMemo(() => chains.filter(c => c.status === 'open'), [chains]);

  // Win rate
  const wins = closedChains.filter(c => getChainSummary(c).netRealized > 0).length;
  const winRate = closedChains.length > 0 ? (wins / closedChains.length) * 100 : 0;

  // Total realized P&L
  const totalRealized = useMemo(
    () => closedChains.reduce((s, c) => s + getChainSummary(c).netRealized, 0),
    [closedChains]
  );

  // Average ROC per closed trade
  const avgRoc = useMemo(() => {
    if (!closedChains.length) return 0;
    const rocs = closedChains.map(c => {
      const summary = getChainSummary(c);
      // Find original open leg to get collateral
      const openLeg = (c.legs || []).find(l => l.legType === 'open');
      if (!openLeg) return 0;
      const collateral = openLeg.strike * (openLeg.contracts || 1) * 100;
      return collateral > 0 ? (summary.totalCollected / collateral) * 100 : 0;
    });
    return rocs.reduce((s, r) => s + r, 0) / rocs.length;
  }, [closedChains]);

  // Roll frequency
  const rolledChains = chains.filter(c => (c.legs || []).some(l => l.legType === 'roll_open'));
  const rollRate = chains.length > 0 ? (rolledChains.length / chains.length) * 100 : 0;

  // Monthly chart data (last 12 months)
  const monthlyData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      const y = date.getFullYear();
      const m = date.getMonth();
      const realized = closedChains
        .filter(c => {
          if (!c.closeDate) return false;
          const d = new Date(c.closeDate);
          return d.getFullYear() === y && d.getMonth() === m;
        })
        .reduce((s, c) => s + getChainSummary(c).netRealized, 0);
      return { name: MONTHS[m], value: realized, target };
    });
  }, [closedChains, target]);

  // Trade history table
  const tradeHistory = useMemo(() =>
    [...closedChains]
      .sort((a, b) => (b.closeDate || '').localeCompare(a.closeDate || ''))
      .slice(0, 20),
    [closedChains]
  );

  // Open positions summary
  const totalUnrealized = useMemo(() => openChains.reduce((s, c) => {
    const active = getActiveLeg(c);
    if (!active) return s;
    const unreal = (active.premiumCollected - (active.currentPremium ?? active.premiumCollected))
      * (active.contracts || 1) * 100;
    return s + unreal;
  }, 0), [openChains]);

  return (
    <div className="animate-fade-up px-4 pt-4 pb-6 flex flex-col gap-5">
      <div>
        <h1 className="text-primary-text font-bold text-base">Analytics</h1>
        <p className="text-muted-text text-xs mt-0.5">{chains.length} total chains · {closedChains.length} closed</p>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Win Rate"
          value={winRate > 0 ? fmtPct(winRate, 0) : '—'}
          sub={`${wins}/${closedChains.length} closed profitably`}
          color={winRate >= 70 ? '#22c55e' : winRate >= 50 ? '#f59e0b' : '#ef4444'}
        />
        <StatCard
          label="Total Realized"
          value={totalRealized !== 0 ? fmt$(totalRealized, 0) : '—'}
          sub="net closed P&L"
          color={totalRealized >= 0 ? '#22c55e' : '#ef4444'}
        />
        <StatCard
          label="Avg ROC"
          value={avgRoc > 0 ? fmtPct(avgRoc, 1) : '—'}
          sub="per trade, on collateral"
          color="#5599FF"
        />
        <StatCard
          label="Roll Rate"
          value={rollRate > 0 ? fmtPct(rollRate, 0) : '—'}
          sub={`${rolledChains.length} positions rolled`}
          color="#f59e0b"
        />
      </div>

      {/* Open unrealized */}
      {openChains.length > 0 && (
        <div className="rounded-xl p-3.5 border border-white/07 bg-[#0D1410] flex items-center justify-between">
          <div>
            <p className="text-muted-text text-xs uppercase tracking-wider">Open Unrealized</p>
            <p className="font-bold text-base mt-0.5" style={{ color: totalUnrealized >= 0 ? '#22c55e' : '#ef4444' }}>
              {totalUnrealized >= 0 ? '+' : ''}{fmt$(totalUnrealized)}
            </p>
          </div>
          <p className="text-muted-text text-xs text-right">{openChains.length} open positions<br/>if all closed now</p>
        </div>
      )}

      {/* Monthly bar chart */}
      <div className="rounded-xl border border-white/07 bg-[#0D1410] p-4">
        <p className="text-muted-text text-xs uppercase tracking-widest mb-4">Monthly Premium (Last 12 Months)</p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={monthlyData} margin={{ top: 0, right: 4, bottom: 0, left: -20 }}>
            <XAxis dataKey="name" tick={{ fill: '#7A9A88', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#7A9A88', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip target={target} />} />
            <ReferenceLine y={target} stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" />
            <Bar dataKey="value" radius={[3, 3, 0, 0]} maxBarSize={24}>
              {monthlyData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.value >= target ? '#22c55e' : entry.value > 0 ? '#5599FF' : '#ef4444'}
                  opacity={0.85}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="text-muted-text text-xs text-right mt-1">Target: {fmt$(target, 0)}/mo</p>
      </div>

      {/* Trade history */}
      {tradeHistory.length > 0 && (
        <div className="rounded-xl border border-white/07 bg-[#0D1410] overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/07">
            <span className="text-muted-text text-xs uppercase tracking-widest">Trade History</span>
            <button
              onClick={() => exportCSV(chains)}
              className="text-xs text-info-blue font-bold px-2 py-1"
              style={{ minHeight: 36 }}
            >
              Export CSV
            </button>
          </div>
          <div className="divide-y divide-white/05">
            {tradeHistory.map(c => {
              const { netRealized, totalCollected } = getChainSummary(c);
              const openLeg = (c.legs || []).find(l => l.legType === 'open');
              const collateral = openLeg ? openLeg.strike * (openLeg.contracts || 1) * 100 : 0;
              const roc = collateral > 0 ? (totalCollected / collateral) * 100 : 0;
              return (
                <div key={c.id} className="flex items-center px-3 py-2.5 gap-3 text-xs">
                  <div className="text-muted-text shrink-0 w-16">{c.closeDate}</div>
                  <div className="flex-1 min-w-0">
                    <span className="text-primary-text font-bold">{c.ticker}</span>
                    <span className="text-muted-text ml-1">{c.type}</span>
                    {(c.legs || []).some(l => l.legType === 'roll_open') && (
                      <span className="text-info-blue ml-1">rolled</span>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold" style={{ color: netRealized >= 0 ? '#22c55e' : '#ef4444' }}>
                      {netRealized >= 0 ? '+' : ''}{fmt$(netRealized)}
                    </div>
                    {roc > 0 && <div className="text-muted-text">{roc.toFixed(1)}% ROC</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {closedChains.length === 0 && (
        <div className="text-center py-8 text-muted-text text-xs">
          Close your first trade to see analytics.
        </div>
      )}
    </div>
  );
}
