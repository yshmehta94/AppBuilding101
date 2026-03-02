import { useState } from 'react';
import { getStatus, getAdvice, daysTo, capturePct, strikeDistancePct, STATUS, STATUS_ORDER } from '../../utils/calculations';

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
    CLOSE_NOW: { label: 'CLOSE NOW', bg: '#00DC78', color: '#070C09' },
    DANGER: { label: 'DANGER', bg: '#FF4060', color: '#fff' },
    ROLL_NOW: { label: 'ROLL NOW', bg: '#FFB800', color: '#070C09' },
    CHECK_21: { label: 'CHECK 21', bg: '#5599FF', color: '#fff' },
    WATCH: { label: 'WATCH', bg: 'rgba(255,184,0,0.18)', color: '#FFB800', border: '#FFB800' },
    HOLD: { label: 'HOLD', bg: 'rgba(122,154,136,0.15)', color: '#7A9A88' },
  };
  const s = map[status] || map.HOLD;
  const isDanger = status === 'DANGER';
  return (
    <span
      className={`text-xs font-bold px-2 py-1 rounded ${isDanger ? 'animate-pulse-danger' : ''}`}
      style={{ background: s.bg, color: s.color, border: s.border ? `1px solid ${s.border}` : undefined }}
    >
      {s.label}
    </span>
  );
}

const ROLLING_RULES = [
  { rule: 'Close at 65% capture', detail: 'Buy back when you have captured 65% of max profit' },
  { rule: 'Roll at 21 DTE if challenged', detail: 'Roll to next month when < 21 DTE and strike is threatened' },
  { rule: 'Never roll for net debit', detail: 'The roll must collect at least $0.15 net credit' },
  { rule: 'Roll maximum 3 times', detail: 'After 3 rolls, accept assignment or close the position' },
  { rule: 'Min $0.15 credit to roll', detail: 'If you cannot collect ≥ $0.15, take the loss instead' },
  { rule: 'Close before earnings', detail: 'Avoid holding through earnings — IV crush risk both ways' },
  { rule: 'Never deploy > 80% capital', detail: 'Keep at least 20% cash free for opportunities and margin' },
  { rule: '3 rolls = broken thesis', detail: 'If rolled 3x, the trade did not work — accept and move on' },
];

const DAILY_CHECKLIST = [
  'Refresh stock prices',
  'Check CLOSE NOW alerts',
  'Check DANGER alerts',
  'Review monthly progress',
  'Check cash available',
  'Review WATCH positions',
];

