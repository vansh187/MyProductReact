import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Header } from "./header";
import { Footer } from "./footer";
import { ChevronLeft, TrendingUp, TrendingDown, Activity, Eye, Zap, PieChart, Bookmark, Settings, MoreVertical } from "lucide-react";

const DARK = {
  bg:           "#0d1117",
  card:         "rgba(22,27,34,0.9)",
  cardSolid:    "#161b22",
  border:       "rgba(255,255,255,0.07)",
  borderMid:    "rgba(255,255,255,0.12)",
  text:         "#e6edf3",
  textMuted:    "#8b949e",
  textDim:      "#6e7681",
  textBody:     "#c9d1d9",
  sidebarBg:    "rgba(13,17,23,0.8)",
  headerBar:    "rgba(13,17,23,0.95)",
};

const LIGHT = {
  bg:           "#f0f4f8",
  card:         "rgba(255,255,255,0.95)",
  cardSolid:    "#ffffff",
  border:       "rgba(0,0,0,0.08)",
  borderMid:    "rgba(0,0,0,0.12)",
  text:         "#0f172a",
  textMuted:    "#64748b",
  textDim:      "#94a3b8",
  textBody:     "#334155",
  sidebarBg:    "rgba(240,244,248,0.8)",
  headerBar:    "rgba(240,244,248,0.97)",
};

const BASE_URL = "https://api.primepiptrade.com";

interface Tick {
  timestamp: number;
  price: number;
}

interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface MarketIndex {
  name: string;
  stock_code: string;
  value: number;
  change: number;
  change_pct: number;
}

interface MarketData {
  market_status: string;
  indices: MarketIndex[];
}

interface IndexData {
  name: string;
  symbol: string;
  value: number;
  change: number;
  change_pct: number;
}

const TOOLS = [
  { icon: TrendingUp, title: "Chart", id: "chart" },
  { icon: Activity, title: "Indicators", id: "indicators" },
  { icon: Eye, title: "Depth", id: "depth" },
  { icon: Zap, title: "Orders", id: "orders" },
  { icon: PieChart, title: "Holdings", id: "holdings" },
  { icon: Bookmark, title: "Watchlist", id: "watchlist" },
  { icon: Settings, title: "Settings", id: "settings" },
];

function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Symbols with a dedicated OHLC candle endpoint on the backend
const CANDLE_SLUG_MAP: Record<string, string> = {
  nifty: "nifty",
  nifty50: "nifty",
  banknifty: "banknifty",
  finnifty: "finnifty",
};

// Name variants to match against /api/market/indices for live tick updates
const INDEX_MATCH_VARIANTS: Record<string, string[]> = {
  nifty: ["nifty50", "nifty"],
  nifty50: ["nifty50", "nifty"],
  sensex: ["sensex"],
  banknifty: ["banknifty", "niftybank"],
  midcpnifty: ["midcapnifty", "niftymidcapselect", "midcpnifty"],
  finnifty: ["finnifty", "niftyfinancialservices"],
  indiavix: ["indiavix"],
};

// Timeframes the historical candle API can serve; anything finer (5s/15s/30s)
// has no broker-side equivalent and always uses live tick aggregation.
const HISTORICAL_TIMEFRAMES = new Set(["1m", "5m", "15m", "1h", "1d"]);

function normalizeCandle(raw: any): Candle | null {
  const rawTime = raw?.timestamp ?? raw?.time ?? raw?.t ?? raw?.datetime;
  const open = raw?.open ?? raw?.o;
  const high = raw?.high ?? raw?.h;
  const low = raw?.low ?? raw?.l;
  const close = raw?.close ?? raw?.c;
  if ([open, high, low, close].some(v => typeof v !== "number" || isNaN(v))) return null;

  let timestamp: number;
  if (typeof rawTime === "number") {
    timestamp = rawTime < 10_000_000_000 ? rawTime * 1000 : rawTime; // seconds vs ms epoch
  } else if (typeof rawTime === "string") {
    const parsed = new Date(rawTime).getTime();
    timestamp = isNaN(parsed) ? Date.now() : parsed;
  } else {
    timestamp = Date.now();
  }

  return { timestamp, open, high, low, close };
}

