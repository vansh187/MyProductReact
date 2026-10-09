import { useCallback, useEffect, useSyncExternalStore } from "react";
import { BASE_URL } from "./fno";
import { perfEnabled, logStreamLag, mark, measure } from "./perf";

// Shared live option chain, one feed per (underlying, expiry), on the
// backend's delta protocol (/optionchain/stream?format=delta):
//   t:"s" snapshot {seq, sym, exch, exp, spot, srv_ts, rows:[[strike, ce_token, pe_token, ce|null, pe|null]]} → replace
//   t:"d" delta    {seq, spot, srv_ts, u:[[token, {changed fields}]]}                                     → merge
//   t:"e" status   {sym, exp, errors:[{reason}], srv_ts}                                                  → banner, keep data
// A delta whose seq isn't last seq + 1 means one was missed: reopen for a
// fresh snapshot.
//
// State is normalized: `rows` (strike + tokens, stable order, only replaced
// on a snapshot) and `quotes` by token. Each price cell subscribes to one
// token, so a tick re-renders just the cells whose leg changed. Messages
// are queued and applied once per animation frame.
//
// The feed outlives the chain view by KEEP_WARM_MS, so going terminal →
// chain → terminal → chain paints instantly from the last state.

export type OptionLeg = {
  tsym?: string;
  token?: string;
  lot_size?: number;
  tick_size?: number;
  ltp: number | null;
  bid: number | null;
  ask: number | null;
  volume?: number | null;
  oi?: number | null;
  poi?: number | null;
  oi_change?: number | null;
  iv: number | null;        // fraction, e.g. 0.337 = 33.7%
  ltp_stale?: boolean;      // no trade today
  ts?: string | number | null;
  exch_ts?: string | number | null;
};

export type ChainRow = { strike: number; ceToken: string | null; peToken: string | null };

export type ChainStatus = "connecting" | "live" | "reconnecting" | "unavailable";

export type ChainMeta = {
  status: ChainStatus;
  errorReason: string | null;
  sym: string | null;
  exch: string | null;
  exp: string | null;     // YYYY-MM-DD
  spot: number | null;
  rows: ChainRow[];
  srvTs: number | null;
};

const KEEP_WARM_MS = 60_000;
const UNAVAILABLE_REASONS = new Set(["no_option_data", "no_expiry_available", "initialization_failed", "option_chain_failed"]);

type SnapshotRow = [number, string | number | null, string | number | null, OptionLeg | null, OptionLeg | null];
type Msg = {
  t?: "s" | "d" | "e";
  seq?: number;
  sym?: string;
  exch?: string;
  exp?: string;
  spot?: number | null;
  srv_ts?: number;
  rows?: SnapshotRow[];
  u?: [string | number, Partial<OptionLeg>][];
  errors?: { reason?: string }[];
};

export class ChainFeed {
  readonly slug: string;
  readonly expiry: string | null;

  private meta: ChainMeta = {
    status: "connecting", errorReason: null, sym: null, exch: null, exp: null, spot: null, rows: [], srvTs: null,
  };
  private quotes = new Map<string, OptionLeg>();
  private metaListeners = new Set<() => void>();
  private tokenListeners = new Map<string, Set<() => void>>();

  private es: EventSource | null = null;
  private seq: number | null = null;
  private queue: Msg[] = [];
  private raf: number | null = null;
  private refs = 0;
  private closeTimer: number | undefined;
  private reconnectTimer: number | undefined;
  private retry = 0;
  private gotFirstMsg = false;

  constructor(slug: string, expiry: string | null) {
    this.slug = slug;
    this.expiry = expiry;
  }

  // ── lifecycle ─────────────────────────────────────────────

  retain() {
    this.refs++;
    window.clearTimeout(this.closeTimer);
    if (!this.es && this.reconnectTimer === undefined) this.open();
  }

  release() {
    this.refs = Math.max(0, this.refs - 1);
    if (this.refs > 0) return;
    window.clearTimeout(this.closeTimer);
    this.closeTimer = window.setTimeout(() => this.close(), KEEP_WARM_MS);
  }

