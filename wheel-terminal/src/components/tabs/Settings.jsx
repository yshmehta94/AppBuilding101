import { useState } from 'react';
import { DEFAULT_SETTINGS, lsSet, SAMPLE_POSITIONS } from '../../utils/calculations';
import { CheckCircle, XCircle, Upload, Download, Trash2 } from 'lucide-react';

function Field({ label, type = 'text', value, onChange, step, min, max, placeholder }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-muted-text text-xs">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        step={step}
        min={min}
        max={max}
        placeholder={placeholder}
        className="px-3 py-2.5 w-full rounded"
        style={{ minHeight: 44 }}
      />
    </label>
  );
}

export default function SettingsTab({
  settings, setSettings, positions, setPositions,
  closedTrades, setClosedTrades, showBanner,
}) {
  const [avStatus, setAvStatus] = useState(null); // null | 'ok' | 'error'
  const [avTesting, setAvTesting] = useState(false);

  const update = (key, value) => setSettings((s) => ({ ...s, [key]: value }));
  const updateNum = (key) => (val) => {
    const n = parseFloat(val);
    if (!isNaN(n)) update(key, n);
  };

  const testAvConnection = async () => {
    setAvTesting(true);
    setAvStatus(null);
    try {
      const apiKey = settings.avKey || '';
      const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=MSFT&apikey=${apiKey}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      const data = await res.json();
      if (data['Note'] || data['Information']) {
        setAvStatus('limit');
      } else if (data['Global Quote'] && data['Global Quote']['05. price']) {
        setAvStatus('ok');
      } else {
        setAvStatus('error');
      }
    } catch {
      setAvStatus('error');
    } finally {
      setAvTesting(false);
    }
  };

  const exportAll = () => {
    const payload = {
      positions,
      closedTrades,
      settings,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wheel-terminal-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showBanner('Data exported!', 'success');
  };

  const importAll = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (data.positions) setPositions(data.positions);
        if (data.closedTrades) setClosedTrades(data.closedTrades);
        if (data.settings) setSettings(data.settings);
        showBanner('Data imported successfully!', 'success');
      } catch {
        showBanner('Failed to import data — invalid JSON', 'error');
      }
    };
    input.click();
  };

  const clearPositions = () => {
    if (window.confirm('Clear ALL open positions? This cannot be undone.')) {
      setPositions([]);
      showBanner('All positions cleared.', 'info');
    }
  };

  const clearHistory = () => {
    if (window.confirm('Clear ALL trade history? This cannot be undone.')) {
      setClosedTrades([]);
      showBanner('Trade history cleared.', 'info');
    }
  };

  const resetToDefaults = () => {
    if (window.confirm('Reset all settings to defaults?')) {
      setSettings(DEFAULT_SETTINGS);
      showBanner('Settings reset to defaults.', 'success');
    }
  };

  const loadSampleData = () => {
    if (window.confirm('Load sample positions? This will not remove existing positions.')) {
      SAMPLE_POSITIONS.forEach((p) => {
        setPositions((prev) => {
          const exists = prev.find((ex) => ex.id === p.id);
          return exists ? prev : [...prev, p];
        });
      });
      showBanner('Sample positions loaded.', 'success');
    }
  };

  const statusIcon = avStatus === 'ok'
    ? <CheckCircle size={16} color="#00DC78" />
    : avStatus === 'error'
    ? <XCircle size={16} color="#FF4060" />
    : avStatus === 'limit'
    ? <span className="text-warning-yellow text-xs">LIMIT</span>
    : null;

  return (
    <div className="animate-fade-up px-4 pt-4 pb-6 flex flex-col gap-4">
      {/* API Settings */}
      <div className="rounded-lg card-border overflow-hidden" style={{ background: '#0D1410' }}>
        <div className="px-3 py-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <span className="text-xs uppercase tracking-widest text-muted-text">API Keys</span>
        </div>
        <div className="p-3 flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-muted-text text-xs">Alpha Vantage API Key</span>
            <div className="flex gap-2">
              <input
                type="text"
                value={settings.avKey || ''}
                onChange={(e) => update('avKey', e.target.value)}
                placeholder="E8BVICYTQ4UDLKUN"
                className="flex-1 px-3 py-2.5 rounded"
                style={{ minHeight: 44 }}
              />
              <button
                onClick={testAvConnection}
                disabled={avTesting}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded border text-xs font-bold"
                style={{
                  borderColor: 'rgba(255,255,255,0.12)',
                  color: '#E0F0E8',
                  minHeight: 44,
                  minWidth: 60,
                }}
              >
                {avTesting ? <span className="spinner" /> : statusIcon || 'Test'}
              </button>
            </div>
            {avStatus === 'ok' && <span className="text-primary-green text-xs">✓ Connected</span>}
            {avStatus === 'error' && <span className="text-danger-red text-xs">✗ Connection failed</span>}
            {avStatus === 'limit' && <span className="text-warning-yellow text-xs">⚠ Daily limit reached</span>}
          </label>
        </div>
      </div>

      {/* Portfolio Settings */}
      <div className="rounded-lg card-border overflow-hidden" style={{ background: '#0D1410' }}>
        <div className="px-3 py-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <span className="text-xs uppercase tracking-widest text-muted-text">Portfolio</span>
        </div>
        <div className="p-3 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Total Capital ($)"
              type="number"
              value={settings.totalCapital || 100000}
              onChange={updateNum('totalCapital')}
              step={1000}
              min={1000}
            />
            <Field
              label="Monthly Target ($)"
              type="number"
              value={settings.monthlyTarget || 3500}
              onChange={updateNum('monthlyTarget')}
              step={100}
              min={100}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Max Positions"
              type="number"
              value={settings.maxPositions || 6}
              onChange={updateNum('maxPositions')}
              min={1}
              max={20}
            />
            <Field
              label="Profit Close %"
              type="number"
              value={settings.profitCloseTarget || 65}
              onChange={updateNum('profitCloseTarget')}
              step={5}
              min={10}
              max={100}
            />
          </div>
        </div>
      </div>

      {/* Strategy Settings */}
      <div className="rounded-lg card-border overflow-hidden" style={{ background: '#0D1410' }}>
        <div className="px-3 py-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <span className="text-xs uppercase tracking-widest text-muted-text">Strategy Targets</span>
        </div>
        <div className="p-3 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="CSP Target Delta"
              type="number"
              value={settings.targetCspDelta || 0.30}
              onChange={updateNum('targetCspDelta')}
              step={0.01}
              min={0.05}
              max={0.50}
            />
            <Field
              label="CC Target Delta"
              type="number"
              value={settings.targetCcDelta || 0.28}
              onChange={updateNum('targetCcDelta')}
              step={0.01}
              min={0.05}
              max={0.50}
            />
          </div>
          <Field
            label="Roll Trigger DTE"
            type="number"
            value={settings.rollDte || 21}
            onChange={updateNum('rollDte')}
            step={1}
            min={7}
            max={45}
          />
        </div>
      </div>

      {/* Current config summary */}
      <div className="rounded-lg p-3 card-border" style={{ background: '#0D1410' }}>
        <div className="text-xs text-muted-text mb-2 uppercase tracking-widest">Current Config</div>
        <div className="flex flex-col gap-1">
          {[
            ['Capital', `$${(settings.totalCapital || 100000).toLocaleString()}`],
            ['Monthly Target', `$${(settings.monthlyTarget || 3500).toLocaleString()}`],
            ['Max Positions', settings.maxPositions || 6],
            ['CSP Delta', settings.targetCspDelta || 0.30],
            ['CC Delta', settings.targetCcDelta || 0.28],
            ['Roll DTE', `${settings.rollDte || 21}d`],
            ['Close %', `${settings.profitCloseTarget || 65}%`],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between text-xs">
              <span className="text-muted-text">{k}</span>
              <span className="text-primary-text font-bold">{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Data Management */}
      <div className="rounded-lg card-border overflow-hidden" style={{ background: '#0D1410' }}>
        <div className="px-3 py-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <span className="text-xs uppercase tracking-widest text-muted-text">Data Management</span>
        </div>
        <div className="p-3 flex flex-col gap-2">
          <button
            onClick={exportAll}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm border font-bold"
            style={{ borderColor: 'rgba(255,255,255,0.12)', color: '#E0F0E8', minHeight: 44 }}
          >
            <Download size={14} /> Export All Data (JSON)
          </button>
          <button
            onClick={importAll}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm border font-bold"
            style={{ borderColor: 'rgba(255,255,255,0.12)', color: '#E0F0E8', minHeight: 44 }}
          >
            <Upload size={14} /> Import Data (JSON)
          </button>
          <button
            onClick={loadSampleData}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm border font-bold"
            style={{ borderColor: 'rgba(85,153,255,0.4)', color: '#5599FF', minHeight: 44 }}
          >
            Load Sample Data
          </button>
          <button
            onClick={resetToDefaults}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm border font-bold"
            style={{ borderColor: 'rgba(255,255,255,0.08)', color: '#7A9A88', minHeight: 44 }}
          >
            Reset Settings to Defaults
          </button>
          <div className="h-px my-1" style={{ background: 'rgba(255,64,96,0.2)' }} />
          <button
            onClick={clearPositions}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm border font-bold"
            style={{ borderColor: 'rgba(255,64,96,0.35)', color: '#FF4060', minHeight: 44 }}
          >
            <Trash2 size={14} /> Clear All Positions
          </button>
          <button
            onClick={clearHistory}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm border font-bold"
            style={{ borderColor: 'rgba(255,64,96,0.35)', color: '#FF4060', minHeight: 44 }}
          >
            <Trash2 size={14} /> Clear Trade History
          </button>
        </div>
      </div>

      {/* App Info */}
      <div className="text-center text-muted-text text-xs pb-2">
        <p>Wheel Terminal v1.0.0</p>
        <p className="mt-0.5">Built for @wheelsniper · $100K portfolio</p>
      </div>
    </div>
  );
}