export default function Alerts({ positions, stockPrices }) {
  const [checked, setChecked] = useState({});

  const allAlerts = positions
    .map((pos) => {
      const sp = stockPrices[pos.ticker];
      const status = getStatus(pos, sp?.price);
      const advice = getAdvice(pos, sp?.price);
      return { pos, sp, status, advice };
    })
    .filter(({ status }) => status !== STATUS.HOLD)
    .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));

  const dangerCount = allAlerts.filter((a) => a.status === STATUS.DANGER).length;
  const urgentCount = allAlerts.filter((a) =>
    a.status === STATUS.DANGER || a.status === STATUS.CLOSE_NOW
  ).length;

  const toggleCheck = (i) => setChecked((prev) => ({ ...prev, [i]: !prev[i] }));

  return (
    <div className="animate-fade-up px-4 pt-4 pb-6 flex flex-col gap-4">
      {/* Summary Line */}
      <div
        className="rounded-lg p-3 card-border"
        style={{ background: '#0D1410' }}
      >
        {urgentCount > 0 ? (
          <p className="text-sm font-bold" style={{ color: '#FF4060' }}>
            🚨 {urgentCount} position{urgentCount !== 1 ? 's' : ''} need{urgentCount === 1 ? 's' : ''} immediate action
          </p>
        ) : allAlerts.length > 0 ? (
          <p className="text-sm font-bold" style={{ color: '#FFB800' }}>
            ⚡ {allAlerts.length} position{allAlerts.length !== 1 ? 's' : ''} need{allAlerts.length === 1 ? 's' : ''} attention
          </p>
        ) : (
          <p className="text-sm font-bold" style={{ color: '#00DC78' }}>
            ✅ All positions in HOLD — theta working
          </p>
        )}
      </div>

      {/* Alert Cards */}
      {allAlerts.length === 0 && (
        <div className="rounded-lg p-8 card-border flex flex-col items-center gap-2" style={{ background: '#0D1410' }}>
          <span className="text-4xl">🎯</span>
          <span className="text-muted-text text-sm text-center">No alerts — all positions are in HOLD status.</span>
        </div>
      )}

      {allAlerts.map(({ pos, sp, status, advice }, i) => {
        const dte = daysTo(pos.expiry);
        const cap = capturePct(pos);
        const sdPct = strikeDistancePct(pos, sp?.price);
        return (
          <div
            key={pos.id}
            className="rounded-lg card-border overflow-hidden animate-fade-up"
            style={{
              background: '#0D1410',
              borderLeft: `3px solid ${advice.color}`,
              animationDelay: `${i * 50}ms`,
            }}
          >
            <div className="px-3 pt-3 pb-2">
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <StatusBadge status={status} />
                  <span className="font-bold text-sm text-primary-text">{pos.ticker}</span>
                  <TypeBadge type={pos.type} />
                </div>
                <span className="text-muted-text text-xs">
                  ${pos.strike} strike
                </span>
              </div>
              <p className="text-xs leading-relaxed mb-3" style={{ color: '#E0F0E8' }}>
                <span className="mr-1">{advice.emoji}</span>
                {advice.message}
              </p>
              <div className="flex gap-3">
                <div className="flex flex-col">
                  <span className="text-muted-text text-xs">DTE</span>
                  <span
                    className="font-bold text-sm"
                    style={{ color: dte <= 7 ? '#FF4060' : dte <= 21 ? '#FFB800' : '#E0F0E8' }}
                  >
                    {dte}d
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-muted-text text-xs">Capture</span>
                  <span
                    className="font-bold text-sm"
                    style={{ color: cap >= 65 ? '#00DC78' : cap >= 40 ? '#FFB800' : '#E0F0E8' }}
                  >
                    {cap.toFixed(1)}%
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-muted-text text-xs">Strike Dist</span>
                  <span
                    className="font-bold text-sm"
                    style={{ color: sdPct < 4 ? '#FF4060' : sdPct < 9 ? '#FFB800' : '#E0F0E8' }}
                  >
                    {sp?.price ? `${sdPct.toFixed(1)}%` : 'n/a'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Rolling Rules Reference */}
      <div className="rounded-lg card-border overflow-hidden" style={{ background: '#0D1410' }}>
        <div className="px-3 py-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <span className="text-xs uppercase tracking-widest text-muted-text">Rolling Rules Reference</span>
        </div>
        <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          {ROLLING_RULES.map((item, i) => (
            <div key={i} className="px-3 py-2.5">
              <div className="flex items-start gap-2">
                <span className="text-primary-green text-xs font-bold shrink-0 mt-0.5">▸</span>
                <div>
                  <div className="text-xs font-bold text-primary-text">{item.rule}</div>
                  <div className="text-xs text-muted-text">{item.detail}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Daily Checklist */}
      <div className="rounded-lg card-border overflow-hidden" style={{ background: '#0D1410' }}>
        <div className="px-3 py-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <div className="flex justify-between items-center">
            <span className="text-xs uppercase tracking-widest text-muted-text">Morning Routine</span>
            <button
              onClick={() => setChecked({})}
              className="text-xs text-muted-text"
              style={{ minHeight: 36, paddingLeft: 8, paddingRight: 8 }}
            >
              Reset
            </button>
          </div>
        </div>
        <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          {DAILY_CHECKLIST.map((item, i) => (
            <button
              key={i}
              onClick={() => toggleCheck(i)}
              className="w-full flex items-center gap-3 px-3 py-3 text-left"
              style={{ minHeight: 48 }}
            >
              <div
                className="w-5 h-5 rounded flex items-center justify-center shrink-0"
                style={{
                  border: `2px solid ${checked[i] ? '#00DC78' : 'rgba(255,255,255,0.2)'}`,
                  background: checked[i] ? '#00DC78' : 'transparent',
                }}
              >
                {checked[i] && (
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4l3 3 5-6" stroke="#070C09" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span
                className="text-sm"
                style={{ color: checked[i] ? '#7A9A88' : '#E0F0E8', textDecoration: checked[i] ? 'line-through' : 'none' }}
              >
                {item}
              </span>
            </button>
          ))}
        </div>
        <div className="px-3 py-2 text-xs text-muted-text text-right">
          {Object.values(checked).filter(Boolean).length}/{DAILY_CHECKLIST.length} done
        </div>
      </div>
    </div>
  );
}
