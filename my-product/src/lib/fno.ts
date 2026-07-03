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

export const CURRENT_EXPIRY = "07 Jul 2026";

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

export interface OptionQuote {
  strike: number;
  ce: { premium: number; iv: number; oi: number };
  pe: { premium: number; iv: number; oi: number };
}

// Deterministic pseudo-random in [0,1), seeded by an integer — used so option
// chain premiums stay stable across re-renders instead of jumping every time
// React repaints (which plain Math.random() in JSX was doing before).
export function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

// Builds a synthetic option chain centered on the live spot price. Premium =
// intrinsic value + a stable pseudo-random time-value component. This is a
// simulator, not a real pricing model (no Black-Scholes/greeks) — good enough
// to exercise the order-ticket flow before the backend order book exists.
export function buildOptionChain(spot: number, strikeStep: number, count = 9): OptionQuote[] {
  if (!spot || isNaN(spot)) return [];
  const center = Math.round(spot / strikeStep) * strikeStep;
  const half = Math.floor(count / 2);
  const strikes: number[] = [];
  for (let i = -half; i <= half; i++) strikes.push(center + i * strikeStep);

  return strikes.map(strike => {
    const callIntrinsic = Math.max(spot - strike, 0);
    const putIntrinsic = Math.max(strike - spot, 0);
    const timeValue = 20 + seededRandom(strike) * 60;
    return {
      strike,
      ce: {
        premium: Math.max(callIntrinsic + timeValue, 0.5),
        iv: 15 + seededRandom(strike + 1) * 20,
        oi: Math.floor(10000 + seededRandom(strike + 2) * 50000),
      },
      pe: {
        premium: Math.max(putIntrinsic + timeValue, 0.5),
        iv: 15 + seededRandom(strike + 3) * 20,
        oi: Math.floor(10000 + seededRandom(strike + 4) * 50000),
      },
    };
  });
}
