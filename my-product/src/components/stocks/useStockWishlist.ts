import { useSyncExternalStore, useCallback } from "react";
import { getStockWishlist, subscribeStockWishlist, toggleStockWishlist } from "../../lib/stockWishlist";
import type { StockSummary } from "../../lib/stocks";

export function useStockWishlist() {
  const list = useSyncExternalStore(subscribeStockWishlist, getStockWishlist, getStockWishlist);
  const toggle = useCallback((stock: StockSummary) => toggleStockWishlist(stock), []);
  return { list, toggle };
}

export function useIsStockWishlisted(symbol: string, exchange: string): boolean {
  const { list } = useStockWishlist();
  return list.some(s => s.symbol === symbol && s.exchange === exchange);
}
