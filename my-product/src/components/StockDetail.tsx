import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Header } from "./header";
import { Footer } from "./footer";
import { ChevronLeft, Bookmark, Circle } from "lucide-react";
import { ErrorBoundary } from "./ErrorBoundary";
import { DARK, LIGHT, type MFTheme } from "./mutualfunds/theme";
import { LoadingBlock, ErrorBlock, EmptyBlock, SectionErrorFallback } from "./mutualfunds/StateBlocks";
import { useIsStockWishlisted, useStockWishlist } from "./stocks/useStockWishlist";
import {
  STOCK_API_BASE, extractErrorMessage, fmtPrice, fmtPct, fmtVolume,
  type StockQuote, type StockChartResponse, type StockChartPeriod,
} from "../lib/stocks";

const PERIODS: { key: StockChartPeriod; label: string }[] = [
  { key: "1d", label: "1D" }, { key: "1w", label: "1W" }, { key: "1m", label: "1M" },
  { key: "6m", label: "6M" }, { key: "1y", label: "1Y" }, { key: "5y", label: "5Y" },
];
const SLOW_LOAD_MS = 20000;

// Same closing-price line chart shape as MutualFundDetail's NavChart —
// candles carry OHLC but a line-on-close is the clearest read at this size.
function PriceChart({ candles, positive }: { candles: StockChartResponse["candles"]; positive: boolean }) {
  if (candles.length < 2) {
    return (
      <div style={{ height: "220px", display: "flex", alignItems: "center", justifyContent: "center", color: "#8b949e", fontSize: "13px" }}>
        Not enough data to draw a chart.
      </div>
    );
  }
  const width = 800, height = 220, pad = 12;
  const closes = candles.map(c => c.close);
  const min = Math.min(...closes), max = Math.max(...closes);
  const range = max - min || 1;
  const stepX = (width - pad * 2) / (candles.length - 1);
  const coords = candles.map((c, i) => {
    const x = pad + i * stepX;
    const y = pad + (height - pad * 2) * (1 - (c.close - min) / range);
    return `${x},${y}`;
  });
  const linePath = `M${coords.join(" L")}`;
  const areaPath = `${linePath} L${pad + (candles.length - 1) * stepX},${height - pad} L${pad},${height - pad} Z`;
  const color = positive ? "#22c55e" : "#ef4444";

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "220px", display: "block" }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="stockFillGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#stockFillGradient)" stroke="none" />
      <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function cleanCandles(candles: StockChartResponse["candles"] | undefined): StockChartResponse["candles"] {
  if (!Array.isArray(candles)) return [];
  return candles.filter(c =>
    isFiniteNumber(c?.timestamp) &&
    isFiniteNumber(c?.open) &&
    isFiniteNumber(c?.high) &&
    isFiniteNumber(c?.low) &&
    isFiniteNumber(c?.close)
  );
}

