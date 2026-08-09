import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Header } from "./header";
import { Footer } from "./footer";
import {
  Megaphone, Download, FileText, GitCompare, Calculator, SlidersHorizontal, ChevronRight,
} from "lucide-react";
import { ErrorBoundary } from "./ErrorBoundary";
import { DARK, LIGHT } from "./mutualfunds/theme";
import { FundCard } from "./mutualfunds/FundCard";
import { LoadingBlock, ErrorBlock, EmptyBlock, SectionErrorFallback } from "./mutualfunds/StateBlocks";
import { useWishlist } from "./mutualfunds/useWishlist";
import { MutualFundDashboard } from "./mutualfunds/Dashboard";
import {
  MF_API_BASE, ICON_HINT_MAP, DEFAULT_COLLECTION_ICON, extractErrorMessage,
  type MFExploreResponse,
} from "../lib/mutualfunds";

const SECTION_TABS = ["Explore", "Dashboard", "SIPs", "Watchlist"];

const PRODUCTS_AND_TOOLS = [
  { key: "nfo",      label: "NFO Live",             icon: Megaphone },
  { key: "import",   label: "Import funds",          icon: Download },
  { key: "tax",      label: "File tax",              icon: FileText },
  { key: "compare",  label: "Compare funds",         icon: GitCompare },
  { key: "sip-calc", label: "SIP Calculator",        icon: Calculator },
  { key: "screener", label: "Mutual funds screener", icon: SlidersHorizontal },
];

