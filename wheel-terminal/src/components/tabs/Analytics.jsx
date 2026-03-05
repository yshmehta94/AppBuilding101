import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Cell,
} from 'recharts';
import { exportCSV, fmt$, fmtPct } from '../../utils/calculations';
import { Download } from 'lucide-react';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function groupByMonth(trades) {
  const map = {};
  trades.forEach((t) => {
    const d = t.closeDate || t.openDate;
    if (!d) return;
    const dt = new Date(d);
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    const label = `${MONTH_NAMES[dt.getMonth()]} '${String(dt.getFullYear()).slice(2)}`;
    if (!map[key]) map[key] = { key, label, premium: 0, count: 0, wins: 0 };
    map[key].premium += t.realizedPnl || 0;
    map[key].count += 1;
    if ((t.realizedPnl || 0) > 0) map[key].wins += 1;
  });
  return Object.values(map).sort((a, b) => a.key.localeCompare(b.key));
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg p-3" style={{ background: '#0D1410', border: '1px solid rgba(255,255,255,0.1)', fontSize: 12 }}>
      <p className="text-primary-text font-bold mb-1">{label}</p>
      <p style={{ color: payload[0].value >= 0 ? '#00DC78' : '#FF4060' }}>
        {fmt$(payload[0].value)}
      </p>
    </div>
  );
};

