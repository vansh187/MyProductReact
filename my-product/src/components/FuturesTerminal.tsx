import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Header } from "./header";
import {
  ChevronLeft, TrendingUp, Activity, Eye, EyeOff, Zap, PieChart, Bookmark, Settings, MoreVertical,
  Crosshair, Slash, Minus, Ruler, Type, Magnet, Lock, Unlock, Trash2, ZoomIn, ZoomOut, Layers, Link2,
} from "lucide-react";
import {
  BASE_URL, normalizeName, INDEX_MATCH_VARIANTS,
  type Candle, type MarketData, type IndexData,
} from "../lib/fno";

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

const TOOLS = [
  { icon: TrendingUp, title: "Chart", id: "chart" },
  { icon: Activity, title: "Indicators", id: "indicators" },
  { icon: Eye, title: "Depth", id: "depth" },
  { icon: Zap, title: "Orders", id: "orders" },
  { icon: PieChart, title: "Holdings", id: "holdings" },
  { icon: Bookmark, title: "Watchlist", id: "watchlist" },
  { icon: Settings, title: "Settings", id: "settings" },
];

// The chart only ever aggregates at one fixed granularity — the backend
// pushes index snapshots roughly every 5-20s, so anything finer than 20s
// mostly produces single-tick (flat/doji) candles. No timeframe switcher
// is exposed in the UI; zoom/pan handle "seeing more or less history" instead.
const CHART_TIMEFRAME_MS = 20 * 1000;

// NSE cash/derivatives session is 09:15–15:30 (6h15m). At one candle per
// CHART_TIMEFRAME_MS, this is how many candles a full trading day produces —
// used as the default zoom level so the whole day is visible without the
// user having to zoom out manually. Early in the day, fewer candles simply
// exist yet, and the chart already clamps to whatever's actually available.
const FULL_DAY_VIEW_COUNT = Math.ceil(((15 * 60 + 30) - (9 * 60 + 15)) * 60 * 1000 / CHART_TIMEFRAME_MS);

const MARKET_OPEN_MIN = 9 * 60 + 15;
const MARKET_CLOSE_MIN = 15 * 60 + 30;

const IST_TIME_ZONE = "Asia/Kolkata";

// NSE market hours are always IST, regardless of the trader's machine/browser
// timezone. Using Date.getHours()/getMinutes() here would read the LOCAL
// system timezone — on any machine not already set to IST, that silently
// excludes every real candle (they'd never fall inside 09:15–15:30 local
// time), leaving the chart to fall back to placeholder data. Intl with an
// explicit timeZone sidesteps the local clock entirely.
function getISTParts(ts: number): { hours: number; minutes: number; year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST_TIME_ZONE,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(ts));
  const map: Record<string, string> = {};
  parts.forEach(p => { map[p.type] = p.value; });
  return {
    hours: parseInt(map.hour, 10),
    minutes: parseInt(map.minute, 10),
    year: parseInt(map.year, 10),
    month: parseInt(map.month, 10),
    day: parseInt(map.day, 10),
  };
}

// The chart should only ever show candles from the live NSE session — no
// pre/post-market noise on the x-axis.
function isWithinMarketHours(ts: number): boolean {
  const { hours, minutes } = getISTParts(ts);
  const mins = hours * 60 + minutes;
  return mins >= MARKET_OPEN_MIN && mins <= MARKET_CLOSE_MIN;
}

