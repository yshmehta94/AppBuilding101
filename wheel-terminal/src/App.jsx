import { useState, useEffect, useCallback, useRef } from 'react';
import { LayoutDashboard, List, Plus, Search, BarChart2, Settings as SettingsIcon } from 'lucide-react';
import useStore from './store';
import { getRuleAlerts } from './utils/calculations';
import Dashboard from './components/tabs/Dashboard';
import Positions from './components/tabs/Positions';
import TradeLogger from './components/tabs/TradeLogger';
import ScanTab from './components/tabs/ScanTab';
import Analytics from './components/tabs/Analytics';
import Alerts from './components/tabs/Alerts';
import SettingsTab from './components/tabs/Settings';

const TABS = [
  { id: 'dashboard', label: 'Home',      Icon: LayoutDashboard },
  { id: 'positions', label: 'Positions', Icon: List },
  { id: 'log',       label: 'Log',       Icon: Plus },
  { id: 'scan',      label: 'Scan',      Icon: Search },
  { id: 'analytics', label: 'Analytics', Icon: BarChart2 },
];

const AV_DELAY_MS = 800;
const REFRESH_INTERVAL_MS = 60000;

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showSettings, setShowSettings] = useState(false);

  const {
    chains, settings,
    stockPrices, setStockPrice,
    isFetching, setFetching,
    pricesConnected, setPricesConnected,
    lastRefresh, setLastRefresh,
    apiLimitReached, setApiLimitReached,
    banner,
  } = useStore();

  const isFetchingRef = useRef(false);
  const limitReachedRef = useRef(false);
  const refreshTimerRef = useRef(null);

  const fetchPrice = useCallback(async (ticker, apiKey) => {
    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${ticker}&apikey=${apiKey}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(url, { signal: controller.signal });
      const data = await res.json();
      clearTimeout(timeout);
      if (data['Note'] || data['Information']) return { limited: true };
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

  const refreshPrices = useCallback(async () => {
    if (isFetchingRef.current) return;
    const openChains = chains.filter(c => c.status === 'open');
    const tickers = [...new Set(openChains.map(c => c.ticker))];
    if (!tickers.length) return;
    const apiKey = settings.avKey;
    if (!apiKey) { setPricesConnected(false); return; }

    isFetchingRef.current = true;
    setFetching(true);
    limitReachedRef.current = false;
    setApiLimitReached(false);
    let anySuccess = false;

    for (let i = 0; i < tickers.length; i++) {
      if (i > 0) await new Promise(r => setTimeout(r, AV_DELAY_MS));
      if (limitReachedRef.current) break;
      const result = await fetchPrice(tickers[i], apiKey);
      if (result?.limited) {
        limitReachedRef.current = true;
        setApiLimitReached(true);
        break;
      }
      if (result) {
        anySuccess = true;
        setStockPrice(result.ticker, result);
      }
    }

    isFetchingRef.current = false;
    setFetching(false);
    setPricesConnected(anySuccess);
    setLastRefresh(new Date().toISOString());
  }, [chains, settings.avKey, fetchPrice, setFetching, setStockPrice, setPricesConnected, setLastRefresh, setApiLimitReached]);

  useEffect(() => {
    refreshPrices();
    refreshTimerRef.current = setInterval(refreshPrices, REFRESH_INTERVAL_MS);
    return () => clearInterval(refreshTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const alertCount = getRuleAlerts(chains, stockPrices, settings).length;
  const lastRefreshTime = lastRefresh
    ? new Date(lastRefresh).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  if (showSettings) {
    return (
      <div className="flex flex-col min-h-screen bg-bg text-primary-text font-mono">
        <header
          className="flex items-center justify-between px-4 py-3 border-b shrink-0"
          style={{ borderColor: 'rgba(255,255,255,0.07)', background: '#0D1410' }}
        >
          <button
            onClick={() => setShowSettings(false)}
            className="text-muted-text text-sm font-bold"
            style={{ minHeight: 44, minWidth: 60 }}
          >
            ← Back
          </button>
          <span className="text-primary-green font-bold text-sm tracking-widest">SETTINGS</span>
          <div style={{ width: 60 }} />
        </header>
        <main className="flex-1 overflow-y-auto pb-6">
          <SettingsTab />
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-bg text-primary-text font-mono">
      {/* Top bar */}
      <header
        className="flex items-center justify-between px-4 py-3 border-b shrink-0"
        style={{ borderColor: 'rgba(255,255,255,0.07)', background: '#0D1410' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-primary-green font-bold text-sm tracking-widest">⚙ WHEEL</span>
          <span className="text-muted-text text-xs">TERMINAL</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`w-2 h-2 rounded-full ${pricesConnected ? 'bg-primary-green animate-pulse-green' : 'bg-muted-text opacity-40'}`} />
          <span className="text-muted-text text-xs">
            {isFetching ? 'loading…' : lastRefreshTime || 'no API'}
          </span>
          <button
            onClick={() => refreshPrices()}
            disabled={isFetching}
            className="flex items-center justify-center text-muted-text hover:text-primary-green transition-colors"
            style={{ minWidth: 36, minHeight: 44 }}
            aria-label="Refresh prices"
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
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center justify-center text-muted-text hover:text-primary-text transition-colors"
            style={{ minWidth: 36, minHeight: 44 }}
            aria-label="Settings"
          >
            <SettingsIcon size={15} />
          </button>
        </div>
      </header>

      {/* Banners */}
      {apiLimitReached && (
        <div className="shrink-0 px-4 py-2 text-xs font-bold text-center text-bg bg-warning-yellow">
          ⚠ Alpha Vantage daily limit — prices may be stale
        </div>
      )}
      {banner && (
        <div
          className={`shrink-0 px-4 py-2 text-xs font-bold text-center animate-fade-up ${
            banner.type === 'success' ? 'bg-primary-green text-bg'
              : banner.type === 'error' ? 'bg-danger-red text-white'
              : 'bg-warning-yellow text-bg'
          }`}
        >
          {banner.msg}
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-y-auto pb-20">
        {activeTab === 'dashboard' && <Dashboard key="dash" setActiveTab={setActiveTab} />}
        {activeTab === 'positions' && <Positions key="pos"  setActiveTab={setActiveTab} />}
        {activeTab === 'log'       && <TradeLogger key="log" setActiveTab={setActiveTab} />}
        {activeTab === 'scan'      && <ScanTab key="scan" />}
        {activeTab === 'analytics' && <Analytics key="analytics" />}
        {activeTab === 'alerts'    && <Alerts key="alerts" setActiveTab={setActiveTab} />}
      </main>

      {/* Bottom nav */}
      <nav
        className="fixed bottom-0 left-0 right-0 flex border-t z-50"
        style={{ borderColor: 'rgba(255,255,255,0.07)', background: '#0D1410' }}
      >
        {TABS.map(({ id, label, Icon: TabIcon }) => { // eslint-disable-line no-unused-vars
          const isActive = activeTab === id;
          const isLog = id === 'log';
          const showBadge = id === 'dashboard' && alertCount > 0;

          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 relative"
              style={{ minHeight: 56 }}
            >
              {isLog ? (
                <>
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center"
                    style={{ background: isActive ? '#00DC78' : 'rgba(0,220,120,0.15)' }}
                  >
                    <TabIcon size={18} color={isActive ? '#070C09' : '#00DC78'} />
                  </div>
                  <span style={{ color: isActive ? '#00DC78' : '#7A9A88', fontSize: 10 }}>{label}</span>
                </>
              ) : (
                <>
                  <div className="relative">
                    <TabIcon size={18} color={isActive ? '#00DC78' : '#7A9A88'} />
                    {showBadge && (
                      <span
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center font-bold"
                        style={{ background: '#ef4444', color: '#fff', fontSize: 9 }}
                      >
                        {alertCount > 9 ? '9+' : alertCount}
                      </span>
                    )}
                  </div>
                  <span style={{ color: isActive ? '#00DC78' : '#7A9A88', fontSize: 10 }}>{label}</span>
                </>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
