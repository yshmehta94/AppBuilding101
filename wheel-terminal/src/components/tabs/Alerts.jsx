import { useMemo } from 'react';
import { Bell, CheckCircle, AlertTriangle, TrendingUp } from 'lucide-react';
import useStore from '../../store';
import {
  getRuleAlerts, STATUS,
} from '../../utils/calculations';

// ─── Alert severity config ────────────────────────────────────────────────────

const SEVERITY = {
  red:    { border: '#ef4444', bg: 'rgba(239,68,68,0.06)', icon: '🔴', iconColor: '#ef4444' },
  yellow: { border: '#f59e0b', bg: 'rgba(245,158,11,0.06)', icon: '⚠️', iconColor: '#f59e0b' },
  green:  { border: '#22c55e', bg: 'rgba(34,197,94,0.06)',  icon: '✅', iconColor: '#22c55e' },
};

const RULE_LABELS = {
  profit_target:  { title: '50% Profit Target Hit', category: 'Take Profit' },
  loss_act:       { title: 'Loss Threshold + Short DTE', category: 'Act Now' },
  loss_roll:      { title: 'Roll Trigger (50% Loss)', category: 'Roll Signal' },
  dte_warning:    { title: 'DTE Warning (<21 Days)', category: 'DTE Alert' },
  position_sizing:{ title: 'Position Too Large', category: 'Risk' },
  cash_buffer:    { title: 'Cash Buffer Warning', category: 'Risk' },
};

function AlertCard({ alert, onNavigate }) {
  const cfg = SEVERITY[alert.severity] || SEVERITY.yellow;
  const rule = RULE_LABELS[alert.type] || { title: 'Alert', category: 'Info' };

  return (
    <div
      className="rounded-xl p-3.5 flex flex-col gap-2"
      style={{ background: cfg.bg, borderLeft: `3px solid ${cfg.border}`, border: `1px solid ${cfg.border}30` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: cfg.iconColor }}>
              {rule.category}
            </span>
          </div>
          <p className="text-primary-text text-sm font-bold">{rule.title}</p>
          <p className="text-muted-text text-xs mt-1 leading-relaxed">{alert.msg}</p>
        </div>
        <span className="text-lg shrink-0">{cfg.icon}</span>
      </div>
      {alert.chain && (
        <button
          onClick={() => onNavigate && onNavigate()}
          className="self-start text-xs font-bold px-3 py-1.5 rounded-lg border border-white/12 text-muted-text hover:text-primary-text transition-colors"
          style={{ minHeight: 36 }}
        >
          View {alert.chain.ticker} →
        </button>
      )}
    </div>
  );
}

// ─── Rule reference card ──────────────────────────────────────────────────────

function RuleCard({ rule }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/05 last:border-0">
      <span className="text-sm shrink-0">{rule.emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-primary-text text-xs font-bold">{rule.name}</p>
        <p className="text-muted-text text-xs">{rule.trigger}</p>
      </div>
    </div>
  );
}

const RULES_REFERENCE = [
  { emoji: '🎯', name: '50% Profit Target', trigger: 'Close when position reaches 50% of max profit' },
  { emoji: '🔄', name: '50% Loss Roll Trigger', trigger: 'Roll when position loses 50% of premium collected' },
  { emoji: '📅', name: 'DTE Warning', trigger: 'Evaluate at <21 DTE with remaining profit' },
  { emoji: '🏢', name: 'Earnings Blackout', trigger: 'Avoid opening when earnings within DTE window' },
  { emoji: '💰', name: 'Position Sizing', trigger: 'Single position collateral should not exceed 20% of portfolio' },
  { emoji: '🏦', name: 'Cash Buffer', trigger: 'Keep at least 10% of portfolio in cash' },
  { emoji: '📊', name: 'IVR Check', trigger: 'Only open when IVR ≥ 30 (high IV environment)' },
  { emoji: '🔀', name: 'Sector Concentration', trigger: 'Single sector should not exceed 35% of deployed capital' },
];

// ─── Main Alerts Tab ──────────────────────────────────────────────────────────

export default function Alerts({ setActiveTab }) {
  const { chains, stockPrices, settings } = useStore();

  const alerts = useMemo(
    () => getRuleAlerts(chains, stockPrices, settings),
    [chains, stockPrices, settings]
  );

  const redAlerts = alerts.filter(a => a.severity === 'red');
  const yellowAlerts = alerts.filter(a => a.severity === 'yellow');
  const greenAlerts = alerts.filter(a => a.severity === 'green');

  return (
    <div className="animate-fade-up px-4 pt-4 pb-6 flex flex-col gap-5">
      <div>
        <h1 className="text-primary-text font-bold text-base">Rule Compliance</h1>
        <p className="text-muted-text text-xs mt-0.5">
          {alerts.length === 0 ? 'All positions within rules' : `${alerts.length} alert${alerts.length !== 1 ? 's' : ''} need attention`}
        </p>
      </div>

      {/* Alert summary chips */}
      <div className="flex gap-2">
        {[
          { count: redAlerts.length, label: 'Critical', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
          { count: yellowAlerts.length, label: 'Warning', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
          { count: greenAlerts.length, label: 'Take Profit', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
        ].map(({ count, label, color, bg }) => (
          <div key={label} className="flex-1 rounded-lg py-2.5 text-center" style={{ background: bg }}>
            <p className="font-bold text-lg" style={{ color }}>{count}</p>
            <p className="text-xs" style={{ color }}>{label}</p>
          </div>
        ))}
      </div>

      {/* All clear */}
      {alerts.length === 0 && (
        <div className="rounded-xl p-5 border border-white/07 bg-[#0D1410] text-center">
          <CheckCircle size={32} className="mx-auto mb-3" style={{ color: '#22c55e' }} />
          <p className="text-primary-text font-bold text-sm mb-1">All Clear</p>
          <p className="text-muted-text text-xs">All positions are within your trading rules.</p>
        </div>
      )}

      {/* Red alerts */}
      {redAlerts.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#ef4444' }}>
            🔴 Critical ({redAlerts.length})
          </p>
          {redAlerts.map(alert => (
            <AlertCard key={alert.id} alert={alert} onNavigate={() => setActiveTab('positions')} />
          ))}
        </div>
      )}

      {/* Green alerts (profit targets) */}
      {greenAlerts.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#22c55e' }}>
            ✅ Take Profit ({greenAlerts.length})
          </p>
          {greenAlerts.map(alert => (
            <AlertCard key={alert.id} alert={alert} onNavigate={() => setActiveTab('positions')} />
          ))}
        </div>
      )}

      {/* Yellow alerts */}
      {yellowAlerts.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#f59e0b' }}>
            ⚠️ Warnings ({yellowAlerts.length})
          </p>
          {yellowAlerts.map(alert => (
            <AlertCard key={alert.id} alert={alert} onNavigate={() => setActiveTab('positions')} />
          ))}
        </div>
      )}

      {/* Rules reference */}
      <div className="rounded-xl border border-white/07 bg-[#0D1410] overflow-hidden">
        <div className="px-3 py-2.5 border-b border-white/07">
          <span className="text-muted-text text-xs uppercase tracking-widest">Your Trading Rules</span>
        </div>
        <div className="px-3 py-1">
          {RULES_REFERENCE.map(r => <RuleCard key={r.name} rule={r} />)}
        </div>
      </div>
    </div>
  );
}
