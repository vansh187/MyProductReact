export const BASE_URL = "https://api.primepiptrade.com";

export type Bucket = "ALL" | "STOCKS" | "FNO";
export type RangeKey = "1D" | "1W" | "1M" | "3M" | "1Y" | "All";

export const RANGE_OPTIONS: RangeKey[] = ["1D", "1W", "1M", "3M", "1Y", "All"];

// ── /getDashboardSummary ───────────────────────────────────────────────
export interface DashboardSummary {
  orders: {
    total_orders: number;
    pending_orders: number;
    executed_orders: number;
    partially_executed_orders: number;
    cancelled_orders: number;
    failed_orders: number;
  };
  trades: {
    total_trades: number;
    buy_trades: number;
    sell_trades: number;
  };
  portfolio: {
    total_invested: number;
    total_holdings: number;
    unrealized_pnl: number;
    return_percentage: number;
    total_positions: number;
    last_updated: string | null;
  };
  last_updated: string | null;
}

// ── /getAssetClassSummary ──────────────────────────────────────────────
export interface AssetClassSummary {
  bucket: Bucket;
  net_value: number;
  todays_pnl: number;
  total_unrealized_pnl: number;
  buying_power: number;
  last_updated: string | null;
}

// ── /getPortfolioEquityCurve ───────────────────────────────────────────
export interface EquityCurvePoint {
  net_value: number;
  total_unrealized_pnl: number;
  buying_power: number;
  captured_at: string;
}

// ── /getPortfolioOfLoggedInUserWithProfitLoss ──────────────────────────
export interface HoldingRow {
  symbol: string;
  quantity: number;
  avg_price: number;
  current_price: number;
  pnl: number;
  asset_type: string;
}

// ── /getFnoPositionsForLoggedInUser ────────────────────────────────────
export interface FnoPositionRow {
  symbol: string;
  underlying: string | null;
  exchange: string;
  expiry: string | null;
  strike: number | null;
  option_type: string | null;
  contract_type: string;
  lot_size: number | null;
  product_type: string;
  netqty: number;
  netavgprc: number;
  buyqty: number;
  sellqty: number;
  buyavgprc: number;
  sellavgprc: number;
  realized_pnl: number;
  status: "OPEN" | "CLOSED";
}

type ApiEnvelope<T> = T & { success: boolean; message?: string };

async function authedGet<T>(path: string): Promise<ApiEnvelope<T>> {
  const token = localStorage.getItem("authToken");
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (res.status === 401) {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = "/";
    throw new Error("Session expired");
  }

  const body: ApiEnvelope<T> = await res.json();
  if (!res.ok || body.success === false) {
    throw new Error(body.message || `Request failed (${res.status})`);
  }
  return body;
}

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const body = await authedGet<{ dashboard: DashboardSummary }>("/getDashboardSummary");
  return body.dashboard;
}

export async function fetchAssetClassSummary(bucket: Bucket): Promise<AssetClassSummary> {
  const body = await authedGet<{ summary: AssetClassSummary }>(`/getAssetClassSummary?bucket=${bucket}`);
  return body.summary;
}

export async function fetchEquityCurve(bucket: Bucket, range: RangeKey): Promise<EquityCurvePoint[]> {
  const body = await authedGet<{ points: EquityCurvePoint[] }>(
    `/getPortfolioEquityCurve?bucket=${bucket}&range=${encodeURIComponent(range)}`
  );
  return body.points;
}

export async function fetchHoldings(bucket?: "STOCKS"): Promise<{ total_pnl: number; portfolio: HoldingRow[] }> {
  const qs = bucket ? `?bucket=${bucket}` : "";
  const body = await authedGet<{ total_pnl: number; portfolio: HoldingRow[] }>(
    `/getPortfolioOfLoggedInUserWithProfitLoss${qs}`
  );
  return body;
}

export async function fetchFnoPositions(): Promise<FnoPositionRow[]> {
  const body = await authedGet<{ positions: FnoPositionRow[] }>("/getFnoPositionsForLoggedInUser");
  return body.positions;
}

