import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, Activity, PieChart, BarChart2, BookmarkPlus, Shield, Zap, Globe, ChevronRight } from "lucide-react";

const BASE_URL = "https://my-product-backend-j1hu.onrender.com";

interface MarketIndex {
  name: string;
  stock_code: string;
  value: number;
  change: number;
  change_pct: number;
}

interface MarketData {
  market_status: string;
  indices: MarketIndex[];
}

function fmt(n: unknown): string {
  if (n == null || typeof n !== "number" || isNaN(n)) return "—";
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function fmtPct(n: unknown): string {
  if (n == null || typeof n !== "number" || isNaN(n)) return "—";
  return (n >= 0 ? "+" : "") + n.toFixed(2) + "%";
}

const INDEX_CONFIG = [
  { key: "Nifty 50",   title: "NIFTY 50",   icon: TrendingUp, accent: "#3b82f6", bg: "rgba(59,130,246,0.08)",  border: "rgba(59,130,246,0.2)"  },
  { key: "Sensex",     title: "SENSEX",     icon: Activity,   accent: "#10b981", bg: "rgba(16,185,129,0.08)",  border: "rgba(16,185,129,0.2)"  },
  { key: "Bank Nifty", title: "NIFTY BANK", icon: BarChart2,  accent: "#f59e0b", bg: "rgba(245,158,11,0.08)",  border: "rgba(245,158,11,0.2)"  },
];

const gainers = [
  { name: "RELIANCE",  sector: "Energy",  price: "₹2,891.40", change: "+4.21%" },
  { name: "TCS",       sector: "IT",      price: "₹3,456.75", change: "+3.87%" },
  { name: "HDFC BANK", sector: "Banking", price: "₹1,678.20", change: "+2.95%" },
  { name: "INFOSYS",   sector: "IT",      price: "₹1,543.60", change: "+2.43%" },
  { name: "BAJAJ FIN", sector: "Finance", price: "₹7,234.80", change: "+2.18%" },
];

const losers = [
  { name: "WIPRO",      sector: "IT",     price: "₹456.30",  change: "-3.12%" },
  { name: "ONGC",       sector: "Energy", price: "₹234.50",  change: "-2.87%" },
  { name: "NTPC",       sector: "Power",  price: "₹389.70",  change: "-2.41%" },
  { name: "COAL INDIA", sector: "Mining", price: "₹456.20",  change: "-1.98%" },
  { name: "BPCL",       sector: "Energy", price: "₹567.40",  change: "-1.73%" },
];

const sectors = [
  { name: "IT",      change: "+1.42%", positive: true  },
  { name: "Banking", change: "-0.21%", positive: false },
  { name: "Energy",  change: "+0.87%", positive: true  },
  { name: "FMCG",   change: "+0.34%", positive: true  },
  { name: "Pharma",  change: "+0.92%", positive: true  },
  { name: "Auto",    change: "-0.56%", positive: false },
  { name: "Realty",  change: "+1.18%", positive: true  },
  { name: "Metal",   change: "-1.03%", positive: false },
];

const funds = [
  { name: "Large Cap",  example: "HDFC Top 100",    returns: "12.4% p.a.", risk: "Moderate",  riskColor: "#f59e0b", color: "#3b82f6", bg: "rgba(59,130,246,0.07)",  border: "rgba(59,130,246,0.18)" },
  { name: "Mid Cap",    example: "Axis Midcap Fund", returns: "18.6% p.a.", risk: "High",      riskColor: "#f97316", color: "#8b5cf6", bg: "rgba(139,92,246,0.07)",  border: "rgba(139,92,246,0.18)" },
  { name: "Small Cap",  example: "SBI Small Cap",    returns: "22.1% p.a.", risk: "Very High", riskColor: "#ef4444", color: "#f59e0b", bg: "rgba(245,158,11,0.07)",  border: "rgba(245,158,11,0.18)" },
  { name: "Debt Fund",  example: "ICICI Pru Liquid", returns: "7.2% p.a.",  risk: "Low",       riskColor: "#10b981", color: "#10b981", bg: "rgba(16,185,129,0.07)",  border: "rgba(16,185,129,0.18)" },
];

const quickActions = [
  { icon: BarChart2,    title: "Explore Stocks", desc: "Browse & analyze stock markets in real time",  color: "#3b82f6" },
  { icon: TrendingUp,   title: "View Holdings",  desc: "Check your current investment portfolio",       color: "#10b981" },
  { icon: PieChart,     title: "Start SIP",      desc: "Begin systematic investment plans easily",      color: "#8b5cf6" },
  { icon: BookmarkPlus, title: "Watchlist",       desc: "Monitor and track your favourite stocks",      color: "#f59e0b" },
];

const features = [
  { icon: Zap,    title: "Lightning Fast",      desc: "Sub-millisecond order execution with zero slippage on major indices.", color: "#f59e0b" },
  { icon: Shield, title: "Bank-Grade Security", desc: "2FA, end-to-end encryption, and SEBI-regulated infrastructure.",       color: "#10b981" },
  { icon: Globe,  title: "Global Markets",      desc: "Trade NSE, BSE, MCX, and track international markets live.",           color: "#3b82f6" },
];

/* ── Theme colour map ──────────────────────────────────── */
const DARK = {
  bg:            "#0d1117",
  card:          "rgba(22,27,34,0.8)",
  cardSolid:     "#161b22",
  border:        "rgba(255,255,255,0.07)",
  borderSubtle:  "rgba(255,255,255,0.04)",
  borderMid:     "rgba(255,255,255,0.08)",
  text:          "#e6edf3",
  textMuted:     "#8b949e",
  textDim:       "#6e7681",
  textBody:      "#c9d1d9",
  headerBar:     "rgba(13,17,23,0.95)",
};

const LIGHT = {
  bg:            "#f0f4f8",
  card:          "rgba(255,255,255,0.9)",
  cardSolid:     "#ffffff",
  border:        "rgba(0,0,0,0.08)",
  borderSubtle:  "rgba(0,0,0,0.04)",
  borderMid:     "rgba(0,0,0,0.1)",
  text:          "#0f172a",
  textMuted:     "#64748b",
  textDim:       "#94a3b8",
  textBody:      "#334155",
  headerBar:     "rgba(240,244,248,0.97)",
};

function SectionHeading({ title, sub, T }: { title: string; sub?: string; T: typeof DARK }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
      <h2 style={{ fontSize: "17px", fontWeight: 700, color: T.text, margin: 0 }}>{title}</h2>
      {sub && <span style={{ fontSize: "12px", color: T.textMuted }}>{sub}</span>}
    </div>
  );
}

