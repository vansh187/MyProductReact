import { useSyncExternalStore, useCallback } from "react";
import { getWishlist, subscribeWishlist, toggleWishlist } from "../../lib/wishlist";
import type { MFFundSummary } from "../../lib/mutualfunds";

// Subscribes to the shared wishlist store and re-renders on any change —
// from this component, another component, or another tab.
export function useWishlist() {
  const list = useSyncExternalStore(subscribeWishlist, getWishlist, getWishlist);
  const toggle = useCallback((fund: MFFundSummary) => toggleWishlist(fund), []);
  return { list, toggle };
}

export function useIsWishlisted(schemeCode: number): boolean {
  const { list } = useWishlist();
  return list.some(f => f.scheme_code === schemeCode);
}
