import { useState, useEffect, useCallback, useRef, useId, type ReactNode, type MouseEvent as ReactMouseEvent } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Header } from "./header";
import { Footer } from "./footer";
import {
  Wallet, IndianRupee, TrendingUp, TrendingDown, Activity,
  RefreshCw, Briefcase, Layers, LayoutDashboard, PieChart,
} from "lucide-react";
import { isoExpiryToDisplay } from "../lib/fno";

const BASE_URL = "https://api.primepiptrade.com";

/* ── Types (mirror dashboard_api.md response shapes) ─────── */
type Bucket = "ALL" | "STOCKS" | "FNO";
type Range = "1D" | "1W" | "1M" | "3M" | "1Y" | "All";

interface AssetSummary {
  bucket: Bucket;
  net_value: number;
  todays_pnl: number;
  total_unrealized_pnl: number;
  buying_power: number;
  last_updated: string;
}

interface DashboardOverview {
  orders: { total_orders: number; pending_orders: number; executed_orders: number; partially_executed_orders: number; cancelled_orders: number; failed_orders: number };
  trades: { total_trades: number; buy_trades: number; sell_trades: number };
  portfolio: { total_invested: number; total_holdings: number; unrealized_pnl: number; return_percentage: number; total_positions: number; last_updated: string };
}

interface EquityPoint {
  net_value: number;
  total_unrealized_pnl: number;
  buying_power: number;
  captured_at: string;
}

interface StockHolding {
  symbol: string;
  quantity: number;
  avg_price: number;
  current_price: number;
  pnl: number;
  asset_type: string;
}

interface FnoPosition {
  symbol: string;
  underlying: string;
  exchange: string;
  expiry: string;
  strike: number;
  option_type: "CE" | "PE";
  contract_type: string;
  lot_size: number;
  product_type: string;
  netqty: number;
  netavgprc: number;
  realized_pnl: number;
  status: string;
}

/* ── Formatters ────────────────────────────────────────────── */
function fmt(n: unknown): string {
  if (n == null || typeof n !== "number" || isNaN(n)) return "—";
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}
function fmtSigned(n: unknown): string {
  if (n == null || typeof n !== "number" || isNaN(n)) return "—";
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}₹${Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}
function fmtPct(n: unknown): string {
  if (n == null || typeof n !== "number" || isNaN(n)) return "—";
  return (n >= 0 ? "+" : "") + n.toFixed(2) + "%";
}
function pnlColor(n: unknown): string {
  if (n == null || typeof n !== "number" || isNaN(n)) return "#8b949e";
  return n > 0 ? "#22c55e" : n < 0 ? "#ef4444" : "#8b949e";
}
function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
function fmtAxisDate(iso: string, range: Range): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  if (range === "1D") return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}
function apiErrorMessage(body: any, fallback: string): string {
  return typeof body?.message === "string" && body.message.trim() ? body.message : fallback;
}

/* ── Small localStorage cache so a section never renders blank
   on first paint / remount — mirrors the cachedMarketData trick
   used on the F&O explore page. ─────────────────────────────── */
function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function writeCache(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable/full — non-fatal */ }
}

/* ── Theme (same shape/spirit as ExploreFutureOptions) ───────── */
const DARK = {
  bg: "#0d1117", card: "rgba(22,27,34,0.9)", cardSolid: "#161b22",
  border: "rgba(255,255,255,0.07)", borderMid: "rgba(255,255,255,0.12)",
  text: "#e6edf3", textMuted: "#8b949e", textDim: "#6e7681", textBody: "#c9d1d9",
  tabHover: "rgba(255,255,255,0.08)", activeBorder: "#3b82f6",
  headerBar: "rgba(13,17,23,0.95)", skeletonBg: "rgba(255,255,255,0.08)",
};
const LIGHT = {
  bg: "#f0f4f8", card: "rgba(255,255,255,0.95)", cardSolid: "#ffffff",
  border: "rgba(0,0,0,0.08)", borderMid: "rgba(0,0,0,0.12)",
  text: "#0f172a", textMuted: "#64748b", textDim: "#94a3b8", textBody: "#334155",
  tabHover: "rgba(0,0,0,0.07)", activeBorder: "#3b82f6",
  headerBar: "rgba(240,244,248,0.97)", skeletonBg: "rgba(0,0,0,0.08)",
};

