import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, Plus, X, ChevronDown, AlertTriangle } from 'lucide-react';
import {
  capturePct, pnlFor, daysTo, getStatus, getAdvice, fmt$, fmtPct,
} from '../../utils/calculations';

// ─── Shared Badges ─────────────────────────────────────────────────────────

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

function StatusBadge({ status }) {
  const map = {
    CLOSE_NOW: { label: 'CLOSE', bg: '#00DC78', color: '#070C09' },
    DANGER: { label: 'DANGER', bg: '#FF4060', color: '#fff' },
    ROLL_NOW: { label: 'ROLL', bg: '#FFB800', color: '#070C09' },
    CHECK_21: { label: 'CHECK', bg: '#5599FF', color: '#fff' },
    WATCH: { label: 'WATCH', bg: 'rgba(255,184,0,0.18)', color: '#FFB800', border: '#FFB800' },
    HOLD: { label: 'HOLD', bg: 'rgba(122,154,136,0.15)', color: '#7A9A88' },
  };
  const s = map[status] || map.HOLD;
  const isDanger = status === 'DANGER';
  return (
    <span
      className={`text-xs font-bold px-2 py-0.5 rounded ${isDanger ? 'animate-pulse-danger' : ''}`}
      style={{ background: s.bg, color: s.color, border: s.border ? `1px solid ${s.border}` : undefined, fontSize: 10 }}
    >
      {s.label}
    </span>
  );
}

// ─── Close Modal ───────────────────────────────────────────────────────────

