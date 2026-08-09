import type { MFFundSummary } from "./mutualfunds";

// Mutual fund wishlist — no backend endpoint exists for this yet (unlike
// positions/orders), so it's a client-side, localStorage-backed list keyed
// by scheme_code. Swapping this for a real synced backend later only means
// changing what's inside these functions, not any of the call sites.
const STORAGE_KEY = "mfWishlist";
const EVENT_NAME = "mf-wishlist-changed";

// useSyncExternalStore requires getSnapshot to return a referentially
// stable value when nothing has changed — parsing JSON fresh on every call
// returns a new array each time, which reads as "the store changed" on
// every render and causes an infinite update loop. Cache the parsed result
// and only reparse when the raw localStorage string actually changes.
let cachedRaw: string | null = null;
let cachedList: MFFundSummary[] = [];

function readAll(): MFFundSummary[] {
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

function writeAll(list: MFFundSummary[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  // Same-tab listeners (React components) need an explicit event — the
  // native "storage" event only fires in *other* tabs/windows.
  window.dispatchEvent(new Event(EVENT_NAME));
}

export function getWishlist(): MFFundSummary[] {
  return readAll();
}

export function isWishlisted(schemeCode: number): boolean {
  return readAll().some(f => f.scheme_code === schemeCode);
}

export function addToWishlist(fund: MFFundSummary) {
  const list = readAll();
  if (list.some(f => f.scheme_code === fund.scheme_code)) return;
  writeAll([fund, ...list]);
}

export function removeFromWishlist(schemeCode: number) {
  writeAll(readAll().filter(f => f.scheme_code !== schemeCode));
}

// Returns the resulting membership state (true = now wishlisted).
export function toggleWishlist(fund: MFFundSummary): boolean {
  const list = readAll();
  const exists = list.some(f => f.scheme_code === fund.scheme_code);
  if (exists) {
    writeAll(list.filter(f => f.scheme_code !== fund.scheme_code));
    return false;
  }
  writeAll([fund, ...list]);
  return true;
}

export function subscribeWishlist(callback: () => void): () => void {
  window.addEventListener(EVENT_NAME, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT_NAME, callback);
    window.removeEventListener("storage", callback);
  };
}