  private open() {
    this.reconnectTimer = undefined;
    const params = new URLSearchParams({ format: "delta" });
    if (this.expiry) params.set("expiry", this.expiry);
    const es = new EventSource(`${BASE_URL}/api/market/${this.slug}/optionchain/stream?${params}`);
    this.es = es;
    this.seq = null;

    es.onopen = () => { this.retry = 0; };
    es.onmessage = (e) => {
      let d: Msg;
      try { d = JSON.parse(e.data); } catch (err) { console.error("[optionChain] parse error:", err); return; }
      if (!this.gotFirstMsg) {
        this.gotFirstMsg = true;
        mark("chain:first-msg");
        measure("chain click→first-msg", "chain:click");
      }
      if (perfEnabled()) logStreamLag(`chain:${this.slug}`, d?.srv_ts);
      this.queue.push(d);
      if (this.raf === null) this.raf = requestAnimationFrame(() => this.flush());
    };
    es.onerror = () => {
      this.setMeta({ status: this.meta.status === "unavailable" ? "unavailable" : "reconnecting" });
      // The browser retries on its own while readyState is CONNECTING (and the
      // server sends a fresh snapshot on reconnect). Only a hard failure
      // (CLOSED) needs a manual reopen.
      if (es.readyState === EventSource.CLOSED) {
        this.es = null;
        this.scheduleReopen();
      }
    };
  }

  private close() {
    this.es?.close();
    this.es = null;
    window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;
    if (this.raf !== null) { cancelAnimationFrame(this.raf); this.raf = null; }
    this.queue = [];
    this.seq = null;
    // Data is kept: a later retain() shows it instantly while reconnecting.
    if (this.meta.status === "live") this.setMeta({ status: "reconnecting" });
  }

  private scheduleReopen() {
    if (this.refs === 0 || this.reconnectTimer !== undefined) return;
    this.reconnectTimer = window.setTimeout(() => this.open(), Math.min(30000, 1000 * 2 ** this.retry++));
  }

  private resync() {
    this.es?.close();
    this.es = null;
    this.queue = [];
    this.seq = null;
    this.open();
  }

  // ── message application (once per frame) ─────────────────

  private flush() {
    this.raf = null;
    const batch = this.queue;
    this.queue = [];

    const changed = new Set<string>();
    let metaPatch: Partial<ChainMeta> | null = null;
    const patch = (p: Partial<ChainMeta>) => { metaPatch = { ...(metaPatch ?? {}), ...p }; };

    for (const d of batch) {
      if (!d || typeof d !== "object") continue;

      if (d.t === "s") {
        const rows: ChainRow[] = [];
        const quotes = new Map<string, OptionLeg>();
        for (const r of Array.isArray(d.rows) ? d.rows : []) {
          const [strike, ceTok, peTok, ce, pe] = r;
          const ceToken = ceTok != null ? String(ceTok) : null;
          const peToken = peTok != null ? String(peTok) : null;
          rows.push({ strike: Number(strike), ceToken, peToken });
          if (ceToken && ce) quotes.set(ceToken, ce);
          if (peToken && pe) quotes.set(peToken, pe);
        }
        for (const t of this.quotes.keys()) changed.add(t);
        for (const t of quotes.keys()) changed.add(t);
        this.quotes = quotes;
        this.seq = typeof d.seq === "number" ? d.seq : null;
        patch({
          rows, sym: d.sym ?? null, exch: d.exch ?? null, exp: d.exp ?? null,
          spot: typeof d.spot === "number" ? d.spot : null, srvTs: d.srv_ts ?? null,
          status: rows.length > 0 ? "live" : "unavailable",
          errorReason: rows.length > 0 ? null : "no_option_data",
        });
      } else if (d.t === "d") {
        if (this.seq === null || d.seq !== this.seq + 1) {
          // Missed a delta (or got one before any snapshot): start over.
          this.resync();
          break;
        }
        this.seq = d.seq;
        for (const [tok, fields] of Array.isArray(d.u) ? d.u : []) {
          if (tok == null || !fields) continue;
          const token = String(tok);
          const prev = this.quotes.get(token);
          this.quotes.set(token, { ...(prev ?? { ltp: null, bid: null, ask: null, iv: null }), ...fields });
          changed.add(token);
        }
        patch({ srvTs: d.srv_ts ?? null, status: "live", errorReason: null, ...(typeof d.spot === "number" ? { spot: d.spot } : {}) });
      } else if (d.t === "e") {
        const reason: string | undefined = Array.isArray(d.errors) ? d.errors[0]?.reason : undefined;
        const status: ChainStatus =
          reason === "connecting" ? (this.meta.rows.length ? "reconnecting" : "connecting")
          : reason && UNAVAILABLE_REASONS.has(reason) ? "unavailable"
          : "reconnecting";
        patch({ status, errorReason: reason ?? null, srvTs: d.srv_ts ?? null, ...(d.exp ? { exp: d.exp } : {}) });
      }
    }

    if (metaPatch) this.setMeta(metaPatch);
    for (const t of changed) this.tokenListeners.get(t)?.forEach(l => l());
  }

