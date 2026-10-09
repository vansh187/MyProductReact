import { useSyncExternalStore } from "react";
import { BASE_URL } from "./fno";
import { perfEnabled, logStreamLag } from "./perf";

// One app-wide live indices feed. Every screen that shows index prices
// (landing, home hero, explore F&O, terminal header, option chain header)
// reads from this store; no component opens its own stream or polls.
//
//  - REST /api/market/indices only for the very first paint, or as a
//    fallback once the stream has been down for more than 5 s.
//  - The stream is never closed on unmount / route change / auth change —
//    market data is public and needs no token.
//  - Reconnects with exponential backoff (1 s, 2 s, 4 s … 30 s).

export type IndexQuote = {
  name: string;
  stock_code: string;
  exchange?: string;
  value: number;
  open?: number;
  high?: number;
  low?: number;
  change: number;
  change_pct: number;
  as_of?: string | null; // tick time (ISO, IST)
  source?: string;
};

export type IndicesState = {
  indices: IndexQuote[];
  marketStatus: string | null;
  srvTs: number | null; // epoch ms the server sent the frame
  live: boolean;        // stream connected and delivering
};

const CACHE_KEY = "cachedMarketData";
const CACHE_WRITE_MS = 5000;

function readCache(): IndicesState {
  try {
    const c = localStorage.getItem(CACHE_KEY);
    if (c) {
      const d = JSON.parse(c);
      return {
        indices: Array.isArray(d?.indices) ? d.indices : [],
        marketStatus: d?.market_status ?? null,
        srvTs: null,
        live: false,
      };
    }
  } catch { /* ignore */ }
  return { indices: [], marketStatus: null, srvTs: null, live: false };
}

let state: IndicesState = readCache();
const listeners = new Set<() => void>();
let es: EventSource | null = null;
let started = false;
let retry = 0;
let fallbackTimer: number | undefined;
let reconnectTimer: number | undefined;
let lastCacheWrite = 0;

function set(next: Partial<IndicesState>) {
  state = { ...state, ...next };
  listeners.forEach(l => l());
}

type IndicesFrame = { market_status?: string; indices?: IndexQuote[]; srv_ts?: number };

function applyFrame(d: IndicesFrame | null, live: boolean) {
  if (!d || typeof d !== "object" || !Array.isArray(d.indices)) return;
  set({
    indices: d.indices,
    marketStatus: d.market_status ?? state.marketStatus,
    srvTs: d.srv_ts ?? null,
    live,
  });
  const now = Date.now();
  if (now - lastCacheWrite > CACHE_WRITE_MS) {
    lastCacheWrite = now;
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ market_status: d.market_status, indices: d.indices }));
    } catch { /* ignore */ }
  }
}

async function restSnapshot() {
  try {
    const r = await fetch(`${BASE_URL}/api/market/indices`); // public: no auth header
    if (!r.ok) return;
    const d = await r.json();
    if (!state.live) applyFrame(d, false);
  } catch { /* stream will retry */ }
}

function connect() {
  reconnectTimer = undefined;
  es = new EventSource(`${BASE_URL}/api/market/indices/stream`);
  es.onopen = () => {
    retry = 0;
    window.clearTimeout(fallbackTimer);
  };
  es.onmessage = (e) => {
    try {
      const d = JSON.parse(e.data);
      applyFrame(d, true);
      if (perfEnabled()) logStreamLag("indices", d.srv_ts);
    } catch (err) {
      console.error("[indicesStream] parse error:", err);
    }
  };
  es.onerror = () => {
    es?.close();
    es = null;
    set({ live: false });
    window.clearTimeout(fallbackTimer);
    fallbackTimer = window.setTimeout(restSnapshot, 5000); // REST only if down > 5 s
    if (reconnectTimer === undefined) {
      reconnectTimer = window.setTimeout(connect, Math.min(30000, 1000 * 2 ** retry++));
    }
  };
}

function start() {
  if (started) return;
  started = true;
  if (state.indices.length === 0) restSnapshot(); // first paint (cache covers the rest)
  connect();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  start();
  return () => { listeners.delete(listener); }; // stream stays open on unmount
}

const getState = () => state;

export function useIndices(): IndicesState {
  return useSyncExternalStore(subscribe, getState);
}

// Subscribe to a slice. `select` must return either a primitive or a value
// taken straight from the state (not a freshly built object), so it is
// referentially stable between frames that didn't touch it.
export function useIndicesSelector<T>(select: (s: IndicesState) => T): T {
  return useSyncExternalStore(subscribe, () => select(state));
}

export function normalizeIndexName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function findIndex(indices: IndexQuote[], matchVariants: string[]): IndexQuote | undefined {
  return indices.find(i => {
    const n = normalizeIndexName(i.name || "");
    return matchVariants.some(v => n === v || n.includes(v));
  });
}

// "updated Xs ago" source: the freshest tick time across all indices.
export function latestAsOf(indices: IndexQuote[]): number | null {
  let best: number | null = null;
  for (const i of indices) {
    if (!i.as_of) continue;
    const t = Date.parse(i.as_of);
    if (!Number.isNaN(t) && (best === null || t > best)) best = t;
  }
  return best;
}
