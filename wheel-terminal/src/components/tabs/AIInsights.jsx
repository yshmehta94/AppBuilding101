import { useState, useCallback } from 'react';
import { Brain, RefreshCw } from 'lucide-react';
import { capturePct, pnlFor, daysTo, getStatus, getAdvice, calcPortfolio, fmt$, fmtPct } from '../../utils/calculations';

function buildPortfolioSummary(positions, stockPrices, settings, closedTrades) {
  const { totalPnl, totalCollateral, cashAvailable, monthlyProgress } = calcPortfolio(positions, stockPrices, settings);

  const posLines = positions.map((pos) => {
    const sp = stockPrices[pos.ticker];
    const advice = getAdvice(pos, sp?.price);
    const cap = capturePct(pos);
    const dte = daysTo(pos.expiry);
    return `- ${pos.ticker} ${pos.type} $${pos.strike} exp ${pos.expiry}: Status=${advice.status}, Price=${sp?.price ? '$' + sp.price.toFixed(2) : 'unknown'}, Capture=${cap.toFixed(1)}%, DTE=${dte}d, Delta=${pos.delta}, Rolls=${pos.rollCount}/3, P&L=${fmt$(pnlFor(pos))}`;
  }).join('\n');

  return `WHEEL STRATEGY PORTFOLIO SUMMARY — @wheelsniper
Capital: $${settings.totalCapital?.toLocaleString() || '100,000'} | Target: $${settings.monthlyTarget?.toLocaleString() || '3,500'}/mo
Monthly Progress: ${fmtPct(monthlyProgress)} (${fmt$(totalPnl)} of $${settings.monthlyTarget || 3500})
Deployed: ${fmt$(totalCollateral)} | Cash Available: ${fmt$(cashAvailable)}

OPEN POSITIONS (${positions.length}):
${posLines || 'None'}

Closed Trades (YTD): ${closedTrades.length}

Please analyze this portfolio and provide:
1. Which positions to prioritize this week and why
2. Patterns in performance or risk
3. Overall risk assessment
4. One specific, concrete recommendation for each open position
5. Portfolio-level insights for a $100K wheel strategy targeting $3,500/month`;
}

function renderResponse(text) {
  if (!text) return null;
  const lines = text.split('\n');
  return lines.map((line, i) => {
    if (line.startsWith('# ')) {
      return <h2 key={i} className="text-primary-green font-bold text-sm mt-4 mb-1">{line.slice(2)}</h2>;
    }
    if (line.startsWith('## ')) {
      return <h3 key={i} className="text-info-blue font-bold text-xs mt-3 mb-1">{line.slice(3)}</h3>;
    }
    if (line.startsWith('### ')) {
      return <h4 key={i} className="text-warning-yellow font-bold text-xs mt-2 mb-0.5">{line.slice(4)}</h4>;
    }
    if (line.startsWith('**') && line.endsWith('**')) {
      return <p key={i} className="text-primary-text font-bold text-xs my-0.5">{line.slice(2, -2)}</p>;
    }
    if (line.startsWith('- ') || line.startsWith('* ')) {
      return (
        <div key={i} className="flex items-start gap-2 my-0.5">
          <span className="text-primary-green text-xs mt-0.5">▸</span>
          <span className="text-xs text-primary-text">{line.slice(2)}</span>
        </div>
      );
    }
    if (line.match(/^\d+\./)) {
      return (
        <div key={i} className="flex items-start gap-2 my-0.5">
          <span className="text-muted-text text-xs shrink-0">{line.match(/^\d+\./)[0]}</span>
          <span className="text-xs text-primary-text">{line.replace(/^\d+\.\s*/, '')}</span>
        </div>
      );
    }
    if (line.trim() === '') return <div key={i} className="h-2" />;
    return <p key={i} className="text-xs text-primary-text leading-relaxed">{line}</p>;
  });
}

export default function AIInsights({ positions, stockPrices, settings, closedTrades, showBanner }) {
  const [analysis, setAnalysis] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState(null);

  const generateAnalysis = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setAnalysis('');

    const prompt = buildPortfolioSummary(positions, stockPrices, settings, closedTrades);

    try {
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
          system: 'You are an expert options wheel strategy analyst. Provide clear, actionable insights for a retail trader. Use plain text with markdown headers (##) and bullet points. Be specific with tickers and numbers. No generic advice.',
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      clearTimeout(timeout);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message || `API error ${res.status}`);
      }

      const data = await res.json();
      const text = data.content?.[0]?.text || 'No analysis returned.';
      setAnalysis(text);
      setLastAnalysis(new Date());
    } catch (err) {
      if (err.name === 'AbortError') {
        showBanner('AI request timed out after 8s. Try again.', 'error');
      } else {
        showBanner(`AI error: ${err.message}`, 'error');
      }
      setAnalysis('');
    } finally {
      setLoading(false);
    }
  }, [positions, stockPrices, settings, closedTrades, loading, showBanner]);

  return (
    <div className="animate-fade-up px-4 pt-4 pb-6 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain size={16} color="#AA88FF" />
          <span className="text-xs uppercase tracking-widest text-muted-text">AI Portfolio Analysis</span>
        </div>
        {lastAnalysis && (
          <span className="text-muted-text text-xs">
            {lastAnalysis.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {/* Generate / Refresh Button */}
      <button
        onClick={generateAnalysis}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-sm"
        style={{
          background: loading ? 'rgba(170,136,255,0.2)' : '#AA88FF',
          color: loading ? '#AA88FF' : '#070C09',
          minHeight: 44,
        }}
      >
        {loading ? (
          <>
            <span className="spinner" style={{ borderColor: 'rgba(170,136,255,0.3)', borderTopColor: '#AA88FF' }} />
            Analyzing portfolio…
          </>
        ) : (
          <>
            <RefreshCw size={15} />
            {analysis ? 'Refresh Analysis' : 'Generate Analysis'}
          </>
        )}
      </button>

      {/* Portfolio Context Preview */}
      <div className="rounded-lg p-3 card-border" style={{ background: '#0D1410' }}>
        <div className="text-xs text-muted-text mb-2 uppercase tracking-widest">Analyzing</div>
        <div className="flex gap-4 flex-wrap">
          <span className="text-xs text-primary-text">{positions.length} open positions</span>
          <span className="text-xs text-primary-text">{closedTrades.length} closed trades</span>
          <span className="text-xs text-primary-text">{Object.keys(stockPrices).length} prices loaded</span>
        </div>
      </div>

      {/* Analysis Result */}
      {analysis && (
        <div
          className="rounded-lg p-4 card-border animate-fade-up"
          style={{ background: '#0D1410' }}
        >
          <div>{renderResponse(analysis)}</div>
        </div>
      )}

      {!analysis && !loading && (
        <div className="rounded-lg p-8 card-border flex flex-col items-center gap-3" style={{ background: '#0D1410' }}>
          <Brain size={32} color="#AA88FF" style={{ opacity: 0.5 }} />
          <p className="text-muted-text text-xs text-center leading-relaxed">
            Click "Generate Analysis" to get AI-powered insights about your portfolio, including specific recommendations for each position.
          </p>
        </div>
      )}

      {/* Disclaimer */}
      <div
        className="rounded-lg p-3"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <p className="text-muted-text text-xs leading-relaxed">
          ⚠ Disclaimer: AI analysis is generated for informational purposes only and does not constitute financial advice. Always conduct your own research and consult a licensed financial advisor before making investment decisions.
        </p>
      </div>
    </div>
  );
}