  private setMeta(p: Partial<ChainMeta>) {
    this.meta = { ...this.meta, ...p };
    this.metaListeners.forEach(l => l());
  }

  // ── subscriptions ─────────────────────────────────────────

  subscribeMeta = (l: () => void) => {
    this.metaListeners.add(l);
    return () => { this.metaListeners.delete(l); };
  };

  getMeta = () => this.meta;

  subscribeToken(token: string, l: () => void) {
    let set = this.tokenListeners.get(token);
    if (!set) { set = new Set(); this.tokenListeners.set(token, set); }
    set.add(l);
    return () => {
      set!.delete(l);
      if (set!.size === 0) this.tokenListeners.delete(token);
    };
  }

  getLeg(token: string | null | undefined): OptionLeg | undefined {
    return token ? this.quotes.get(token) : undefined;
  }
}

const feeds = new Map<string, ChainFeed>();

export function getChainFeed(slug: string, expiry: string | null = null): ChainFeed {
  const key = `${slug}|${expiry ?? ""}`;
  let feed = feeds.get(key);
  if (!feed) { feed = new ChainFeed(slug, expiry); feeds.set(key, feed); }
  return feed;
}

// Open the stream ahead of navigation (hover/focus on a "Chain" button), so
// the first snapshot is usually already there when the chain view mounts.
// Kept warm for KEEP_WARM_MS if the view never mounts.
export function prefetchOptionChain(slug: string | undefined, expiry: string | null = null) {
  if (!slug) return;
  const feed = getChainFeed(slug, expiry);
  feed.retain();
  feed.release();
}

// Hold the feed open while the calling component is mounted. `feed` may be
// null (unsupported underlying).
export function useChainFeed(feed: ChainFeed | null) {
  useEffect(() => {
    if (!feed) return;
    feed.retain();
    return () => feed.release();
  }, [feed]);
}

const EMPTY_META: ChainMeta = {
  status: "unavailable", errorReason: null, sym: null, exch: null, exp: null, spot: null, rows: [], srvTs: null,
};
const noopSubscribe = () => () => {};

// `select` must return a primitive or a value taken straight from the meta
// object, so unrelated updates don't re-render the caller.
export function useChainMeta<T>(feed: ChainFeed | null, select: (m: ChainMeta) => T): T {
  return useSyncExternalStore(
    feed ? feed.subscribeMeta : noopSubscribe,
    () => select(feed ? feed.getMeta() : EMPTY_META),
  );
}

// One leg's live quote; re-renders only when that token ticks.
export function useLeg(feed: ChainFeed | null, token: string | null | undefined): OptionLeg | undefined {
  const subscribe = useCallback(
    (l: () => void) => (feed && token ? feed.subscribeToken(token, l) : () => {}),
    [feed, token],
  );
  return useSyncExternalStore(subscribe, () => feed?.getLeg(token));
}
