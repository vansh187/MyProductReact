import type { StockSummary } from "./stocks";

// Stock watchlist — no backend endpoint exists for this yet, so it's a
// client-side, localStorage-backed list keyed by "EXCHANGE:SYMBOL", same
// pattern as lib/wishlist.ts for mutual funds.
const STORAGE_KEY = "stockWishlist";
const EVENT_NAME = "stock-wishlist-changed";

let cachedRaw: string | null = null;
let cachedList: StockSummary[] = [];

function keyOf(s: Pick<StockSummary, "symbol" | "exchange">): string {
  return `${s.exchange}:${s.symbol}`;
}

function readAll(): StockSummary[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cachedList;
  cachedRaw = raw;
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    cachedList = Array.isArray(parsed) ? parsed : [];
  } catch {
    cachedList = [];
  }
  return cachedList;
}

function writeAll(list: StockSummary[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event(EVENT_NAME));
}

export function getStockWishlist(): StockSummary[] {
  return readAll();
}

export function isStockWishlisted(symbol: string, exchange: string): boolean {
  return readAll().some(s => keyOf(s) === `${exchange}:${symbol}`);
}

export function toggleStockWishlist(stock: StockSummary): boolean {
  const list = readAll();
  const exists = list.some(s => keyOf(s) === keyOf(stock));
  if (exists) {
    writeAll(list.filter(s => keyOf(s) !== keyOf(stock)));
    return false;
  }
  writeAll([stock, ...list]);
  return true;
}

export function subscribeStockWishlist(callback: () => void): () => void {
  window.addEventListener(EVENT_NAME, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT_NAME, callback);
    window.removeEventListener("storage", callback);
  };
}