export default function Analytics({ closedTrades, settings }) {
  const monthlyTarget = settings?.monthlyTarget || 3500;

  const monthlyData = useMemo(() => groupByMonth(closedTrades), [closedTrades]);

  const ytdData = useMemo(() => {
    const year = new Date().getFullYear();
    const ytd = closedTrades.filter((t) => {
      const d = t.closeDate || t.openDate;
      return d && new Date(d).getFullYear() === year;
    });
    const total = ytd.reduce((s, t) => s + (t.realizedPnl || 0), 0);
    const months = new Set(ytd.map((t) => {
      const d = t.closeDate || t.openDate;
      return d ? `${new Date(d).getFullYear()}-${new Date(d).getMonth()}` : null;
    }).filter(Boolean)).size;
    const best = ytd.reduce((max, t) => {
      const key = t.closeDate ? `${new Date(t.closeDate).getFullYear()}-${new Date(t.closeDate).getMonth()}` : null;
      return t.realizedPnl > (max.val || 0) ? { val: t.realizedPnl, key } : max;
    }, {});

    // Group by month for best month calc
    const byMonth = groupByMonth(ytd);
    const bestMonth = byMonth.reduce((b, m) => m.premium > b.premium ? m : b, { premium: 0, label: '—' });

    const wins = ytd.filter((t) => (t.realizedPnl || 0) > 0).length;
    const winRate = ytd.length > 0 ? (wins / ytd.length) * 100 : 0;

    return {
      total,
      avgPerMonth: months > 0 ? total / months : 0,
      bestMonth: bestMonth.premium,
      bestMonthLabel: bestMonth.label,
      trades: ytd.length,
      winRate,
    };
  }, [closedTrades]);

  const allTimeTotal = closedTrades.reduce((s, t) => s + (t.realizedPnl || 0), 0);

  return (
    <div className="animate-fade-up px-4 pt-4 pb-6 flex flex-col gap-4">
      {/* Monthly P&L Chart */}
      <div className="rounded-lg p-4 card-border" style={{ background: '#0D1410' }}>
        <div className="flex justify-between items-center mb-3">
          <span className="text-xs uppercase tracking-widest text-muted-text">Monthly P&L</span>
          <span className="text-xs text-muted-text">Target: {fmt$(monthlyTarget, 0)}</span>
        </div>
        {monthlyData.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-text text-xs">
            No closed trades yet
          </div>
        ) : (
          <div style={{ width: '100%', height: 180 }}>
            <ResponsiveContainer>
              <BarChart data={monthlyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="label" tick={{ fill: '#7A9A88', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#7A9A88', fontSize: 10 }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => `$${Math.abs(v) >= 1000 ? (v / 1000).toFixed(1) + 'k' : v}`} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={monthlyTarget} stroke="#00DC78" strokeDasharray="4 4" strokeWidth={1.5} />
                <Bar dataKey="premium" radius={[3, 3, 0, 0]}>
                  {monthlyData.map((entry, i) => (
                    <Cell key={i} fill={entry.premium >= monthlyTarget ? '#00DC78' : entry.premium >= 0 ? '#5599FF' : '#FF4060'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* YTD Stats */}
      <div className="rounded-lg card-border overflow-hidden" style={{ background: '#0D1410' }}>
        <div className="px-3 py-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <span className="text-xs uppercase tracking-widest text-muted-text">YTD Summary</span>
        </div>
        <div className="grid grid-cols-2 divide-x divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          {[
            { label: 'Total Premium', value: fmt$(ytdData.total), color: ytdData.total >= 0 ? '#00DC78' : '#FF4060' },
            { label: 'Avg / Month', value: fmt$(ytdData.avgPerMonth), color: '#5599FF' },
            { label: 'Best Month', value: ytdData.bestMonth > 0 ? fmt$(ytdData.bestMonth) : '—', color: '#00DC78' },
            { label: 'Total Trades', value: ytdData.trades, color: '#E0F0E8' },
            { label: 'Win Rate', value: fmtPct(ytdData.winRate), color: ytdData.winRate >= 70 ? '#00DC78' : '#FFB800' },
            { label: 'All-Time Total', value: fmt$(allTimeTotal), color: allTimeTotal >= 0 ? '#00DC78' : '#FF4060' },
          ].map((item) => (
            <div key={item.label} className="px-3 py-3">
              <div className="text-muted-text text-xs">{item.label}</div>
              <div className="font-bold text-sm" style={{ color: item.color }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* All-Time Running Total */}
      <div className="rounded-lg p-3 card-border flex items-center justify-between" style={{ background: '#0D1410' }}>
        <span className="text-muted-text text-xs uppercase tracking-widest">All-Time Premium</span>
        <span
          className="font-bold text-base"
          style={{ color: allTimeTotal >= 0 ? '#00DC78' : '#FF4060' }}
        >
          {fmt$(allTimeTotal)}
        </span>
      </div>

      {/* Export */}
      <button
        onClick={() => exportCSV(closedTrades)}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-sm border"
        style={{ borderColor: 'rgba(255,255,255,0.12)', color: '#E0F0E8', minHeight: 44 }}
      >
        <Download size={15} />
        Export CSV
      </button>

      {/* Closed Trades Table */}
      <div className="rounded-lg card-border overflow-hidden" style={{ background: '#0D1410' }}>
        <div className="px-3 py-2 border-b flex justify-between items-center" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <span className="text-xs uppercase tracking-widest text-muted-text">Trade History</span>
          <span className="text-xs text-muted-text">{closedTrades.length} trades</span>
        </div>
        {closedTrades.length === 0 ? (
          <div className="px-3 py-8 text-center text-muted-text text-xs">
            No closed trades yet
          </div>
        ) : (
          <div className="overflow-x-auto no-scrollbar">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  {['Date', 'Ticker', 'Type', 'Strike', 'Open', 'Close', 'P&L', 'Days', 'Reason'].map((h) => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: '#7A9A88', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {closedTrades.map((t, i) => (
                  <tr
                    key={t.id || i}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                  >
                    <td style={{ padding: '8px 10px', color: '#7A9A88', whiteSpace: 'nowrap' }}>
                      {t.closeDate || '—'}
                    </td>
                    <td style={{ padding: '8px 10px', fontWeight: 700, color: '#E0F0E8' }}>{t.ticker}</td>
                    <td style={{ padding: '8px 10px' }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                        background: t.type === 'CSP' ? 'rgba(0,200,255,0.15)' : 'rgba(170,136,255,0.15)',
                        color: t.type === 'CSP' ? '#00C8FF' : '#AA88FF',
                      }}>
                        {t.type}
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px', color: '#E0F0E8' }}>${t.strike}</td>
                    <td style={{ padding: '8px 10px', color: '#7A9A88' }}>${t.premium?.toFixed(2)}</td>
                    <td style={{ padding: '8px 10px', color: '#7A9A88' }}>${(t.closePremium || 0)?.toFixed(2)}</td>
                    <td style={{ padding: '8px 10px', fontWeight: 700, color: (t.realizedPnl || 0) >= 0 ? '#00DC78' : '#FF4060' }}>
                      {fmt$(t.realizedPnl || 0)}
                    </td>
                    <td style={{ padding: '8px 10px', color: '#7A9A88' }}>{t.daysHeld || 0}d</td>
                    <td style={{ padding: '8px 10px', color: '#7A9A88', whiteSpace: 'nowrap' }}>
                      {(t.closeReason || '—').replace('Profit Target 65%', 'PT65')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
