import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Header } from "./header";
import { Footer } from "./footer";
import { ChevronLeft, Bookmark } from "lucide-react";
import { ErrorBoundary } from "./ErrorBoundary";
import { DARK, LIGHT, type MFTheme } from "./mutualfunds/theme";
import { LoadingBlock, ErrorBlock, EmptyBlock, SectionErrorFallback } from "./mutualfunds/StateBlocks";
import { useIsWishlisted, useWishlist } from "./mutualfunds/useWishlist";
import {
  MF_API_BASE, extractErrorMessage, fmtPct, fmtNav, fmtDate,
  type MFFundDetail, type MFNavChartResponse, type NavChartPeriod,
} from "../lib/mutualfunds";

const PERIODS: { key: NavChartPeriod; label: string }[] = [
  { key: "1m", label: "1M" }, { key: "6m", label: "6M" }, { key: "1y", label: "1Y" },
  { key: "3y", label: "3Y" }, { key: "5y", label: "5Y" }, { key: "all", label: "All" },
];

function NavChart({ points, positive }: { points: { nav_date: string; nav: number }[]; positive: boolean }) {
  if (points.length < 2) {
    return (
      <div style={{ height: "220px", display: "flex", alignItems: "center", justifyContent: "center", color: "#8b949e", fontSize: "13px" }}>
        Not enough data to draw a chart.
      </div>
    );
  }
  const width = 800, height = 220, pad = 12;
  const navs = points.map(p => p.nav);
  const min = Math.min(...navs), max = Math.max(...navs);
  const range = max - min || 1;
  const stepX = (width - pad * 2) / (points.length - 1);
  const coords = points.map((p, i) => {
    const x = pad + i * stepX;
    const y = pad + (height - pad * 2) * (1 - (p.nav - min) / range);
    return `${x},${y}`;
  });
  const linePath = `M${coords.join(" L")}`;
  const areaPath = `${linePath} L${pad + (points.length - 1) * stepX},${height - pad} L${pad},${height - pad} Z`;
  const color = positive ? "#22c55e" : "#ef4444";
  const gradId = "navFillGradient";

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "220px", display: "block" }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} stroke="none" />
      <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function ReturnsGrid({ returns, T }: { returns: MFNavChartResponse["returns"]; T: MFTheme }) {
  const rows: { label: string; value: number | null }[] = [
    { label: "1M", value: returns.return_1m },
    { label: "6M", value: returns.return_6m },
    { label: "1Y", value: returns.return_1y },
    { label: "3Y", value: returns.return_3y },
    { label: "5Y", value: returns.return_5y },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "10px" }}>
      {rows.map(r => {
        const has = r.value != null;
        const positive = has && r.value! >= 0;
        return (
          <div key={r.label} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "12px", padding: "12px", textAlign: "center" }}>
            <div style={{ fontSize: "11px", color: T.textDim, fontWeight: 600, marginBottom: "6px" }}>{r.label}</div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: has ? (positive ? "#22c55e" : "#ef4444") : T.textDim }}>
              {has ? fmtPct(r.value) : "NA"}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function MutualFundDetail() {
  const navigate = useNavigate();
  const { schemeCode } = useParams<{ schemeCode: string }>();
  const [isDark, setIsDark] = useState(() => localStorage.getItem("theme") !== "light");
  const T = isDark ? DARK : LIGHT;

  const [detail, setDetail] = useState<MFFundDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [period, setPeriod] = useState<NavChartPeriod>("6m");
  const [chart, setChart] = useState<MFNavChartResponse | null>(null);
  const [chartLoading, setChartLoading] = useState(true);
  const [chartError, setChartError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    if (!localStorage.getItem("authToken")) navigate("/", { replace: true });
  }, []);

  useEffect(() => {
    if (!schemeCode) return;
    let cancelled = false;
    const controller = new AbortController();
    setDetailLoading(true);
    setDetailError(null);
    setNotFound(false);
    fetch(`${MF_API_BASE}/${encodeURIComponent(schemeCode)}`, { signal: controller.signal })
      .then(async r => ({ status: r.status, ok: r.ok, body: await r.json() }))
      .then(({ status, ok, body }) => {
        if (cancelled) return;
        if (status === 404) { setNotFound(true); return; }
        if (!ok) { setDetailError(extractErrorMessage(body, "Failed to load this fund.")); return; }
        setDetail(body as MFFundDetail);
      })
      .catch(e => { if (!cancelled && e?.name !== "AbortError") setDetailError("Network error while loading this fund."); })
      .finally(() => { if (!cancelled) setDetailLoading(false); });
    return () => { cancelled = true; controller.abort(); };
  }, [schemeCode, retryTick]);

  useEffect(() => {
    if (!schemeCode || notFound) return;
    let cancelled = false;
    const controller = new AbortController();
    setChartLoading(true);
    setChartError(null);
    fetch(`${MF_API_BASE}/${encodeURIComponent(schemeCode)}/nav-chart?period=${period}`, { signal: controller.signal })
      .then(async r => ({ ok: r.ok, body: await r.json() }))
      .then(({ ok, body }) => {
        if (cancelled) return;
        if (!ok) { setChartError(extractErrorMessage(body, "Failed to load chart data.")); return; }
        setChart(body as MFNavChartResponse);
      })
      .catch(e => { if (!cancelled && e?.name !== "AbortError") setChartError("Network error while loading chart data."); })
      .finally(() => { if (!cancelled) setChartLoading(false); });
    return () => { cancelled = true; controller.abort(); };
  }, [schemeCode, period, notFound, retryTick]);

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

  const headlineReturn = useMemo(() => {
    if (!chart) return null;
    const map: Record<NavChartPeriod, number | null> = {
      "1m": chart.returns.return_1m,
      "6m": chart.returns.return_6m,
      "1y": chart.returns.return_1y,
      "3y": chart.returns.return_3y,
      "5y": chart.returns.return_5y,
      "all": chart.returns.return_5y ?? chart.returns.return_3y ?? chart.returns.return_1y
        ?? chart.returns.return_6m ?? chart.returns.return_1m,
    };
    return map[period];
  }, [chart, period]);

  const periodLabel = PERIODS.find(p => p.key === period)?.label ?? period;

  const wishlisted = useIsWishlisted(detail?.scheme_code ?? -1);
  const { toggle: toggleWishlist } = useWishlist();
  const handleToggleWishlist = useCallback(() => {
    if (!detail) return;
    toggleWishlist({
      scheme_code: detail.scheme_code,
      scheme_name: detail.scheme_name,
      fund_house: detail.fund_house,
      scheme_category: detail.scheme_category,
      scheme_type: detail.scheme_type,
      latest_nav: chart?.returns.latest_nav ?? null,
      return_3y: chart?.returns.return_3y ?? null,
    });
  }, [detail, chart, toggleWishlist]);

  const hasFundamentals = !!detail && (
    detail.min_sip_amount != null || detail.fund_size_aum != null || detail.expense_ratio != null ||
    detail.rating != null || (detail.holdings != null && detail.holdings !== "unavailable") ||
    detail.isin_growth != null || detail.isin_div_reinvestment != null
  );

  const toggleTheme = () => setIsDark(d => { const n = !d; localStorage.setItem("theme", n ? "dark" : "light"); return n; });

  if (notFound) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: T.bg }}>
        <Header isDark={isDark} onToggleTheme={toggleTheme} />
        <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 24px" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "18px", fontWeight: 700, color: T.text, marginBottom: "8px" }}>Fund not found</div>
            <div style={{ fontSize: "13px", color: T.textMuted, marginBottom: "20px" }}>
              This scheme code doesn't exist or isn't available.
            </div>
            <button
              onClick={() => navigate("/explore/mutualfunds")}
              style={{
                padding: "10px 20px", borderRadius: "10px", fontSize: "13px", fontWeight: 700,
                background: T.activeBorder, border: "none", color: "#fff", cursor: "pointer",
              }}
            >
              Back to Mutual Funds
            </button>
          </div>
        </main>
        <Footer isDark={isDark} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: T.bg }}>
      <Header isDark={isDark} onToggleTheme={toggleTheme} />

      <main style={{ flex: 1 }}>
        <div style={{ borderBottom: `1px solid ${T.border}`, background: T.headerBar, padding: "16px 24px" }}>
          <div style={{ maxWidth: "900px", margin: "0 auto", display: "flex", alignItems: "center", gap: "12px" }}>
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
            <span style={{ fontSize: "16px", fontWeight: 700, color: T.text }}>Fund Details</span>
          </div>
        </div>

        <div style={{ maxWidth: "900px", margin: "0 auto", padding: "24px", display: "flex", flexDirection: "column", gap: "24px" }}>

          <ErrorBoundary fallback={(error, reset) => <SectionErrorFallback error={error} onRetry={reset} T={T} />}>
            {detailLoading ? (
              <LoadingBlock T={T} label="Loading fund details…" />
            ) : detailError ? (
              <ErrorBlock T={T} message={detailError} onRetry={retry} />
            ) : detail && (
              <>
                {/* Header */}
                <div>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
                    <div style={{ fontSize: "19px", fontWeight: 700, color: T.text, lineHeight: 1.4, marginBottom: "6px" }}>
                      {detail.scheme_name}
                    </div>
                    <button
                      onClick={handleToggleWishlist}
                      style={{
                        display: "flex", alignItems: "center", gap: "7px", padding: "8px 14px", borderRadius: "10px",
                        fontSize: "12px", fontWeight: 700, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap",
                        color: wishlisted ? T.activeBorder : T.textBody,
                        background: wishlisted ? `${T.activeBorder}1f` : T.card,
                        border: `1px solid ${wishlisted ? T.activeBorder + "55" : T.border}`,
                      }}
                    >
                      <Bookmark style={{ width: "14px", height: "14px" }} fill={wishlisted ? T.activeBorder : "none"} />
                      {wishlisted ? "In Watchlist" : "Add to Watchlist"}
                    </button>
                  </div>
                  <div style={{ fontSize: "13px", color: T.textMuted, marginBottom: "10px" }}>{detail.fund_house}</div>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "11px", fontWeight: 600, padding: "4px 10px", borderRadius: "100px", background: T.tabBg, border: `1px solid ${T.border}`, color: T.textBody }}>
                      {detail.scheme_category}
                    </span>
                    <span style={{ fontSize: "11px", fontWeight: 600, padding: "4px 10px", borderRadius: "100px", background: T.tabBg, border: `1px solid ${T.border}`, color: T.textBody }}>
                      {detail.scheme_type}
                    </span>
                  </div>
                </div>

                {/* Chart card */}
                <div style={{ background: T.cardSolid, border: `1px solid ${T.borderMid}`, borderRadius: "16px", padding: "20px" }}>
                  {chartLoading ? (
                    <LoadingBlock T={T} label="Loading chart…" />
                  ) : chartError ? (
                    <ErrorBlock T={T} message={chartError} onRetry={retry} />
                  ) : chart && (
                    <>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "4px", flexWrap: "wrap", gap: "8px" }}>
                        <div>
                          <div style={{ fontSize: "24px", fontWeight: 700, color: (headlineReturn ?? 0) >= 0 ? "#22c55e" : "#ef4444" }}>
                            {fmtPct(headlineReturn)} <span style={{ fontSize: "13px", color: T.textMuted, fontWeight: 600 }}>· {periodLabel} return</span>
                          </div>
                          <div style={{ fontSize: "12px", color: T.textDim, marginTop: "4px" }}>
                            NAV ₹{fmtNav(chart.returns.latest_nav)}
                            {chart.points.length > 0 && ` · as of ${fmtDate(chart.points[chart.points.length - 1].nav_date)}`}
                          </div>
                        </div>
                        {!chart.is_live && (
                          <span style={{
                            fontSize: "11px", fontWeight: 600, padding: "4px 10px", borderRadius: "100px",
                            color: "#f59e0b", background: "rgba(245,158,11,0.12)", whiteSpace: "nowrap",
                          }}>
                            Data may not be current
                          </span>
                        )}
                      </div>

                      <div style={{ display: "flex", gap: "6px", margin: "14px 0" }}>
                        {PERIODS.map(p => (
                          <button
                            key={p.key}
                            onClick={() => setPeriod(p.key)}
                            style={{
                              padding: "6px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 700,
                              background: period === p.key ? T.activeBorder : T.tabBg,
                              border: `1px solid ${period === p.key ? T.activeBorder : T.border}`,
                              color: period === p.key ? "#fff" : T.textMuted, cursor: "pointer",
                            }}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>

                      {chart.points.length === 0 ? (
                        <EmptyBlock T={T} message="No data available for this fund." />
                      ) : (
                        <NavChart points={chart.points} positive={(headlineReturn ?? 0) >= 0} />
                      )}
                    </>
                  )}
                </div>

                {/* Trailing returns */}
                {chart && (
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: T.text, marginBottom: "10px" }}>Trailing Returns</div>
                    <ReturnsGrid returns={chart.returns} T={T} />
                  </div>
                )}

                {/* Fundamentals — collapses entirely when the backend has no data for this fund yet */}
                {hasFundamentals && (
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: T.text, marginBottom: "10px" }}>Fundamentals</div>
                    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "12px", padding: "14px", display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px" }}>
                      {detail.isin_growth != null && (
                        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: T.textMuted }}>ISIN (Growth)</span><span style={{ fontWeight: 600, color: T.text }}>{detail.isin_growth}</span></div>
                      )}
                      {detail.isin_div_reinvestment != null && (
                        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: T.textMuted }}>ISIN (Div. Reinvestment)</span><span style={{ fontWeight: 600, color: T.text }}>{detail.isin_div_reinvestment}</span></div>
                      )}
                      {detail.min_sip_amount != null && (
                        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: T.textMuted }}>Min SIP Amount</span><span style={{ fontWeight: 600, color: T.text }}>₹{detail.min_sip_amount}</span></div>
                      )}
                      {detail.fund_size_aum != null && (
                        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: T.textMuted }}>Fund Size (AUM)</span><span style={{ fontWeight: 600, color: T.text }}>₹{detail.fund_size_aum}</span></div>
                      )}
                      {detail.expense_ratio != null && (
                        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: T.textMuted }}>Expense Ratio</span><span style={{ fontWeight: 600, color: T.text }}>{detail.expense_ratio}%</span></div>
                      )}
                      {detail.rating != null && (
                        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: T.textMuted }}>Rating</span><span style={{ fontWeight: 600, color: T.text }}>{detail.rating} / 5</span></div>
                      )}
                      {detail.holdings != null && detail.holdings !== "unavailable" && (
                        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: T.textMuted }}>Holdings</span><span style={{ fontWeight: 600, color: T.text }}>{detail.holdings}</span></div>
                      )}
                    </div>
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