function DepthTable({ quote, T }: { quote: StockQuote; T: MFTheme }) {
  if (!quote.depth) {
    return <EmptyBlock T={T} message="Market depth is not available for this stock." />;
  }
  const rows = Math.max(quote.depth.bids.length, quote.depth.asks.length);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
      <div>
        <div style={{ fontSize: "11px", fontWeight: 700, color: "#22c55e", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Bid</div>
        {Array.from({ length: rows }).map((_, i) => {
          const b = quote.depth!.bids[i];
          return (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: "12px", borderBottom: `1px solid ${T.border}` }}>
              <span style={{ color: T.textBody, fontWeight: 600 }}>{b ? `₹${fmtPrice(b.price)}` : "—"}</span>
              <span style={{ color: T.textDim }}>{b ? fmtVolume(b.qty) : "—"}</span>
            </div>
          );
        })}
      </div>
      <div>
        <div style={{ fontSize: "11px", fontWeight: 700, color: "#ef4444", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Ask</div>
        {Array.from({ length: rows }).map((_, i) => {
          const a = quote.depth!.asks[i];
          return (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: "12px", borderBottom: `1px solid ${T.border}` }}>
              <span style={{ color: T.textBody, fontWeight: 600 }}>{a ? `₹${fmtPrice(a.price)}` : "—"}</span>
              <span style={{ color: T.textDim }}>{a ? fmtVolume(a.qty) : "—"}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatRow({ label, value, T }: { label: string; value: string; T: MFTheme }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ color: T.textMuted }}>{label}</span>
      <span style={{ fontWeight: 600, color: T.text }}>{value}</span>
    </div>
  );
}

export default function StockDetail() {
  const navigate = useNavigate();
  const { exchange, symbol } = useParams<{ exchange: string; symbol: string }>();
  const [isDark, setIsDark] = useState(() => localStorage.getItem("theme") !== "light");
  const T = isDark ? DARK : LIGHT;

  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(true);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteSlow, setQuoteSlow] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const [period, setPeriod] = useState<StockChartPeriod>("1m");
  const [chart, setChart] = useState<StockChartResponse | null>(null);
  const [chartLoading, setChartLoading] = useState(true);
  const [chartError, setChartError] = useState<string | null>(null);
  const [chartSlow, setChartSlow] = useState(false);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    if (!localStorage.getItem("authToken")) navigate("/", { replace: true });
  }, []);

  // Quote fetch + live polling every 3s while the market is open — the
  // fastest cadence that stays sane over plain REST polling; a true
  // websocket/streaming upgrade is documented as a follow-up in the backend
  // requirements doc, not implemented here since no such transport exists
  // anywhere else in this frontend yet.
  useEffect(() => {
    if (!exchange || !symbol) return;
    let cancelled = false;
    const controller = new AbortController();
    const slowId = window.setTimeout(() => {
      if (!cancelled) setQuoteSlow(true);
    }, SLOW_LOAD_MS);
    if (quote == null) setQuoteLoading(true);
    setQuoteSlow(false);
    setQuoteError(null);
    setNotFound(false);
    fetch(`${STOCK_API_BASE}/${encodeURIComponent(exchange)}/${encodeURIComponent(symbol)}/quote`, { signal: controller.signal })
      .then(async r => ({ status: r.status, ok: r.ok, body: await r.json() }))
      .then(({ status, ok, body }) => {
        if (cancelled) return;
        if (status === 404) { setNotFound(true); return; }
        if (!ok) { setQuoteError(extractErrorMessage(body, "Failed to load this stock.")); return; }
        setQuote(body as StockQuote);
        setQuoteError(null);
      })
      .catch(e => {
        if (cancelled) return;
        if (e?.name !== "AbortError") setQuoteError("Network error while loading this stock.");
      })
      .finally(() => {
        window.clearTimeout(slowId);
        if (!cancelled) {
          setQuoteLoading(false);
          setQuoteSlow(false);
        }
      });
    return () => { cancelled = true; window.clearTimeout(slowId); controller.abort(); };
  }, [exchange, symbol, retryTick]);

  useEffect(() => {
    if (!quote?.is_market_open) return;
    const id = setInterval(() => setRetryTick(t => t + 1), 3000);
    return () => clearInterval(id);
  }, [quote?.is_market_open]);

  useEffect(() => {
    if (!exchange || !symbol || notFound) return;
    let cancelled = false;
    const controller = new AbortController();
    const slowId = window.setTimeout(() => {
      if (!cancelled) setChartSlow(true);
    }, SLOW_LOAD_MS);
    setChartLoading(true);
    setChartSlow(false);
    setChartError(null);
    fetch(`${STOCK_API_BASE}/${encodeURIComponent(exchange)}/${encodeURIComponent(symbol)}/chart?period=${period}`, { signal: controller.signal })
      .then(async r => ({ ok: r.ok, body: await r.json() }))
      .then(({ ok, body }) => {
        if (cancelled) return;
        if (!ok) { setChartError(extractErrorMessage(body, "Failed to load chart data.")); return; }
        setChart(body as StockChartResponse);
      })
      .catch(e => {
        if (cancelled) return;
        if (e?.name !== "AbortError") setChartError("Network error while loading chart data.");
      })
      .finally(() => {
        window.clearTimeout(slowId);
        if (!cancelled) {
          setChartLoading(false);
          setChartSlow(false);
        }
      });
    return () => { cancelled = true; window.clearTimeout(slowId); controller.abort(); };
  }, [exchange, symbol, period, notFound]);

  const retry = useCallback(() => setRetryTick(t => t + 1), []);

  useEffect(() => {
    document.body.style.overflow = "auto";
    document.body.style.height = "auto";
    document.documentElement.style.overflow = "auto";
    document.documentElement.style.height = "auto";
    return () => {
      document.body.style.overflow = "";
      document.body.style.height = "";
      document.documentElement.style.overflow = "";
      document.documentElement.style.height = "";
    };
  }, []);

  useEffect(() => {
    document.body.style.backgroundColor = isDark ? "#0d1117" : "#f0f4f8";
    return () => { document.body.style.backgroundColor = ""; };
  }, [isDark]);

  const wishlisted = useIsStockWishlisted(symbol ?? "", exchange ?? "");
  const { toggle: toggleWishlist } = useStockWishlist();
  const handleToggleWishlist = useCallback(() => {
    if (!quote) return;
    toggleWishlist({
      symbol: quote.symbol,
      exchange: quote.exchange,
      name: quote.name,
      ltp: quote.ltp,
      change: quote.change,
      change_pct: quote.change_pct,
      volume: quote.volume,
    });
  }, [quote, toggleWishlist]);

  const toggleTheme = () => setIsDark(d => { const n = !d; localStorage.setItem("theme", n ? "dark" : "light"); return n; });
  const chartCandles = useMemo(() => cleanCandles(chart?.candles), [chart]);

  if (notFound) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: T.bg }}>
        <Header isDark={isDark} onToggleTheme={toggleTheme} />
        <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 24px" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "18px", fontWeight: 700, color: T.text, marginBottom: "8px" }}>Stock not found</div>
            <div style={{ fontSize: "13px", color: T.textMuted, marginBottom: "20px" }}>
              This symbol doesn't exist or isn't available on {exchange}.
            </div>
            <button
              onClick={() => navigate("/explore/stocks")}
              style={{
                padding: "10px 20px", borderRadius: "10px", fontSize: "13px", fontWeight: 700,
                background: T.activeBorder, border: "none", color: "#fff", cursor: "pointer",
              }}
            >
              Back to Stocks
            </button>
          </div>
        </main>
        <Footer isDark={isDark} />
      </div>
    );
  }

  const positive = (quote?.change_pct ?? 0) >= 0;
  const displaySymbol = quote?.symbol ?? symbol ?? "Stock";
  const displayExchange = quote?.exchange ?? exchange ?? "";
  const displayName = quote?.name ?? "Chart data";

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: T.bg }}>
      <Header isDark={isDark} onToggleTheme={toggleTheme} />

      <main style={{ flex: 1 }}>
        <div style={{ borderBottom: `1px solid ${T.border}`, background: T.headerBar, padding: "16px 24px" }}>
          <div style={{ maxWidth: "900px", margin: "0 auto", display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              onClick={() => navigate(-1)}
              style={{
                width: "32px", height: "32px", borderRadius: "8px",
                background: T.card, border: `1px solid ${T.border}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: T.textMuted, flexShrink: 0,
              }}
            >
              <ChevronLeft size={18} />
            </button>
            <span style={{ fontSize: "16px", fontWeight: 700, color: T.text }}>Stock Details</span>
          </div>
        </div>

        <div style={{ maxWidth: "900px", margin: "0 auto", padding: "24px", display: "flex", flexDirection: "column", gap: "24px" }}>

          <ErrorBoundary fallback={(error, reset) => <SectionErrorFallback error={error} onRetry={reset} T={T} />}>
            {quoteLoading && !quote ? (
              <LoadingBlock T={T} label={quoteSlow ? "Still waiting for stock data..." : "Loading stock..."} />
            ) : quoteError && !quote ? (
              <ErrorBlock T={T} message={quoteError} onRetry={retry} />
            ) : quote && (
              <>
                {quoteError && (
                  <div style={{ padding: "10px 12px", borderRadius: "10px", background: T.tabBg, border: `1px solid ${T.border}`, color: T.textMuted, fontSize: "12px", display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center" }}>
                    <span>{quoteError} Showing the latest loaded quote.</span>
                    <button
                      onClick={retry}
                      style={{ border: "none", background: "transparent", color: T.activeBorder, fontSize: "12px", fontWeight: 700, cursor: "pointer", padding: 0, flexShrink: 0 }}
                    >
                      Retry
                    </button>
                  </div>
                )}

                {/* Header */}
                <div>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
                    <div>
                      <div style={{ fontSize: "19px", fontWeight: 700, color: T.text, lineHeight: 1.4 }}>{quote.symbol}</div>
                      <div style={{ fontSize: "13px", color: T.textMuted, marginTop: "2px" }}>{quote.name}</div>
                    </div>
                    <button
                      onClick={handleToggleWishlist}
                      style={{
                        display: "flex", alignItems: "center", gap: "7px", padding: "8px 14px", borderRadius: "10px",
                        fontSize: "12px", fontWeight: 700, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap",
                        color: wishlisted ? T.activeBorder : T.textBody,
                        background: wishlisted ? `${T.activeBorder}1f` : T.card,
                        border: `1px solid ${wishlisted ? T.activeBorder + "55" : T.border}`,
                      }}
                    >
                      <Bookmark style={{ width: "14px", height: "14px" }} fill={wishlisted ? T.activeBorder : "none"} />
                      {wishlisted ? "In Watchlist" : "Add to Watchlist"}
                    </button>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "10px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 600, padding: "4px 10px", borderRadius: "100px", background: T.tabBg, border: `1px solid ${T.border}`, color: T.textBody }}>
                      {quote.exchange}
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", fontWeight: 600, color: T.textMuted }}>
                      <Circle style={{ width: "7px", height: "7px" }} fill={quote.is_market_open ? "#22c55e" : "#ef4444"} color={quote.is_market_open ? "#22c55e" : "#ef4444"} />
                      {quote.is_market_open ? "Live" : "Closed"}
                    </span>
                  </div>
                </div>

                {/* Chart card */}
                <div style={{ background: T.cardSolid, border: `1px solid ${T.borderMid}`, borderRadius: "16px", padding: "20px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "4px", flexWrap: "wrap", gap: "8px" }}>
                    <div>
                      <div style={{ fontSize: "28px", fontWeight: 700, color: T.text }}>
                        ₹{fmtPrice(quote.ltp)}
                      </div>
                      <div style={{ fontSize: "14px", fontWeight: 700, color: positive ? "#22c55e" : "#ef4444", marginTop: "4px" }}>
                        {positive ? "+" : ""}{fmtPrice(quote.change)} ({fmtPct(quote.change_pct)})
                      </div>
                    </div>
                    <div style={{ fontSize: "11px", color: T.textDim, textAlign: "right" }}>
                      As of {new Date(quote.last_updated).toLocaleTimeString("en-IN")}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "6px", margin: "14px 0" }}>
                    {PERIODS.map(p => (
                      <button
                        key={p.key}
                        onClick={() => setPeriod(p.key)}
                        style={{
                          padding: "6px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 700,
                          background: period === p.key ? T.activeBorder : T.tabBg,
                          border: `1px solid ${period === p.key ? T.activeBorder : T.border}`,
                          color: period === p.key ? "#fff" : T.textMuted, cursor: "pointer",
                        }}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  {chartLoading ? (
                    <LoadingBlock T={T} label={chartSlow ? "Still waiting for chart data..." : "Loading chart..."} />
                  ) : chartError ? (
                    <ErrorBlock T={T} message={chartError} onRetry={retry} />
                  ) : chart && chartCandles.length === 0 ? (
                    <EmptyBlock T={T} message="No chart data available for this stock." />
                  ) : chart ? (
                    <PriceChart candles={chartCandles} positive={positive} />
                  ) : null}
                </div>

                {/* Key stats */}
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: T.text, marginBottom: "10px" }}>Key Stats</div>
                  <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "12px", padding: "14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 24px", fontSize: "13px" }}>
                    <StatRow label="Open" value={`₹${fmtPrice(quote.open)}`} T={T} />
                    <StatRow label="Prev. Close" value={`₹${fmtPrice(quote.close)}`} T={T} />
                    <StatRow label="Day High" value={`₹${fmtPrice(quote.high)}`} T={T} />
                    <StatRow label="Day Low" value={`₹${fmtPrice(quote.low)}`} T={T} />
                    <StatRow label="Volume" value={fmtVolume(quote.volume)} T={T} />
                    <StatRow label="Avg. Price" value={quote.avg_price != null ? `₹${fmtPrice(quote.avg_price)}` : "—"} T={T} />
                    <StatRow label="52W High" value={quote.week_52_high != null ? `₹${fmtPrice(quote.week_52_high)}` : "—"} T={T} />
                    <StatRow label="52W Low" value={quote.week_52_low != null ? `₹${fmtPrice(quote.week_52_low)}` : "—"} T={T} />
                    <StatRow label="Market Cap" value={quote.market_cap != null ? `₹${fmtVolume(quote.market_cap)}` : "—"} T={T} />
                    <StatRow label="P/E Ratio" value={quote.pe_ratio != null ? quote.pe_ratio.toFixed(2) : "—"} T={T} />
                    <StatRow label="Upper Circuit" value={quote.upper_circuit != null ? `₹${fmtPrice(quote.upper_circuit)}` : "—"} T={T} />
                    <StatRow label="Lower Circuit" value={quote.lower_circuit != null ? `₹${fmtPrice(quote.lower_circuit)}` : "—"} T={T} />
                  </div>
                </div>

                {/* Market depth */}
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: T.text, marginBottom: "10px" }}>Market Depth</div>
                  <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "12px", padding: "14px" }}>
                    <DepthTable quote={quote} T={T} />
                  </div>
                </div>
              </>
            )}
          </ErrorBoundary>

          {!quote && (
            <ErrorBoundary fallback={(error, reset) => <SectionErrorFallback error={error} onRetry={reset} T={T} />}>
              <div style={{ background: T.cardSolid, border: `1px solid ${T.borderMid}`, borderRadius: "16px", padding: "20px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "4px", flexWrap: "wrap", gap: "8px" }}>
                  <div>
                    <div style={{ fontSize: "18px", fontWeight: 700, color: T.text }}>{displaySymbol}</div>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: T.textMuted, marginTop: "4px" }}>
                      {displayName}{displayExchange ? ` - ${displayExchange}` : ""}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "6px", margin: "14px 0", flexWrap: "wrap" }}>
                  {PERIODS.map(p => (
                    <button
                      key={p.key}
                      onClick={() => setPeriod(p.key)}
                      style={{
                        padding: "6px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 700,
                        background: period === p.key ? T.activeBorder : T.tabBg,
                        border: `1px solid ${period === p.key ? T.activeBorder : T.border}`,
                        color: period === p.key ? "#fff" : T.textMuted, cursor: "pointer",
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {chartLoading ? (
                  <LoadingBlock T={T} label={chartSlow ? "Still waiting for chart data..." : "Loading chart..."} />
                ) : chartError ? (
                  <ErrorBlock T={T} message={chartError} onRetry={retry} />
                ) : chart && chartCandles.length === 0 ? (
                  <EmptyBlock T={T} message="No chart data available for this stock." />
                ) : chart ? (
                  <PriceChart candles={chartCandles} positive={positive} />
                ) : null}
              </div>
            </ErrorBoundary>
          )}
        </div>
      </main>

      <Footer isDark={isDark} />
    </div>
  );
}