const DASHBOARD_TABS: { key: string; label: string; bucket: Bucket | null; accent: string; icon: any }[] = [
  { key: "Overall", label: "Overall", bucket: "ALL", accent: "#6366f1", icon: LayoutDashboard },
  { key: "Stocks", label: "Stocks", bucket: "STOCKS", accent: "#3b82f6", icon: TrendingUp },
  { key: "Mutual Funds", label: "Mutual Funds", bucket: null, accent: "#10b981", icon: PieChart },
  { key: "F&O", label: "F&O", bucket: "FNO", accent: "#f59e0b", icon: Layers },
];

const RANGE_TABS: Range[] = ["1D", "1W", "1M", "3M", "1Y", "All"];

/* ── Error banner (matches the red-banner idiom used across the app) ── */
function ErrorBanner({ message }: { message: string }) {
  return (
    <div style={{
      fontSize: "13px", color: "#ef4444", background: "rgba(239,68,68,0.08)",
      border: "1px solid rgba(239,68,68,0.25)", borderRadius: "8px", padding: "10px 14px", marginBottom: "16px",
    }}>
      {message}
    </div>
  );
}

function EmptyCard({ children }: { children: ReactNode }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center",
      minHeight: "140px", padding: "24px", borderRadius: "16px", fontSize: "13px",
    }}>
      {children}
    </div>
  );
}