export function HeroSection({ isDark }: { isDark: boolean }) {
  const T = isDark ? DARK : LIGHT;
  const [marketData, setMarketData] = useState<MarketData | null>(null);

  useEffect(() => {
    let controller = new AbortController();

    const fetchData = () => {
      controller.abort();
      controller = new AbortController();
      fetch(`${BASE_URL}/api/market/indices`, { signal: controller.signal })
        .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); })
        .then((d: unknown) => {
          if (d && typeof d === "object" && "indices" in d) {
            const data = d as MarketData;
            data.indices = Array.isArray(data.indices) ? data.indices : [];
            setMarketData(data);
          }
        })
        .catch(e => { if (e?.name !== "AbortError") console.error("[market/indices]", e); });
    };

    fetchData();
    const id = setInterval(fetchData, 10_000);
    return () => { clearInterval(id); controller.abort(); };
  }, []);

  const marketOpen = marketData?.market_status === "open";
  const statusColor = marketOpen ? "#4ade80" : "#f87171";
  const statusLabel = marketOpen ? "MARKETS LIVE" : "MARKET CLOSED";

  const apiIndices = Array.isArray(marketData?.indices) ? marketData!.indices : [];

  function resolvedPct(value: number, change: number, changePct: number): number {
    if (changePct !== 0) return changePct;
    const prev = value - change;
    if (prev > 0 && change !== 0) return (change / prev) * 100;
    return 0;
  }

  const indexCards = INDEX_CONFIG.map(cfg => {
    const live = apiIndices.find(i => i.name === cfg.key);
    const chg = live?.change ?? 0;
    const pct = live ? resolvedPct(live.value ?? 0, chg, live.change_pct ?? 0) : 0;
    return {
      ...cfg,
      value: live ? fmt(live.value) : "—",
      change: live ? (chg >= 0 ? "+" : "") + fmt(Math.abs(chg)) : "—",
      pct: live ? fmtPct(pct) : "—",
      positive: live ? pct >= 0 : true,
    };
  });

  const tickerRows = apiIndices.map(i => {
    const pct = resolvedPct(i.value ?? 0, i.change ?? 0, i.change_pct ?? 0);
    return {
      name: i.name ? String(i.name).toUpperCase() : "—",
      value: fmt(i.value),
      change: fmtPct(pct),
      positive: pct >= 0,
    };
  });

  return (
    <div style={{ background: T.bg }}>

      {/* ── PAGE HEADER BAR ── */}
      <div style={{ borderBottom: `1px solid ${T.border}`, background: T.headerBar }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <h1 style={{ fontSize: "19px", fontWeight: 700, color: T.text, margin: 0 }}>Market Dashboard</h1>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: `${statusColor}14`, border: `1px solid ${statusColor}33`, borderRadius: "100px", padding: "3px 10px" }}>
              <span
                className={marketOpen ? "dot-live" : undefined}
                style={{ width: "6px", height: "6px", borderRadius: "50%", background: statusColor, boxShadow: `0 0 6px ${statusColor}`, display: "inline-block" }}
              />
              <span style={{ fontSize: "11px", color: statusColor, fontWeight: 700, letterSpacing: "0.5px" }}>{statusLabel}</span>
            </div>
          </div>
          <span style={{ fontSize: "12px", color: T.textDim }}>NSE · BSE · MCX · Updated just now</span>
        </div>
      </div>

      {/* ── KEY INDICES + LIVE TICKER ── */}
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px 24px 0" }}>
        <SectionHeading title="Key Indices" sub="Live · 15 min delay" T={T} />
        <div style={{ display: "flex", gap: "20px", alignItems: "flex-start" }}>

          {/* Three index cards */}
          <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
            {indexCards.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.title} style={{ background: stat.bg, border: `1px solid ${stat.border}`, borderRadius: "16px", padding: "20px 20px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                    <span style={{ fontSize: "13px", color: T.textMuted, fontWeight: 500 }}>{stat.title}</span>
                    <div style={{ width: "30px", height: "30px", borderRadius: "8px", background: `${stat.accent}1f`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Icon style={{ width: "15px", height: "15px", color: stat.accent }} />
                    </div>
                  </div>
                  <div style={{ fontSize: "26px", fontWeight: 800, color: T.text, lineHeight: 1, marginBottom: "10px" }}>{stat.value}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: stat.positive ? "#22c55e" : "#f87171", background: stat.positive ? "rgba(34,197,94,0.1)" : "rgba(248,113,113,0.1)", padding: "2px 8px", borderRadius: "100px" }}>
                      {stat.pct}
                    </span>
                    <span style={{ fontSize: "11px", color: T.textDim }}>{stat.change} pts</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Live Ticker — vertical upward scroll */}
          <div style={{ width: "248px", flexShrink: 0, background: T.card, border: `1px solid ${T.borderMid}`, borderRadius: "16px", overflow: "hidden" }}>
            <div style={{ padding: "12px 14px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                className={marketOpen ? "dot-live" : undefined}
                style={{ width: "7px", height: "7px", borderRadius: "50%", background: statusColor, boxShadow: `0 0 5px ${statusColor}`, display: "inline-block" }}
              />
              <span style={{ fontSize: "12px", fontWeight: 700, color: T.text }}>{marketOpen ? "Live Prices" : "Last Prices"}</span>
            </div>
            <div style={{ height: "172px", overflow: "hidden" }}>
              {tickerRows.length > 0 ? (
                <div className="animate-ticker-up">
                  {[...tickerRows, ...tickerRows].map((t, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 14px", borderBottom: `1px solid ${T.borderSubtle}` }}>
                      <span style={{ fontSize: "12px", fontWeight: 600, color: T.textBody }}>{t.name}</span>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "12px", fontWeight: 600, color: T.text }}>{t.value}</div>
                        <div style={{ fontSize: "11px", fontWeight: 600, color: t.positive ? "#22c55e" : "#f87171" }}>{t.change}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: "12px", color: T.textDim }}>Loading…</div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ── SECTOR PERFORMANCE ── */}
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "40px 24px 0" }}>
        <SectionHeading title="Sector Performance" sub="NSE Sectoral Indices" T={T} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: "10px" }}>
          {sectors.map((s) => (
            <div key={s.name} style={{
              background: s.positive ? "rgba(34,197,94,0.08)" : "rgba(248,113,113,0.08)",
              border: `1px solid ${s.positive ? "rgba(34,197,94,0.2)" : "rgba(248,113,113,0.2)"}`,
              borderRadius: "12px", padding: "14px 10px", textAlign: "center",
            }}>
              <div style={{ fontSize: "12px", fontWeight: 600, color: T.textMuted, marginBottom: "6px" }}>{s.name}</div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: s.positive ? "#22c55e" : "#f87171" }}>{s.change}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── TOP GAINERS & LOSERS ── */}
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "40px 24px 0" }}>
        <SectionHeading title="Top Movers" sub="NSE · Today" T={T} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>

          {/* Gainers */}
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "16px", overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: "8px" }}>
              <TrendingUp style={{ width: "15px", height: "15px", color: "#22c55e" }} />
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#22c55e" }}>Top Gainers</span>
            </div>
            {gainers.map((g, i) => (
              <div key={g.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", borderBottom: i < gainers.length - 1 ? `1px solid ${T.borderSubtle}` : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "34px", height: "34px", borderRadius: "10px", background: "rgba(34,197,94,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700, color: "#22c55e", flexShrink: 0 }}>
                    {g.name.slice(0, 2)}
                  </div>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: T.text }}>{g.name}</div>
                    <div style={{ fontSize: "11px", color: T.textDim }}>{g.sector}</div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: T.textBody }}>{g.price}</div>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#22c55e" }}>{g.change}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Losers */}
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "16px", overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: "8px" }}>
              <TrendingDown style={{ width: "15px", height: "15px", color: "#f87171" }} />
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#f87171" }}>Top Losers</span>
            </div>
            {losers.map((l, i) => (
              <div key={l.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", borderBottom: i < losers.length - 1 ? `1px solid ${T.borderSubtle}` : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "34px", height: "34px", borderRadius: "10px", background: "rgba(248,113,113,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700, color: "#f87171", flexShrink: 0 }}>
                    {l.name.slice(0, 2)}
                  </div>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: T.text }}>{l.name}</div>
                    <div style={{ fontSize: "11px", color: T.textDim }}>{l.sector}</div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: T.textBody }}>{l.price}</div>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#f87171" }}>{l.change}</div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* ── MUTUAL FUNDS ── */}
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "40px 24px 0" }}>
        <SectionHeading title="Mutual Funds" sub="1-year trailing returns" T={T} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}>
          {funds.map((f) => (
            <div key={f.name}
              style={{ background: f.bg, border: `1px solid ${f.border}`, borderRadius: "16px", padding: "22px 20px", cursor: "pointer", transition: "transform 0.2s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)"; }}
            >
              <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: `${f.color}22`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "14px" }}>
                <PieChart style={{ width: "20px", height: "20px", color: f.color }} />
              </div>
              <div style={{ fontSize: "15px", fontWeight: 700, color: T.text, marginBottom: "4px" }}>{f.name}</div>
              <div style={{ fontSize: "11px", color: T.textDim, marginBottom: "16px" }}>{f.example}</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: "18px", fontWeight: 800, color: f.color }}>{f.returns}</div>
                  <div style={{ fontSize: "10px", color: T.textDim, marginTop: "2px" }}>avg. returns</div>
                </div>
                <span style={{ fontSize: "10px", fontWeight: 700, color: f.riskColor, background: `${f.riskColor}18`, border: `1px solid ${f.riskColor}30`, padding: "3px 8px", borderRadius: "100px" }}>
                  {f.risk}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── QUICK ACTIONS ── */}
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "40px 24px 0" }}>
        <SectionHeading title="Quick Actions" sub="Get started" T={T} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}>
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <div key={action.title}
                style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "16px", padding: "24px", cursor: "pointer", transition: "border-color 0.2s, transform 0.2s" }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = action.color + "60";
                  (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = T.border;
                  (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
                }}
              >
                <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: `${action.color}1a`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px" }}>
                  <Icon style={{ width: "22px", height: "22px", color: action.color }} />
                </div>
                <h3 style={{ fontSize: "15px", fontWeight: 700, color: T.text, margin: "0 0 6px" }}>{action.title}</h3>
                <p style={{ fontSize: "13px", color: T.textMuted, margin: "0 0 14px", lineHeight: 1.5 }}>{action.desc}</p>
                <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", fontWeight: 600, color: action.color }}>
                  Open <ChevronRight style={{ width: "13px", height: "13px" }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── WHY PRIMEPIPTRADE ── */}
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "40px 24px 56px" }}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: T.text, margin: "0 0 8px" }}>Why PrimePipTrade?</h2>
          <p style={{ fontSize: "13px", color: T.textMuted, margin: 0 }}>Built for serious traders who demand speed, security, and reliability</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px" }}>
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "20px", padding: "28px" }}>
                <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: `${f.color}1a`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "18px" }}>
                  <Icon style={{ width: "22px", height: "22px", color: f.color }} />
                </div>
                <h3 style={{ fontSize: "16px", fontWeight: 700, color: T.text, margin: "0 0 8px" }}>{f.title}</h3>
                <p style={{ fontSize: "13px", color: T.textMuted, margin: 0, lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
