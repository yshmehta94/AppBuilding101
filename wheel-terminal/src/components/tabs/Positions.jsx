import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, RotateCcw, X, Edit3, TrendingDown, TrendingUp } from 'lucide-react';
import useStore from '../../store';
import {
  getActiveLeg, getChainSummary, getCapturePct,
  getStatus, getTrueCostBasis, daysTo, fmt$, STATUS,
} from '../../utils/calculations';

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const map = {
    [STATUS.CLOSE]:  { label: 'CLOSE', bg: '#22c55e', color: '#070C09' },
    [STATUS.GREEN]:  { label: 'HOLD',  bg: 'rgba(34,197,94,0.15)', color: '#22c55e' },
    [STATUS.YELLOW]: { label: 'HOLD',  bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
    [STATUS.WATCH]:  { label: 'WATCH', bg: 'rgba(239,68,68,0.15)', color: '#ef4444' },
    [STATUS.ACT]:    { label: 'ACT',   bg: '#ef4444', color: '#fff' },
  };
  const s = map[status] || map[STATUS.YELLOW];
  return (
    <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: s.bg, color: s.color, fontSize: 10 }}>
      {s.label}
    </span>
  );
}

function TypeBadge({ type }) {
  return (
    <span
      className="text-xs font-bold px-1.5 py-0.5 rounded"
      style={{
        background: type === 'CSP' ? 'rgba(0,200,255,0.15)' : 'rgba(170,136,255,0.15)',
        color: type === 'CSP' ? '#00C8FF' : '#AA88FF',
        fontSize: 10,
      }}
    >
      {type}
    </span>
  );
}

function ConvictionBadge({ level }) {
  const map = { high: '#22c55e', medium: '#f59e0b', low: '#ef4444' };
  return (
    <span className="text-xs" style={{ color: map[level] || '#7A9A88' }}>
      {level === 'high' ? '🟢' : level === 'medium' ? '🟡' : '🔴'} {level}
    </span>
  );
}

// ─── Edit current premium modal ───────────────────────────────────────────────

function UpdatePremiumModal({ chain, activeLeg, onClose, onSave }) {
  const [val, setVal] = useState(activeLeg?.currentPremium ?? activeLeg?.premiumCollected ?? '');
  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full rounded-t-2xl p-5 flex flex-col gap-4" style={{ background: '#0D1410', maxHeight: '60vh' }}>
        <div className="flex items-center justify-between">
          <span className="text-primary-text font-bold text-sm">Update Current Premium</span>
          <button onClick={onClose} style={{ minWidth: 44, minHeight: 44 }} className="flex items-center justify-center text-muted-text">
            <X size={18} />
          </button>
        </div>
        <p className="text-muted-text text-xs">
          {chain.ticker} ${activeLeg?.strike} {activeLeg?.optionType} — current market price to buy back
        </p>
        <div className="flex flex-col gap-1">
          <label className="text-muted-text text-xs uppercase tracking-wider">Current market price / share</label>
          <input
            type="number"
            step="0.01"
            className="w-full px-3 py-2.5 rounded-lg text-sm bg-[#070C09] border border-white/10 focus:border-primary-green outline-none text-primary-text"
            value={val}
            onChange={e => setVal(e.target.value)}
            autoFocus
          />
        </div>
        {activeLeg && parseFloat(val) > 0 && (
          <div className="text-xs text-muted-text">
            P&L on this leg: <span className="font-bold" style={{ color: (activeLeg.premiumCollected - parseFloat(val)) >= 0 ? '#22c55e' : '#ef4444' }}>
              {fmt$((activeLeg.premiumCollected - parseFloat(val)) * (activeLeg.contracts || 1) * 100)}
            </span>
            {' '}·{' '}
            <span className="font-bold" style={{ color: ((activeLeg.premiumCollected - parseFloat(val)) / activeLeg.premiumCollected * 100) >= 0 ? '#22c55e' : '#ef4444' }}>
              {(((activeLeg.premiumCollected - parseFloat(val)) / (activeLeg.premiumCollected || 1)) * 100).toFixed(0)}% capture
            </span>
          </div>
        )}
        <button
          onClick={() => { onSave(parseFloat(val)); onClose(); }}
          className="w-full py-3 rounded-lg font-bold text-sm"
          style={{ background: '#00DC78', color: '#070C09', minHeight: 48 }}
        >
          Update
        </button>
      </div>
    </div>
  );
}

// ─── Chain detail card ────────────────────────────────────────────────────────