// ── Formatters ──────────────────────────────────────────────────────────
export function fmtCurrency(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "—";
  return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

export function fmtCurrencyCompact(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "—";
  return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

export function fmtSigned(n: number | null | undefined, prefix = "₹"): string {
  if (n == null || isNaN(n)) return "—";
  const sign = n >= 0 ? "+" : "-";
  return `${sign}${prefix}${Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export function fmtPct(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "—";
  return (n >= 0 ? "+" : "") + n.toFixed(2) + "%";
}

export function pnlColor(n: number | null | undefined): string {
  if (n == null || isNaN(n) || n === 0) return "#8b949e";
  return n > 0 ? "#00E676" : "#FF5252";
}

// ── Mock News (no backend integration exists yet) ──────────────────────
export interface NewsItem {
  headline: string;
  source: string;
  time: string;
  sentiment: "positive" | "negative" | "neutral";
}

export const MOCK_NEWS: Record<"overall" | "stocks" | "fno" | "mutualfunds", NewsItem[]> = {
  overall: [
    { headline: "Nifty 50 ends flat as investors await Fed rate decision", source: "Moneycontrol", time: "2h ago", sentiment: "neutral" },
    { headline: "FII inflows turn positive for the third straight session", source: "Economic Times", time: "4h ago", sentiment: "positive" },
    { headline: "RBI holds repo rate steady at 6.5%", source: "Business Standard", time: "1d ago", sentiment: "neutral" },
  ],
  stocks: [
    { headline: "Reliance Industries announces new energy JV", source: "Livemint", time: "1h ago", sentiment: "positive" },
    { headline: "TCS Q2 results beat street estimates", source: "CNBC-TV18", time: "3h ago", sentiment: "positive" },
    { headline: "IT sector faces margin pressure amid rupee volatility", source: "Moneycontrol", time: "6h ago", sentiment: "negative" },
  ],
  fno: [
    { headline: "Nifty options see heavy Call writing at 25000 strike", source: "Economic Times", time: "45m ago", sentiment: "neutral" },
    { headline: "India VIX drops below 12, signals low volatility ahead", source: "Moneycontrol", time: "2h ago", sentiment: "positive" },
    { headline: "F&O ban list adds two stocks amid high open interest", source: "Business Standard", time: "5h ago", sentiment: "negative" },
  ],
  mutualfunds: [
    { headline: "SIP inflows cross ₹20,000 crore for the fourth month running", source: "Livemint", time: "3h ago", sentiment: "positive" },
    { headline: "SEBI proposes new disclosure norms for mutual fund expense ratios", source: "Economic Times", time: "1d ago", sentiment: "neutral" },
  ],
};

// ── Mock Greeks (UI placeholder only — no live F&O price feed exists to
// compute real Greeks; these numbers are NOT derived from live market data
// and must not be used for actual trading decisions) ────────────────────
export interface GreeksSnapshot {
  delta: number;
  theta: number;
  gamma: number;
  vega: number;
  iv: number;
  ivSkew: number;
}

export type ExpiryUrgency = "expired" | "critical" | "warning" | "normal";

export interface ExpiryCountdown {
  text: string;
  urgency: ExpiryUrgency;
}

// NSE F&O contracts expire at market close (15:30 IST) on the expiry date,
// regardless of the viewer's own timezone - the "+05:30" offset pins that.
export function formatTimeToExpiry(expiryIso: string | null, now: Date = new Date()): ExpiryCountdown | null {
  if (!expiryIso) return null;
  const expiryAt = new Date(`${expiryIso}T15:30:00+05:30`);
  const diffMs = expiryAt.getTime() - now.getTime();

  if (diffMs <= 0) return { text: "Expired", urgency: "expired" };

  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  const text = days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  const urgency: ExpiryUrgency =
    diffMs < 24 * 60 * 60 * 1000 ? "critical" : diffMs < 3 * 24 * 60 * 60 * 1000 ? "warning" : "normal";

  return { text, urgency };
}

export function mockGreeksFor(symbol: string): GreeksSnapshot {
  // Deterministic pseudo-random spread per symbol so values are stable
  // across re-renders instead of jumping around, while still being
  // obviously synthetic (see disclaimer shown alongside this data in the UI).
  let seed = 0;
  for (let i = 0; i < symbol.length; i++) seed = (seed * 31 + symbol.charCodeAt(i)) % 997;
  const rand = (min: number, max: number) => min + ((seed % 100) / 100) * (max - min);
  return {
    delta: Number(rand(-0.6, 0.6).toFixed(3)),
    theta: Number(rand(-0.08, -0.01).toFixed(3)),
    gamma: Number(rand(0.001, 0.02).toFixed(3)),
    vega: Number(rand(0, 0.15).toFixed(3)),
    iv: Number(rand(12, 28).toFixed(2)),
    ivSkew: Number(rand(-6, 6).toFixed(2)),
  };
}
