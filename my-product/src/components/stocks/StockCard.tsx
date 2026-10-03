import { Bookmark } from "lucide-react";
import type { StockSummary } from "../../lib/stocks";
import { fmtPrice, fmtPct } from "../../lib/stocks";
import type { MFTheme } from "../mutualfunds/theme";
import { useIsStockWishlisted, useStockWishlist } from "./useStockWishlist";

export function StockCard({ stock, T, onClick }: { stock: StockSummary; T: MFTheme; onClick?: () => void }) {
  const positive = stock.change_pct >= 0;
  const wishlisted = useIsStockWishlisted(stock.symbol, stock.exchange);
  const { toggle } = useStockWishlist();

  return (
    <div
      onClick={onClick}
      style={{
        position: "relative", background: T.card, border: `1px solid ${T.border}`, borderRadius: "16px",
        padding: "16px", display: "flex", flexDirection: "column", gap: "10px",
        cursor: onClick ? "pointer" : "default", transition: "border-color 0.18s, transform 0.18s",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = T.borderMid;
        if (onClick) (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = T.border;
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
      }}
    >
      <button
        onClick={e => { e.stopPropagation(); toggle(stock); }}
        title={wishlisted ? "Remove from watchlist" : "Add to watchlist"}
        style={{
          position: "absolute", top: "12px", right: "12px", width: "28px", height: "28px", borderRadius: "8px",
          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
          background: wishlisted ? `${T.activeBorder}1f` : T.tabBg,
          border: `1px solid ${wishlisted ? T.activeBorder + "55" : T.border}`,
        }}
      >
        <Bookmark
          style={{ width: "13px", height: "13px", color: wishlisted ? T.activeBorder : T.textDim }}
          fill={wishlisted ? T.activeBorder : "none"}
        />
      </button>

      <div>
        <div style={{ fontSize: "14px", fontWeight: 700, color: T.text }}>{stock.symbol}</div>
        <div
          title={stock.name}
          style={{ fontSize: "11px", color: T.textDim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "180px" }}
        >
          {stock.name}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <span style={{ fontSize: "17px", fontWeight: 700, color: T.text }}>₹{fmtPrice(stock.ltp)}</span>
        <span style={{ fontSize: "12px", fontWeight: 700, color: positive ? "#22c55e" : "#ef4444" }}>
          {fmtPct(stock.change_pct)}
        </span>
      </div>

      <div style={{ fontSize: "10px", color: T.textDim, display: "flex", justifyContent: "space-between" }}>
        <span>{stock.exchange}</span>
        {stock.sector && <span>{stock.sector}</span>}
      </div>
    </div>
  );
}
