import { useState, useMemo } from 'react';
import { ChevronDown, Check, AlertTriangle, Info } from 'lucide-react';
import useStore from '../../store';
import { getActiveLeg, daysTo, fmt$ } from '../../utils/calculations';

// ─── Shared input styling ─────────────────────────────────────────────────────

const inputCls = 'w-full px-3 py-2.5 rounded-lg text-sm bg-[#070C09] border border-white/10 focus:border-primary-green outline-none text-primary-text';
const labelCls = 'text-muted-text text-xs uppercase tracking-wider mb-1 block';

function Field({ label, children }) {
  return (
    <div className="flex flex-col">
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  );
}

function SegmentedControl({ options, value, onChange }) {
  return (
    <div className="flex rounded-lg overflow-hidden border border-white/10">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className="flex-1 py-2.5 text-sm font-bold transition-colors"
          style={{
            background: value === opt.value ? '#00DC78' : 'transparent',
            color: value === opt.value ? '#070C09' : '#7A9A88',
            minHeight: 44,
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function RuleCheck({ ok, text }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span style={{ color: ok === true ? '#00DC78' : ok === false ? '#ef4444' : '#f59e0b' }}>
        {ok === true ? '✅' : ok === false ? '🔴' : '⚠️'}
      </span>
      <span className="text-muted-text">{text}</span>
    </div>
  );
}

// ─── Open New Position Form ───────────────────────────────────────────────────

function OpenForm({ onSave, existingTickers }) {
  const [form, setForm] = useState({
    optionType: 'CSP',
    ticker: '',
    strike: '',
    expiration: '',
    contracts: '1',
    premium: '',
    delta: '',
    thesis: '',
    conviction: 'medium',
    notes: '',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const dte = form.expiration ? daysTo(form.expiration) : null;
  const premium = parseFloat(form.premium) || 0;
  const strike = parseFloat(form.strike) || 0;
  const contracts = parseInt(form.contracts) || 1;
  const collateral = strike * contracts * 100;
  const totalCredit = premium * contracts * 100;
  const roc = collateral > 0 ? (totalCredit / collateral) * 100 : 0;
  const annualized = dte && dte > 0 ? (roc / dte) * 365 : 0;
  const halfTarget = premium > 0 ? (premium / 2).toFixed(2) : null;

  const dteOk = dte != null && dte >= 25 && dte <= 50;
  const rocOk = roc >= 1.5;
  const deltaOk = form.delta ? parseFloat(form.delta) <= 0.35 : null;

  const canSave = form.ticker && form.strike && form.expiration && form.premium;

  return (
    <div className="flex flex-col gap-4">
      <Field label="Option Type">
        <SegmentedControl
          options={[{ label: 'CSP', value: 'CSP' }, { label: 'CC', value: 'CC' }]}
          value={form.optionType}
          onChange={v => set('optionType', v)}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Ticker">
          <input
            className={inputCls}
            placeholder="SOFI"
            value={form.ticker}
            onChange={e => set('ticker', e.target.value.toUpperCase())}
            list="ticker-suggestions"
            autoCapitalize="characters"
          />
          <datalist id="ticker-suggestions">
            {existingTickers.map(t => <option key={t} value={t} />)}
          </datalist>
        </Field>
        <Field label="Strike">
          <input className={inputCls} type="number" placeholder="25" value={form.strike} onChange={e => set('strike', e.target.value)} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Expiration">
          <input className={inputCls} type="date" value={form.expiration} onChange={e => set('expiration', e.target.value)} />
        </Field>
        <Field label="Contracts">
          <input className={inputCls} type="number" min="1" value={form.contracts} onChange={e => set('contracts', e.target.value)} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Premium / share">
          <input className={inputCls} type="number" step="0.01" placeholder="2.10" value={form.premium} onChange={e => set('premium', e.target.value)} />
        </Field>
        <Field label="Delta (optional)">
          <input className={inputCls} type="number" step="0.01" placeholder="0.28" value={form.delta} onChange={e => set('delta', e.target.value)} />
        </Field>
      </div>

      {/* Auto-calculated preview */}
      {(premium > 0 || dte != null) && (
        <div className="rounded-lg p-3 border border-white/07 bg-[#0D1410]">
          <p className="text-muted-text text-xs uppercase tracking-wider mb-2">Auto-calculated</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {dte != null && <><span className="text-muted-text">DTE</span><span className="text-primary-text font-bold">{dte} days</span></>}
            {totalCredit > 0 && <><span className="text-muted-text">Total credit</span><span className="text-primary-green font-bold">{fmt$(totalCredit)}</span></>}
            {roc > 0 && <><span className="text-muted-text">ROC</span><span className="text-primary-text font-bold">{roc.toFixed(2)}%</span></>}
            {annualized > 0 && <><span className="text-muted-text">Annualized</span><span className="text-primary-text font-bold">~{annualized.toFixed(0)}%</span></>}
            {halfTarget && <><span className="text-muted-text">50% target</span><span className="text-warning-yellow font-bold">${halfTarget} → close</span></>}
          </div>
        </div>
      )}

      {/* Rule checks */}
      {(premium > 0 || dte != null) && (
        <div className="rounded-lg p-3 border border-white/07 bg-[#0D1410] flex flex-col gap-1.5">
          <p className="text-muted-text text-xs uppercase tracking-wider mb-1">Rule check</p>
          {dte != null && <RuleCheck ok={dteOk} text={`DTE ${dte} days ${dteOk ? '✓' : '— target 25–50 days'}`} />}
          {roc > 0 && <RuleCheck ok={rocOk} text={`ROC ${roc.toFixed(2)}% ${rocOk ? '✓' : '— target ≥1.5%'}`} />}
          {form.delta && <RuleCheck ok={deltaOk} text={`Delta ${form.delta} ${deltaOk ? '✓' : '— target ≤0.35'}`} />}
          {!form.delta && <RuleCheck ok={null} text="Delta not confirmed — verify before opening" />}
        </div>
      )}

      <Field label="Thesis (optional)">
        <textarea
          className={`${inputCls} resize-none`}
          rows={2}
          placeholder="Why this trade? e.g. High IV, strong support at $25..."
          value={form.thesis}
          onChange={e => set('thesis', e.target.value)}
        />
      </Field>

      <Field label="Conviction">
        <SegmentedControl
          options={[
            { label: 'High', value: 'high' },
            { label: 'Medium', value: 'medium' },
            { label: 'Low', value: 'low' },
          ]}
          value={form.conviction}
          onChange={v => set('conviction', v)}
        />
      </Field>

      <button
        onClick={() => canSave && onSave(form)}
        disabled={!canSave}
        className="w-full py-3.5 rounded-lg font-bold text-sm transition-opacity"
        style={{
          background: canSave ? '#00DC78' : 'rgba(0,220,120,0.3)',
          color: canSave ? '#070C09' : '#7A9A88',
          minHeight: 52,
        }}
      >
        Save Position
      </button>
    </div>
  );
}

// ─── Roll Form ────────────────────────────────────────────────────────────────

function RollForm({ openChains, onSave }) {
  const [selectedChainId, setSelectedChainId] = useState('');
  const [closeDebit, setCloseDebit] = useState('');
  const [newStrike, setNewStrike] = useState('');
  const [newExpiry, setNewExpiry] = useState('');
  const [newCredit, setNewCredit] = useState('');
  const [newContracts, setNewContracts] = useState('1');

  const selectedChain = openChains.find(c => c.id === parseInt(selectedChainId));
  const activeLeg = selectedChain ? getActiveLeg(selectedChain) : null;

  const debit = parseFloat(closeDebit) || 0;
  const credit = parseFloat(newCredit) || 0;
  const contracts = parseInt(newContracts) || 1;
  const netCredit = (credit - debit) * contracts * 100;
  const isNetDebit = netCredit < 0;

  const dte = newExpiry ? daysTo(newExpiry) : null;
  const canSave = selectedChainId && closeDebit && newStrike && newExpiry && newCredit;

  return (
    <div className="flex flex-col gap-4">
      <Field label="Select Chain to Roll">
        <select
          className={inputCls}
          value={selectedChainId}
          onChange={e => setSelectedChainId(e.target.value)}
        >
          <option value="">— select position —</option>
          {openChains.map(c => {
            const active = getActiveLeg(c);
            return (
              <option key={c.id} value={c.id}>
                {c.ticker} ${active?.strike} {active?.optionType} {active?.expiration}
              </option>
            );
          })}
        </select>
      </Field>

      {activeLeg && (
        <div className="rounded-lg p-3 border border-white/07 bg-[#0D1410] text-xs">
          <p className="text-muted-text uppercase tracking-wider mb-1">Current leg</p>
          <p className="text-primary-text">
            ${activeLeg.strike} {activeLeg.optionType} exp {activeLeg.expiration}
            · {activeLeg.contracts}x · collected ${activeLeg.premiumCollected}/sh
          </p>
        </div>
      )}

      <div className="border-t border-white/07 pt-3">
        <p className="text-muted-text text-xs uppercase tracking-wider mb-3">Close current leg (debit)</p>
        <Field label="Closing debit / share">
          <input className={inputCls} type="number" step="0.01" placeholder="5.94" value={closeDebit} onChange={e => setCloseDebit(e.target.value)} />
        </Field>
      </div>

      <div className="border-t border-white/07 pt-3">
        <p className="text-muted-text text-xs uppercase tracking-wider mb-3">Open new leg (credit)</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="New strike">
            <input className={inputCls} type="number" placeholder={activeLeg?.strike || ''} value={newStrike} onChange={e => setNewStrike(e.target.value)} />
          </Field>
          <Field label="New expiry">
            <input className={inputCls} type="date" value={newExpiry} onChange={e => setNewExpiry(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <Field label="Credit / share">
            <input className={inputCls} type="number" step="0.01" placeholder="5.94" value={newCredit} onChange={e => setNewCredit(e.target.value)} />
          </Field>
          <Field label="Contracts">
            <input className={inputCls} type="number" min="1" value={newContracts} onChange={e => setNewContracts(e.target.value)} />
          </Field>
        </div>
      </div>

      {debit > 0 && credit > 0 && (
        <div className="rounded-lg p-3 border border-white/07 bg-[#0D1410]">
          <div className="flex justify-between items-center">
            <span className="text-muted-text text-xs">Net roll result</span>
            <span className="font-bold text-sm" style={{ color: isNetDebit ? '#ef4444' : '#00DC78' }}>
              {isNetDebit ? '-' : '+'}{fmt$(Math.abs(netCredit))}
            </span>
          </div>
          {dte != null && (
            <p className="text-muted-text text-xs mt-1">New DTE: {dte} days</p>
          )}
        </div>
      )}

      {isNetDebit && debit > 0 && credit > 0 && (
        <div className="flex items-start gap-2 rounded-lg p-3 border" style={{ borderColor: '#f59e0b', background: 'rgba(245,158,11,0.08)' }}>
          <AlertTriangle size={14} className="text-warning-yellow shrink-0 mt-0.5" />
          <p className="text-warning-yellow text-xs">Net debit roll — confirm this is intentional per your rules. Only roll for a debit if you're highly convicted on recovery.</p>
        </div>
      )}

      <button
        onClick={() => canSave && onSave({ chainId: parseInt(selectedChainId), closeDebit, newStrike, newExpiry, newCredit, newContracts, activeLeg })}
        disabled={!canSave}
        className="w-full py-3.5 rounded-lg font-bold text-sm transition-opacity"
        style={{
          background: canSave ? '#00DC78' : 'rgba(0,220,120,0.3)',
          color: canSave ? '#070C09' : '#7A9A88',
          minHeight: 52,
        }}
      >
        Log Roll
      </button>
    </div>
  );
}

// ─── Close Form ───────────────────────────────────────────────────────────────

function CloseForm({ openChains, onSave }) {
  const [selectedChainId, setSelectedChainId] = useState('');
  const [closePrice, setClosePrice] = useState('');

  const selectedChain = openChains.find(c => c.id === parseInt(selectedChainId));
  const activeLeg = selectedChain ? getActiveLeg(selectedChain) : null;

  const price = parseFloat(closePrice) || 0;
  const collected = activeLeg ? activeLeg.premiumCollected * (activeLeg.contracts || 1) * 100 : 0;
  const paidNow = price * (activeLeg?.contracts || 1) * 100;
  const legPnL = collected - paidNow;
  const capturePct = activeLeg?.premiumCollected > 0
    ? ((activeLeg.premiumCollected - price) / activeLeg.premiumCollected) * 100
    : 0;

  const canSave = selectedChainId && closePrice;

  return (
    <div className="flex flex-col gap-4">
      <Field label="Select Position to Close">
        <select
          className={inputCls}
          value={selectedChainId}
          onChange={e => setSelectedChainId(e.target.value)}
        >
          <option value="">— select position —</option>
          {openChains.map(c => {
            const active = getActiveLeg(c);
            return (
              <option key={c.id} value={c.id}>
                {c.ticker} ${active?.strike} {active?.optionType} {active?.expiration}
              </option>
            );
          })}
        </select>
      </Field>

      {activeLeg && (
        <div className="rounded-lg p-3 border border-white/07 bg-[#0D1410] text-xs">
          <p className="text-muted-text uppercase tracking-wider mb-1">Position</p>
          <p className="text-primary-text">
            {selectedChain.ticker} ${activeLeg.strike} {activeLeg.optionType} exp {activeLeg.expiration}
            · collected ${activeLeg.premiumCollected}/sh
          </p>
        </div>
      )}

      <Field label="Closing price / share (buy-to-close)">
        <input
          className={inputCls}
          type="number"
          step="0.01"
          placeholder="1.05"
          value={closePrice}
          onChange={e => setClosePrice(e.target.value)}
        />
      </Field>

      {price > 0 && activeLeg && (
        <div className="rounded-lg p-3 border border-white/07 bg-[#0D1410]">
          <div className="flex justify-between items-center mb-1">
            <span className="text-muted-text text-xs">Realized P&L on this leg</span>
            <span className="font-bold text-sm" style={{ color: legPnL >= 0 ? '#00DC78' : '#ef4444' }}>
              {legPnL >= 0 ? '+' : ''}{fmt$(legPnL)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-text text-xs">Capture %</span>
            <span className="text-xs font-bold" style={{ color: capturePct >= 50 ? '#00DC78' : capturePct >= 25 ? '#f59e0b' : '#ef4444' }}>
              {capturePct.toFixed(0)}%
            </span>
          </div>
        </div>
      )}

      {capturePct >= 50 && price > 0 && (
        <div className="flex items-center gap-2 rounded-lg p-3 border border-primary-green/30 bg-primary-green/5">
          <Check size={14} className="text-primary-green" />
          <p className="text-primary-green text-xs">50%+ profit target hit — great close!</p>
        </div>
      )}

      <button
        onClick={() => canSave && onSave({ chainId: parseInt(selectedChainId), closePrice })}
        disabled={!canSave}
        className="w-full py-3.5 rounded-lg font-bold text-sm transition-opacity"
        style={{
          background: canSave ? '#00DC78' : 'rgba(0,220,120,0.3)',
          color: canSave ? '#070C09' : '#7A9A88',
          minHeight: 52,
        }}
      >
        Close Position
      </button>
    </div>
  );
}

// ─── Main TradeLogger ─────────────────────────────────────────────────────────

const MODES = [
  { value: 'open', label: 'Open New' },
  { value: 'roll', label: 'Log Roll' },
  { value: 'close', label: 'Close' },
];

export default function TradeLogger({ setActiveTab }) {
  const [mode, setMode] = useState('open');
  const { chains, addChain, addRoll, closeChain, showBanner } = useStore();

  const openChains = useMemo(() => chains.filter(c => c.status === 'open'), [chains]);
  const existingTickers = useMemo(() => [...new Set(chains.map(c => c.ticker))], [chains]);

  const handleOpen = (formData) => {
    addChain(formData);
    showBanner(`${formData.ticker} position added!`, 'success');
    setActiveTab('positions');
  };

  const handleRoll = ({ chainId, closeDebit, newStrike, newExpiry, newCredit, newContracts, activeLeg }) => {
    addRoll(chainId, {
      optionType: activeLeg?.optionType,
      strike: activeLeg?.strike,
      expiration: activeLeg?.expiration,
      contracts: activeLeg?.contracts,
      debit: closeDebit,
    }, {
      optionType: activeLeg?.optionType,
      strike: newStrike,
      expiration: newExpiry,
      contracts: newContracts,
      credit: newCredit,
    });
    showBanner('Roll logged!', 'success');
    setActiveTab('positions');
  };

  const handleClose = ({ chainId, closePrice }) => {
    closeChain(chainId, closePrice);
    showBanner('Position closed — monthly income updated!', 'success');
    setActiveTab('dashboard');
  };

  return (
    <div className="animate-fade-up px-4 pt-4 pb-6">
      <div className="mb-5">
        <h1 className="text-primary-text font-bold text-base mb-1">Log Trade</h1>
        <p className="text-muted-text text-xs">Log a trade in under 30 seconds</p>
      </div>

      <div className="mb-5">
        <SegmentedControl options={MODES} value={mode} onChange={setMode} />
      </div>

      {mode === 'open' && (
        <OpenForm onSave={handleOpen} existingTickers={existingTickers} />
      )}
      {mode === 'roll' && (
        <RollForm openChains={openChains} onSave={handleRoll} />
      )}
      {mode === 'close' && (
        <CloseForm openChains={openChains} onSave={handleClose} />
      )}
    </div>
  );
}
