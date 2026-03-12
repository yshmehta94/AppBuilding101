import { useState } from 'react';
import { DEFAULT_SETTINGS, SAMPLE_CHAINS, SAMPLE_CLOSED_CHAINS, exportCSV } from '../../utils/calculations';
import { CheckCircle, Download, Trash2, RefreshCcw } from 'lucide-react';
import useStore from '../../store';

function Field({ label, type = 'text', value, onChange, step, min, placeholder }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-muted-text text-xs uppercase tracking-wider">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        step={step}
        min={min}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-lg text-sm bg-[#070C09] border border-white/10 focus:border-primary-green outline-none text-primary-text"
        style={{ minHeight: 44 }}
      />
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="rounded-xl border border-white/07 bg-[#0D1410] overflow-hidden">
      <div className="px-3 py-2.5 border-b border-white/07">
        <span className="text-muted-text text-xs uppercase tracking-widest">{title}</span>
      </div>
      <div className="p-4 flex flex-col gap-4">{children}</div>
    </div>
  );
}

export default function Settings() {
  const { settings, updateSettings, chains } = useStore();
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    if (confirm('Reset to sample data? This will overwrite your current chains.')) {
      useStore.setState({ chains: [...SAMPLE_CHAINS, ...SAMPLE_CLOSED_CHAINS] });
    }
  };

  const handleClear = () => {
    if (confirm('Clear ALL data? This cannot be undone.')) {
      useStore.setState({ chains: [] });
    }
  };

  return (
    <div className="animate-fade-up px-4 pt-4 pb-6 flex flex-col gap-4">
      <div>
        <h1 className="text-primary-text font-bold text-base">Settings</h1>
        <p className="text-muted-text text-xs mt-0.5">Portfolio configuration</p>
      </div>

      <Section title="Portfolio">
        <Field
          label="Total Capital ($)"
          type="number"
          min="0"
          value={settings.totalCapital}
          onChange={v => updateSettings({ totalCapital: parseFloat(v) || 0 })}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Monthly Target Low ($)"
            type="number"
            min="0"
            value={settings.targetLow}
            onChange={v => updateSettings({ targetLow: parseFloat(v) || 0, monthlyTarget: ((parseFloat(v) || 0) + settings.targetHigh) / 2 })}
          />
          <Field
            label="Monthly Target High ($)"
            type="number"
            min="0"
            value={settings.targetHigh}
            onChange={v => updateSettings({ targetHigh: parseFloat(v) || 0, monthlyTarget: (settings.targetLow + (parseFloat(v) || 0)) / 2 })}
          />
        </div>
        <p className="text-muted-text text-xs">
          Monthly target (midpoint): <span className="text-primary-text font-bold">{`$${settings.monthlyTarget.toLocaleString()}`}</span>
        </p>
      </Section>

      <Section title="Risk Rules">
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Profit Close Target (%)"
            type="number"
            min="1"
            max="100"
            value={settings.profitCloseTarget}
            onChange={v => updateSettings({ profitCloseTarget: parseFloat(v) || 50 })}
          />
          <Field
            label="Roll DTE Trigger"
            type="number"
            min="1"
            value={settings.rollDte}
            onChange={v => updateSettings({ rollDte: parseInt(v) || 21 })}
          />
          <Field
            label="Max Position Size (%)"
            type="number"
            min="1"
            max="100"
            value={settings.maxPositionPct}
            onChange={v => updateSettings({ maxPositionPct: parseFloat(v) || 20 })}
          />
          <Field
            label="Max Deployed (%)"
            type="number"
            min="1"
            max="100"
            value={settings.maxDeployedPct}
            onChange={v => updateSettings({ maxDeployedPct: parseFloat(v) || 90 })}
          />
        </div>
      </Section>

      <Section title="Market Data (Phase 2)">
        <Field
          label="Alpha Vantage API Key"
          type="password"
          placeholder="Enter API key for live stock prices"
          value={settings.avKey || ''}
          onChange={v => updateSettings({ avKey: v })}
        />
        <p className="text-muted-text text-xs leading-relaxed">
          Free tier: 25 calls/day. Get your key at alphavantage.co.
          Live option premium prices require Tradier API (Phase 2).
        </p>
      </Section>

      <button
        onClick={handleSave}
        className="w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
        style={{ background: saved ? 'rgba(34,197,94,0.2)' : '#00DC78', color: saved ? '#22c55e' : '#070C09', minHeight: 52 }}
      >
        {saved ? <><CheckCircle size={16} /> Saved!</> : 'Save Settings'}
      </button>

      <Section title="Data Management">
        <button
          onClick={() => exportCSV(chains)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border border-white/12 text-sm font-bold text-muted-text"
          style={{ minHeight: 44 }}
        >
          <Download size={14} />
          Export CSV
        </button>
        <button
          onClick={handleReset}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border border-white/12 text-sm font-bold text-muted-text"
          style={{ minHeight: 44 }}
        >
          <RefreshCcw size={14} />
          Reset to Sample Data
        </button>
        <button
          onClick={handleClear}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold"
          style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', minHeight: 44 }}
        >
          <Trash2 size={14} />
          Clear All Data
        </button>
      </Section>

      <p className="text-center text-muted-text text-xs">
        WheelTerminal v1.0 · Phase 1<br />
        @wheelsniper
      </p>
    </div>
  );
}