function CloseModal({ pos, onClose, onConfirm }) {
  const [closeDate, setCloseDate] = useState(new Date().toISOString().split('T')[0]);
  const [closePremium, setClosePremium] = useState(pos.currentPremium ?? '');
  const [closeReason, setCloseReason] = useState('Profit Target 65%');

  const realizedPnl = pos.premium > 0
    ? (pos.premium - parseFloat(closePremium || 0)) * (pos.contracts || 1) * 100
    : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.75)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full rounded-t-2xl p-5 pb-8 animate-fade-up"
        style={{ background: '#0D1410', maxWidth: 480, border: '1px solid rgba(255,255,255,0.1)' }}
      >
        <div className="flex justify-between items-center mb-4">
          <span className="font-bold text-sm text-primary-green">Close {pos.ticker} {pos.type}</span>
          <button onClick={onClose} className="text-muted-text" style={{ minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={18} />
          </button>
        </div>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-muted-text text-xs">Close Date</span>
            <input type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)}
              className="px-3 py-2.5 w-full" style={{ minHeight: 44 }} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-muted-text text-xs">Close Price (per share)</span>
            <input type="number" step="0.01" placeholder="0.00" value={closePremium}
              onChange={(e) => setClosePremium(e.target.value)}
              className="px-3 py-2.5 w-full" style={{ minHeight: 44 }} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-muted-text text-xs">Close Reason</span>
            <select value={closeReason} onChange={(e) => setCloseReason(e.target.value)}
              className="px-3 py-2.5 w-full appearance-none" style={{ minHeight: 44 }}>
              {['Profit Target 65%', 'Expired Worthless', 'Rolled', 'Assigned', 'Called Away', 'Manual Close'].map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>
          <div className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <div className="flex justify-between text-xs">
              <span className="text-muted-text">Realized P&L</span>
              <span className="font-bold" style={{ color: realizedPnl >= 0 ? '#00DC78' : '#FF4060' }}>
                {fmt$(realizedPnl)}
              </span>
            </div>
          </div>
          <button
            onClick={() => onConfirm({ closeDate, closePremium: parseFloat(closePremium) || 0, closeReason })}
            className="w-full py-3 rounded-lg font-bold text-sm"
            style={{ background: '#00DC78', color: '#070C09', minHeight: 44 }}
          >
            Confirm Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Position Card ─────────────────────────────────────────────────────────

function PositionCard({ pos, stockPrices, updatePosition, closePosition, markRolled, removePosition, isFocused }) {
  const [showClose, setShowClose] = useState(false);
  const [cpInput, setCpInput] = useState(pos.currentPremium ?? pos.premium);
  const cardRef = useRef(null);

  useEffect(() => {
    if (isFocused && cardRef.current) {
      setTimeout(() => cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }
  }, [isFocused]);

  useEffect(() => {
    setCpInput(pos.currentPremium ?? pos.premium);
  }, [pos.currentPremium, pos.premium]);

  const sp = stockPrices[pos.ticker];
  const stockPrice = sp?.price;
  const cap = capturePct(pos);
  const pnl = pnlFor(pos);
  const dte = daysTo(pos.expiry);
  const status = getStatus(pos, stockPrice);
  const advice = getAdvice(pos, stockPrice);

  const handleCpBlur = () => {
    const val = parseFloat(cpInput);
    if (!isNaN(val) && val !== pos.currentPremium) {
      updatePosition(pos.id, { currentPremium: val });
    }
  };

  const handleConfirmClose = (closeData) => {
    closePosition(pos, closeData);
    setShowClose(false);
  };

  const rollWarning = pos.rollCount >= 3;
  const rollAlmost = pos.rollCount >= 2 && !rollWarning;

  return (
    <>
      {showClose && (
        <CloseModal pos={pos} onClose={() => setShowClose(false)} onConfirm={handleConfirmClose} />
      )}
      <div
        ref={cardRef}
        className="rounded-lg card-border overflow-hidden animate-fade-up"
        style={{
          background: '#0D1410',
          borderLeft: `3px solid ${advice.color}`,
          scrollMarginTop: 16,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 pt-3 pb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-base text-primary-text">{pos.ticker}</span>
            <TypeBadge type={pos.type} />
            <StatusBadge status={status} />
          </div>
          <div className="flex flex-col items-end">
            {stockPrice ? (
              <>
                <span className="font-bold text-sm text-primary-text">${stockPrice.toFixed(2)}</span>
                <span
                  className="text-xs"
                  style={{ color: (sp?.change || 0) >= 0 ? '#00DC78' : '#FF4060' }}
                >
                  {(sp?.change || 0) >= 0 ? '+' : ''}{sp?.change?.toFixed(2)} ({sp?.changePct?.toFixed(2)}%)
                </span>
              </>
            ) : (
              <span className="text-muted-text text-xs">no price</span>
            )}
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-3 gap-0 px-3 pb-2">
          <div>
            <div className="text-muted-text text-xs">Premium</div>
            <div className="text-sm font-bold text-primary-text">${pos.premium?.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-muted-text text-xs">P&L</div>
            <div className="text-sm font-bold" style={{ color: pnl >= 0 ? '#00DC78' : '#FF4060' }}>
              {fmt$(pnl)}
            </div>
          </div>
          <div>
            <div className="text-muted-text text-xs">Collateral</div>
            <div className="text-sm font-bold text-info-blue">{fmt$(pos.collateral, 0)}</div>
          </div>
          <div className="mt-2">
            <div className="text-muted-text text-xs">Strike</div>
            <div className="text-sm font-bold text-primary-text">${pos.strike}</div>
          </div>
          <div className="mt-2">
            <div className="text-muted-text text-xs">DTE</div>
            <div className="text-sm font-bold" style={{ color: dte <= 7 ? '#FF4060' : dte <= 21 ? '#FFB800' : '#E0F0E8' }}>
              {dte}d
            </div>
          </div>
          <div className="mt-2">
            <div className="text-muted-text text-xs flex items-center gap-1">
              Rolls
              {rollAlmost && <AlertTriangle size={10} color="#FFB800" />}
              {rollWarning && <AlertTriangle size={10} color="#FF4060" />}
            </div>
            <div
              className="text-sm font-bold"
              style={{ color: rollWarning ? '#FF4060' : rollAlmost ? '#FFB800' : '#E0F0E8' }}
            >
              {pos.rollCount || 0}/3
            </div>
          </div>
        </div>

        {/* Capture Section */}
        <div className="px-3 pb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-muted-text text-xs">Capture</span>
            <span
              className="text-xl font-bold"
              style={{ color: cap >= 65 ? '#00DC78' : cap >= 40 ? '#FFB800' : '#E0F0E8' }}
            >
              {cap.toFixed(1)}%
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden mb-2" style={{ background: 'rgba(255,255,255,0.07)' }}>
            <div
              className="progress-bar-fill h-full rounded-full"
              style={{ width: `${cap}%`, background: cap >= 65 ? '#00DC78' : '#FFB800' }}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-text text-xs shrink-0">Current $</span>
            <input
              type="number"
              step="0.01"
              value={cpInput}
              onChange={(e) => setCpInput(e.target.value)}
              onBlur={handleCpBlur}
              className="flex-1 px-2 py-1 text-sm font-bold text-right"
              style={{ minHeight: 36, maxWidth: 100 }}
            />
            <span className="text-muted-text text-xs shrink-0">/ ${pos.premium?.toFixed(2)}</span>
          </div>
        </div>

        {/* Advice Strip */}
        <div
          className="px-3 py-2 text-xs leading-relaxed"
          style={{ background: 'rgba(255,255,255,0.03)', borderTop: '1px solid rgba(255,255,255,0.05)', borderLeft: `3px solid ${advice.color}` }}
        >
          <span className="mr-1">{advice.emoji}</span>
          <span className="font-bold mr-1" style={{ color: advice.color }}>{advice.action}</span>
          <span className="text-muted-text">{advice.message}</span>
        </div>

        {/* Roll Warning */}
        {rollWarning && (
          <div className="px-3 py-2 text-xs font-bold" style={{ background: 'rgba(255,64,96,0.1)', color: '#FF4060' }}>
            ⛔ MAX ROLLS REACHED — Thesis is broken. Accept assignment or close.
          </div>
        )}

        {/* Action Buttons */}
        <div
          className="flex gap-2 px-3 py-3"
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
        >
          {cap >= 65 && (
            <button
              onClick={() => setShowClose(true)}
              className="flex-1 py-2.5 rounded-lg text-xs font-bold"
              style={{ background: '#00DC78', color: '#070C09', minHeight: 44 }}
            >
              ✅ CLOSE
            </button>
          )}
          <button
            onClick={() => {
              if (rollWarning) return;
              markRolled(pos.id);
            }}
            disabled={rollWarning}
            className="flex-1 py-2.5 rounded-lg text-xs font-bold border"
            style={{
              borderColor: rollWarning ? '#FF4060' : 'rgba(255,255,255,0.12)',
              color: rollWarning ? '#FF4060' : '#E0F0E8',
              minHeight: 44,
              opacity: rollWarning ? 0.6 : 1,
            }}
          >
            🔄 ROLLED
          </button>
          {cap < 65 && (
            <button
              onClick={() => setShowClose(true)}
              className="flex-1 py-2.5 rounded-lg text-xs font-bold border"
              style={{ borderColor: 'rgba(255,255,255,0.12)', color: '#7A9A88', minHeight: 44 }}
            >
              Close
            </button>
          )}
          <button
            onClick={() => {
              if (window.confirm(`Remove ${pos.ticker} from open positions?`)) {
                removePosition(pos.id);
              }
            }}
            className="py-2.5 px-3 rounded-lg text-xs font-bold border"
            style={{ borderColor: 'rgba(255,64,96,0.3)', color: '#FF4060', minHeight: 44 }}
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Manual Entry Form ─────────────────────────────────────────────────────

const EMPTY_FORM = {
  ticker: '', type: 'CSP', strike: '', expiry: '', premium: '',
  currentPremium: '', contracts: 1, delta: '', collateral: '',
  costBasis: '', rollCount: 0, notes: '',
};

function ManualForm({ onAdd, onCancel }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const validate = () => {
    const e = {};
    if (!form.ticker.trim()) e.ticker = 'Required';
    if (!form.strike || isNaN(form.strike)) e.strike = 'Required';
    if (!form.expiry) e.expiry = 'Required';
    if (!form.premium || isNaN(form.premium)) e.premium = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    const contracts = parseInt(form.contracts) || 1;
    const strike = parseFloat(form.strike);
    const collateral = parseFloat(form.collateral) || strike * 100 * contracts;
    onAdd({
      ...form,
      ticker: form.ticker.toUpperCase(),
      strike,
      premium: parseFloat(form.premium),
      currentPremium: parseFloat(form.currentPremium || form.premium),
      contracts,
      delta: parseFloat(form.delta) || 0,
      collateral,
      costBasis: parseFloat(form.costBasis) || 0,
      rollCount: parseInt(form.rollCount) || 0,
    });
  };

  const fieldClass = "px-3 py-2.5 w-full rounded";
  const labelClass = "text-muted-text text-xs mb-1";

  return (
    <div className="rounded-lg p-4 card-border animate-fade-up" style={{ background: '#0D1410' }}>
      <div className="flex justify-between items-center mb-4">
        <span className="font-bold text-sm text-primary-green">New Position</span>
        <button onClick={onCancel} style={{ minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <X size={16} color="#7A9A88" />
        </button>
      </div>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col">
            <span className={labelClass}>Ticker *</span>
            <input value={form.ticker} onChange={(e) => set('ticker', e.target.value.toUpperCase())}
              placeholder="AAPL" className={fieldClass} style={{ minHeight: 44 }} />
            {errors.ticker && <span className="text-danger-red text-xs mt-0.5">{errors.ticker}</span>}
          </label>
          <label className="flex flex-col">
            <span className={labelClass}>Type</span>
            <select value={form.type} onChange={(e) => set('type', e.target.value)}
              className={fieldClass} style={{ minHeight: 44 }}>
              <option value="CSP">CSP</option>
              <option value="CC">CC</option>
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col">
            <span className={labelClass}>Strike *</span>
            <input type="number" step="0.5" value={form.strike} onChange={(e) => set('strike', e.target.value)}
              placeholder="50.00" className={fieldClass} style={{ minHeight: 44 }} />
            {errors.strike && <span className="text-danger-red text-xs mt-0.5">{errors.strike}</span>}
          </label>
          <label className="flex flex-col">
            <span className={labelClass}>Expiry *</span>
            <input type="date" value={form.expiry} onChange={(e) => set('expiry', e.target.value)}
              className={fieldClass} style={{ minHeight: 44 }} />
            {errors.expiry && <span className="text-danger-red text-xs mt-0.5">{errors.expiry}</span>}
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col">
            <span className={labelClass}>Premium (credit) *</span>
            <input type="number" step="0.01" value={form.premium} onChange={(e) => set('premium', e.target.value)}
              placeholder="1.50" className={fieldClass} style={{ minHeight: 44 }} />
            {errors.premium && <span className="text-danger-red text-xs mt-0.5">{errors.premium}</span>}
          </label>
          <label className="flex flex-col">
            <span className={labelClass}>Current Premium</span>
            <input type="number" step="0.01" value={form.currentPremium} onChange={(e) => set('currentPremium', e.target.value)}
              placeholder="Same as premium" className={fieldClass} style={{ minHeight: 44 }} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col">
            <span className={labelClass}>Contracts</span>
            <input type="number" min="1" value={form.contracts} onChange={(e) => set('contracts', e.target.value)}
              className={fieldClass} style={{ minHeight: 44 }} />
          </label>
          <label className="flex flex-col">
            <span className={labelClass}>Delta</span>
            <input type="number" step="0.01" value={form.delta} onChange={(e) => set('delta', e.target.value)}
              placeholder="0.30" className={fieldClass} style={{ minHeight: 44 }} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col">
            <span className={labelClass}>Collateral (auto)</span>
            <input type="number" value={form.collateral} onChange={(e) => set('collateral', e.target.value)}
              placeholder="Auto-calc" className={fieldClass} style={{ minHeight: 44 }} />
          </label>
          {form.type === 'CC' && (
            <label className="flex flex-col">
              <span className={labelClass}>Cost Basis</span>
              <input type="number" step="0.01" value={form.costBasis} onChange={(e) => set('costBasis', e.target.value)}
                placeholder="41.00" className={fieldClass} style={{ minHeight: 44 }} />
            </label>
          )}
        </div>
        <label className="flex flex-col">
          <span className={labelClass}>Notes</span>
          <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)}
            placeholder="Optional notes…" rows={2}
            className="px-3 py-2 w-full rounded resize-none text-sm" />
        </label>
        <button
          onClick={handleSubmit}
          className="w-full py-3 rounded-lg font-bold text-sm"
          style={{ background: '#00DC78', color: '#070C09', minHeight: 44 }}
        >
          Add Position
        </button>
      </div>
    </div>
  );
}

// ─── Screenshot Review ─────────────────────────────────────────────────────

function ScreenshotReview({ parsed, onConfirm, onCancel }) {
  const [form, setForm] = useState({
    ticker: parsed.ticker || '',
    type: parsed.type || 'CSP',
    strike: parsed.strike || '',
    expiry: parsed.expiry || '',
    premium: parsed.premium || '',
    currentPremium: parsed.premium || '',
    contracts: parsed.contracts || 1,
    delta: parsed.delta || '',
    collateral: parsed.collateral || '',
    costBasis: parsed.costBasis || '',
    notes: parsed.notes || '',
    rollCount: 0,
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleConfirm = () => {
    const contracts = parseInt(form.contracts) || 1;
    const strike = parseFloat(form.strike) || 0;
    onConfirm({
      ...form,
      ticker: (form.ticker || '').toUpperCase(),
      strike,
      premium: parseFloat(form.premium) || 0,
      currentPremium: parseFloat(form.currentPremium || form.premium) || 0,
      contracts,
      delta: parseFloat(form.delta) || 0,
      collateral: parseFloat(form.collateral) || strike * 100 * contracts,
      costBasis: parseFloat(form.costBasis) || 0,
    });
  };

  const fieldClass = "px-3 py-2.5 w-full rounded";
  const labelClass = "text-muted-text text-xs mb-1";

  return (
    <div className="rounded-lg p-4 card-border animate-fade-up" style={{ background: '#0D1410' }}>
      <div className="flex justify-between items-center mb-4">
        <span className="font-bold text-sm text-info-blue">Review Parsed Trade</span>
        <button onClick={onCancel} style={{ minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <X size={16} color="#7A9A88" />
        </button>
      </div>
      <p className="text-muted-text text-xs mb-4">Review and edit before confirming.</p>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col">
            <span className={labelClass}>Ticker</span>
            <input value={form.ticker} onChange={(e) => set('ticker', e.target.value.toUpperCase())}
              className={fieldClass} style={{ minHeight: 44 }} />
          </label>
          <label className="flex flex-col">
            <span className={labelClass}>Type</span>
            <select value={form.type} onChange={(e) => set('type', e.target.value)}
              className={fieldClass} style={{ minHeight: 44 }}>
              <option value="CSP">CSP</option>
              <option value="CC">CC</option>
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col">
            <span className={labelClass}>Strike</span>
            <input type="number" step="0.5" value={form.strike} onChange={(e) => set('strike', e.target.value)}
              className={fieldClass} style={{ minHeight: 44 }} />
          </label>
          <label className="flex flex-col">
            <span className={labelClass}>Expiry</span>
            <input type="date" value={form.expiry} onChange={(e) => set('expiry', e.target.value)}
              className={fieldClass} style={{ minHeight: 44 }} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col">
            <span className={labelClass}>Premium</span>
            <input type="number" step="0.01" value={form.premium} onChange={(e) => set('premium', e.target.value)}
              className={fieldClass} style={{ minHeight: 44 }} />
          </label>
          <label className="flex flex-col">
            <span className={labelClass}>Contracts</span>
            <input type="number" min="1" value={form.contracts} onChange={(e) => set('contracts', e.target.value)}
              className={fieldClass} style={{ minHeight: 44 }} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col">
            <span className={labelClass}>Delta</span>
            <input type="number" step="0.01" value={form.delta} onChange={(e) => set('delta', e.target.value)}
              className={fieldClass} style={{ minHeight: 44 }} />
          </label>
          <label className="flex flex-col">
            <span className={labelClass}>Collateral</span>
            <input type="number" value={form.collateral} onChange={(e) => set('collateral', e.target.value)}
              className={fieldClass} style={{ minHeight: 44 }} />
          </label>
        </div>
        {form.type === 'CC' && (
          <label className="flex flex-col">
            <span className={labelClass}>Cost Basis</span>
            <input type="number" step="0.01" value={form.costBasis} onChange={(e) => set('costBasis', e.target.value)}
              className={fieldClass} style={{ minHeight: 44 }} />
          </label>
        )}
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-3 rounded-lg text-sm border"
            style={{ borderColor: 'rgba(255,255,255,0.12)', color: '#7A9A88', minHeight: 44 }}>
            Cancel
          </button>
          <button onClick={handleConfirm}
            className="flex-1 py-3 rounded-lg font-bold text-sm"
            style={{ background: '#00DC78', color: '#070C09', minHeight: 44 }}>
            Add Position
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Positions Tab ─────────────────────────────────────────────────────

export default function Positions({
  positions, sortedPositions, settings, stockPrices,
  addPosition, updatePosition, removePosition, closePosition, markRolled,
  focusTicker, setFocusTicker, showBanner,
}) {
  const [mode, setMode] = useState('list'); // list | manual | screenshot | review
  const [screenshotParsed, setScreenshotParsed] = useState(null);
  const [screenshotLoading, setScreenshotLoading] = useState(false);
  const fileInputRef = useRef(null);

  // Clear focus after a bit
  useEffect(() => {
    if (focusTicker) {
      const t = setTimeout(() => setFocusTicker(null), 2000);
      return () => clearTimeout(t);
    }
  }, [focusTicker, setFocusTicker]);

  const handleImageUpload = useCallback(async (file) => {
    if (!file) return;
    setScreenshotLoading(true);
    setMode('screenshot');
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result;
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const mediaType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'x-api-key': '',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mediaType, data: base64 },
              },
              {
                type: 'text',
                text: 'Analyze this broker screenshot of an options trade. Return ONLY valid JSON with no markdown and no explanation in this exact format: {"ticker": string, "type": "CSP" or "CC", "strike": number, "expiry": "YYYY-MM-DD", "premium": number, "contracts": number, "delta": number, "collateral": number, "costBasis": number, "notes": string}. Use 0 for unknown numbers and empty string for unknown text. Return ONLY the JSON.',
              },
            ],
          }],
        }),
      });
      clearTimeout(timeout);

      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      const text = data.content?.[0]?.text || '{}';
      const parsed = JSON.parse(text);
      setScreenshotParsed(parsed);
      setMode('review');
    } catch (err) {
      showBanner('Failed to parse screenshot. Please enter manually.', 'error');
      setMode('manual');
    } finally {
      setScreenshotLoading(false);
    }
  }, [showBanner]);

  const handleAddFromReview = (pos) => {
    addPosition(pos);
    setScreenshotParsed(null);
    setMode('list');
    showBanner('Position added from screenshot!', 'success');
  };

  const handleManualAdd = (pos) => {
    addPosition(pos);
    setMode('list');
    showBanner('Position added!', 'success');
  };

  return (
    <div className="animate-fade-up px-4 pt-4 pb-6 flex flex-col gap-4">
      {/* Add buttons */}
      {mode === 'list' && (
        <div className="flex gap-3">
          <button
            onClick={() => {
              fileInputRef.current?.click();
            }}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm border font-bold"
            style={{ borderColor: 'rgba(255,255,255,0.12)', color: '#E0F0E8', minHeight: 44 }}
          >
            <Camera size={15} />
            Screenshot
          </button>
          <button
            onClick={() => setMode('manual')}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-sm"
            style={{ background: '#00DC78', color: '#070C09', minHeight: 44 }}
          >
            <Plus size={15} />
            Manual
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/heic,image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageUpload(file);
              e.target.value = '';
            }}
          />
        </div>
      )}

      {/* Screenshot loading */}
      {mode === 'screenshot' && screenshotLoading && (
        <div className="rounded-lg p-6 card-border flex flex-col items-center gap-3" style={{ background: '#0D1410' }}>
          <span className="spinner" style={{ width: 24, height: 24, borderWidth: 3 }} />
          <span className="text-muted-text text-sm">Parsing screenshot with AI…</span>
        </div>
      )}

      {/* Review parsed */}
      {mode === 'review' && screenshotParsed && (
        <ScreenshotReview
          parsed={screenshotParsed}
          onConfirm={handleAddFromReview}
          onCancel={() => { setMode('list'); setScreenshotParsed(null); }}
        />
      )}

      {/* Manual form */}
      {mode === 'manual' && (
        <ManualForm onAdd={handleManualAdd} onCancel={() => setMode('list')} />
      )}

      {/* Empty state */}
      {mode === 'list' && sortedPositions.length === 0 && (
        <div className="rounded-lg p-8 card-border flex flex-col items-center gap-3" style={{ background: '#0D1410' }}>
          <span className="text-4xl">📋</span>
          <span className="text-muted-text text-sm text-center">No open positions yet. Add one using screenshot or manual entry.</span>
        </div>
      )}

      {/* Position cards */}
      {mode === 'list' && sortedPositions.map((pos) => (
        <PositionCard
          key={pos.id}
          pos={pos}
          stockPrices={stockPrices}
          updatePosition={updatePosition}
          closePosition={closePosition}
          markRolled={markRolled}
          removePosition={removePosition}
          isFocused={focusTicker === pos.ticker}
        />
      ))}
    </div>
  );
}
