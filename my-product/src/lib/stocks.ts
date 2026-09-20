export const BASE_URL = "https://api.primepiptrade.com";
// All stock-market-data endpoints are public reads, no auth header required
// (same convention as mutual funds — see lib/mutualfunds.ts).
export const STOCK_API_BASE = `${BASE_URL}/api/stocks`;
export const SEARCH_API_BASE = `${BASE_URL}/api/search`;

export type StockExchange = "NSE" | "BSE";

export interface StockSummary {
  symbol: string;          // e.g. "RELIANCE"
  exchange: StockExchange;
  name: string;             // e.g. "Reliance Industries Ltd"
  ltp: number;
  change: number;
  change_pct: number;
  volume: number;
  sector?: string | null;
}

export interface StockCollectionTile {
  key: string;
  title: string;
  icon_hint: string;
}

export interface StockExploreResponse {
  trending: StockSummary[];
  top_gainers: StockSummary[];
  top_losers: StockSummary[];
  most_active: StockSummary[];
  collections: StockCollectionTile[];
  market_status: "OPEN" | "CLOSED" | "PRE_OPEN";
}

export interface StockFacetsResponse {
  exchanges: StockExchange[];
  sectors: string[];
}

export interface MarketDepthLevel {
  price: number;
  qty: number;
  orders?: number;
}

export interface MarketDepth {
  bids: MarketDepthLevel[]; // best 5
  asks: MarketDepthLevel[]; // best 5
}

export interface StockQuote {
  symbol: string;
  exchange: StockExchange;
  name: string;
  ltp: number;
  change: number;
  change_pct: number;
  open: number;
  high: number;
  low: number;
  close: number;       // previous close
  volume: number;
  avg_price: number | null;
  upper_circuit: number | null;
  lower_circuit: number | null;
  week_52_high: number | null;
  week_52_low: number | null;
  market_cap: number | null;
  pe_ratio: number | null;
  depth: MarketDepth | null;
  is_market_open: boolean;
  last_updated: string; // ISO timestamp
}

export interface StockCandle {
  timestamp: number; // epoch seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type StockChartPeriod = "1d" | "1w" | "1m" | "6m" | "1y" | "5y";

export interface StockChartResponse {
  symbol: string;
  period: StockChartPeriod;
  candles: StockCandle[];
}

// ── Combined search (navbar) ─────────────────────────────
export interface CombinedSearchResponse {
  stocks: StockSummary[];
  mutual_funds: Array<{
    scheme_code: number;
    scheme_name: string;
    fund_house: string;
    latest_nav: number | null;
  }>;
}

export function fmtPrice(n: unknown): string {
  if (n == null || typeof n !== "number" || isNaN(n)) return "—";
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtPct(n: unknown): string {
  if (n == null || typeof n !== "number" || isNaN(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

export function fmtVolume(n: unknown): string {
  if (n == null || typeof n !== "number" || isNaN(n)) return "—";
  if (n >= 1e7) return `${(n / 1e7).toFixed(2)}Cr`;
  if (n >= 1e5) return `${(n / 1e5).toFixed(2)}L`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}

// Same error-shape convention used across the rest of the app (see
// lib/mutualfunds.ts / lib/fno.ts) — backend returns { detail: "..." } on
// errors, occasionally an array of pydantic validation issues.
export function extractErrorMessage(body: any, fallback: string): string {
  const detail = body?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d: any) => {
        const field = Array.isArray(d?.loc) ? d.loc.slice(-1)[0] : d?.loc;
        return field ? `${field}: ${d?.msg ?? "invalid value"}` : d?.msg ?? "invalid value";
      })
      .join("; ");
  }
  return fallback;
}