function CandleChart({ candles = [] }: { candles?: Candle[] }) {
  const displayCandles = candles.length > 0 ? candles : [
    { timestamp: 0, open: 23880, high: 24020, low: 23800, close: 23950 },
    { timestamp: 1, open: 23950, high: 24100, low: 23920, close: 24050 },
    { timestamp: 2, open: 24050, high: 24150, low: 24000, close: 24080 },
    { timestamp: 3, open: 24080, high: 24200, low: 24050, close: 24150 },
    { timestamp: 4, open: 24150, high: 24280, low: 24100, close: 24200 },
    { timestamp: 5, open: 24200, high: 24300, low: 24150, close: 24250 },
    { timestamp: 6, open: 24250, high: 24350, low: 24200, close: 24300 },
    { timestamp: 7, open: 24300, high: 24400, low: 24250, close: 24350 },
  ];

  // Chart plot area (fixed coordinate space, scales via viewBox)
  const PLOT_LEFT = 100;
  const PLOT_RIGHT = 1160;
  const PLOT_TOP = 30;
  const PLOT_BOTTOM = 320;
  const plotWidth = PLOT_RIGHT - PLOT_LEFT;
  const plotHeight = PLOT_BOTTOM - PLOT_TOP;

  const rawMin = Math.min(...displayCandles.map(c => c.low));
  const rawMax = Math.max(...displayCandles.map(c => c.high));
  const padding = Math.max((rawMax - rawMin) * 0.12, 5);
  const minPrice = rawMin - padding;
  const maxPrice = rawMax + padding;
  const range = maxPrice - minPrice || 1;

  const priceToY = (price: number) => PLOT_BOTTOM - ((price - minPrice) / range) * plotHeight;

  const n = displayCandles.length;
  const slotWidth = plotWidth / n;
  const candleWidth = Math.max(3, Math.min(26, slotWidth * 0.62));
  const xForIndex = (i: number) => PLOT_LEFT + (i + 0.5) * slotWidth;

  const lastCandle = displayCandles[displayCandles.length - 1];
  const lastClose = lastCandle?.close;
  const lastIsUp = lastCandle ? lastCandle.close >= lastCandle.open : true;

  // Show ~7 evenly spaced time labels
  const labelStep = Math.max(1, Math.round(n / 7));

  return (
    <svg
      viewBox="0 0 1200 360"
      style={{ width: "100%", height: "100%", background: "rgba(15,19,28,0.9)", borderRadius: "10px" }}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(59,130,246,0.06)" />
          <stop offset="100%" stopColor="rgba(139,92,246,0.02)" />
        </linearGradient>
      </defs>

      {/* Plot background */}
      <rect x={PLOT_LEFT} y={PLOT_TOP} width={plotWidth} height={plotHeight} fill="url(#bgGrad)" stroke="rgba(255,255,255,0.12)" strokeWidth="1" rx="6" />

      {/* Horizontal gridlines + price labels */}
      {[0, 1, 2, 3, 4, 5].map(i => {
        const y = PLOT_TOP + (i * plotHeight) / 5;
        const price = maxPrice - (i * range) / 5;
        return (
          <g key={`grid-${i}`}>
            <line x1={PLOT_LEFT} y1={y} x2={PLOT_RIGHT} y2={y} stroke="rgba(255,255,255,0.07)" strokeWidth="1" strokeDasharray="3,4" />
            <text x={PLOT_LEFT - 10} y={y} fontSize="13" fontWeight="600" fill="rgba(255,255,255,0.75)" textAnchor="end" dominantBaseline="middle">
              {price.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </text>
          </g>
        );
      })}

      {/* Current price dashed line */}
      {lastClose != null && (
        <g>
          <line
            x1={PLOT_LEFT} y1={priceToY(lastClose)} x2={PLOT_RIGHT} y2={priceToY(lastClose)}
            stroke={lastIsUp ? "#22c55e" : "#ef4444"} strokeWidth="1" strokeDasharray="5,4" opacity="0.7"
          />
          <rect
            x={PLOT_RIGHT - 68} y={priceToY(lastClose) - 11} width="66" height="22" rx="4"
            fill={lastIsUp ? "#16a34a" : "#dc2626"}
          />
          <text x={PLOT_RIGHT - 35} y={priceToY(lastClose)} fontSize="12" fontWeight="700" fill="#fff" textAnchor="middle" dominantBaseline="middle">
            {lastClose.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
          </text>
        </g>
      )}

      {/* Axes */}
      <line x1={PLOT_LEFT} y1={PLOT_TOP} x2={PLOT_LEFT} y2={PLOT_BOTTOM} stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
      <line x1={PLOT_LEFT} y1={PLOT_BOTTOM} x2={PLOT_RIGHT} y2={PLOT_BOTTOM} stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />

      {/* Candles */}
      {displayCandles.map((candle, i) => {
        const x = xForIndex(i);
        const highY = priceToY(candle.high);
        const lowY = priceToY(candle.low);
        const openY = priceToY(candle.open);
        const closeY = priceToY(candle.close);

        const isFlat = candle.close === candle.open;
        const isUp = candle.close > candle.open;
        const bodyColor = isFlat ? "#9ca3af" : isUp ? "#22c55e" : "#ef4444";
        const borderColor = isFlat ? "#6b7280" : isUp ? "#16a34a" : "#dc2626";
        const bodyTop = Math.min(openY, closeY);
        const bodyHeight = Math.max(Math.abs(closeY - openY), 2);

        return (
          <g key={i}>
            <line x1={x} y1={highY} x2={x} y2={lowY} stroke={borderColor} strokeWidth={Math.max(1, candleWidth * 0.08)} strokeLinecap="round" />
            <rect
              x={x - candleWidth / 2}
              y={bodyTop}
              width={candleWidth}
              height={bodyHeight}
              fill={bodyColor}
              stroke={borderColor}
              strokeWidth="1"
              rx="1.5"
            />
          </g>
        );
      })}

      {/* Time labels */}
      {displayCandles.map((candle, i) => {
        if (i % labelStep !== 0) return null;
        const x = xForIndex(i);
        const timeStr = new Date(candle.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
        return (
          <text key={`time-${i}`} x={x} y={PLOT_BOTTOM + 20} fontSize="12" fontWeight="500" fill="rgba(255,255,255,0.65)" textAnchor="middle">
            {timeStr}
          </text>
        );
      })}
    </svg>
  );
}

export default function FuturesTerminal() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isDark, setIsDark] = useState(() => localStorage.getItem("theme") !== "light");
  const [activeTool, setActiveTool] = useState<string>("chart");
  const [timeframe, setTimeframe] = useState<string>("20s");

  const T = isDark ? DARK : LIGHT;

  const indexData: IndexData = (location.state as any)?.indexData ?? {
    name: "NIFTY 50",
    symbol: "NIFTY",
    value: 24320.00,
    change: 2.30,
    change_pct: 0.01,
  };

  const symbolKey = normalizeName(indexData.symbol || "");
  const candleSlug = CANDLE_SLUG_MAP[symbolKey];
  const cacheKey = `cachedCandles_${symbolKey || "unknown"}_${timeframe}`;

  const [candles, setCandles] = useState<Candle[]>(() => {
    try {
      const cached = localStorage.getItem(cacheKey);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const isUp = indexData.change >= 0;
  const changeColor = isUp ? "#22c55e" : "#ef4444";

  useEffect(() => {
    if (!localStorage.getItem("authToken")) navigate("/", { replace: true });
  }, []);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    document.body.style.height = "100vh";
    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.height = "100vh";
    return () => {
      document.body.style.overflow = "auto";
      document.body.style.height = "auto";
      document.documentElement.style.overflow = "auto";
      document.documentElement.style.height = "auto";
    };
  }, []);

  useEffect(() => {
    document.body.style.backgroundColor = isDark ? "#0d1117" : "#f0f4f8";
    return () => { document.body.style.backgroundColor = ""; };
  }, [isDark]);

  // Whether real OHLC bars are currently coming from the historical candle
  // endpoint. While true, the tick-aggregation fallback below must not
  // overwrite `candles` with its own (lower-fidelity) reconstruction.
  const usingHistoricalRef = useRef(false);

  // Historical OHLC candles from the backend's broker-backed candle endpoint
  // (only available for symbols in CANDLE_SLUG_MAP, at minute+ timeframes).
  useEffect(() => {
    if (!candleSlug || !HISTORICAL_TIMEFRAMES.has(timeframe)) {
      usingHistoricalRef.current = false;
      return;
    }

    let cancelled = false;

    const fetchHistorical = () => {
      fetch(`${BASE_URL}/api/market/${candleSlug}/candles?timeframe=${encodeURIComponent(timeframe)}&limit=100`)
        .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); })
        .then((data: { candles?: unknown[] }) => {
          if (cancelled) return;
          const normalized = Array.isArray(data.candles)
            ? (data.candles.map(normalizeCandle).filter(Boolean) as Candle[])
            : [];
          if (normalized.length > 0) {
            usingHistoricalRef.current = true;
            setCandles(normalized);
            localStorage.setItem(cacheKey, JSON.stringify(normalized));
          } else {
            // Broker has no candle data yet (e.g. "no_candle_data") — let the
            // tick-aggregation fallback below keep the chart populated.
            usingHistoricalRef.current = false;
          }
        })
        .catch(e => {
          console.error("[FuturesTerminal] candles fetch error:", e);
          usingHistoricalRef.current = false;
        });
    };

    fetchHistorical();
    const id = setInterval(fetchHistorical, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [candleSlug, timeframe, cacheKey]);

  // Fallback: aggregate live ticks from the indices stream into candles.
  // This is the only data source for symbols without a candle endpoint
  // (Sensex, Midcap Nifty, India VIX) or sub-minute timeframes (5s/15s/30s),
  // and it also keeps the chart populated while historical data is pending.
  useEffect(() => {
    const matchVariants = INDEX_MATCH_VARIANTS[symbolKey] ?? [symbolKey];
    const es = new EventSource(`${BASE_URL}/api/market/indices/stream`);
    const ticksArray: Tick[] = [];

    const aggregateCandles = () => {
      if (ticksArray.length === 0 || usingHistoricalRef.current) return;

      const timeframeMs: Record<string, number> = {
        "20s": 20 * 1000,
        "30s": 30 * 1000,
        "1m": 60 * 1000,
        "5m": 5 * 60 * 1000,
        "15m": 15 * 60 * 1000,
        "1h": 60 * 60 * 1000,
        "1d": 24 * 60 * 60 * 1000,
      };

      const interval = timeframeMs[timeframe] || 60000;
      const grouped: Record<number, Tick[]> = {};

      ticksArray.forEach(tick => {
        const candleTime = Math.floor(tick.timestamp / interval) * interval;
        if (!grouped[candleTime]) grouped[candleTime] = [];
        grouped[candleTime].push(tick);
      });

      const candlesArray = Object.entries(grouped)
        .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
        .map(([time, ticks]) => {
          const prices = ticks.map(t => t.price);
          return {
            timestamp: parseInt(time),
            open: ticks[0].price,
            high: Math.max(...prices),
            low: Math.min(...prices),
            close: ticks[ticks.length - 1].price,
          };
        })
        .slice(-50); // Show last 50 candles (recent data). Full day view will be added later with filters

      setCandles(candlesArray);
      localStorage.setItem(cacheKey, JSON.stringify(candlesArray));
    };

    es.onmessage = (event) => {
      try {
        const data: MarketData = JSON.parse(event.data);
        const matchedIndex = data.indices.find(i => {
          const normalized = normalizeName(i.name || "");
          return matchVariants.some(v => normalized === v || normalized.includes(v));
        });

        if (matchedIndex) {
          ticksArray.push({
            timestamp: Date.now(),
            price: matchedIndex.value,
          });

          // Keep all ticks for full trading day (5-sec updates × 6.5 hours = ~4,680 ticks)
          if (ticksArray.length > 10000) ticksArray.shift();

          aggregateCandles();
        }
      } catch (e) {
        console.error("[FuturesTerminal] Stream parse error:", e);
      }
    };

    es.onerror = () => {
      console.error("[FuturesTerminal] EventSource error - stream closed");
      es.close();
    };

    return () => es.close();
  }, [timeframe, symbolKey, cacheKey]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: T.bg }}>
      <Header
        isDark={isDark}
        onToggleTheme={() => setIsDark(d => { const n = !d; localStorage.setItem("theme", n ? "dark" : "light"); return n; })}
      />

      <main style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ── Left Sidebar: Tools ── */}
        <div style={{
          width: "80px", flexShrink: 0, background: T.sidebarBg,
          borderRight: `1px solid ${T.border}`,
          display: "flex", flexDirection: "column", alignItems: "center", paddingTop: "16px", paddingBottom: "16px",
          gap: "12px", overflowY: "auto",
        }}>
          {TOOLS.map(tool => {
            const Icon = tool.icon;
            const active = activeTool === tool.id;
            return (
              <button
                key={tool.id}
                onClick={() => setActiveTool(tool.id)}
                title={tool.title}
                style={{
                  width: "56px", height: "56px", borderRadius: "12px",
                  background: active ? "rgba(59,130,246,0.2)" : "transparent",
                  border: active ? `1px solid rgba(59,130,246,0.4)` : `1px solid ${T.border}`,
                  color: active ? "#3b82f6" : T.textMuted,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", transition: "all 0.2s",
                }}
                onMouseEnter={e => {
                  if (!active) (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(59,130,246,0.3)";
                }}
                onMouseLeave={e => {
                  if (!active) (e.currentTarget as HTMLButtonElement).style.borderColor = T.border;
                }}
              >
                <Icon size={22} />
              </button>
            );
          })}
        </div>

        {/* ── Main Content Area ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* ── Top Header: Symbol Info ── */}
          <div style={{
            borderBottom: `1px solid ${T.border}`, background: T.headerBar,
            padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <button
                onClick={() => navigate(-1)}
                style={{
                  width: "32px", height: "32px", borderRadius: "8px",
                  background: T.card, border: `1px solid ${T.border}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", color: T.textMuted,
                }}
              >
                <ChevronLeft size={18} />
              </button>

              <div>
                <div style={{ fontSize: "15px", fontWeight: 700, color: T.text }}>
                  {indexData.name}
                </div>
                <div style={{ fontSize: "11px", color: T.textMuted }}>NSE · {timeframe}</div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "18px", fontWeight: 700, color: T.text }}>
                  ₹{indexData.value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: "12px", fontWeight: 600, color: changeColor }}>
                  {isUp ? "+" : ""}{indexData.change.toFixed(2)} ({isUp ? "+" : ""}{indexData.change_pct.toFixed(2)}%)
                </div>
              </div>
              <button style={{ background: "none", border: "none", color: T.textMuted, cursor: "pointer" }}>
                <MoreVertical size={18} />
              </button>
            </div>
          </div>

          {/* ── Chart Area ── */}
          <div style={{ flex: 1, display: "flex", gap: "12px", overflow: "hidden", padding: "16px 12px 12px 12px" }}>

            {/* Chart */}
            <div style={{
              flex: 1, background: T.cardSolid, border: `1px solid ${T.borderMid}`,
              borderRadius: "14px", padding: "20px 16px", overflow: "hidden",
              display: "flex", flexDirection: "column",
            }}>
              <div style={{ fontSize: "11px", color: T.textMuted, marginBottom: "12px", display: "flex", gap: "8px" }}>
                {["20s", "30s", "1m", "5m", "15m", "1h", "1d"].map(tf => (
                  <button
                    key={tf}
                    onClick={() => setTimeframe(tf)}
                    style={{
                      background: "none",
                      border: "none",
                      color: timeframe === tf ? "#3b82f6" : T.textMuted,
                      cursor: "pointer",
                      fontSize: "12px",
                      fontWeight: timeframe === tf ? 600 : 400,
                    }}
                  >
                    {tf}
                  </button>
                ))}
              </div>
              <div style={{ flex: 1, minHeight: 0, width: "100%" }}>
                <CandleChart candles={candles} />
              </div>
            </div>

            {/* Right Panel: Options Chain */}
            <div style={{
              width: "320px", flexShrink: 0, background: T.cardSolid, border: `1px solid ${T.borderMid}`,
              borderRadius: "14px", padding: "16px", overflow: "auto",
              display: "flex", flexDirection: "column", gap: "12px",
            }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: T.text, paddingBottom: "8px", borderBottom: `1px solid ${T.border}` }}>
                Options Chain (Expiry: 07 Jul)
              </div>

              {/* Call/Put Tabs */}
              <div style={{ display: "flex", gap: "6px" }}>
                <button style={{
                  flex: 1, padding: "6px", fontSize: "11px", fontWeight: 600,
                  background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)",
                  borderRadius: "6px", color: "#22c55e", cursor: "pointer",
                }}>
                  Call
                </button>
                <button style={{
                  flex: 1, padding: "6px", fontSize: "11px", fontWeight: 600,
                  background: T.border, border: `1px solid ${T.border}`,
                  borderRadius: "6px", color: T.textMuted, cursor: "pointer",
                }}>
                  Put
                </button>
              </div>

              {/* Call Options */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {[23800, 23850, 23900, 23950, 24000, 24050, 24100].map(strike => (
                  <div
                    key={strike}
                    style={{
                      background: T.cardSolid, border: `1px solid ${T.borderMid}`,
                      borderRadius: "8px", padding: "8px 10px", cursor: "pointer",
                      transition: "border-color 0.18s",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(59,130,246,0.4)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = T.borderMid; }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                      <span style={{ fontSize: "10px", color: T.textMuted }}>Strike {strike}</span>
                      <span style={{ fontSize: "11px", fontWeight: 600, color: T.text }}>₹{(Math.random() * 200 + 50).toFixed(2)}</span>
                    </div>
                    <div style={{ fontSize: "9px", color: T.textDim, display: "flex", justifyContent: "space-between" }}>
                      <span>IV: {(Math.random() * 20 + 15).toFixed(1)}%</span>
                      <span>OI: {Math.floor(Math.random() * 50000 + 10000)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>

      </main>

      <Footer isDark={isDark} />
    </div>
  );
}