export default function ExploreMutualFunds() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isDark, setIsDark] = useState(() => localStorage.getItem("theme") !== "light");
  const [activeSection, setActiveSection] = useState<string>((location.state as any)?.tab ?? "Explore");
  const T = isDark ? DARK : LIGHT;

  const [explore, setExplore] = useState<MFExploreResponse | null>(null);
  const [exploreLoading, setExploreLoading] = useState(true);
  const [exploreError, setExploreError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const { list: wishlist } = useWishlist();

  useEffect(() => {
    if (!localStorage.getItem("authToken")) navigate("/", { replace: true });
  }, []);

  // Re-navigating to this same route (e.g. clicking a different item in the
  // header's "Mutual Funds" menu while already here) keeps this component
  // mounted, so the useState initializer above never re-runs — location.key
  // changes on every navigation (even same-path ones), so watch that instead.
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
    fetch(`${MF_API_BASE}/explore`, { signal: controller.signal })
      .then(async r => ({ ok: r.ok, body: await r.json() }))
      .then(({ ok, body }) => {
        if (cancelled) return;
        if (!ok) {
          setExploreError(extractErrorMessage(body, "Failed to load mutual funds."));
          return;
        }
        setExplore(body as MFExploreResponse);
        setExploreError(null);
      })
      .catch(e => { if (!cancelled && e?.name !== "AbortError") setExploreError("Network error while loading mutual funds."); })
      .finally(() => { if (!cancelled) setExploreLoading(false); });
    return () => { cancelled = true; controller.abort(); };
  }, [activeSection, retryTick]);

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

  const popularFunds = explore?.popular_funds ?? [];
  const collections = explore?.collections ?? [];

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: T.bg }}>
      <Header
        isDark={isDark}
        onToggleTheme={() => setIsDark(d => { const n = !d; localStorage.setItem("theme", n ? "dark" : "light"); return n; })}
      />

      <main style={{ flex: 1 }}>

        {/* ── Top bar: section tabs ── */}
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
          </div>
        </div>

        {/* ── Explore tab ── */}
        {activeSection === "Explore" && (
          <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px 24px", display: "grid", gridTemplateColumns: "2fr 1fr", gap: "24px", alignItems: "start" }}>

            {/* Main column */}
            <div style={{ display: "flex", flexDirection: "column", gap: "40px", minWidth: 0 }}>

              <ErrorBoundary fallback={(error, reset) => <SectionErrorFallback error={error} onRetry={reset} T={T} />}>
                {/* Popular Funds */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                    <span style={{ fontSize: "17px", fontWeight: 700, color: T.text }}>Popular Funds</span>
                  </div>

                  {exploreLoading ? (
                    <LoadingBlock T={T} label="Loading popular funds…" />
                  ) : exploreError ? (
                    <ErrorBlock T={T} message={exploreError} onRetry={retry} />
                  ) : popularFunds.length === 0 ? (
                    <EmptyBlock T={T} message="No popular funds available right now." />
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px" }}>
                      {popularFunds.map(fund => (
                        <FundCard key={fund.scheme_code} fund={fund} T={T} onClick={() => navigate(`/explore/mutualfunds/fund/${fund.scheme_code}`)} />
                      ))}
                    </div>
                  )}

                  <div
                    onClick={() => navigate("/explore/mutualfunds/search")}
                    style={{ marginTop: "14px", display: "flex", alignItems: "center", gap: "4px", fontSize: "13px", fontWeight: 600, color: T.activeBorder, cursor: "pointer", width: "fit-content" }}
                  >
                    All Mutual Funds <ChevronRight style={{ width: "14px", height: "14px" }} />
                  </div>
                </div>
              </ErrorBoundary>

              <ErrorBoundary fallback={(error, reset) => <SectionErrorFallback error={error} onRetry={reset} T={T} />}>
                {/* Collections */}
                <div>
                  <div style={{ fontSize: "17px", fontWeight: 700, color: T.text, marginBottom: "16px" }}>Collections</div>

                  {exploreLoading ? (
                    <LoadingBlock T={T} label="Loading collections…" />
                  ) : exploreError ? (
                    <ErrorBlock T={T} message={exploreError} onRetry={retry} />
                  ) : collections.length === 0 ? (
                    <EmptyBlock T={T} message="No collections available right now." />
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
                      {collections.map(c => {
                        const Icon = ICON_HINT_MAP[c.icon_hint] ?? DEFAULT_COLLECTION_ICON;
                        return (
                          <div
                            key={c.key}
                            onClick={() => navigate(`/explore/mutualfunds/collection/${c.key}`, { state: { title: c.title } })}
                            style={{
                              background: T.card, border: `1px solid ${T.border}`, borderRadius: "16px",
                              padding: "20px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px",
                              cursor: "pointer", transition: "border-color 0.18s",
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = T.activeBorder + "55"; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = T.border; }}
                          >
                            <div style={{
                              width: "44px", height: "44px", borderRadius: "12px",
                              background: `${T.activeBorder}1a`, display: "flex", alignItems: "center", justifyContent: "center",
                            }}>
                              <Icon style={{ width: "20px", height: "20px", color: T.activeBorder }} />
                            </div>
                            <span style={{ fontSize: "13px", fontWeight: 600, color: T.textBody, textAlign: "center" }}>{c.title}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </ErrorBoundary>
            </div>

            {/* Sidebar column */}
            <div style={{ display: "flex", flexDirection: "column", gap: "20px", position: "sticky", top: "130px" }}>
              <ErrorBoundary fallback={(error, reset) => <SectionErrorFallback error={error} onRetry={reset} T={T} />}>
                <div style={{ background: T.cardSolid, border: `1px solid ${T.borderMid}`, borderRadius: "16px", padding: "8px", overflow: "hidden" }}>
                  <div style={{ fontSize: "15px", fontWeight: 700, color: T.text, padding: "12px 12px 8px" }}>Products and Tools</div>
                  {PRODUCTS_AND_TOOLS.map(item => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.key}
                        style={{
                          display: "flex", alignItems: "center", gap: "12px", padding: "11px 12px",
                          borderTop: `1px solid ${T.border}`, cursor: "pointer", borderRadius: "10px",
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = T.tabHover; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
                      >
                        <Icon style={{ width: "16px", height: "16px", color: T.textMuted, flexShrink: 0 }} />
                        <span style={{ fontSize: "13px", fontWeight: 600, color: T.textBody, flex: 1 }}>{item.label}</span>
                      </div>
                    );
                  })}
                </div>
              </ErrorBoundary>
            </div>
          </div>
        )}

        {/* ── Watchlist tab ── */}
        {activeSection === "Watchlist" && (
          <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px 24px" }}>
            <div style={{ fontSize: "17px", fontWeight: 700, color: T.text, marginBottom: "4px" }}>Watchlist</div>
            <div style={{ fontSize: "12px", color: T.textDim, marginBottom: "20px" }}>
              {wishlist.length > 0
                ? `${wishlist.length} fund${wishlist.length !== 1 ? "s" : ""} you're tracking`
                : "Funds you bookmark show up here"}
            </div>

            <ErrorBoundary fallback={(error, reset) => <SectionErrorFallback error={error} onRetry={reset} T={T} />}>
              {wishlist.length === 0 ? (
                <EmptyBlock T={T} message="Your watchlist is empty. Tap the bookmark icon on any fund's card or detail page to add it here." />
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
                  {wishlist.map(fund => (
                    <FundCard key={fund.scheme_code} fund={fund} T={T} onClick={() => navigate(`/explore/mutualfunds/fund/${fund.scheme_code}`)} />
                  ))}
                </div>
              )}
            </ErrorBoundary>
          </div>
        )}

        {/* ── Dashboard tab ── */}
        {activeSection === "Dashboard" && (
          <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px 24px" }}>
            <ErrorBoundary fallback={(error, reset) => <SectionErrorFallback error={error} onRetry={reset} T={T} />}>
              <MutualFundDashboard T={T} />
            </ErrorBoundary>
          </div>
        )}

        {/* ── Other tabs (not built yet) ── */}
        {activeSection === "SIPs" && (
          <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px 24px" }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              minHeight: "240px", background: T.card, border: `1px solid ${T.border}`,
              borderRadius: "16px", fontSize: "13px", color: T.textMuted,
            }}>
              {activeSection} is coming soon.
            </div>
          </div>
        )}

      </main>

      <Footer isDark={isDark} />
    </div>
  );
}