/* ── Summary tile row ─────────────────────────────────────────── */
function SummaryTiles({ summary, loading, error, bucket, T }: {
  summary: AssetSummary | null; loading: boolean; error: string | null; bucket: Bucket; T: typeof DARK;
}) {
  const tiles = [
    { label: "Net Value", value: summary ? `₹${fmt(summary.net_value)}` : null, icon: Wallet, color: "#3b82f6" },
    {
      label: "Today's P&L",
      value: summary ? fmtSigned(summary.todays_pnl) : null,
      icon: summary && summary.todays_pnl < 0 ? TrendingDown : TrendingUp,
      color: summary ? pnlColor(summary.todays_pnl) : "#3b82f6",
    },
    {
      label: "Unrealized P&L",
      value: summary ? fmtSigned(summary.total_unrealized_pnl) : null,
      icon: Activity,
      color: summary ? pnlColor(summary.total_unrealized_pnl) : "#3b82f6",
      note: bucket === "FNO" ? "No live F&O price feed — realized-only" : undefined,
    },
    { label: "Buying Power", value: summary ? `₹${fmt(summary.buying_power)}` : null, icon: IndianRupee, color: "#8b5cf6" },
  ];

  return (
    <div>
      {error && <ErrorBanner message={error} />}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", marginBottom: "8px" }}>
        {tiles.map(tile => {
          const Icon = tile.icon;
          return (
            <div key={tile.label} style={{
              flex: "1 1 220px", minWidth: "200px", background: T.card, border: `1px solid ${T.border}`,
              borderRadius: "16px", padding: "16px 18px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                <div style={{
                  width: "28px", height: "28px", borderRadius: "8px", background: `${tile.color}1a`,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <Icon style={{ width: "14px", height: "14px", color: tile.color }} />
                </div>
                <span style={{ fontSize: "11px", fontWeight: 600, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.4px" }}>
                  {tile.label}
                </span>
              </div>
              {loading && tile.value == null ? (
                <div style={{ height: "24px", width: "110px", borderRadius: "6px", background: T.skeletonBg, animation: "pulse 1.5s ease-in-out infinite" }} />
              ) : (
                <div style={{ fontSize: "21px", fontWeight: 800, color: tile.value == null ? T.textDim : tile.color, letterSpacing: "-0.4px" }}>
                  {tile.value ?? "—"}
                </div>
              )}
              {tile.note && <div style={{ fontSize: "10px", color: T.textDim, marginTop: "6px" }}>{tile.note}</div>}
            </div>
          );
        })}
      </div>
      {summary?.last_updated && (
        <div style={{ fontSize: "11px", color: T.textDim, marginBottom: "24px" }}>
          Updated {fmtDateTime(summary.last_updated)}
        </div>
      )}
    </div>
  );
}

/* ── Equity curve — hand-rolled SVG line chart (no chart lib in this app) ── */
function EquityCurveChart({ points, loading, error, accent, range, T, isDark }: {
  points: EquityPoint[]; loading: boolean; error: string | null; accent: string; range: Range; T: typeof DARK; isDark: boolean;
}) {
  const rawId = useId();
  const gradientId = `dash-curve-grad-${rawId.replace(/[^a-zA-Z0-9-_]/g, "")}`;
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const W = 640, H = 220, padTop = 18, padBottom = 28, padX = 8;
  const values = points.map(p => p.net_value);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const span = max - min || Math.max(Math.abs(max), 1) * 0.02;
  const usableH = H - padTop - padBottom;

  const xAt = (i: number) => points.length > 1 ? padX + (i / (points.length - 1)) * (W - padX * 2) : W / 2;
  const yAt = (v: number) => padTop + usableH - ((v - min) / span) * usableH;

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(2)} ${yAt(p.net_value).toFixed(2)}`).join(" ");
  const areaPath = points.length ? `${linePath} L ${xAt(points.length - 1).toFixed(2)} ${padTop + usableH} L ${xAt(0).toFixed(2)} ${padTop + usableH} Z` : "";

  const first = points[0]?.net_value;
  const last = points[points.length - 1]?.net_value;
  const rangeChange = first != null && last != null ? last - first : null;
  const rangeChangePct = first ? ((last! - first) / Math.abs(first)) * 100 : null;

  function handleMove(e: ReactMouseEvent<SVGSVGElement>) {
    if (!svgRef.current || points.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * W;
    let nearest = 0, best = Infinity;
    points.forEach((_, i) => {
      const d = Math.abs(xAt(i) - relX);
      if (d < best) { best = d; nearest = i; }
    });
    setHoverIdx(nearest);
  }

  if (loading && points.length === 0) {
    return <div style={{ height: `${H}px`, borderRadius: "12px", background: T.skeletonBg, animation: "pulse 1.5s ease-in-out infinite" }} />;
  }
  if (error && points.length === 0) {
    return <ErrorBanner message={error} />;
  }
  if (points.length === 0) {
    return (
      <EmptyCard>
        <span style={{ color: T.textMuted }}>
          Not enough data yet to chart your portfolio performance. Check back after your first trading day.
        </span>
      </EmptyCard>
    );
  }

  const hovered = hoverIdx != null ? points[hoverIdx] : null;

  return (
    <div>
      {error && <ErrorBanner message={error} />}
      {rangeChange != null && (
        <div style={{ display: "flex", alignItems: "baseline", gap: "10px", marginBottom: "10px" }}>
          <span style={{ fontSize: "22px", fontWeight: 800, color: T.text, letterSpacing: "-0.4px" }}>₹{fmt(last)}</span>
          <span style={{ fontSize: "13px", fontWeight: 700, color: pnlColor(rangeChange) }}>
            {fmtSigned(rangeChange)} ({fmtPct(rangeChangePct)}) · {range}
          </span>
        </div>
      )}
      <div style={{ position: "relative" }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height={H}
          style={{ display: "block", cursor: "crosshair" }}
          onMouseMove={handleMove}
          onMouseLeave={() => setHoverIdx(null)}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity="0.28" />
              <stop offset="100%" stopColor={accent} stopOpacity="0" />
            </linearGradient>
          </defs>

          {[0.25, 0.5, 0.75].map(f => (
            <line key={f} x1={padX} x2={W - padX} y1={padTop + usableH * f} y2={padTop + usableH * f}
              stroke={T.border} strokeWidth="1" strokeDasharray="3 4" />
          ))}

          <path d={areaPath} fill={`url(#${gradientId})`} />
          <path d={linePath} fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

          <circle cx={xAt(points.length - 1)} cy={yAt(last!)} r="4" fill={accent} stroke={isDark ? "#0d1117" : "#ffffff"} strokeWidth="2" />

          {hovered && (
            <g>
              <line x1={xAt(hoverIdx!)} x2={xAt(hoverIdx!)} y1={padTop} y2={padTop + usableH} stroke={T.borderMid} strokeWidth="1" />
              <circle cx={xAt(hoverIdx!)} cy={yAt(hovered.net_value)} r="4" fill={accent} stroke={isDark ? "#0d1117" : "#ffffff"} strokeWidth="2" />
            </g>
          )}
        </svg>

        {hovered && (
          <div style={{
            position: "absolute", pointerEvents: "none",
            left: `${Math.min(Math.max((xAt(hoverIdx!) / W) * 100, 12), 88)}%`,
            top: "0px", transform: "translate(-50%, -6px)",
            background: T.cardSolid, border: `1px solid ${T.borderMid}`, borderRadius: "8px",
            padding: "6px 10px", fontSize: "11px", whiteSpace: "nowrap", boxShadow: "0 8px 20px rgba(0,0,0,0.25)",
          }}>
            <div style={{ color: T.textMuted, marginBottom: "2px" }}>{fmtAxisDate(hovered.captured_at, range)}</div>
            <div style={{ color: T.text, fontWeight: 700 }}>₹{fmt(hovered.net_value)}</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Stocks holdings list ─────────────────────────────────────── */
function StockHoldingsList({ holdings, loading, error, T, limit }: {
  holdings: StockHolding[]; loading: boolean; error: string | null; T: typeof DARK; limit?: number;
}) {
  if (error) return <ErrorBanner message={error} />;
  if (loading && holdings.length === 0) {
    return <div style={{ fontSize: "13px", color: T.textMuted, textAlign: "center", padding: "40px" }}>Loading holdings…</div>;
  }
  if (holdings.length === 0) {
    return (
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "16px" }}>
        <EmptyCard><span style={{ color: T.textMuted }}>No stock holdings yet. Buy a stock to see it here.</span></EmptyCard>
      </div>
    );
  }
  const rows = limit ? holdings.slice(0, limit) : holdings;
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "16px", overflow: "hidden" }}>
      {rows.map((h, i) => (
        <div key={h.symbol} style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 18px", borderBottom: i < rows.length - 1 ? `1px solid ${T.border}` : "none", gap: "12px", flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: "1 1 200px", minWidth: 0 }}>
            <div style={{
              width: "34px", height: "34px", borderRadius: "9px", background: "rgba(59,130,246,0.12)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <TrendingUp style={{ width: "16px", height: "16px", color: "#3b82f6" }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: "13px", fontWeight: 700, color: T.text }}>{h.symbol}</div>
              <div style={{ fontSize: "11px", color: T.textDim }}>Qty {fmt(h.quantity)} · Avg ₹{fmt(h.avg_price)}</div>
            </div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: "13px", fontWeight: 700, color: T.text }}>₹{fmt(h.current_price)}</div>
            <div style={{ fontSize: "12px", fontWeight: 700, color: pnlColor(h.pnl) }}>{fmtSigned(h.pnl)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── F&O positions list ───────────────────────────────────────── */
function FnoPositionsList({ positions, loading, error, T, limit }: {
  positions: FnoPosition[]; loading: boolean; error: string | null; T: typeof DARK; limit?: number;
}) {
  if (error) return <ErrorBanner message={error} />;
  if (loading && positions.length === 0) {
    return <div style={{ fontSize: "13px", color: T.textMuted, textAlign: "center", padding: "40px" }}>Loading positions…</div>;
  }
  if (positions.length === 0) {
    return (
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "16px" }}>
        <EmptyCard><span style={{ color: T.textMuted }}>No F&O positions yet. Trade an option or future to see it here.</span></EmptyCard>
      </div>
    );
  }
  const rows = limit ? positions.slice(0, limit) : positions;
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "16px", overflow: "hidden" }}>
      {rows.map((p, i) => {
        const isLong = p.netqty > 0;
        const sideColor = isLong ? "#22c55e" : p.netqty < 0 ? "#ef4444" : "#8b949e";
        return (
          <div key={`${p.symbol}-${p.product_type}`} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 18px", borderBottom: i < rows.length - 1 ? `1px solid ${T.border}` : "none", gap: "12px", flexWrap: "wrap",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: "1 1 220px", minWidth: 0 }}>
              <span style={{
                fontSize: "10px", fontWeight: 700, padding: "3px 8px", borderRadius: "100px",
                color: sideColor, background: `${sideColor}1a`, flexShrink: 0,
              }}>
                {p.netqty === 0 ? "FLAT" : isLong ? "LONG" : "SHORT"}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "13px", fontWeight: 700, color: T.text, overflow: "hidden", textOverflow: "ellipsis" }}>{p.symbol}</div>
                <div style={{ fontSize: "11px", color: T.textDim }}>
                  {p.underlying} · {p.expiry ? isoExpiryToDisplay(p.expiry) : "—"} · {p.product_type}
                </div>
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <span style={{
                fontSize: "10px", fontWeight: 700, padding: "3px 8px", borderRadius: "100px",
                color: p.status === "OPEN" ? "#3b82f6" : "#8b949e", background: p.status === "OPEN" ? "rgba(59,130,246,0.1)" : "rgba(139,148,158,0.1)",
              }}>
                {p.status}
              </span>
              <div style={{ fontSize: "12px", fontWeight: 700, color: pnlColor(p.realized_pnl), marginTop: "4px" }}>{fmtSigned(p.realized_pnl)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────────── */
export default function OverallDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isDark, setIsDark] = useState(() => localStorage.getItem("theme") !== "light");
  const [activeTab, setActiveTab] = useState<string>((location.state as any)?.tab ?? "Overall");
  const [range, setRange] = useState<Range>("1M");
  const T = isDark ? DARK : LIGHT;
  const tabDef = DASHBOARD_TABS.find(t => t.key === activeTab) ?? DASHBOARD_TABS[0];
  const bucket = tabDef.bucket;

  useEffect(() => {
    if (!localStorage.getItem("authToken")) navigate("/", { replace: true });
  }, []);

  function handleSessionExpired() {
    localStorage.clear();
    sessionStorage.clear();
    navigate("/");
  }

  async function authedGet(path: string): Promise<{ ok: boolean; body: any; expired: boolean }> {
    try {
      const res = await fetch(`${BASE_URL}${path}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
      });
      if (res.status === 401) return { ok: false, body: null, expired: true };
      const body = await res.json().catch(() => null);
      return { ok: res.ok, body, expired: false };
    } catch {
      return { ok: false, body: null, expired: false };
    }
  }

  /* ── Summary tile (bucket-scoped) ── */
  const [summary, setSummary] = useState<AssetSummary | null>(() => bucket ? readCache<AssetSummary>(`dash_summary_${bucket}`) : null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const fetchSummary = useCallback(async (b: Bucket) => {
    setSummaryLoading(true);
    const { ok, body, expired } = await authedGet(`/getAssetClassSummary?bucket=${b}`);
    if (expired) { handleSessionExpired(); return; }
    if (!ok || !body?.success) {
      setSummaryError(apiErrorMessage(body, "Unable to load your portfolio summary right now."));
    } else {
      setSummaryError(null);
      setSummary(body.summary);
      writeCache(`dash_summary_${b}`, body.summary);
    }
    setSummaryLoading(false);
  }, []);

  useEffect(() => {
    if (!bucket) return;
    setSummary(readCache<AssetSummary>(`dash_summary_${bucket}`));
    setSummaryError(null);
    fetchSummary(bucket);
    const id = setInterval(() => fetchSummary(bucket), 30_000);
    return () => clearInterval(id);
  }, [bucket, fetchSummary]);

  /* ── Overview stats (Overall tab only) ── */
  const [overview, setOverview] = useState<DashboardOverview | null>(() => readCache<DashboardOverview>("dash_overview"));
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const fetchOverview = useCallback(async () => {
    setOverviewLoading(true);
    const { ok, body, expired } = await authedGet("/getDashboardSummary");
    if (expired) { handleSessionExpired(); return; }
    if (!ok || !body?.success) {
      setOverviewError(apiErrorMessage(body, "Unable to load your activity summary right now."));
    } else {
      setOverviewError(null);
      setOverview(body.dashboard);
      writeCache("dash_overview", body.dashboard);
    }
    setOverviewLoading(false);
  }, []);

  useEffect(() => {
    fetchOverview();
    const id = setInterval(fetchOverview, 60_000);
    return () => clearInterval(id);
  }, [fetchOverview]);

  /* ── Equity curve (bucket + range scoped) ── */
  const [curvePoints, setCurvePoints] = useState<EquityPoint[]>(() => bucket ? readCache<EquityPoint[]>(`dash_curve_${bucket}_1M`) ?? [] : []);
  const [curveLoading, setCurveLoading] = useState(false);
  const [curveError, setCurveError] = useState<string | null>(null);

  const fetchCurve = useCallback(async (b: Bucket, r: Range) => {
    setCurveLoading(true);
    const { ok, body, expired } = await authedGet(`/getPortfolioEquityCurve?bucket=${b}&range=${r}`);
    if (expired) { handleSessionExpired(); return; }
    if (!ok || !body?.success) {
      setCurveError(apiErrorMessage(body, "Unable to load your performance chart right now."));
    } else {
      setCurveError(null);
      setCurvePoints(body.points ?? []);
      writeCache(`dash_curve_${b}_${r}`, body.points ?? []);
    }
    setCurveLoading(false);
  }, []);

  useEffect(() => {
    if (!bucket) return;
    setCurvePoints(readCache<EquityPoint[]>(`dash_curve_${bucket}_${range}`) ?? []);
    setCurveError(null);
    fetchCurve(bucket, range);
    const id = setInterval(() => fetchCurve(bucket, range), 60_000);
    return () => clearInterval(id);
  }, [bucket, range, fetchCurve]);

  /* ── Stock holdings (fetched once, shared by Overall preview + Stocks tab) ── */
  const [holdings, setHoldings] = useState<StockHolding[]>(() => readCache<StockHolding[]>("dash_stocks_holdings") ?? []);
  const [holdingsLoading, setHoldingsLoading] = useState(false);
  const [holdingsError, setHoldingsError] = useState<string | null>(null);

  const fetchHoldings = useCallback(async () => {
    setHoldingsLoading(true);
    const { ok, body, expired } = await authedGet("/getPortfolioOfLoggedInUserWithProfitLoss");
    if (expired) { handleSessionExpired(); return; }
    if (!ok || !body?.success) {
      // "No portfolio data found for user" is a normal empty state for a new
      // user, not a failure — only surface an error banner for real failures
      // (including network/parse failures, where body is null).
      const rawMessage = typeof body?.message === "string" ? body.message : null;
      if (rawMessage && /no portfolio data/i.test(rawMessage)) {
        setHoldingsError(null);
      } else {
        setHoldingsError(rawMessage ?? "Unable to load your stock holdings right now.");
      }
      setHoldings([]);
      writeCache("dash_stocks_holdings", []);
    } else {
      setHoldingsError(null);
      setHoldings(body.portfolio ?? []);
      writeCache("dash_stocks_holdings", body.portfolio ?? []);
    }
    setHoldingsLoading(false);
  }, []);

  useEffect(() => {
    fetchHoldings();
    const id = setInterval(fetchHoldings, 30_000);
    return () => clearInterval(id);
  }, [fetchHoldings]);

  /* ── F&O positions (fetched once, shared by Overall preview + F&O tab) ── */
  const [fnoPositions, setFnoPositions] = useState<FnoPosition[]>(() => readCache<FnoPosition[]>("dash_fno_positions") ?? []);
  const [fnoLoading, setFnoLoading] = useState(false);
  const [fnoError, setFnoError] = useState<string | null>(null);

  const fetchFno = useCallback(async () => {
    setFnoLoading(true);
    const { ok, body, expired } = await authedGet("/getFnoPositionsForLoggedInUser");
    if (expired) { handleSessionExpired(); return; }
    if (!ok || !body?.success) {
      setFnoError(apiErrorMessage(body, "Unable to load your F&O positions right now."));
    } else {
      setFnoError(null);
      setFnoPositions(body.positions ?? []);
      writeCache("dash_fno_positions", body.positions ?? []);
    }
    setFnoLoading(false);
  }, []);

  useEffect(() => {
    fetchFno();
    const id = setInterval(fetchFno, 30_000);
    return () => clearInterval(id);
  }, [fetchFno]);

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

  function refreshAll() {
    if (bucket) { fetchSummary(bucket); fetchCurve(bucket, range); }
    fetchOverview();
    fetchHoldings();
    fetchFno();
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: T.bg }}>
      <Header
        isDark={isDark}
        onToggleTheme={() => setIsDark(d => { const n = !d; localStorage.setItem("theme", n ? "dark" : "light"); return n; })}
      />

      <main style={{ flex: 1 }}>
        {/* ── Tab bar ── */}
        <div style={{ borderBottom: `1px solid ${T.border}`, background: T.headerBar, position: "sticky", top: "64px", zIndex: 40 }}>
          <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: "4px" }}>
              {DASHBOARD_TABS.map(tab => {
                const active = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    style={{
                      padding: "14px 20px", fontSize: "14px", fontWeight: active ? 700 : 500,
                      color: active ? T.activeBorder : T.textMuted, background: "transparent", border: "none",
                      borderBottom: active ? `2px solid ${T.activeBorder}` : "2px solid transparent",
                      cursor: "pointer", transition: "all 0.2s", marginBottom: "-1px",
                    }}
                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = T.text; }}
                    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = T.textMuted; }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <button
              onClick={refreshAll}
              style={{
                display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "10px",
                background: "transparent", border: `1px solid ${T.border}`, color: T.textMuted,
                fontSize: "12px", fontWeight: 600, cursor: "pointer",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = T.text; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = T.textMuted; }}
            >
              <RefreshCw style={{ width: "13px", height: "13px" }} />
              Refresh
            </button>
          </div>
        </div>

        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "28px 24px 56px" }}>
          {activeTab === "Mutual Funds" ? (
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "16px" }}>
              <EmptyCard>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: T.text, marginBottom: "6px" }}>Mutual Funds dashboard is coming soon</div>
                  <div style={{ fontSize: "12px", color: T.textMuted }}>We're working on bringing your fund holdings and SIPs into this view.</div>
                </div>
              </EmptyCard>
            </div>
          ) : (
            <>
              <SummaryTiles summary={summary} loading={summaryLoading} error={summaryError} bucket={bucket!} T={T} />

              {activeTab === "Overall" && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", marginBottom: "24px" }}>
                  {overviewError && <div style={{ flex: "1 1 100%" }}><ErrorBanner message={overviewError} /></div>}
                  {[
                    { label: "Total Orders", value: overview?.orders.total_orders, sub: overview ? `${overview.orders.executed_orders} executed · ${overview.orders.pending_orders} pending` : undefined },
                    { label: "Total Trades", value: overview?.trades.total_trades, sub: overview ? `${overview.trades.buy_trades} buy · ${overview.trades.sell_trades} sell` : undefined },
                    { label: "Invested (Equity)", value: overview ? `₹${fmt(overview.portfolio.total_invested)}` : undefined, sub: overview ? `Return ${fmtPct(overview.portfolio.return_percentage)}` : undefined },
                  ].map(stat => (
                    <div key={stat.label} style={{ flex: "1 1 220px", minWidth: "200px", background: T.card, border: `1px solid ${T.border}`, borderRadius: "16px", padding: "16px 18px" }}>
                      <div style={{ fontSize: "11px", fontWeight: 600, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: "8px" }}>{stat.label}</div>
                      {overviewLoading && stat.value == null ? (
                        <div style={{ height: "22px", width: "90px", borderRadius: "6px", background: T.skeletonBg, animation: "pulse 1.5s ease-in-out infinite" }} />
                      ) : (
                        <div style={{ fontSize: "19px", fontWeight: 800, color: T.text }}>{stat.value ?? "—"}</div>
                      )}
                      {stat.sub && <div style={{ fontSize: "11px", color: T.textDim, marginTop: "4px" }}>{stat.sub}</div>}
                    </div>
                  ))}
                </div>
              )}

              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "16px", padding: "20px", marginBottom: "24px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: "14px" }}>
                  <div style={{ fontSize: "15px", fontWeight: 700, color: T.text }}>Portfolio Performance</div>
                  <div style={{ display: "flex", gap: "4px", background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)", padding: "3px", borderRadius: "10px" }}>
                    {RANGE_TABS.map(r => {
                      const active = range === r;
                      return (
                        <button
                          key={r}
                          onClick={() => setRange(r)}
                          style={{
                            padding: "5px 10px", fontSize: "12px", fontWeight: active ? 700 : 500, borderRadius: "7px",
                            background: active ? T.cardSolid : "transparent", color: active ? T.text : T.textMuted,
                            border: "none", cursor: "pointer",
                          }}
                        >
                          {r}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <EquityCurveChart points={curvePoints} loading={curveLoading} error={curveError} accent={tabDef.accent} range={range} T={T} isDark={isDark} />
              </div>

              {activeTab === "Overall" && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "20px" }}>
                  <div style={{ flex: "1 1 420px", minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                      <div style={{ fontSize: "15px", fontWeight: 700, color: T.text }}>Stock Holdings</div>
                      <button onClick={() => setActiveTab("Stocks")} style={{ background: "none", border: "none", color: "#3b82f6", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>View all →</button>
                    </div>
                    <StockHoldingsList holdings={holdings} loading={holdingsLoading} error={holdingsError} T={T} limit={5} />
                  </div>
                  <div style={{ flex: "1 1 420px", minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                      <div style={{ fontSize: "15px", fontWeight: 700, color: T.text }}>F&O Positions</div>
                      <button onClick={() => setActiveTab("F&O")} style={{ background: "none", border: "none", color: "#3b82f6", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>View all →</button>
                    </div>
                    <FnoPositionsList positions={fnoPositions} loading={fnoLoading} error={fnoError} T={T} limit={5} />
                  </div>
                </div>
              )}

              {activeTab === "Stocks" && (
                <div>
                  <div style={{ fontSize: "15px", fontWeight: 700, color: T.text, marginBottom: "12px" }}>Stock Holdings</div>
                  <StockHoldingsList holdings={holdings} loading={holdingsLoading} error={holdingsError} T={T} />
                </div>
              )}

              {activeTab === "F&O" && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                    <div style={{ fontSize: "15px", fontWeight: 700, color: T.text }}>F&O Positions</div>
                    <button
                      onClick={() => navigate("/explore/fno", { state: { tab: "Positions" } })}
                      style={{
                        display: "flex", alignItems: "center", gap: "6px", padding: "7px 14px", borderRadius: "9px",
                        background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)",
                        color: "#f59e0b", fontSize: "12px", fontWeight: 700, cursor: "pointer",
                      }}
                    >
                      <Briefcase style={{ width: "13px", height: "13px" }} />
                      Manage in F&O Terminal
                    </button>
                  </div>
                  <FnoPositionsList positions={fnoPositions} loading={fnoLoading} error={fnoError} T={T} />
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <Footer isDark={isDark} />
    </div>
  );
}
