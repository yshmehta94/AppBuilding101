import { useState, useEffect, useCallback, useRef } from 'react';
import { LayoutDashboard, List, Bell, BarChart2, Brain, Settings as SettingsIcon } from 'lucide-react';
import {
  lsGet, lsSet, SAMPLE_POSITIONS, DEFAULT_SETTINGS,
  getStatus, STATUS, STATUS_ORDER,
} from './utils/calculations';
import Dashboard from './components/tabs/Dashboard';
import Positions from './components/tabs/Positions';
import Alerts from './components/tabs/Alerts';
import Analytics from './components/tabs/Analytics';
import AIInsights from './components/tabs/AIInsights';
import SettingsTab from './components/tabs/Settings';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { id: 'positions', label: 'Positions', Icon: List },
  { id: 'alerts', label: 'Alerts', Icon: Bell },
  { id: 'analytics', label: 'Analytics', Icon: BarChart2 },
  { id: 'ai', label: 'AI', Icon: Brain },
  { id: 'settings', label: 'Settings', Icon: SettingsIcon },
];

const AV_DELAY_MS = 800;
const REFRESH_INTERVAL_MS = 30000;

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [positions, setPositions] = useState(() =>
    lsGet('wt_positions', SAMPLE_POSITIONS)
  );
  const [closedTrades, setClosedTrades] = useState(() =>
    lsGet('wt_closed', [])
  );
  const [settings, setSettings] = useState(() =>
    lsGet('wt_settings', DEFAULT_SETTINGS)
  );
  const [stockPrices, setStockPrices] = useState({});
  const [pricesConnected, setPricesConnected] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [isFetching, setIsFetching] = useState(false);
  const [apiLimitReached, setApiLimitReached] = useState(false);
  const [banner, setBanner] = useState(null);
  const [focusTicker, setFocusTicker] = useState(null);
  const isFetchingRef = useRef(false);
  const refreshTimerRef = useRef(null);
  const limitReachedRef = useRef(false);

  useEffect(() => { lsSet('wt_positions', positions); }, [positions]);
  useEffect(() => { lsSet('wt_closed', closedTrades); }, [closedTrades]);
  useEffect(() => { lsSet('wt_settings', settings); }, [settings]);

  const fetchPrice = useCallback(async (ticker, apiKey) => {
    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${ticker}&apikey=${apiKey}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(url, { signal: controller.signal });
      const data = await res.json();
      clearTimeout(timeout);
      if (data['Note'] || data['Information']) {
        return { limited: true };
      }
      const q = data['Global Quote'];
      if (!q || !q['05. price']) return null;
      return {
        price: parseFloat(q['05. price']),
        change: parseFloat(q['09. change']),
        changePct: parseFloat(q['10. change percent']?.replace('%', '')),
        ticker,
      };
    } catch {
      clearTimeout(timeout);
      return null;
    }
  }, []);

  const refreshPrices = useCallback(async (positionsOverride) => {
    if (isFetchingRef.current) return;
    const activePosns = positionsOverride || positions;
    const tickers = [...new Set(activePosns.map((p) => p.ticker))];
    if (!tickers.length) return;
    const apiKey = settings.avKey || import.meta.env.VITE_ALPHA_VANTAGE_KEY || '';
    if (!apiKey) { setPricesConnected(false); return; }

    isFetchingRef.current = true;
    setIsFetching(true);
    limitReachedRef.current = false;
    setApiLimitReached(false);
    let anySuccess = false;

    for (let i = 0; i < tickers.length; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, AV_DELAY_MS));
      if (limitReachedRef.current) break;
      const result = await fetchPrice(tickers[i], apiKey);
      if (result?.limited) {
        limitReachedRef.current = true;
        setApiLimitReached(true);
        break;
      }
      if (result) {
        anySuccess = true;
        setStockPrices((prev) => ({ ...prev, [result.ticker]: result }));
      }
    }

    isFetchingRef.current = false;
    setIsFetching(false);
    setPricesConnected(anySuccess);
    setLastRefresh(new Date());
  }, [positions, settings.avKey, fetchPrice]);

  useEffect(() => {
    refreshPrices();
    refreshTimerRef.current = setInterval(() => refreshPrices(), REFRESH_INTERVAL_MS);
    return () => clearInterval(refreshTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const prevTickersRef = useRef('');
  useEffect(() => {
    const current = [...new Set(positions.map((p) => p.ticker))].sort().join(',');
    if (current !== prevTickersRef.current && prevTickersRef.current !== '') {
      prevTickersRef.current = current;
      refreshPrices(positions);
    } else {
      prevTickersRef.current = current;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions]);

  const addPosition = useCallback((pos) => {
    const newPos = {
      id: Date.now(),
      contracts: 1,
      rollCount: 0,
      openDate: new Date().toISOString().split('T')[0],
      ...pos,
      ticker: (pos.ticker || '').toUpperCase(),
      collateral: pos.collateral || (pos.strike * 100 * (pos.contracts || 1)),
    };
    setPositions((prev) => [...prev, newPos]);
  }, []);

  const updatePosition = useCallback((id, updates) => {
    setPositions((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
  }, []);

  const removePosition = useCallback((id) => {
    setPositions((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const closePosition = useCallback((pos, closeData) => {
    const closeDate = closeData.closeDate || new Date().toISOString().split('T')[0];
    const daysHeld = pos.openDate
      ? Math.max(0, Math.ceil((new Date(closeDate) - new Date(pos.openDate)) / 86400000))
      : 0;
    const closePremium = parseFloat(closeData.closePremium) || 0;
    const realizedPnl = (pos.premium - closePremium) * (pos.contracts || 1) * 100;
    const capPct = pos.premium > 0
      ? Math.max(0, Math.min(100, ((pos.premium - closePremium) / pos.premium) * 100))
      : 0;

    const closed = { ...pos, ...closeData, closeDate, daysHeld, realizedPnl, capturePct: capPct, closePremium };
    setClosedTrades((prev) => [closed, ...prev]);
    removePosition(pos.id);
  }, [removePosition]);

  const markRolled = useCallback((id) => {
    setPositions((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, rollCount: (p.rollCount || 0) + 1 } : p
      )
    );
  }, []);

  const showBanner = useCallback((msg, type = 'error') => {
    setBanner({ msg, type });
    setTimeout(() => setBanner(null), 5000);
  }, []);

  const navigateToPosition = useCallback((ticker) => {
    setFocusTicker(ticker);
    setActiveTab('positions');
  }, []);

  const alertCount = positions.filter((p) => {
    const sp = stockPrices[p.ticker];
    return getStatus(p, sp?.price) !== STATUS.HOLD;
  }).length;

  const sortedPositions = [...positions].sort((a, b) => {
    const sa = getStatus(a, stockPrices[a.ticker]?.price);
    const sb = getStatus(b, stockPrices[b.ticker]?.price);
    return STATUS_ORDER.indexOf(sa) - STATUS_ORDER.indexOf(sb);
  });

  const sharedProps = {
    positions,
    sortedPositions,
    closedTrades,
    settings,
    setSettings,
    stockPrices,
    pricesConnected,
    lastRefresh,
    isFetching,
    apiLimitReached,
    addPosition,
    updatePosition,
    removePosition,
    closePosition,
    markRolled,
    refreshPrices,
    showBanner,
    navigateToPosition,
    focusTicker,
    setFocusTicker,
    setClosedTrades,
    setPositions,
  };

  return (
    <div className="flex flex-col min-h-screen bg-bg text-primary-text font-mono">
      {/* Top Bar */}
      <header
        className="flex items-center justify-between px-4 py-3 border-b shrink-0"
        style={{ borderColor: 'rgba(255,255,255,0.07)', background: '#0D1410' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-primary-green font-bold text-sm tracking-widest">⚙ WHEEL</span>
          <span className="text-muted-text text-xs">@wheelsniper</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${pricesConnected ? 'bg-primary-green animate-pulse-green' : 'bg-danger-red'}`}
          />
          <span className="text-muted-text text-xs">
            {isFetching ? 'loading…' : lastRefresh
              ? lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : 'offline'}
          </span>
          <button
            onClick={() => refreshPrices()}
            disabled={isFetching}
            className="flex items-center justify-center text-muted-text hover:text-primary-green transition-colors"
            style={{ minWidth: 44, minHeight: 44 }}
            aria-label="Refresh"
          >
            {isFetching ? (
              <span className="spinner" />
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {apiLimitReached && (
        <div className="shrink-0 px-4 py-2 text-xs font-bold text-center text-bg bg-warning-yellow">
          ⚠ Alpha Vantage daily limit reached — prices may be stale
        </div>
      )}

      {banner && (
        <div
          className={`shrink-0 px-4 py-2 text-xs font-bold text-center animate-fade-up ${
            banner.type === 'error' ? 'bg-danger-red text-white'
              : banner.type === 'success' ? 'bg-primary-green text-bg'
              : 'bg-warning-yellow text-bg'
          }`}
        >
          {banner.msg}
        </div>
      )}

      <main className="flex-1 overflow-y-auto pb-20">
        {activeTab === 'dashboard' && <Dashboard key="dashboard" {...sharedProps} />}
        {activeTab === 'positions' && <Positions key="positions" {...sharedProps} />}
        {activeTab === 'alerts' && <Alerts key="alerts" {...sharedProps} />}
        {activeTab === 'analytics' && <Analytics key="analytics" {...sharedProps} />}
        {activeTab === 'ai' && <AIInsights key="ai" {...sharedProps} />}
        {activeTab === 'settings' && <SettingsTab key="settings" {...sharedProps} />}
      </main>

      {/* Bottom Nav */}
      <nav
        className="fixed bottom-0 left-0 right-0 flex border-t z-50"
        style={{ borderColor: 'rgba(255,255,255,0.07)', background: '#0D1410' }}
      >
        {TABS.map(({ id, label, Icon }) => {
          const isActive = activeTab === id;
          const showBadge = id === 'alerts' && alertCount > 0;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 relative"
              style={{ minHeight: 56 }}
            >
              <div className="relative">
                <Icon size={18} color={isActive ? '#00DC78' : '#7A9A88'} />
                {showBadge && (
                  <span
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-bg font-bold"
                    style={{ background: '#FF4060', fontSize: 9 }}
                  >
                    {alertCount}
                  </span>
                )}
              </div>
              <span style={{ color: isActive ? '#00DC78' : '#7A9A88', fontSize: 10 }}>{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
