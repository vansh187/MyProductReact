import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { Header } from "./header";
import { Footer } from "./footer";
import { ChevronLeft } from "lucide-react";
import { ErrorBoundary } from "./ErrorBoundary";
import { DARK, LIGHT } from "./mutualfunds/theme";
import { FundCard } from "./mutualfunds/FundCard";
import { LoadingBlock, ErrorBlock, EmptyBlock, SectionErrorFallback } from "./mutualfunds/StateBlocks";
import { MF_API_BASE, extractErrorMessage, humanizeKey, type MFFundSummary } from "../lib/mutualfunds";

const PAGE_SIZE = 20;

export default function MutualFundCollection() {
  const navigate = useNavigate();
  const location = useLocation();
  const { key } = useParams<{ key: string }>();
  const [isDark, setIsDark] = useState(() => localStorage.getItem("theme") !== "light");
  const T = isDark ? DARK : LIGHT;
  const title = (location.state as any)?.title ?? (key ? humanizeKey(key) : "Collection");

  const [funds, setFunds] = useState<MFFundSummary[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [retryTick, setRetryTick] = useState(0);

  // Reset pagination whenever the collection key changes (navigating tile to
  // tile). Done during render rather than in an effect so the fetch effect
  // below never observes a stale page number from the previous collection —
  // an effect-based reset would still let one wasted fetch (new key, old
  // page) fire before the reset commits.
  const [prevKey, setPrevKey] = useState(key);
  if (key !== prevKey) {
    setPrevKey(key);
    setFunds([]);
    setPage(1);
    setHasMore(true);
    setError(null);
  }

  useEffect(() => {
    if (!localStorage.getItem("authToken")) navigate("/", { replace: true });
  }, []);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const controller = new AbortController();
    if (page === 1) setLoading(true); else setLoadingMore(true);
    fetch(`${MF_API_BASE}/collections/${encodeURIComponent(key)}?page=${page}&page_size=${PAGE_SIZE}`, { signal: controller.signal })
      .then(async r => ({ ok: r.ok, body: await r.json() }))
      .then(({ ok, body }) => {
        if (cancelled) return;
        if (!ok) {
          setError(extractErrorMessage(body, "Failed to load this collection."));
          return;
        }
        const list = Array.isArray(body) ? (body as MFFundSummary[]) : [];
        setFunds(prev => (page === 1 ? list : [...prev, ...list]));
        setHasMore(list.length === PAGE_SIZE);
        setError(null);
      })
      .catch(e => { if (!cancelled && e?.name !== "AbortError") setError("Network error while loading this collection."); })
      .finally(() => { if (!cancelled) { setLoading(false); setLoadingMore(false); } });
    return () => { cancelled = true; controller.abort(); };
  }, [key, page, retryTick]);

  const retry = useCallback(() => { setPage(1); setRetryTick(t => t + 1); }, []);

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

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: T.bg }}>
      <Header
        isDark={isDark}
        onToggleTheme={() => setIsDark(d => { const n = !d; localStorage.setItem("theme", n ? "dark" : "light"); return n; })}
      />

      <main style={{ flex: 1 }}>
        <div style={{ borderBottom: `1px solid ${T.border}`, background: T.headerBar, padding: "16px 24px", display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ maxWidth: "1200px", margin: "0 auto", width: "100%", display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              onClick={() => navigate(-1)}
              style={{
                width: "32px", height: "32px", borderRadius: "8px",
                background: T.card, border: `1px solid ${T.border}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: T.textMuted,
              }}
            >
              <ChevronLeft size={18} />
            </button>
            <span style={{ fontSize: "16px", fontWeight: 700, color: T.text }}>{title}</span>
          </div>
        </div>

        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px 24px" }}>
          <ErrorBoundary fallback={(error, reset) => <SectionErrorFallback error={error} onRetry={reset} T={T} />}>
            {loading ? (
              <LoadingBlock T={T} label={`Loading ${title}…`} />
            ) : error ? (
              <ErrorBlock T={T} message={error} onRetry={retry} />
            ) : funds.length === 0 ? (
              <EmptyBlock T={T} message={`No funds found in ${title}.`} />
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
                  {funds.map(fund => (
                    <FundCard key={fund.scheme_code} fund={fund} T={T} onClick={() => navigate(`/explore/mutualfunds/fund/${fund.scheme_code}`)} />
                  ))}
                </div>
                {hasMore && (
                  <div style={{ textAlign: "center", marginTop: "24px" }}>
                    <button
                      onClick={() => setPage(p => p + 1)}
                      disabled={loadingMore}
                      style={{
                        padding: "10px 24px", borderRadius: "10px", fontSize: "13px", fontWeight: 700,
                        background: T.card, border: `1px solid ${T.border}`, color: T.text,
                        cursor: loadingMore ? "not-allowed" : "pointer", opacity: loadingMore ? 0.7 : 1,
                      }}
                    >
                      {loadingMore ? "Loading…" : "Load more"}
                    </button>
                  </div>
                )}
              </>
            )}
          </ErrorBoundary>
        </div>
      </main>

      <Footer isDark={isDark} />
    </div>
  );
}
