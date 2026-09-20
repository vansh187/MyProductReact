import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Header } from "./header";
import { Footer } from "./footer";
import { ChevronRight, Circle } from "lucide-react";
import { ErrorBoundary } from "./ErrorBoundary";
import { DARK, LIGHT } from "./mutualfunds/theme";
import { LoadingBlock, ErrorBlock, EmptyBlock, SectionErrorFallback } from "./mutualfunds/StateBlocks";
import { StockCard } from "./stocks/StockCard";
import { useStockWishlist } from "./stocks/useStockWishlist";
import { STOCK_API_BASE, extractErrorMessage, type StockExploreResponse } from "../lib/stocks";

const SECTION_TABS = ["Explore", "Watchlist"];

export default function ExploreStocks() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isDark, setIsDark] = useState(() => localStorage.getItem("theme") !== "light");
  const [activeSection, setActiveSection] = useState<string>((location.state as any)?.tab ?? "Explore");
  const T = isDark ? DARK : LIGHT;

  const [explore, setExplore] = useState<StockExploreResponse | null>(null);
  const [exploreLoading, setExploreLoading] = useState(true);
  const [exploreError, setExploreError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const { list: wishlist } = useStockWishlist();

  useEffect(() => {
    if (!localStorage.getItem("authToken")) navigate("/", { replace: true });
  }, []);

  useEffect(() => {
    const tab = (location.state as any)?.tab;
    if (tab) setActiveSection(tab);
  }, [location.key]);

  useEffect(() => {
    if (activeSection !== "Explore") return;
    let cancelled = false;
    const controller = new AbortController();
    setExploreLoading(true);
    setExploreError(null);
    fetch(`${STOCK_API_BASE}/explore`, { signal: controller.signal })
      .then(async r => ({ ok: r.ok, body: await r.json() }))
      .then(({ ok, body }) => {
        if (cancelled) return;
        if (!ok) {
          setExploreError(extractErrorMessage(body, "Failed to load stocks."));
          return;
        }
        setExplore(body as StockExploreResponse);
        setExploreError(null);
      })
      .catch(e => { if (!cancelled && e?.name !== "AbortError") setExploreError("Network error while loading stocks."); })
      .finally(() => { if (!cancelled) setExploreLoading(false); });
    return () => { cancelled = true; controller.abort(); };
  }, [activeSection, retryTick]);

  // Live-ish refresh while the market is open — matches the polling cadence
  // used elsewhere in the app (see OverallDashboard's holdings poll) rather
  // than a websocket, since none exists in this frontend yet.
  useEffect(() => {
    if (activeSection !== "Explore" || explore?.market_status !== "OPEN") return;
    const id = setInterval(() => setRetryTick(t => t + 1), 5000);
    return () => clearInterval(id);
  }, [activeSection, explore?.market_status]);

  const retry = useCallback(() => setRetryTick(t => t + 1), []);

  useEffect(() => {
    document.body.style.overflow = "auto";
    document.body.style.height = "auto";
    document.documentElement.style.overflow = "auto";
    document.documentElement.style.height = "auto";
    return () => {
      document.body.style.overflow = "";
      document.body.style.height = "";
      document.documentElement.style.overflow = "";
      document.documentElement.style.height = "";
    };
  }, []);

  useEffect(() => {
    document.body.style.backgroundColor = isDark ? "#0d1117" : "#f0f4f8";
    return () => { document.body.style.backgroundColor = ""; };
  }, [isDark]);

  const trending = explore?.trending ?? [];
  const gainers = explore?.top_gainers ?? [];
  const losers = explore?.top_losers ?? [];
  const mostActive = explore?.most_active ?? [];

  function renderRow(title: string, stocks: typeof trending, emptyMsg: string) {
    return (
      <ErrorBoundary fallback={(error, reset) => <SectionErrorFallback error={error} onRetry={reset} T={T} />}>
        <div>
          <div style={{ fontSize: "17px", fontWeight: 700, color: T.text, marginBottom: "16px" }}>{title}</div>
          {exploreLoading ? (
            <LoadingBlock T={T} label={`Loading ${title.toLowerCase()}…`} />
          ) : exploreError ? (
            <ErrorBlock T={T} message={exploreError} onRetry={retry} />
          ) : stocks.length === 0 ? (
            <EmptyBlock T={T} message={emptyMsg} />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}>
              {stocks.map(s => (
                <StockCard key={`${s.exchange}:${s.symbol}`} stock={s} T={T} onClick={() => navigate(`/explore/stocks/${s.exchange}/${s.symbol}`)} />
              ))}
            </div>
          )}
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: T.bg }}>
      <Header
        isDark={isDark}
        onToggleTheme={() => setIsDark(d => { const n = !d; localStorage.setItem("theme", n ? "dark" : "light"); return n; })}
      />

      <main style={{ flex: 1 }}>
        {/* ── Top bar: section tabs + market status ── */}
        <div style={{ borderBottom: `1px solid ${T.border}`, background: T.headerBar, position: "sticky", top: "64px", zIndex: 40 }}>
          <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: "4px" }}>
              {SECTION_TABS.map(tab => {
                const active = activeSection === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveSection(tab)}
                    style={{
                      padding: "14px 20px", fontSize: "14px", fontWeight: active ? 700 : 500,
                      color: active ? T.activeBorder : T.textMuted,
                      background: "transparent", border: "none",
                      borderBottom: active ? `2px solid ${T.activeBorder}` : "2px solid transparent",
                      cursor: "pointer", transition: "all 0.2s", marginBottom: "-1px",
                    }}
                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = T.text; }}
                    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = T.textMuted; }}
                  >
                    {tab}
                  </button>
                );
              })}
            </div>

            {explore && (
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 600, color: T.textMuted }}>
                <Circle
                  style={{ width: "8px", height: "8px" }}
                  fill={explore.market_status === "OPEN" ? "#22c55e" : "#ef4444"}
                  color={explore.market_status === "OPEN" ? "#22c55e" : "#ef4444"}
                />
                {explore.market_status === "OPEN" ? "Market Open" : explore.market_status === "PRE_OPEN" ? "Pre-Open" : "Market Closed"}
              </div>
            )}
          </div>
        </div>

        {/* ── Explore tab ── */}
        {activeSection === "Explore" && (
          <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px 24px", display: "flex", flexDirection: "column", gap: "40px" }}>
            {renderRow("Trending Stocks", trending, "No trending stocks available right now.")}
            {renderRow("Top Gainers", gainers, "No gainers available right now.")}
            {renderRow("Top Losers", losers, "No losers available right now.")}
            {renderRow("Most Active", mostActive, "No active-stock data available right now.")}

            <div
              onClick={() => navigate("/explore/stocks/search")}
              style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "13px", fontWeight: 600, color: T.activeBorder, cursor: "pointer", width: "fit-content" }}
            >
              All Stocks <ChevronRight style={{ width: "14px", height: "14px" }} />
            </div>
          </div>
        )}

        {/* ── Watchlist tab ── */}
        {activeSection === "Watchlist" && (
          <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px 24px" }}>
            <div style={{ fontSize: "17px", fontWeight: 700, color: T.text, marginBottom: "4px" }}>Watchlist</div>
            <div style={{ fontSize: "12px", color: T.textDim, marginBottom: "20px" }}>
              {wishlist.length > 0
                ? `${wishlist.length} stock${wishlist.length !== 1 ? "s" : ""} you're tracking`
                : "Stocks you bookmark show up here"}
            </div>

            <ErrorBoundary fallback={(error, reset) => <SectionErrorFallback error={error} onRetry={reset} T={T} />}>
              {wishlist.length === 0 ? (
                <EmptyBlock T={T} message="Your watchlist is empty. Tap the bookmark icon on any stock's card or detail page to add it here." />
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}>
                  {wishlist.map(s => (
                    <StockCard key={`${s.exchange}:${s.symbol}`} stock={s} T={T} onClick={() => navigate(`/explore/stocks/${s.exchange}/${s.symbol}`)} />
                  ))}
                </div>
              )}
            </ErrorBoundary>
          </div>
        )}
      </main>

      <Footer isDark={isDark} />
    </div>
  );
}
