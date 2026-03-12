import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SAMPLE_CHAINS, SAMPLE_CLOSED_CHAINS, DEFAULT_SETTINGS } from '../utils/calculations';

const useStore = create(
  persist(
    (set) => ({
      // ── State ──────────────────────────────────────────────────────────────
      chains: [...SAMPLE_CHAINS, ...SAMPLE_CLOSED_CHAINS],
      settings: DEFAULT_SETTINGS,
      stockPrices: {},
      isFetching: false,
      pricesConnected: false,
      lastRefresh: null,
      apiLimitReached: false,
      banner: null,

      // ── Chain Actions ──────────────────────────────────────────────────────

      /** Add a brand new chain (open CSP or CC) */
      addChain: (chainData) => {
        const now = new Date().toISOString().split('T')[0];
        const id = Date.now();
        const legId = id + 1;
        const newChain = {
          id,
          ticker: (chainData.ticker || '').toUpperCase(),
          type: chainData.optionType || 'CSP',
          thesis: chainData.thesis || '',
          conviction: chainData.conviction || 'medium',
          status: 'open',
          openDate: now,
          closeDate: null,
          legs: [
            {
              id: legId,
              legType: 'open',
              optionType: chainData.optionType || 'CSP',
              strike: parseFloat(chainData.strike) || 0,
              expiration: chainData.expiration || '',
              contracts: parseInt(chainData.contracts) || 1,
              premiumCollected: parseFloat(chainData.premium) || 0,
              premiumPaid: 0,
              currentPremium: parseFloat(chainData.premium) || 0,
              filledAt: now,
              delta: parseFloat(chainData.delta) || null,
              notes: chainData.notes || '',
            },
          ],
        };
        set(s => ({ chains: [...s.chains, newChain] }));
        return newChain;
      },

      /** Log a roll: close current leg + open new leg */
      addRoll: (chainId, rollClose, rollOpen) => {
        const now = new Date().toISOString().split('T')[0];
        set(s => ({
          chains: s.chains.map(c => {
            if (c.id !== chainId) return c;
            const baseId = Date.now();
            const closeLeg = {
              id: baseId,
              legType: 'roll_close',
              optionType: rollClose.optionType || c.type,
              strike: parseFloat(rollClose.strike) || 0,
              expiration: rollClose.expiration || '',
              contracts: parseInt(rollClose.contracts) || 1,
              premiumCollected: 0,
              premiumPaid: parseFloat(rollClose.debit) || 0,
              currentPremium: 0,
              filledAt: now,
              delta: null,
              notes: rollClose.notes || '',
            };
            const openLeg = {
              id: baseId + 1,
              legType: 'roll_open',
              optionType: rollOpen.optionType || c.type,
              strike: parseFloat(rollOpen.strike) || 0,
              expiration: rollOpen.expiration || '',
              contracts: parseInt(rollOpen.contracts) || 1,
              premiumCollected: parseFloat(rollOpen.credit) || 0,
              premiumPaid: 0,
              currentPremium: parseFloat(rollOpen.credit) || 0,
              filledAt: now,
              delta: parseFloat(rollOpen.delta) || null,
              notes: rollOpen.notes || '',
            };
            return { ...c, legs: [...c.legs, closeLeg, openLeg] };
          }),
        }));
      },

      /** Close a chain */
      closeChain: (chainId, closePrice) => {
        const now = new Date().toISOString().split('T')[0];
        set(s => ({
          chains: s.chains.map(c => {
            if (c.id !== chainId) return c;
            const active = c.legs.filter(l => l.legType === 'open' || l.legType === 'roll_open');
            const activeLeg = active[active.length - 1];
            if (!activeLeg) return c;
            const closeLeg = {
              id: Date.now(),
              legType: 'close',
              optionType: activeLeg.optionType,
              strike: activeLeg.strike,
              expiration: activeLeg.expiration,
              contracts: activeLeg.contracts,
              premiumCollected: 0,
              premiumPaid: parseFloat(closePrice) || 0,
              currentPremium: 0,
              filledAt: now,
              delta: null,
              notes: 'Closed position',
            };
            return { ...c, status: 'closed', closeDate: now, legs: [...c.legs, closeLeg] };
          }),
        }));
      },

      /** Update a chain's active leg current premium (for P&L display) */
      updateCurrentPremium: (chainId, legId, currentPremium) => {
        set(s => ({
          chains: s.chains.map(c => {
            if (c.id !== chainId) return c;
            return {
              ...c,
              legs: c.legs.map(l =>
                l.id === legId ? { ...l, currentPremium: parseFloat(currentPremium) || 0 } : l
              ),
            };
          }),
        }));
      },

      /** Update chain metadata (thesis, conviction) */
      updateChain: (chainId, updates) => {
        set(s => ({
          chains: s.chains.map(c => c.id === chainId ? { ...c, ...updates } : c),
        }));
      },

      /** Delete a chain */
      deleteChain: (chainId) => {
        set(s => ({ chains: s.chains.filter(c => c.id !== chainId) }));
      },

      // ── Settings ───────────────────────────────────────────────────────────

      updateSettings: (updates) => {
        set(s => ({ settings: { ...s.settings, ...updates } }));
      },

      // ── Market Data ────────────────────────────────────────────────────────

      setStockPrice: (ticker, data) => {
        set(s => ({ stockPrices: { ...s.stockPrices, [ticker]: data } }));
      },

      setFetching: (v) => set({ isFetching: v }),
      setPricesConnected: (v) => set({ pricesConnected: v }),
      setLastRefresh: (v) => set({ lastRefresh: v }),
      setApiLimitReached: (v) => set({ apiLimitReached: v }),

      // ── Banner ─────────────────────────────────────────────────────────────

      showBanner: (msg, type = 'error') => {
        set({ banner: { msg, type } });
        setTimeout(() => set({ banner: null }), 5000);
      },
    }),
    {
      name: 'wheel-terminal-v2',
      // Only persist chains and settings (not transient UI state)
      partialize: (state) => ({
        chains: state.chains,
        settings: state.settings,
      }),
    }
  )
);

export default useStore;
