export const BASE_URL = "https://api.primepiptrade.com";

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface MarketIndex {
  name: string;
  stock_code: string;
  value: number;
  change: number;
  change_pct: number;
  open?: number;
  high?: number;
  low?: number;
}

export interface MarketData {
  market_status: string;
  indices: MarketIndex[];
}

export interface IndexData {
  name: string;
  symbol: string;
  value: number;
  change: number;
  change_pct: number;
}

export function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Name variants to match against /api/market/indices for live tick updates
export const INDEX_MATCH_VARIANTS: Record<string, string[]> = {
  nifty: ["nifty50", "nifty"],
  nifty50: ["nifty50", "nifty"],
  sensex: ["sensex"],
  banknifty: ["banknifty", "niftybank"],
  midcpnifty: ["midcapnifty", "niftymidcapselect", "midcpnifty"],
  finnifty: ["finnifty", "niftyfinancialservices"],
  indiavix: ["indiavix"],
};

export const UNDERLYING_DISPLAY: Record<string, string> = {
  nifty: "NIFTY", nifty50: "NIFTY",
  banknifty: "BANKNIFTY",
  finnifty: "FINNIFTY",
  midcpnifty: "MIDCPNIFTY",
  sensex: "SENSEX",
  indiavix: "INDIA VIX",
};

// NSE lot sizes as of latest circular we have on file — these are revised
// periodically by the exchange, so verify against the current NSE circular
// before treating this as authoritative for real trading.
export const LOT_SIZE_MAP: Record<string, number> = {
  nifty: 75, nifty50: 75,
  banknifty: 35,
  finnifty: 65,
  midcpnifty: 140,
  sensex: 10,
};
export const DEFAULT_LOT_SIZE = 50;

export const STRIKE_STEP_MAP: Record<string, number> = {
  nifty: 50, nifty50: 50,
  banknifty: 100,
  finnifty: 50,
  midcpnifty: 25,
  sensex: 100,
};
export const DEFAULT_STRIKE_STEP = 50;

// Only used as a placeholder before the real option-chain stream's first
// frame arrives (which always carries the actual expiry) — never trust this
// for anything beyond that brief initial render.
export const CURRENT_EXPIRY = "07 Jul 2026";

// Only these underlyings have live-data endpoints deployed (candles and
// option chain). Others (midcpnifty, indiavix) fall back to an honest
// "not available" state rather than fake data.
export const SUPPORTED_UNDERLYING_SLUGS: Record<string, string> = {
  nifty: "nifty", nifty50: "nifty",
  banknifty: "banknifty",
  finnifty: "finnifty",
  sensex: "sensex",
};

export interface OptionLeg {
  ltp: number;
  bid: number;
  ask: number;
  oi: number;
  oi_change: number;
  volume: number;
  iv: number | null; // fraction, e.g. 0.337 = 33.7% — not a percentage
}

export interface OptionStrikeRow {
  strike: number;
  ce: OptionLeg | null;
  pe: OptionLeg | null;
}

export interface OptionChainErrorEntry {
  reason: string;
}

export interface OptionChainResponse {
  symbol: string;
  exchange: string;
  expiry: string; // YYYY-MM-DD
  spot: number;
  strikes: OptionStrikeRow[];
  errors: OptionChainErrorEntry[];
  last_updated: string;
}

// "2026-07-07" -> "07 Jul 2026", matching the "DD Mon YYYY" shape expiryToSymbolCode expects.
export function isoExpiryToDisplay(iso: string): string {
  const [y, m, d] = iso.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthName = months[parseInt(m, 10) - 1] ?? m;
  return `${d} ${monthName} ${y}`;
}

// "07 Jul 2026" -> "07JUL26", matching NSE-style contract symbol suffixes.
export function expiryToSymbolCode(expiry: string): string {
  const [day, mon, year] = expiry.split(" ");
  return `${day}${mon.toUpperCase()}${year.slice(2)}`;
}

export function buildOptionSymbol(underlying: string, expiry: string, strike: number, optionType: "CE" | "PE"): string {
  return `${underlying}${expiryToSymbolCode(expiry)}${strike}${optionType}`;
}

// The order API returns either a plain string `detail`, or (on pydantic
// validation failures) an array of { loc, msg, ... } objects. Normalize both
// into one human-readable line.
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