// IST YYYY-MM-DD, used to scope the candle cache to "today" (in the market's
// timezone, not the trader's local one) so a stale cache from a previous
// session doesn't bleed yesterday's candles into today's chart.
function istDateKey(ts: number): string {
  const { year, month, day } = getISTParts(ts);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Only these three underlyings have a historical-candles endpoint deployed
// (per the backend team). Others (midcpnifty, sensex, indiavix) fall back to
// live-tick-only + the day-summary empty state.
const CANDLE_SLUG_MAP: Record<string, string> = {
  nifty: "nifty", nifty50: "nifty",
  banknifty: "banknifty",
  finnifty: "finnifty",
};

// The exact response schema has never been observed with real data (the
// endpoint has only ever returned `no_candle_data` in testing), so this
// tries several plausible field-name conventions (our own API's likely
// camelCase, and Shoonya TPSeries-style short codes it may be proxying) and
// only accepts entries where every field parses to a real number/timestamp.
// The backend's actual format, confirmed from a live response: "DD-MM-YYYY
// HH:mm:ss", already expressed in IST (e.g. "03-07-2026 09:15:00"). This is
// NOT reliably parseable by Date.parse() — it's ambiguous with MM-DD-YYYY and
// commonly comes back as NaN or the wrong date, which silently dropped every
// backfilled candle. Parse it explicitly instead of guessing.
function parseISTTimestamp(s: string): number | null {
  const m = s.match(/^(\d{2})-(\d{2})-(\d{4})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, dd, mm, yyyy, hh, min, ss] = m;
  // Build the UTC instant corresponding to these IST wall-clock components.
  return Date.UTC(+yyyy, +mm - 1, +dd, +hh, +min, +ss) - 5.5 * 60 * 60 * 1000;
}

function normalizeHistoricalCandle(raw: any): Candle | null {
  const rawTime = raw?.timestamp ?? raw?.time ?? raw?.t;
  let timestamp: number | null = null;
  if (typeof rawTime === "number") {
    timestamp = rawTime < 1e12 ? rawTime * 1000 : rawTime;
  } else if (typeof rawTime === "string") {
    const istParsed = parseISTTimestamp(rawTime);
    if (istParsed != null) {
      timestamp = istParsed;
    } else {
      const parsed = Date.parse(rawTime);
      timestamp = isNaN(parsed) ? null : parsed;
    }
  }
  const open = Number(raw?.open ?? raw?.o ?? raw?.into);
  const high = Number(raw?.high ?? raw?.h ?? raw?.inth);
  const low = Number(raw?.low ?? raw?.l ?? raw?.intl);
  const close = Number(raw?.close ?? raw?.c ?? raw?.intc);
  if (timestamp == null || ![open, high, low, close].every(Number.isFinite)) return null;
  return { timestamp, open, high, low, close };
}

type ChartTool = "cursor" | "trendline" | "horizontal" | "measure" | "text";

type Drawing =
  | { id: string; type: "trendline"; a: { t: number; p: number }; b: { t: number; p: number } }
  | { id: string; type: "horizontal"; price: number }
  | { id: string; type: "measure"; a: { t: number; p: number }; b: { t: number; p: number } }
  | { id: string; type: "text"; t: number; p: number; text: string };

function makeDrawingId(): string {
  return `d_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

const MIN_VIEW_COUNT = 10;

// Today's day-level range (open/high/low/last) — this is the one thing the
// backend always has, even after market close, via /api/market/indices. It's
// shown as an honest reference when there's no intraday candle history yet
// (see the empty-state note below for why that can happen).
export interface DaySummary {
  open: number;
  high: number;
  low: number;
  value: number;
}

interface CandleChartProps {
  candles: Candle[];
  daySummary: DaySummary | null;
  chartTool: ChartTool;
  drawings: Drawing[];
  drawingsVisible: boolean;
  drawingsLocked: boolean;
  snapEnabled: boolean;
  chartStyle: "candles" | "line";
  viewCount: number;
  viewOffset: number;
  onViewCountChange: (n: number) => void;
  onViewOffsetChange: (n: number) => void;
  onAddDrawing: (d: Drawing) => void;
}

function CandleChart({
  candles, daySummary, chartTool, drawings, drawingsVisible, drawingsLocked, snapEnabled,
  chartStyle, viewCount, viewOffset, onViewCountChange, onViewOffsetChange, onAddDrawing,
}: CandleChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ startClientX: number; startOffset: number } | null>(null);
  const [crosshair, setCrosshair] = useState<{ index: number; time: number; price: number } | null>(null);
  const [pendingPoint, setPendingPoint] = useState<{ t: number; p: number } | null>(null);

  // The viewBox always matches the SVG's actual rendered pixel size (tracked via
  // ResizeObserver), so the chart fills whatever space its container gives it —
  // no letterboxing, no distortion — and grows/shrinks with the window.
  const [size, setSize] = useState({ width: 1200, height: 600 });
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const ro = new ResizeObserver(entries => {
      const rect = entries[0]?.contentRect;
      if (rect && rect.width > 0 && rect.height > 0) {
        setSize({ width: rect.width, height: rect.height });
      }
    });
    ro.observe(svg);
    return () => ro.disconnect();
  }, []);

  const { width: W, height: H } = size;
  const PLOT_LEFT = 64;
  const PLOT_RIGHT = W - 24;
  const PLOT_TOP = 34;
  const PLOT_BOTTOM = H - 36;

  // Only real market-hours candles are shown — filters out any pre/post-market
  // ticks or stale out-of-session candles that might already be cached.
  const marketCandles = candles.filter((c: Candle) => isWithinMarketHours(c.timestamp));
  const source: Candle[] = marketCandles;
  const total = source.length;

  // No candles exist yet — this happens when the chart is opened without any
  // session having been captured client-side today (there's no backend
  // historical intraday feed to backfill from). Show real numbers where we
  // have them (today's day-level range, always available) instead of a fake
  // placeholder chart.
  if (total === 0) {
    return (
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "100%", background: "rgba(15,19,28,0.9)", borderRadius: "10px" }}
      >
        <text x={W / 2} y={H / 2 - (daySummary ? 14 : 0)} textAnchor="middle" fontSize="14" fontWeight="700" fill="rgba(255,255,255,0.6)">
          No intraday candles captured today yet
        </text>
        {daySummary && (
          <>
            <text x={W / 2} y={H / 2 + 12} textAnchor="middle" fontSize="13" fontWeight="600" fill="rgba(255,255,255,0.45)">
              Today's range — O {daySummary.open.toLocaleString("en-IN")} · H {daySummary.high.toLocaleString("en-IN")} · L {daySummary.low.toLocaleString("en-IN")} · LTP {daySummary.value.toLocaleString("en-IN")}
            </text>
            <text x={W / 2} y={H / 2 + 34} textAnchor="middle" fontSize="11" fontWeight="500" fill="rgba(255,255,255,0.32)">
              Live candles build while this chart stays open during market hours (09:15–15:30 IST)
            </text>
          </>
        )}
      </svg>
    );
  }
  const effectiveViewCount = Math.max(MIN_VIEW_COUNT, Math.min(viewCount, Math.max(total, MIN_VIEW_COUNT)));
  const maxOffset = Math.max(0, total - effectiveViewCount);
  const clampedOffset = Math.max(0, Math.min(viewOffset, maxOffset));
  const endIdx = total - clampedOffset;
  const startIdx = Math.max(0, endIdx - effectiveViewCount);
  const visibleCandles = source.slice(startIdx, endIdx);
  const n = Math.max(1, visibleCandles.length);

  const plotWidth = PLOT_RIGHT - PLOT_LEFT;
  const plotHeight = PLOT_BOTTOM - PLOT_TOP;

  const rawMin = Math.min(...visibleCandles.map(c => c.low));
  const rawMax = Math.max(...visibleCandles.map(c => c.high));
  const padding = Math.max((rawMax - rawMin) * 0.12, 5);
  const minPrice = rawMin - padding;
  const maxPrice = rawMax + padding;
  const range = maxPrice - minPrice || 1;

  const priceToY = (price: number) => PLOT_BOTTOM - ((price - minPrice) / range) * plotHeight;
  const slotWidth = plotWidth / n;
  const candleWidth = Math.max(2, Math.min(26, slotWidth * 0.62));
  const xForIndex = (i: number) => PLOT_LEFT + (i + 0.5) * slotWidth;
  const xForTimestamp = (t: number): number | null => {
    const idx = visibleCandles.findIndex(c => c.timestamp === t);
    return idx === -1 ? null : xForIndex(idx);
  };

  const lastCandle = visibleCandles[visibleCandles.length - 1];
  const lastClose = lastCandle?.close;
  const lastIsUp = lastCandle ? lastCandle.close >= lastCandle.open : true;

  // OHLC readout: shows the candle under the pointer as the crosshair moves,
  // and falls back to the latest candle when the pointer isn't over the chart.
  const hoveredCandle = crosshair ? visibleCandles[crosshair.index] : lastCandle;
  const hoveredChange = hoveredCandle ? hoveredCandle.close - hoveredCandle.open : 0;
  const hoveredChangePct = hoveredCandle && hoveredCandle.open !== 0 ? (hoveredChange / hoveredCandle.open) * 100 : 0;
  const hoveredColor = hoveredChange === 0 ? "#9ca3af" : hoveredChange > 0 ? "#22c55e" : "#ef4444";
  const fmtOhlc = (v: number) => v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const spanMs = visibleCandles.length > 1
    ? visibleCandles[visibleCandles.length - 1].timestamp - visibleCandles[0].timestamp
    : 0;
  const fmtTime = (t: number) => new Date(t).toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit",
    second: spanMs <= 5 * 60 * 1000 ? "2-digit" : undefined,
    hour12: false,
    timeZone: IST_TIME_ZONE,
  });
  // Day-of-month only (no month/year) — used as a separator label whenever
  // the visible candles cross a date boundary, so multi-day panning stays
  // readable without cluttering every single x-axis tick with a full date.
  const fmtDate = (t: number) => new Date(t).toLocaleDateString("en-IN", { day: "2-digit", timeZone: IST_TIME_ZONE });
  const labelStep = Math.max(1, Math.round(n / 7));

  function pixelToData(clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg || visibleCandles.length === 0) return { index: 0, time: Date.now(), price: minPrice };
    const rect = svg.getBoundingClientRect();
    const svgX = ((clientX - rect.left) / rect.width) * W;
    const svgY = ((clientY - rect.top) / rect.height) * H;
    const idxFloat = (svgX - PLOT_LEFT) / slotWidth - 0.5;
    const index = Math.max(0, Math.min(visibleCandles.length - 1, Math.round(idxFloat)));
    const time = visibleCandles[index].timestamp;
    const price = maxPrice - ((svgY - PLOT_TOP) / plotHeight) * range;
    return { index, time, price };
  }

  function snapPrice(index: number, rawPrice: number): number {
    const c = visibleCandles[index];
    if (!c) return rawPrice;
    const candidates = [c.open, c.high, c.low, c.close];
    return candidates.reduce((best, v) => (Math.abs(v - rawPrice) < Math.abs(best - rawPrice) ? v : best), candidates[0]);
  }

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const { index, time, price } = pixelToData(e.clientX, e.clientY);
    setCrosshair({ index, time, price: snapEnabled ? snapPrice(index, price) : price });

    if (dragRef.current) {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const dxSvg = ((e.clientX - dragRef.current.startClientX) / rect.width) * W;
      const dCandles = Math.round(dxSvg / slotWidth);
      onViewOffsetChange(Math.max(0, Math.min(dragRef.current.startOffset + dCandles, Math.max(0, total - effectiveViewCount))));
    }
  };

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    const { time, price, index } = pixelToData(e.clientX, e.clientY);
    const displayPrice = snapEnabled ? snapPrice(index, price) : price;

    if (chartTool === "cursor") {
      dragRef.current = { startClientX: e.clientX, startOffset: clampedOffset };
      return;
    }
    if (drawingsLocked) return;

    if (chartTool === "horizontal") {
      onAddDrawing({ id: makeDrawingId(), type: "horizontal", price: displayPrice });
    } else if (chartTool === "text") {
      const text = window.prompt("Note text:", "");
      if (text) onAddDrawing({ id: makeDrawingId(), type: "text", t: time, p: displayPrice, text });
    } else if (chartTool === "trendline" || chartTool === "measure") {
      if (!pendingPoint) {
        setPendingPoint({ t: time, p: displayPrice });
      } else {
        onAddDrawing({ id: makeDrawingId(), type: chartTool, a: pendingPoint, b: { t: time, p: displayPrice } });
        setPendingPoint(null);
      }
    }
  };

  const handleMouseUp = () => { dragRef.current = null; };
  const handleMouseLeave = () => { dragRef.current = null; setCrosshair(null); };

  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();

    // Trackpad two-finger horizontal swipe pans left/right instead of zooming.
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      const dCandles = Math.round(e.deltaX / slotWidth);
      if (dCandles !== 0) {
        onViewOffsetChange(Math.max(0, Math.min(clampedOffset + dCandles, maxOffset)));
      }
      return;
    }

    // Wheel scroll / trackpad pinch zooms anchored at the cursor, so the
    // candle under the pointer stays under the pointer (TradingView-style).
    const { index: cursorIndex } = pixelToData(e.clientX, e.clientY);
    const absIdx = startIdx + cursorIndex;
    const fraction = n > 0 ? cursorIndex / n : 0.5;
    const factor = e.deltaY > 0 ? 1.15 : 0.87;
    const newViewCount = Math.round(Math.max(MIN_VIEW_COUNT, Math.min(viewCount * factor, Math.max(total, MIN_VIEW_COUNT))));
    const newMaxOffset = Math.max(0, total - newViewCount);
    const newStartIdx = Math.round(absIdx - fraction * newViewCount);
    const newOffset = Math.max(0, Math.min(total - (newStartIdx + newViewCount), newMaxOffset));

    onViewCountChange(newViewCount);
    onViewOffsetChange(newOffset);
  };

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", height: "100%", background: "rgba(15,19,28,0.9)", borderRadius: "10px", cursor: chartTool === "cursor" ? "grab" : "crosshair" }}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onWheel={handleWheel}
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
            <line x1={PLOT_LEFT} y1={y} x2={PLOT_RIGHT} y2={y} stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="3,4" />
            <text x={PLOT_LEFT - 12} y={y} fontSize="14" fontWeight="700" fill="rgba(255,255,255,0.88)" textAnchor="end" dominantBaseline="middle">
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

      {/* Candles or line style */}
      {chartStyle === "line" ? (
        <polyline
          fill="none"
          stroke="#3b82f6"
          strokeWidth="2"
          points={visibleCandles.map((c, i) => `${xForIndex(i)},${priceToY(c.close)}`).join(" ")}
        />
      ) : (
        visibleCandles.map((candle, i) => {
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
        })
      )}

      {/* OHLC readout — tracks the candle under the pointer, falls back to the latest candle.
          The "Cursor" value is the raw price at the exact pixel (continuous, sub-candle
          precision) so the readout visibly updates on every mouse move, not just when the
          pointer crosses into a different candle. */}
      {hoveredCandle && (() => {
        const ohlcBoxWidth = Math.min(plotWidth, 560);
        const ohlcBoxX = PLOT_RIGHT - ohlcBoxWidth;
        return (
        <g pointerEvents="none">
          <rect x={ohlcBoxX} y={PLOT_TOP - 16} width={ohlcBoxWidth} height="24" rx="5" fill="rgba(13,17,23,0.72)" />
          <text x={ohlcBoxX + 10} y={PLOT_TOP - 4} fontSize="12" fontWeight="700" fontFamily="ui-monospace, 'SF Mono', Consolas, monospace" dominantBaseline="middle">
            {crosshair && (
              <>
                <tspan fill="rgba(255,255,255,0.5)">Cursor</tspan>
                <tspan fill="#facc15" dx="4" fontWeight="700">{fmtOhlc(crosshair.price)}</tspan>
              </>
            )}
            <tspan fill="rgba(255,255,255,0.5)" dx={crosshair ? 14 : 0}>O</tspan>
            <tspan fill="#e6edf3" dx="4">{fmtOhlc(hoveredCandle.open)}</tspan>
            <tspan fill="rgba(255,255,255,0.5)" dx="12">H</tspan>
            <tspan fill="#e6edf3" dx="4">{fmtOhlc(hoveredCandle.high)}</tspan>
            <tspan fill="rgba(255,255,255,0.5)" dx="12">L</tspan>
            <tspan fill="#e6edf3" dx="4">{fmtOhlc(hoveredCandle.low)}</tspan>
            <tspan fill="rgba(255,255,255,0.5)" dx="12">C</tspan>
            <tspan fill="#e6edf3" dx="4">{fmtOhlc(hoveredCandle.close)}</tspan>
            <tspan fill={hoveredColor} dx="12" fontWeight="700">
              {hoveredChange >= 0 ? "+" : ""}{hoveredChange.toFixed(2)} ({hoveredChangePct >= 0 ? "+" : ""}{hoveredChangePct.toFixed(2)}%)
            </tspan>
          </text>
        </g>
        );
      })()}

      {/* Time labels — each shows HH:MM (market hours only). Whenever the
          visible candles cross a day boundary (or at the very first label),
          a day-of-month-only separator is stamped below the time so multi-day
          panning stays legible without a full date/month/year on every tick. */}
      {(() => {
        let prevDateKey: string | null = null;
        return visibleCandles.map((candle, i) => {
          if (i % labelStep !== 0) return null;
          const x = xForIndex(i);
          const dateKey = istDateKey(candle.timestamp);
          const isNewDate = dateKey !== prevDateKey;
          prevDateKey = dateKey;
          return (
            <g key={`time-${i}`}>
              {isNewDate && (
                <text x={x} y={PLOT_BOTTOM + 34} fontSize="11" fontWeight="700" fill="rgba(255,255,255,0.5)" textAnchor="middle">
                  {fmtDate(candle.timestamp)}
                </text>
              )}
              <text x={x} y={PLOT_BOTTOM + 22} fontSize="13" fontWeight="600" fill="rgba(255,255,255,0.78)" textAnchor="middle">
                {fmtTime(candle.timestamp)}
              </text>
            </g>
          );
        });
      })()}

      {/* Drawings */}
      {drawingsVisible && drawings.map(d => {
        if (d.type === "horizontal") {
          const y = priceToY(d.price);
          return (
            <g key={d.id}>
              <line x1={PLOT_LEFT} y1={y} x2={PLOT_RIGHT} y2={y} stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="6,3" />
              <text x={PLOT_LEFT + 6} y={y - 6} fontSize="11" fontWeight="700" fill="#f59e0b">
                {d.price.toLocaleString("en-IN", { maximumFractionDigits: 1 })}
              </text>
            </g>
          );
        }
        if (d.type === "text") {
          const x = xForTimestamp(d.t);
          if (x == null) return null;
          return (
            <text key={d.id} x={x} y={priceToY(d.p)} fontSize="12" fontWeight="700" fill="#a78bfa">
              {d.text}
            </text>
          );
        }
        // trendline / measure
        const x1 = xForTimestamp(d.a.t);
        const x2 = xForTimestamp(d.b.t);
        if (x1 == null || x2 == null) return null;
        const y1 = priceToY(d.a.p);
        const y2 = priceToY(d.b.p);
        const deltaP = d.b.p - d.a.p;
        const deltaPct = d.a.p !== 0 ? (deltaP / d.a.p) * 100 : 0;
        return (
          <g key={d.id}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={d.type === "measure" ? "#3b82f6" : "#eab308"} strokeWidth="2" />
            <circle cx={x1} cy={y1} r="3" fill={d.type === "measure" ? "#3b82f6" : "#eab308"} />
            <circle cx={x2} cy={y2} r="3" fill={d.type === "measure" ? "#3b82f6" : "#eab308"} />
            {d.type === "measure" && (
              <text x={(x1 + x2) / 2} y={Math.min(y1, y2) - 8} fontSize="11" fontWeight="700" fill="#3b82f6" textAnchor="middle">
                {deltaP >= 0 ? "+" : ""}{deltaP.toFixed(2)} ({deltaPct >= 0 ? "+" : ""}{deltaPct.toFixed(2)}%)
              </text>
            )}
          </g>
        );
      })}

      {/* Pending two-point drawing preview */}
      {pendingPoint && crosshair && (chartTool === "trendline" || chartTool === "measure") && (() => {
        const x1 = xForTimestamp(pendingPoint.t);
        if (x1 == null) return null;
        return (
          <line
            x1={x1} y1={priceToY(pendingPoint.p)} x2={xForIndex(crosshair.index)} y2={priceToY(crosshair.price)}
            stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4,3"
          />
        );
      })()}

      {/* Crosshair */}
      {crosshair && (
        <g pointerEvents="none">
          <line x1={xForIndex(crosshair.index)} y1={PLOT_TOP} x2={xForIndex(crosshair.index)} y2={PLOT_BOTTOM} stroke="rgba(255,255,255,0.35)" strokeWidth="1" strokeDasharray="3,3" />
          <line x1={PLOT_LEFT} y1={priceToY(crosshair.price)} x2={PLOT_RIGHT} y2={priceToY(crosshair.price)} stroke="rgba(255,255,255,0.35)" strokeWidth="1" strokeDasharray="3,3" />

          <rect x={PLOT_RIGHT + 2} y={priceToY(crosshair.price) - 10} width="0" height="0" />
          <rect x={PLOT_LEFT - 78} y={priceToY(crosshair.price) - 11} width="70" height="22" rx="4" fill="#334155" />
          <text x={PLOT_LEFT - 43} y={priceToY(crosshair.price)} fontSize="12" fontWeight="700" fill="#fff" textAnchor="middle" dominantBaseline="middle">
            {crosshair.price.toLocaleString("en-IN", { maximumFractionDigits: 1 })}
          </text>

          <rect x={xForIndex(crosshair.index) - 45} y={PLOT_BOTTOM + 6} width="90" height="20" rx="4" fill="#334155" />
          <text x={xForIndex(crosshair.index)} y={PLOT_BOTTOM + 16} fontSize="11" fontWeight="700" fill="#fff" textAnchor="middle" dominantBaseline="middle">
            {fmtTime(crosshair.time)}
          </text>
        </g>
      )}
    </svg>
  );
}

export default function FuturesTerminal() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isDark, setIsDark] = useState(() => localStorage.getItem("theme") !== "light");
  const [activeTool, setActiveTool] = useState<string>("chart");

  const T = isDark ? DARK : LIGHT;

  const indexData: IndexData = (location.state as any)?.indexData ?? {
    name: "NIFTY 50",
    symbol: "NIFTY",
    value: 24320.00,
    change: 2.30,
    change_pct: 0.01,
  };

  const symbolKey = normalizeName(indexData.symbol || "");
  // Scoped to today's IST date so a stale cache from a previous session (or
  // one that spans midnight) never bleeds yesterday's candles into today's chart.
  const cacheKey = `cachedCandles_${symbolKey || "unknown"}_20s_${istDateKey(Date.now())}`;

  // Chart drawing/analysis toolbar state
  const [chartTool, setChartTool] = useState<ChartTool>("cursor");
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [drawingsVisible, setDrawingsVisible] = useState(true);
  const [drawingsLocked, setDrawingsLocked] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(false);
  const [chartStyle, setChartStyle] = useState<"candles" | "line">("candles");
  const [viewCount, setViewCount] = useState(FULL_DAY_VIEW_COUNT);
  const [viewOffset, setViewOffset] = useState(0);

  const [candles, setCandles] = useState<Candle[]>(() => {
    try {
      const cached = localStorage.getItem(cacheKey);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  // The index data handed off via route state is a one-time snapshot from the
  // moment the card was clicked. Track a separate live copy that's kept fresh
  // by the tick stream below, so the header price is genuinely real-time
  // instead of frozen at whatever value it had on navigation.
  const [livePrice, setLivePrice] = useState({
    value: indexData.value,
    change: indexData.change,
    change_pct: indexData.change_pct,
  });

  const isUp = livePrice.change >= 0;
  const changeColor = isUp ? "#22c55e" : "#ef4444";

  // Today's day-level range — always available from /api/market/indices, even
  // after market close. Used as an honest fallback in the chart when no
  // intraday candles were captured client-side today (see CandleChart).
  const [daySummary, setDaySummary] = useState<DaySummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    const matchVariants = INDEX_MATCH_VARIANTS[symbolKey] ?? [symbolKey];

    fetch(`${BASE_URL}/api/market/indices`)
      .then(res => res.json())
      .then((data: MarketData) => {
        if (cancelled) return;
        const matched = data.indices?.find(i => {
          const normalized = normalizeName(i.name || "");
          return matchVariants.some(v => normalized === v || normalized.includes(v));
        });
        if (matched && matched.open != null && matched.high != null && matched.low != null) {
          setDaySummary({ open: matched.open, high: matched.high, low: matched.low, value: matched.value });
        }
      })
      .catch(e => console.error("[FuturesTerminal] Failed to fetch day summary:", e));

    return () => { cancelled = true; };
  }, [symbolKey]);

  // One-shot backfill from the historical-candles endpoint, for whenever the
  // chart is opened with nothing already captured client-side today (e.g.
  // after market close, or a fresh session mid-day). This endpoint has only
  // ever returned `no_candle_data` in testing — the backend doesn't persist
  // intraday history yet — but the integration is otherwise complete and
  // will start working the moment it does, with no further frontend changes.
  useEffect(() => {
    const slug = CANDLE_SLUG_MAP[symbolKey];
    if (!slug) return;
    let cancelled = false;

    fetch(`${BASE_URL}/api/market/${slug}/candles?timeframe=1m&limit=400`)
      .then(res => res.json())
      .then((data: { candles?: any[] }) => {
        if (cancelled || !Array.isArray(data.candles) || data.candles.length === 0) return;

        // Only filter by time-of-day (09:15-15:30), not calendar date — if
        // today's session hasn't started yet (pre-market, or the backend
        // hasn't ingested today's data yet), this correctly falls back to
        // showing the most recent completed session (e.g. last Friday's close
        // over a weekend) instead of an empty chart. The day-of-month
        // separator on the x-axis already makes it clear which date is shown.
        const backfilled = data.candles
          .map(normalizeHistoricalCandle)
          .filter((c): c is Candle => c !== null)
          .filter(c => isWithinMarketHours(c.timestamp))
          .sort((a, b) => a.timestamp - b.timestamp);

        if (backfilled.length === 0) return;

        // Only seed with history if nothing *valid* has been captured live
        // yet. Checking raw prev.length here isn't enough: a cache written by
        // an earlier, buggier build (e.g. before timestamp parsing was fixed)
        // can be non-empty but contain garbage that the market-hours/date
        // filter rejects wholesale — which would otherwise permanently block
        // this backfill from ever re-running for the rest of the day. Require
        // at least one cached candle to actually be a valid today-session
        // candle before treating the cache as authoritative.
        setCandles(prev => {
          const today = istDateKey(Date.now());
          const hasValidToday = prev.some(c => isWithinMarketHours(c.timestamp) && istDateKey(c.timestamp) === today);
          if (hasValidToday) return prev;
          try {
            localStorage.setItem(cacheKey, JSON.stringify(backfilled));
          } catch (e) {
            console.error("[FuturesTerminal] Failed to persist backfilled candles:", e);
          }
          return backfilled;
        });
      })
      .catch(e => console.error("[FuturesTerminal] Historical candle backfill failed:", e));

    return () => { cancelled = true; };
  }, [symbolKey, cacheKey]);

  useEffect(() => {
    if (!localStorage.getItem("authToken")) navigate("/", { replace: true });
  }, []);

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

  // Aggregate live ticks from the indices stream into fixed 20s candles,
  // updating the persisted `candles` state incrementally (extend the last
  // bucket, or append a new one) rather than rebuilding the whole array from
  // an in-memory tick buffer. The old approach started that buffer empty on
  // every mount, so the very first tick after a page refresh replaced the
  // entire (cached) day's history with a single-tick candle — this is what
  // made candles disappear on refresh. Building on top of the cached state
  // instead means history survives refreshes and remounts.
  useEffect(() => {
    const matchVariants = INDEX_MATCH_VARIANTS[symbolKey] ?? [symbolKey];
    const es = new EventSource(`${BASE_URL}/api/market/indices/stream`);
    // ~1 trading day of 20s candles, with headroom — bounds memory/localStorage size.
    const MAX_CANDLES = 1500;

    es.onmessage = (event) => {
      try {
        const data: MarketData = JSON.parse(event.data);
        const matchedIndex = data.indices.find(i => {
          const normalized = normalizeName(i.name || "");
          return matchVariants.some(v => normalized === v || normalized.includes(v));
        });
        if (!matchedIndex) return;

        setLivePrice({ value: matchedIndex.value, change: matchedIndex.change, change_pct: matchedIndex.change_pct });

        // Don't bucket ticks that arrive outside the 09:15–15:30 session
        // (e.g. simulator ticks right at market open/close) into a candle —
        // keeps the x-axis strictly to real market hours.
        const now = Date.now();
        if (!isWithinMarketHours(now)) return;

        const price = matchedIndex.value;
        const candleTime = Math.floor(now / CHART_TIMEFRAME_MS) * CHART_TIMEFRAME_MS;

        setCandles(prev => {
          const last = prev[prev.length - 1];
          let next: Candle[];
          if (last && last.timestamp === candleTime) {
            next = prev.slice(0, -1).concat({
              ...last,
              high: Math.max(last.high, price),
              low: Math.min(last.low, price),
              close: price,
            });
          } else {
            next = [...prev, { timestamp: candleTime, open: price, high: price, low: price, close: price }];
          }
          if (next.length > MAX_CANDLES) next = next.slice(next.length - MAX_CANDLES);
          try {
            localStorage.setItem(cacheKey, JSON.stringify(next));
          } catch (e) {
            console.error("[FuturesTerminal] Failed to persist candles:", e);
          }
          return next;
        });
      } catch (e) {
        console.error("[FuturesTerminal] Stream parse error:", e);
      }
    };

    es.onerror = () => {
      console.error("[FuturesTerminal] EventSource error - stream closed");
      es.close();
    };

    return () => es.close();
  }, [symbolKey, cacheKey]);

  // Keep a panned-back view frozen on the same window as new candles arrive,
  // instead of silently drifting forward. Only auto-follows live when the
  // user hasn't panned away from the latest candle (viewOffset === 0).
  const prevCandleCountRef = useRef(candles.length);
  useEffect(() => {
    const delta = candles.length - prevCandleCountRef.current;
    prevCandleCountRef.current = candles.length;
    if (delta > 0 && viewOffset > 0) {
      setViewOffset(o => o + delta);
    }
  }, [candles.length, viewOffset]);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: T.bg, overflow: "hidden" }}>
      <Header
        isDark={isDark}
        onToggleTheme={() => setIsDark(d => { const n = !d; localStorage.setItem("theme", n ? "dark" : "light"); return n; })}
      />

      <main style={{ flex: 1, minHeight: 0, display: "flex" }}>

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
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", minWidth: 0 }}>

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
                <div style={{ fontSize: "11px", color: T.textMuted }}>NSE · 20s</div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "18px", fontWeight: 700, color: T.text }}>
                  ₹{livePrice.value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: "12px", fontWeight: 600, color: changeColor }}>
                  {isUp ? "+" : ""}{livePrice.change.toFixed(2)} ({isUp ? "+" : ""}{livePrice.change_pct.toFixed(2)}%)
                </div>
              </div>
              <button
                onClick={() => navigate("/terminal/fno/chain", { state: { indexData: { ...indexData, ...livePrice } } })}
                title="Open real-time option chain"
                style={{
                  display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px",
                  background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.4)",
                  borderRadius: "8px", color: "#3b82f6", fontSize: "13px", fontWeight: 700, cursor: "pointer",
                }}
              >
                <Link2 size={15} />
                Chain
              </button>
              <button style={{ background: "none", border: "none", color: T.textMuted, cursor: "pointer" }}>
                <MoreVertical size={18} />
              </button>
            </div>
          </div>

          {/* ── Chart Area ── */}
          <div style={{ flex: 1, minHeight: 0, display: "flex", gap: "10px", padding: "16px 12px 12px 12px" }}>

            {/* Chart analysis toolbar */}
            <div style={{
              width: "44px", flexShrink: 0, background: T.cardSolid, border: `1px solid ${T.borderMid}`,
              borderRadius: "12px", display: "flex", flexDirection: "column", alignItems: "center",
              padding: "8px 0", gap: "4px",
            }}>
              {([
                { tool: "cursor" as ChartTool, icon: Crosshair, title: "Crosshair" },
                { tool: "trendline" as ChartTool, icon: Slash, title: "Trend Line" },
                { tool: "horizontal" as ChartTool, icon: Minus, title: "Horizontal Line" },
                { tool: "measure" as ChartTool, icon: Ruler, title: "Measure" },
                { tool: "text" as ChartTool, icon: Type, title: "Text" },
              ]).map(({ tool, icon: Icon, title }) => (
                <button
                  key={tool}
                  title={title}
                  onClick={() => setChartTool(tool)}
                  style={{
                    width: "32px", height: "32px", borderRadius: "8px",
                    background: chartTool === tool ? "rgba(59,130,246,0.18)" : "transparent",
                    border: chartTool === tool ? "1px solid rgba(59,130,246,0.4)" : "1px solid transparent",
                    color: chartTool === tool ? "#3b82f6" : T.textMuted,
                    display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                  }}
                >
                  <Icon size={16} />
                </button>
              ))}

              <div style={{ width: "24px", height: "1px", background: T.border, margin: "4px 0" }} />

              <button
                title={snapEnabled ? "Snap to price: on" : "Snap to price: off"}
                onClick={() => setSnapEnabled(v => !v)}
                style={{
                  width: "32px", height: "32px", borderRadius: "8px",
                  background: snapEnabled ? "rgba(139,92,246,0.18)" : "transparent",
                  border: snapEnabled ? "1px solid rgba(139,92,246,0.4)" : "1px solid transparent",
                  color: snapEnabled ? "#8b5cf6" : T.textMuted,
                  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                }}
              >
                <Magnet size={16} />
              </button>
              <button
                title={drawingsVisible ? "Hide drawings" : "Show drawings"}
                onClick={() => setDrawingsVisible(v => !v)}
                style={{
                  width: "32px", height: "32px", borderRadius: "8px", background: "transparent", border: "1px solid transparent",
                  color: T.textMuted, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                }}
              >
                {drawingsVisible ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
              <button
                title={drawingsLocked ? "Unlock drawings" : "Lock drawings"}
                onClick={() => setDrawingsLocked(v => !v)}
                style={{
                  width: "32px", height: "32px", borderRadius: "8px",
                  background: drawingsLocked ? "rgba(239,68,68,0.15)" : "transparent",
                  border: drawingsLocked ? "1px solid rgba(239,68,68,0.4)" : "1px solid transparent",
                  color: drawingsLocked ? "#ef4444" : T.textMuted,
                  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                }}
              >
                {drawingsLocked ? <Lock size={16} /> : <Unlock size={16} />}
              </button>
              <button
                title="Clear all drawings"
                onClick={() => { if (!drawingsLocked) setDrawings([]); }}
                disabled={drawingsLocked}
                style={{
                  width: "32px", height: "32px", borderRadius: "8px", background: "transparent", border: "1px solid transparent",
                  color: T.textMuted, display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: drawingsLocked ? "not-allowed" : "pointer", opacity: drawingsLocked ? 0.4 : 1,
                }}
              >
                <Trash2 size={16} />
              </button>

              <div style={{ width: "24px", height: "1px", background: T.border, margin: "4px 0" }} />

              <button
                title="Zoom in"
                onClick={() => setViewCount(v => Math.max(MIN_VIEW_COUNT, Math.round(v * 0.8)))}
                style={{
                  width: "32px", height: "32px", borderRadius: "8px", background: "transparent", border: "1px solid transparent",
                  color: T.textMuted, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                }}
              >
                <ZoomIn size={16} />
              </button>
              <button
                title="Zoom out"
                onClick={() => setViewCount(v => Math.round(v * 1.25))}
                style={{
                  width: "32px", height: "32px", borderRadius: "8px", background: "transparent", border: "1px solid transparent",
                  color: T.textMuted, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                }}
              >
                <ZoomOut size={16} />
              </button>
              <button
                title={chartStyle === "candles" ? "Switch to line chart" : "Switch to candlesticks"}
                onClick={() => setChartStyle(s => (s === "candles" ? "line" : "candles"))}
                style={{
                  width: "32px", height: "32px", borderRadius: "8px", background: "transparent", border: "1px solid transparent",
                  color: T.textMuted, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                }}
              >
                <Layers size={16} />
              </button>
            </div>

            {/* Chart */}
            <div style={{
              flex: 1, minHeight: 0, background: T.cardSolid, border: `1px solid ${T.borderMid}`,
              borderRadius: "14px", padding: "12px 16px 16px",
              display: "flex", flexDirection: "column", minWidth: 0,
            }}>
              <div style={{ flex: 1, minHeight: 0, width: "100%" }}>
                <CandleChart
                  candles={candles}
                  daySummary={daySummary}
                  chartTool={chartTool}
                  drawings={drawings}
                  drawingsVisible={drawingsVisible}
                  drawingsLocked={drawingsLocked}
                  snapEnabled={snapEnabled}
                  chartStyle={chartStyle}
                  viewCount={viewCount}
                  viewOffset={viewOffset}
                  onViewCountChange={setViewCount}
                  onViewOffsetChange={setViewOffset}
                  onAddDrawing={d => setDrawings(prev => [...prev, d])}
                />
              </div>
            </div>

          </div>

        </div>

      </main>

      {/* ── Compact copyright bar — deliberately not the full marketing
          Footer (products/company/contact sections): that pushed this page
          taller than one viewport, which is what forced scrolling to see the
          chart's x-axis in the first place. This is a fixed-height sliver
          instead, so the terminal still fits in exactly one screen. ── */}
      <div style={{
        flexShrink: 0, borderTop: `1px solid ${T.border}`, background: T.headerBar,
        padding: "8px 20px", display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: "8px",
      }}>
        <p style={{ fontSize: "11px", color: T.textMuted, margin: 0 }}>
          © {new Date().getFullYear()} PrimePipTrade.com. All rights reserved.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          {["Privacy Policy", "Terms", "Risk Disclosure"].map((item, i, arr) => (
            <span key={item} style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <a
                href="#"
                style={{ fontSize: "11px", color: T.textMuted, textDecoration: "none" }}
                onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.color = T.textBody}
                onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.color = T.textMuted}
              >
                {item}
              </a>
              {i < arr.length - 1 && <span style={{ color: T.border, fontSize: "12px", lineHeight: 1 }}>·</span>}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
