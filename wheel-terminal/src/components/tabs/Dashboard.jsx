import { useMemo } from 'react';
import { Camera, Plus } from 'lucide-react';
import {
  capturePct, pnlFor, daysTo, getStatus, getAdvice,
  STATUS, calcPortfolio, fmt$, fmtPct,
} from '../../utils/calculations';

const MONTHLY_TARGET = 3500;
const MILESTONE_1 = 2275;

function MetricCard({ label, value, sub, valueColor, className = '' }) {
  return (
    <div
      className={`shrink-0 flex flex-col gap-1 rounded-lg p-3 card-border ${className}`}
      style={{ background: '#0D1410', minWidth: 120 }}
    >
      <span className="text-muted-text text-xs uppercase tracking-widest">{label}</span>
      <span className="font-bold text-base" style={{ color: valueColor || '#E0F0E8' }}>
        {value}
      </span>
      {sub && <span className="text-muted-text text-xs">{sub}</span>}
    </div>
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
      style={{
        background: s.bg,
        color: s.color,
        border: s.border ? `1px solid ${s.border}` : undefined,
        fontSize: 10,
      }}
    >
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

export default function Dashboard({ positions, sortedPositions, settings, stockPrices, navigateToPosition, setActiveTab }) {
  const { totalPnl, totalCollateral, cashAvailable, monthlyProgress, alerts } = useMemo(
    () => calcPortfolio(positions, stockPrices, settings),
    [positions, stockPrices, settings]
  );

  const monthlyTarget = settings.monthlyTarget || MONTHLY_TARGET;
  const totalCapital = settings.totalCapital || 100000;
  const deployedPct = totalCapital > 0 ? (totalCollateral / totalCapital) * 100 : 0;
  const progressClamped = Math.min(100, Math.max(0, monthlyProgress));
  const hasAlerts = alerts.length > 0;

  const pnlColor = totalPnl >= 0 ? '#00DC78' : '#FF4060';
  const progressColor =
    progressClamped >= 75 ? '#00DC78' : progressClamped >= 40 ? '#FFB800' : '#FF4060';

  return (
    <div className="animate-fade-up px-4 pt-4 pb-6 flex flex-col gap-4">
      {/* Metric Cards — horizontal scroll */}
      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
        <MetricCard
          label="OPEN P&L"
          value={fmt$(totalPnl)}
          valueColor={pnlColor}
          sub={totalPnl >= 0 ? 'unrealized gain' : 'unrealized loss'}
        />
        <MetricCard
          label="MONTHLY"
          value={fmtPct(progressClamped)}
          valueColor={progressColor}
          sub={`${fmt$(totalPnl)} of ${fmt$(monthlyTarget, 0)}`}
        />
        <MetricCard
          label="DEPLOYED"
          value={fmt$(totalCollateral, 0)}
          valueColor="#5599FF"
          sub={`${fmtPct(deployedPct, 0)} of capital`}
        />
        <MetricCard
          label="CASH FREE"
          value={fmt$(cashAvailable, 0)}
          valueColor="#00C8FF"
          sub="available"
        />
        <MetricCard
          label="POSITIONS"
          value={positions.length}
          valueColor={hasAlerts ? '#FFB800' : '#E0F0E8'}
          sub={hasAlerts ? `${alerts.length} need action` : 'all clear'}
        />
      </div>

      {/* Monthly Progress Bar */}
      <div className="rounded-lg p-4 card-border" style={{ background: '#0D1410' }}>
        <div className="flex justify-between items-center mb-2">
          <span className="text-muted-text text-xs uppercase tracking-widest">Monthly Target Progress</span>
          <span className="text-xs font-bold" style={{ color: progressColor }}>
            {fmtPct(progressClamped, 1)}
          </span>
        </div>
        <div className="relative h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
          <div
            className="progress-bar-fill h-full rounded-full"
            style={{ width: `${progressClamped}%`, background: progressColor }}
          />
          {/* Milestone markers */}
          <div
            className="absolute top-0 bottom-0 w-px"
            style={{ left: `${(MILESTONE_1 / monthlyTarget) * 100}%`, background: 'rgba(255,255,255,0.3)' }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-muted-text text-xs">$0</span>
          <span className="text-muted-text text-xs">${MILESTONE_1.toLocaleString()}</span>
          <span className="text-muted-text text-xs">${monthlyTarget.toLocaleString()}</span>
        </div>
      </div>

      {/* Action Required */}
      {hasAlerts && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="text-warning-yellow text-xs font-bold tracking-widest uppercase">
              ⚡ Needs Action
            </span>
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(255,184,0,0.15)', color: '#FFB800' }}
            >
              {alerts.length}
            </span>
          </div>
          {alerts.map((pos, i) => {
            const sp = stockPrices[pos.ticker];
            const advice = getAdvice(pos, sp?.price);
            const cap = capturePct(pos);
            const dte = daysTo(pos.expiry);
            return (
              <button
                key={pos.id}
                onClick={() => navigateToPosition(pos.ticker)}
                className="w-full text-left rounded-lg p-3 card-border animate-fade-up"
                style={{
                  background: '#0D1410',
                  animationDelay: `${i * 50}ms`,
                  borderLeft: `3px solid ${advice.color}`,
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-primary-text">{pos.ticker}</span>
                    <TypeBadge type={pos.type} />
                    <StatusBadge status={advice.status} />
                  </div>
                  <span className="text-muted-text text-xs">{dte}d / {cap.toFixed(0)}%</span>
                </div>
                <p className="text-muted-text text-xs leading-relaxed">{advice.message}</p>
              </button>
            );
          })}
        </div>
      )}

      {/* Positions Summary Table */}
      <div className="rounded-lg card-border overflow-hidden" style={{ background: '#0D1410' }}>
        <div className="px-3 py-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <span className="text-muted-text text-xs uppercase tracking-widest">All Positions</span>
        </div>
        {sortedPositions.length === 0 ? (
          <div className="px-3 py-6 text-center text-muted-text text-xs">
            No open positions. Add one below.
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
            {sortedPositions.map((pos) => {
              const sp = stockPrices[pos.ticker];
              const status = getStatus(pos, sp?.price);
              const cap = capturePct(pos);
              const dte = daysTo(pos.expiry);
              return (
                <button
                  key={pos.id}
                  onClick={() => navigateToPosition(pos.ticker)}
                  className="w-full flex items-center px-3 py-2.5 gap-2 hover:bg-white/5 transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-sm text-primary-text">{pos.ticker}</span>
                      <TypeBadge type={pos.type} />
                    </div>
                    <span className="text-muted-text text-xs">${pos.strike} · {dte}d</span>
                  </div>
                  {/* Mini capture bar */}
                  <div className="flex flex-col items-end gap-1 shrink-0" style={{ minWidth: 72 }}>
                    <span className="text-xs font-bold" style={{ color: cap >= 65 ? '#00DC78' : '#FFB800' }}>
                      {cap.toFixed(0)}%
                    </span>
                    <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)', width: 60 }}>
                      <div
                        className="progress-bar-fill h-full rounded-full"
                        style={{ width: `${cap}%`, background: cap >= 65 ? '#00DC78' : '#FFB800' }}
                      />
                    </div>
                  </div>
                  <StatusBadge status={status} />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="flex gap-3">
        <button
          onClick={() => setActiveTab('positions')}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-sm border"
          style={{ borderColor: 'rgba(255,255,255,0.12)', color: '#E0F0E8', minHeight: 44 }}
        >
          <Camera size={16} />
          Screenshot
        </button>
        <button
          onClick={() => setActiveTab('positions')}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-sm"
          style={{ background: '#00DC78', color: '#070C09', minHeight: 44 }}
        >
          <Plus size={16} />
          Manual Entry
        </button>
      </div>
    </div>
  );
}
