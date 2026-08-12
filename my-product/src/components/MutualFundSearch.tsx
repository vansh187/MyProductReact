import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "./header";
import { Footer } from "./footer";
import { ChevronLeft, Search, X, ChevronDown, Check, SlidersHorizontal } from "lucide-react";
import { ErrorBoundary } from "./ErrorBoundary";
import { DARK, LIGHT, type MFTheme } from "./mutualfunds/theme";
import { FundCard } from "./mutualfunds/FundCard";
import { LoadingBlock, ErrorBlock, EmptyBlock, SectionErrorFallback } from "./mutualfunds/StateBlocks";
import { MF_API_BASE, extractErrorMessage, type MFFundSummary, type MFCategoriesResponse } from "../lib/mutualfunds";

const PAGE_SIZE = 20;

// A single-select, searchable filter dropdown — replaces a bare horizontal
// scroll of every category/fund-house value (unusable once there are dozens
// of them) with the pattern most brokerage/investing apps use today: a
// compact trigger that shows the active value, a searchable list in a
// popover, and the applied filter surfaced separately so it's obvious what's
// actually affecting the results.
function FilterDropdown({
  label, options, selected, onSelect, T,
}: {
  label: string;
  options: string[];
  selected: string | null;
  onSelect: (value: string | null) => void;
  T: MFTheme;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const filtered = query.trim()
    ? options.filter(o => o.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: "8px", padding: "9px 14px", borderRadius: "10px",
          fontSize: "12px", fontWeight: 600, whiteSpace: "nowrap", cursor: "pointer",
          color: selected ? T.activeBorder : T.textBody,
          background: selected ? `${T.activeBorder}14` : T.card,
          border: `1px solid ${selected ? T.activeBorder + "55" : T.border}`,
        }}
      >
        {label}
        <ChevronDown style={{ width: "13px", height: "13px", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 100, width: "300px",
          background: T.cardSolid, border: `1px solid ${T.borderMid}`, borderRadius: "12px",
          boxShadow: "0 16px 40px rgba(0,0,0,0.35)", padding: "10px", display: "flex", flexDirection: "column", gap: "8px",
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: "8px", padding: "7px 10px",
            background: T.tabBg, border: `1px solid ${T.border}`, borderRadius: "8px",
          }}>
            <Search style={{ width: "13px", height: "13px", color: T.textDim, flexShrink: 0 }} />
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={`Search ${label.toLowerCase()}…`}
              style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: "12px", color: T.text }}
            />
          </div>

          <div style={{ maxHeight: "260px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "2px" }}>
            {selected && (
              <div
                onClick={() => { onSelect(null); setOpen(false); setQuery(""); }}
                style={{ padding: "8px 10px", borderRadius: "8px", fontSize: "12px", fontWeight: 600, color: "#ef4444", cursor: "pointer" }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = T.tabHover; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
              >
                Clear selection
              </div>
            )}
            {filtered.length === 0 ? (
              <div style={{ padding: "12px 10px", fontSize: "12px", color: T.textDim, textAlign: "center" }}>No matches.</div>
            ) : filtered.map(opt => {
              const isSelected = selected === opt;
              return (
                <div
                  key={opt}
                  onClick={() => { onSelect(isSelected ? null : opt); setOpen(false); setQuery(""); }}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px",
                    padding: "8px 10px", borderRadius: "8px", fontSize: "12px", fontWeight: isSelected ? 700 : 500,
                    color: isSelected ? T.activeBorder : T.textBody, cursor: "pointer",
                    background: isSelected ? `${T.activeBorder}14` : "transparent",
                  }}
                  onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = T.tabHover; }}
                  onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
                >
                  <span>{opt}</span>
                  {isSelected && <Check style={{ width: "13px", height: "13px", flexShrink: 0 }} />}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function AppliedFilterPill({ label, onClear, T }: { label: string; onClear: () => void; T: MFTheme }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "6px", padding: "6px 10px", borderRadius: "100px",
      fontSize: "12px", fontWeight: 600, color: T.activeBorder,
      background: `${T.activeBorder}14`, border: `1px solid ${T.activeBorder}55`,
    }}>
      <span style={{ maxWidth: "260px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      <button
        onClick={onClear}
        style={{ display: "flex", border: "none", background: "transparent", color: "inherit", cursor: "pointer", padding: 0 }}
      >
        <X style={{ width: "12px", height: "12px" }} />
      </button>
    </div>
  );
}

export default function MutualFundSearch() {
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(() => localStorage.getItem("theme") !== "light");
  const T = isDark ? DARK : LIGHT;

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [fundHouse, setFundHouse] = useState<string | null>(null);

  const [facets, setFacets] = useState<MFCategoriesResponse | null>(null);
  const [facetsError, setFacetsError] = useState<string | null>(null);

  const [results, setResults] = useState<MFFundSummary[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    if (!localStorage.getItem("authToken")) navigate("/", { replace: true });
  }, []);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), 400);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${MF_API_BASE}/categories`, { signal: controller.signal })
      .then(async r => ({ ok: r.ok, body: await r.json() }))
      .then(({ ok, body }) => {
        if (!ok) { setFacetsError(extractErrorMessage(body, "Failed to load filters.")); return; }
        setFacets(body as MFCategoriesResponse);
      })
      .catch(e => { if (e?.name !== "AbortError") setFacetsError("Network error while loading filters."); });
    return () => controller.abort();
  }, []);

  // Reset pagination during render (not in an effect) whenever the filters
  // change, so the fetch effect below never fires once with the new filters
  // but a stale page number — see the identical pattern/comment in
  // MutualFundCollection.tsx for why an effect-based reset isn't enough.
  const filterKey = `${debouncedQuery}|${category ?? ""}|${fundHouse ?? ""}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setResults([]);
    setPage(1);
    setHasMore(true);
  }

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    if (page === 1) setLoading(true); else setLoadingMore(true);
    const params = new URLSearchParams();
    if (debouncedQuery) params.set("q", debouncedQuery);
    if (category) params.set("category", category);
    if (fundHouse) params.set("fund_house", fundHouse);
    params.set("page", String(page));
    params.set("page_size", String(PAGE_SIZE));
    fetch(`${MF_API_BASE}/search?${params.toString()}`, { signal: controller.signal })
      .then(async r => ({ ok: r.ok, body: await r.json() }))
      .then(({ ok, body }) => {
        if (cancelled) return;
        if (!ok) {
          setError(extractErrorMessage(body, "Failed to search mutual funds."));
          return;
        }
        const list = Array.isArray(body) ? (body as MFFundSummary[]) : [];
        setResults(prev => (page === 1 ? list : [...prev, ...list]));
        setHasMore(list.length === PAGE_SIZE);
        setError(null);
      })
      .catch(e => { if (!cancelled && e?.name !== "AbortError") setError("Network error while searching."); })
      .finally(() => { if (!cancelled) { setLoading(false); setLoadingMore(false); } });
    return () => { cancelled = true; controller.abort(); };
  }, [debouncedQuery, category, fundHouse, page, retryTick]);

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
        <div style={{ borderBottom: `1px solid ${T.border}`, background: T.headerBar, padding: "16px 24px" }}>
          <div style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              onClick={() => navigate(-1)}
              style={{
                width: "32px", height: "32px", borderRadius: "8px",
                background: T.card, border: `1px solid ${T.border}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: T.textMuted, flexShrink: 0,
              }}
            >
              <ChevronLeft size={18} />
            </button>
            <span style={{ fontSize: "16px", fontWeight: 700, color: T.text }}>All Mutual Funds</span>
          </div>
        </div>

        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "24px" }}>

          {/* Search bar */}
          <div style={{
            display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", marginBottom: "16px",
            background: T.card, border: `1px solid ${T.border}`, borderRadius: "12px",
          }}>
            <Search style={{ width: "16px", height: "16px", color: T.textDim, flexShrink: 0 }} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search mutual funds by name…"
              style={{
                flex: 1, border: "none", outline: "none", background: "transparent",
                fontSize: "13px", color: T.text,
              }}
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                style={{ border: "none", background: "transparent", cursor: "pointer", color: T.textDim, display: "flex" }}
              >
                <X style={{ width: "14px", height: "14px" }} />
              </button>
            )}
          </div>

          {/* Filters */}
          {facetsError ? (
            <div style={{ fontSize: "12px", color: T.textDim, marginBottom: "16px" }}>{facetsError}</div>
          ) : facets && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700, color: T.textDim }}>
                  <SlidersHorizontal style={{ width: "13px", height: "13px" }} /> Filters
                </span>
                <FilterDropdown label="Category" options={facets.categories} selected={category} onSelect={setCategory} T={T} />
                <FilterDropdown label="Fund House" options={facets.fund_houses} selected={fundHouse} onSelect={setFundHouse} T={T} />
              </div>

              {(category || fundHouse) && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  {category && <AppliedFilterPill label={category} onClear={() => setCategory(null)} T={T} />}
                  {fundHouse && <AppliedFilterPill label={fundHouse} onClear={() => setFundHouse(null)} T={T} />}
                  <button
                    onClick={() => { setCategory(null); setFundHouse(null); }}
                    style={{ fontSize: "12px", fontWeight: 600, color: T.textMuted, background: "transparent", border: "none", cursor: "pointer", padding: "6px 4px" }}
                  >
                    Clear all
                  </button>
                </div>
              )}
            </div>
          )}

          <ErrorBoundary fallback={(error, reset) => <SectionErrorFallback error={error} onRetry={reset} T={T} />}>
            {loading ? (
              <LoadingBlock T={T} label="Searching…" />
            ) : error ? (
              <ErrorBlock T={T} message={error} onRetry={retry} />
            ) : results.length === 0 ? (
              <EmptyBlock T={T} message="No mutual funds match your search." />
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
                  {results.map(fund => (
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