function ChainCard({ chain, setActiveTab }) {
  const [expanded, setExpanded] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const { updateCurrentPremium, deleteChain, showBanner } = useStore();

  const activeLeg = getActiveLeg(chain);
  const { totalCollected, totalPaid, netRealized } = getChainSummary(chain);
  const unrealized = chain.status === 'open' ? (activeLeg
    ? (activeLeg.premiumCollected - (activeLeg.currentPremium ?? activeLeg.premiumCollected)) * (activeLeg.contracts || 1) * 100
    : 0) : 0;
  const netChainPnL = netRealized + unrealized;
  const capPct = activeLeg ? getCapturePct(chain, activeLeg.currentPremium) : 0;
  const status = activeLeg ? getStatus(chain, activeLeg.currentPremium) : STATUS.YELLOW;
  const dte = activeLeg ? daysTo(activeLeg.expiration) : null;
  const trueCostBasis = getTrueCostBasis(chain);
  const rollCount = (chain.legs || []).filter(l => l.legType === 'roll_open').length;

  const pnlColor = netChainPnL >= 0 ? '#22c55e' : '#ef4444';
  const capColor = capPct >= 50 ? '#22c55e' : capPct >= 25 ? '#f59e0b' : '#ef4444';

  const expiryFmt = (exp) => exp
    ? new Date(exp + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '';

  return (
    <div className="rounded-xl border border-white/07 bg-[#0D1410] overflow-hidden">
      {/* Chain header row */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-3 py-3 hover:bg-white/03 transition-colors"
      >
        {/* Ticker + badges */}
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            <span className="font-bold text-sm text-primary-text">{chain.ticker}</span>
            <TypeBadge type={activeLeg?.optionType || chain.type} />
            {chain.status === 'open' && <StatusBadge status={status} />}
            {chain.status === 'closed' && (
              <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(122,154,136,0.2)', color: '#7A9A88', fontSize: 10 }}>CLOSED</span>
            )}
            {rollCount > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(85,153,255,0.15)', color: '#5599FF', fontSize: 10 }}>
                {rollCount}x rolled
              </span>
            )}
          </div>
          {activeLeg && (
            <span className="text-muted-text text-xs">
              ${activeLeg.strike} · {expiryFmt(activeLeg.expiration)}{dte != null ? ` · ${dte}d` : ''}
              {activeLeg.contracts > 1 ? ` · ${activeLeg.contracts}x` : ''}
            </span>
          )}
        </div>

        {/* P&L + chevron */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <div className="text-xs font-bold" style={{ color: pnlColor }}>
              {netChainPnL >= 0 ? '+' : ''}{fmt$(netChainPnL)}
            </div>
            {chain.status === 'open' && (
              <div className="text-xs" style={{ color: capColor }}>{capPct >= 0 ? '+' : ''}{capPct.toFixed(0)}%</div>
            )}
          </div>
          {expanded ? <ChevronUp size={14} className="text-muted-text" /> : <ChevronDown size={14} className="text-muted-text" />}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-white/07">
          {/* Thesis */}
          {chain.thesis && (
            <div className="px-3 py-2.5 border-b border-white/07">
              <p className="text-muted-text text-xs leading-relaxed">{chain.thesis}</p>
              <ConvictionBadge level={chain.conviction} />
            </div>
          )}

          {/* Leg history */}
          <div className="px-3 py-3 border-b border-white/07">
            <p className="text-muted-text text-xs uppercase tracking-wider mb-2">Leg History</p>
            <div className="flex flex-col gap-1.5">
              {(chain.legs || []).map((leg, i) => {
                const isActive = (leg.legType === 'open' || leg.legType === 'roll_open')
                  && i === (chain.legs || []).length - 1 && chain.status === 'open';
                const legPnL = (leg.premiumCollected - leg.premiumPaid) * (leg.contracts || 1) * 100;

                return (
                  <div key={leg.id} className="flex items-center gap-2 text-xs">
                    <span className="text-muted-text w-4 shrink-0">{isActive ? '→' : '✓'}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-primary-text">
                        ${leg.strike} {leg.optionType || chain.type} {expiryFmt(leg.expiration)}
                      </span>
                      <span className="text-muted-text ml-1 text-xs">{leg.filledAt}</span>
                    </div>
                    <span className="shrink-0 font-bold" style={{
                      color: isActive ? '#7A9A88' : legPnL >= 0 ? '#22c55e' : '#ef4444'
                    }}>
                      {isActive
                        ? `+${fmt$(leg.premiumCollected * (leg.contracts || 1) * 100)} open`
                        : `${legPnL >= 0 ? '+' : ''}${fmt$(legPnL)}`
                      }
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Chain summary */}
          <div className="px-3 py-3 border-b border-white/07">
            <p className="text-muted-text text-xs uppercase tracking-wider mb-2">Chain Summary</p>
            <div className="flex flex-col gap-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-text">Total collected</span>
                <span className="text-primary-green font-bold">+{fmt$(totalCollected)}</span>
              </div>
              {totalPaid > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-text">Total paid (rolls/close)</span>
                  <span className="text-danger-red font-bold">-{fmt$(totalPaid)}</span>
                </div>
              )}
              {chain.status === 'open' && unrealized !== 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-text">Unrealized</span>
                  <span className="font-bold" style={{ color: unrealized >= 0 ? '#22c55e' : '#ef4444' }}>
                    {unrealized >= 0 ? '+' : ''}{fmt$(unrealized)}
                  </span>
                </div>
              )}
              <div className="flex justify-between border-t border-white/07 pt-1 mt-0.5">
                <span className="text-primary-text font-bold">Net chain P&L</span>
                <span className="font-bold" style={{ color: pnlColor }}>
                  {netChainPnL >= 0 ? '+' : ''}{fmt$(netChainPnL)}
                  {netChainPnL < 0 && ' ⚠️'}
                </span>
              </div>
            </div>
          </div>

          {/* True cost basis (for open chains with multiple legs) */}
          {chain.status === 'open' && trueCostBasis != null && rollCount > 0 && (
            <div className="px-3 py-3 border-b border-white/07">
              <p className="text-muted-text text-xs uppercase tracking-wider mb-2">Assignment Scenario</p>
              <div className="flex flex-col gap-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-text">True cost basis</span>
                  <span className="text-primary-text font-bold">{fmt$(trueCostBasis)}/sh</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-text">Strike</span>
                  <span className="text-primary-text">{fmt$(activeLeg?.strike || 0)}/sh</span>
                </div>
                <p className="text-muted-text mt-1">
                  Need CC at ${(trueCostBasis || 0).toFixed(2)}+ to break even if assigned
                </p>
              </div>
            </div>
          )}

          {/* Update premium + actions */}
          {chain.status === 'open' && activeLeg && (
            <div className="px-3 py-3 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-text">Current premium</span>
                <button
                  onClick={() => setShowPremiumModal(true)}
                  className="flex items-center gap-1 text-info-blue"
                  style={{ minHeight: 36 }}
                >
                  <Edit3 size={11} />
                  {fmt$(activeLeg.currentPremium ?? activeLeg.premiumCollected)}/sh
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab('log')}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold border border-white/12 text-muted-text"
                  style={{ minHeight: 44 }}
                >
                  <RotateCcw size={12} />
                  Roll
                </button>
                <button
                  onClick={() => setActiveTab('log')}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold"
                  style={{ background: '#22c55e', color: '#070C09', minHeight: 44 }}
                >
                  ✓ Close
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete ${chain.ticker} chain? This cannot be undone.`)) {
                      deleteChain(chain.id);
                      showBanner(`${chain.ticker} chain deleted`, 'info');
                    }
                  }}
                  className="flex items-center justify-center py-2.5 px-2.5 rounded-lg border border-white/12 text-muted-text"
                  style={{ minHeight: 44, minWidth: 44 }}
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Update premium modal */}
      {showPremiumModal && activeLeg && (
        <UpdatePremiumModal
          chain={chain}
          activeLeg={activeLeg}
          onClose={() => setShowPremiumModal(false)}
          onSave={(val) => updateCurrentPremium(chain.id, activeLeg.id, val)}
        />
      )}
    </div>
  );
}

// ─── Main Positions Tab ───────────────────────────────────────────────────────

export default function Positions({ setActiveTab }) {
  const { chains } = useStore();
  const [filter, setFilter] = useState('open'); // 'open' | 'closed' | 'all'

  const filteredChains = useMemo(() => {
    const base = filter === 'all' ? chains : chains.filter(c => c.status === filter);
    // Sort open: ACT→WATCH→CLOSE→YELLOW→GREEN; closed: by closeDate desc
    if (filter === 'closed') {
      return [...base].sort((a, b) => (b.closeDate || '').localeCompare(a.closeDate || ''));
    }
    const order = { ACT: 0, WATCH: 1, CLOSE: 2, YELLOW: 3, GREEN: 4 };
    return [...base].sort((a, b) => {
      if (a.status === 'closed') return 1;
      if (b.status === 'closed') return -1;
      const aA = getActiveLeg(a);
      const bA = getActiveLeg(b);
      const sa = getStatus(a, aA?.currentPremium);
      const sb = getStatus(b, bA?.currentPremium);
      return (order[sa] ?? 5) - (order[sb] ?? 5);
    });
  }, [chains, filter]);

  const openCount = chains.filter(c => c.status === 'open').length;
  const closedCount = chains.filter(c => c.status === 'closed').length;

  return (
    <div className="animate-fade-up px-4 pt-4 pb-6 flex flex-col gap-3">
      {/* Filter tabs */}
      <div className="flex rounded-lg overflow-hidden border border-white/10">
        {[
          { id: 'open', label: `Open (${openCount})` },
          { id: 'closed', label: `Closed (${closedCount})` },
          { id: 'all', label: 'All' },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className="flex-1 py-2.5 text-xs font-bold transition-colors"
            style={{
              background: filter === f.id ? '#00DC78' : 'transparent',
              color: filter === f.id ? '#070C09' : '#7A9A88',
              minHeight: 44,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filteredChains.length === 0 ? (
        <div className="text-center py-12 text-muted-text text-xs">
          {filter === 'open' ? 'No open positions. Tap Log Trade to add one.' : 'No closed positions yet.'}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredChains.map(chain => (
            <ChainCard key={chain.id} chain={chain} setActiveTab={setActiveTab} />
          ))}
        </div>
      )}

      {/* Add button */}
      <button
        onClick={() => setActiveTab('log')}
        className="w-full py-3.5 rounded-xl font-bold text-sm mt-2"
        style={{ background: '#00DC78', color: '#070C09', minHeight: 52 }}
      >
        + Log New Trade
      </button>
    </div>
  );
}
