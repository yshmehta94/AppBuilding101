import { Search } from 'lucide-react';
import useStore from '../../store';
import {
  getActiveLeg, getCapturePct, getStatus, getMonthlyRealized,
  daysTo, fmt$, STATUS,
} from '../../utils/calculations';

export default function ScanTab() {
  const { chains, settings } = useStore();
  const now = new Date();

  const openChains = chains.filter(c => c.status === 'open');
  const monthlyRealized = getMonthlyRealized(chains, now.getFullYear(), now.getMonth());
  const target = settings.monthlyTarget || 3750;
  const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
  const pct = target > 0 ? Math.min(100, (monthlyRealized / target) * 100) : 0;

  const attentionChains = openChains.filter(c => {
    const a = getActiveLeg(c);
    const s = getStatus(c, a?.currentPremium);
    return s === STATUS.ACT || s === STATUS.WATCH || s === STATUS.CLOSE;
  });

  return (
    <div className="animate-fade-up px-4 pt-5 pb-6 flex flex-col gap-5">
      <div>
        <h1 className="text-primary-text font-bold text-base">Daily Scan</h1>
        <p className="text-muted-text text-xs mt-0.5">AI-powered market brief — Phase 2</p>
      </div>

      {/* Coming in Phase 2 */}
      <div className="rounded-xl border border-white/07 bg-[#0D1410] p-6 text-center flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,220,120,0.1)' }}>
          <Search size={22} style={{ color: '#00DC78' }} />
        </div>
        <div>
          <p className="text-primary-text font-bold text-sm mb-1">AI Daily Scan — Phase 2</p>
          <p className="text-muted-text text-xs leading-relaxed max-w-xs mx-auto">
            One tap to get a full WheelSniper market brief with live data.
            Powered by Claude API with your actual positions and monthly income pre-populated.
          </p>
        </div>
        <div className="w-full rounded-lg p-3 border border-white/07 text-left">
          <p className="text-muted-text text-xs uppercase tracking-wider mb-2">What's coming</p>
          {[
            '📰 Macro pulse + VIX context',
            '💰 Monthly income vs target (auto-filled)',
            '🎯 Top wheel setups today',
            '🔄 Your positions that need attention',
            '⚠️ Earnings blackout warnings',
            '🆕 New ticker candidates',
          ].map(item => (
            <p key={item} className="text-xs text-primary-text py-0.5">{item}</p>
          ))}
        </div>
      </div>

      {/* Manual scan context — what Claude would receive */}
      <div className="rounded-xl border border-white/07 bg-[#0D1410] overflow-hidden">
        <div className="px-3 py-2.5 border-b border-white/07">
          <span className="text-muted-text text-xs uppercase tracking-widest">Your Context (for manual scan)</span>
        </div>
        <div className="p-3 flex flex-col gap-2 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-text">Date</span>
            <span className="text-primary-text font-bold">{now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-text">Monthly income</span>
            <span className="font-bold" style={{ color: pct >= 60 ? '#22c55e' : '#f59e0b' }}>
              {fmt$(monthlyRealized, 0)} / {fmt$(target, 0)} ({pct.toFixed(0)}%)
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-text">Days left in month</span>
            <span className="text-primary-text">{daysLeft}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-text">Open positions</span>
            <span className="text-primary-text">{openChains.length}</span>
          </div>
          {attentionChains.length > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-text">Need attention</span>
              <span className="font-bold" style={{ color: '#ef4444' }}>{attentionChains.length}</span>
            </div>
          )}
        </div>
      </div>

      {/* Open positions summary for manual scan */}
      {openChains.length > 0 && (
        <div className="rounded-xl border border-white/07 bg-[#0D1410] overflow-hidden">
          <div className="px-3 py-2.5 border-b border-white/07">
            <span className="text-muted-text text-xs uppercase tracking-widest">Open Positions</span>
          </div>
          <div className="p-3">
            <div className="font-mono text-xs text-primary-text leading-relaxed whitespace-pre-wrap">
              {openChains.map(c => {
                const a = getActiveLeg(c);
                if (!a) return null;
                const capPct = getCapturePct(c, a.currentPremium);
                const dte = daysTo(a.expiration);
                return `${c.ticker} $${a.strike}${a.optionType === 'CSP' ? 'P' : 'C'} ${a.expiration} · ${capPct >= 0 ? '+' : ''}${capPct.toFixed(0)}% · ${dte}d`;
              }).filter(Boolean).join('\n')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
