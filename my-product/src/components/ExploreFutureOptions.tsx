import { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Header } from "./header";
import { Footer } from "./footer";
import { BarChart2, TrendingUp, Activity, Layers, Terminal, List, Link2 } from "lucide-react";

const BASE_URL = "https://api.primepiptrade.com";

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

function fmtChange(n: unknown): string {
  if (n == null || typeof n !== "number" || isNaN(n)) return "—";
  return (n >= 0 ? "+" : "") + n.toFixed(2);
}

function fmtPct(n: unknown): string {
  if (n == null || typeof n !== "number" || isNaN(n)) return "—";
  return (n >= 0 ? "+" : "") + n.toFixed(2) + "%";
}

function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findApiIndex(apiIndices: MarketIndex[], variants: string[]): MarketIndex | undefined {
  return apiIndices.find(i => {
    const n = normalizeName(i.name || "");
    return variants.some(v => { const nv = normalizeName(v); return n === nv || n.includes(nv); });
  });
}

interface Order {
  id: number;
  user_id: number;
  symbol: string;
  exchange: string;
  side: "BUY" | "SELL";
  quantity: number;
  price: number | null;
  order_type: string;
  product_type: string;
  validity: string;
  status: string;
  created_at: string;
  updated_at: string;
}

// The order API returns either a plain string `detail`, or (on pydantic
// validation failures) an array of { loc, msg, ... } objects.
function extractErrorMessage(body: any, fallback: string): string {
  const detail = body?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d: any) => {
        const field = Array.isArray(d?.loc) ? d.loc.slice(-1)[0] : d?.loc;
        return field ? `${field}: ${d?.msg ?? "invalid value"}` : d?.msg ?? "invalid value";
      })
      .join("; ");
  }
  return fallback;
}

function statusColor(status: string): string {
  switch (status) {
    case "EXECUTED": return "#22c55e";
    case "PARTIALLY_EXECUTED": return "#3b82f6";
    case "PENDING": return "#f59e0b";
    case "CANCELLED": return "#ef4444";
    default: return "#8b949e";
  }
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/* ── Theme ─────────────────────────────────────────────── */
const DARK = {
  bg:           "#0d1117",
  card:         "rgba(22,27,34,0.9)",
  cardSolid:    "#161b22",
  border:       "rgba(255,255,255,0.07)",
  borderMid:    "rgba(255,255,255,0.12)",
  text:         "#e6edf3",
  textMuted:    "#8b949e",
  textDim:      "#6e7681",
  textBody:     "#c9d1d9",
  tabBg:        "rgba(255,255,255,0.04)",
  tabHover:     "rgba(255,255,255,0.08)",
  activeTab:    "rgba(59,130,246,0.15)",
  activeBorder: "#3b82f6",
  headerBar:    "rgba(13,17,23,0.95)",
};

const LIGHT = {
  bg:           "#f0f4f8",
  card:         "rgba(255,255,255,0.95)",
  cardSolid:    "#ffffff",
  border:       "rgba(0,0,0,0.08)",
  borderMid:    "rgba(0,0,0,0.12)",
  text:         "#0f172a",
  textMuted:    "#64748b",
  textDim:      "#94a3b8",
  textBody:     "#334155",
  tabBg:        "rgba(0,0,0,0.04)",
  tabHover:     "rgba(0,0,0,0.07)",
  activeTab:    "rgba(59,130,246,0.1)",
  activeBorder: "#3b82f6",
  headerBar:    "rgba(240,244,248,0.97)",
};

/* ── Index Options ──────────────────────────────────────── */
const INDICES = [
  { key: "nifty50",     label: "NIFTY",      icon: TrendingUp, accent: "#3b82f6", symbol: "NIFTY",      matchNames: ["Nifty 50", "Nifty"] },
  { key: "sensex",      label: "SENSEX",     icon: Activity,   accent: "#10b981", symbol: "SENSEX",     matchNames: ["Sensex"] },
  { key: "banknifty",   label: "BANKNIFTY",  icon: BarChart2,  accent: "#f59e0b", symbol: "BANKNIFTY",  matchNames: ["Bank Nifty", "Nifty Bank"] },
  { key: "midcpnifty",  label: "MIDCPNIFTY", icon: Layers,     accent: "#8b5cf6", symbol: "MIDCPNIFTY", matchNames: ["Nifty Midcap Select", "Midcap Nifty", "Midcp Nifty"] },
  { key: "finnifty",    label: "FINNIFTY",   icon: List,       accent: "#ec4899", symbol: "FINNIFTY",   matchNames: ["Fin Nifty", "Nifty Financial Services"] },
];

const SECTION_TABS = ["Explore", "Positions", "Orders"];

/* ── Top Traded ──────────────────────────────────────────── */
const ASSET_TABS = ["Equity", "Commodities"];

const BAR_PATTERNS: Record<string, number[]> = {
  nifty50:    [6, 5, 7, 4, 6, 8, 9, 11, 10, 13],
  sensex:     [5, 6, 5, 7, 8, 7, 9, 10, 9, 12],
  banknifty:  [11, 9, 10, 8, 9, 7, 6, 5, 6, 4],
  midcpnifty: [10, 11, 9, 8, 7, 8, 6, 5, 6, 4],
  finnifty:   [6, 7, 6, 8, 7, 9, 8, 10, 11, 12],
  indiavix:   [9, 10, 8, 9, 11, 10, 8, 9, 7, 8],
};

const EXTRA_TOP_TRADED = [
  { key: "indiavix", label: "INDIA VIX", matchNames: ["India VIX"] },
];

function CandleSparkline({ bars, positive }: { bars: number[]; positive: boolean }) {
  const color = positive ? "#22c55e" : "#ef4444";
  const max = Math.max(...bars);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "3px", height: "32px" }}>
      {bars.map((h, i) => (
        <div
          key={i}
          style={{
            width: "4px",
            height: `${(h / max) * 100}%`,
            minHeight: "3px",
            borderRadius: "1px",
            background: color,
            opacity: 0.45 + (i / bars.length) * 0.55,
          }}
        />
      ))}
    </div>
  );
}

export default function ExploreFutureOptions() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isDark, setIsDark] = useState(() => localStorage.getItem("theme") !== "light");
  const [activeSection, setActiveSection] = useState<string>((location.state as any)?.tab ?? "Explore");
  const [hoveredIndex, setHoveredIndex] = useState<string | null>(null);
  const [activeAsset, setActiveAsset] = useState<string>("Equity");
  const T = isDark ? DARK : LIGHT;

  const [marketData, setMarketData] = useState<MarketData | null>(() => {
    try {
      const cached = localStorage.getItem("cachedMarketData");
      if (cached) return JSON.parse(cached) as MarketData;
    } catch { /* ignore */ }
    return null;
  });

  useEffect(() => {
    if (!localStorage.getItem("authToken")) navigate("/", { replace: true });
  }, []);

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
            localStorage.setItem("cachedMarketData", JSON.stringify(data));
          }
        })
        .catch(e => { if (e?.name !== "AbortError") console.error("[market/indices]", e); });
    };

    fetchData();
    const id = setInterval(fetchData, 10_000);
    return () => { clearInterval(id); controller.abort(); };
  }, []);

  const apiIndices = Array.isArray(marketData?.indices) ? marketData!.indices : [];

  const topTraded = [...INDICES, ...EXTRA_TOP_TRADED].map(idx => {
    const live = findApiIndex(apiIndices, idx.matchNames);
    return {
      key: idx.key,
      name: idx.label,
      live,
      bars: BAR_PATTERNS[idx.key],
    };
  });

  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  useEffect(() => {
    if (activeSection !== "Orders" && activeSection !== "Positions") return;
    let cancelled = false;

    const fetchOrders = () => {
      setOrdersLoading(true);
      fetch(`${BASE_URL}/orders`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
      })
        .then(async r => ({ ok: r.ok, body: await r.json() }))
        .then(({ ok, body }) => {
          if (cancelled) return;
          if (!ok || !body?.success) {
            setOrdersError(extractErrorMessage(body, "Failed to load orders."));
            return;
          }
          setOrders(Array.isArray(body.orders) ? body.orders : []);
          setOrdersError(null);
        })
        .catch(() => { if (!cancelled) setOrdersError("Network error while loading orders."); })
        .finally(() => { if (!cancelled) setOrdersLoading(false); });
    };

    fetchOrders();
    const id = setInterval(fetchOrders, 10_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [activeSection]);

  async function cancelOrder(orderId: number) {
    setCancellingId(orderId);
    try {
      const res = await fetch(`${BASE_URL}/orders/${orderId}/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
        body: JSON.stringify({}),
      });
      const body = await res.json();
      if (!res.ok || !body?.success) {
        setOrdersError(extractErrorMessage(body, "Could not cancel order."));
        return;
      }
      setOrders(prev => prev.map(o => (o.id === orderId ? { ...o, status: "CANCELLED" } : o)));
    } catch {
      setOrdersError("Network error while cancelling order.");
    } finally {
      setCancellingId(null);
    }
  }

  // Positions derived from filled orders — the backend has no dedicated
  // positions endpoint yet, so this is an approximation based on each
  // order's full quantity (the order-list response doesn't expose
  // matched_quantity for partial fills, only the create-order response does).
  const positions = useMemo(() => {
    const filled = orders.filter(o => o.status === "EXECUTED" || o.status === "PARTIALLY_EXECUTED");
    const bySymbol: Record<string, { symbol: string; exchange: string; netQty: number; buyValue: number; sellValue: number; buyQty: number; sellQty: number }> = {};
    filled.forEach(o => {
      if (!bySymbol[o.symbol]) {
        bySymbol[o.symbol] = { symbol: o.symbol, exchange: o.exchange, netQty: 0, buyValue: 0, sellValue: 0, buyQty: 0, sellQty: 0 };
      }
      const p = bySymbol[o.symbol];
      const value = (o.price ?? 0) * o.quantity;
      if (o.side === "BUY") { p.netQty += o.quantity; p.buyQty += o.quantity; p.buyValue += value; }
      else { p.netQty -= o.quantity; p.sellQty += o.quantity; p.sellValue += value; }
    });
    return Object.values(bySymbol).filter(p => p.netQty !== 0);
  }, [orders]);

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

        {/* ── Top bar: section tabs + Terminal button ── */}
        <div style={{ borderBottom: `1px solid ${T.border}`, background: T.headerBar, position: "sticky", top: "64px", zIndex: 40 }}>
          <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>

            {/* Section tabs: Stocks | Mutual Funds | F&O */}
            <div style={{ display: "flex", gap: "4px" }}>
              {SECTION_TABS.map(tab => {
                const active = activeSection === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveSection(tab)}
                    style={{
                      padding: "14px 20px",
                      fontSize: "14px",
                      fontWeight: active ? 700 : 500,
                      color: active ? T.activeBorder : T.textMuted,
                      background: "transparent",
                      border: "none",
                      borderBottom: active ? `2px solid ${T.activeBorder}` : "2px solid transparent",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      marginBottom: "-1px",
                    }}
                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = T.text; }}
                    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = T.textMuted; }}
                  >
                    {tab}
                  </button>
                );
              })}
            </div>

            {/* Terminal button */}
            <button
              style={{
                display: "flex", alignItems: "center", gap: "8px",
                padding: "8px 18px", borderRadius: "10px",
                background: "rgba(139,92,246,0.15)",
                border: "1px solid rgba(139,92,246,0.35)",
                color: "#a78bfa", fontSize: "13px", fontWeight: 700,
                cursor: "pointer", transition: "all 0.2s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(139,92,246,0.25)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(139,92,246,0.15)"; }}
            >
              <Terminal style={{ width: "15px", height: "15px" }} />
              F&O Terminal
            </button>
          </div>
        </div>

        {/* ── Index selector row ── */}
        <div style={{ borderBottom: `1px solid ${T.border}`, background: T.headerBar }}>
          <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "12px 24px", display: "flex", gap: "8px" }}>
            {INDICES.map(idx => {
              const Icon = idx.icon;
              const hovered = hoveredIndex === idx.key;
              return (
                <div
                  key={idx.key}
                  style={{ position: "relative", flex: 1 }}
                  onMouseEnter={() => setHoveredIndex(idx.key)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  {/* Index tab pill */}
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "7px",
                    padding: "8px 16px", borderRadius: "10px",
                    background: hovered ? T.tabHover : T.tabBg,
                    border: `1px solid ${hovered ? idx.accent + "55" : T.border}`,
                    cursor: "pointer", transition: "all 0.18s", userSelect: "none", width: "100%",
                  }}>
                    <Icon style={{ width: "14px", height: "14px", color: idx.accent }} />
                    <span style={{ fontSize: "13px", fontWeight: 600, color: hovered ? idx.accent : T.textBody }}>
                      {idx.label}
                    </span>
                    <span style={{ fontSize: "10px", color: T.textDim, fontWeight: 500 }}>{idx.symbol}</span>
                  </div>

                  {/* Hover card */}
                  {hovered && (
                    <div style={{
                      position: "absolute", top: "calc(100% + 8px)", left: 0,
                      background: T.cardSolid,
                      border: `1px solid ${T.borderMid}`,
                      borderRadius: "14px",
                      boxShadow: isDark
                        ? "0 16px 40px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4)"
                        : "0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
                      padding: "8px", minWidth: "200px", zIndex: 100,
                    }}>
                      {/* Option Chain */}
                      <button
                        style={{
                          width: "100%", display: "flex", alignItems: "center", gap: "12px",
                          padding: "10px 12px", borderRadius: "10px", border: "none",
                          background: "transparent", cursor: "pointer", transition: "background 0.15s",
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = T.tabHover; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                      >
                        <div style={{ width: "32px", height: "32px", borderRadius: "9px", background: "rgba(59,130,246,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <List style={{ width: "15px", height: "15px", color: "#3b82f6" }} />
                        </div>
                        <div style={{ textAlign: "left" }}>
                          <div style={{ fontSize: "13px", fontWeight: 600, color: T.text }}>Option Chain</div>
                          <div style={{ fontSize: "11px", color: T.textDim }}>View all strikes & OI</div>
                        </div>
                      </button>

                      {/* Terminal */}
                      <button
                        style={{
                          width: "100%", display: "flex", alignItems: "center", gap: "12px",
                          padding: "10px 12px", borderRadius: "10px", border: "none",
                          background: "transparent", cursor: "pointer", transition: "background 0.15s",
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = T.tabHover; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                      >
                        <div style={{ width: "32px", height: "32px", borderRadius: "9px", background: "rgba(139,92,246,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Terminal style={{ width: "15px", height: "15px", color: "#8b5cf6" }} />
                        </div>
                        <div style={{ textAlign: "left" }}>
                          <div style={{ fontSize: "13px", fontWeight: 600, color: T.text }}>Terminal</div>
                          <div style={{ fontSize: "11px", color: T.textDim }}>Live F&O trading view</div>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Top traded (Explore tab) ── */}
        {activeSection === "Explore" && (
          <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px 24px" }}>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                <span style={{ fontSize: "17px", fontWeight: 700, color: T.text }}>Top traded</span>
                <div style={{ display: "flex", gap: "6px" }}>
                  {ASSET_TABS.map(tab => {
                    const active = activeAsset === tab;
                    return (
                      <button
                        key={tab}
                        onClick={() => setActiveAsset(tab)}
                        style={{
                          padding: "6px 14px", borderRadius: "20px", fontSize: "13px", fontWeight: 600,
                          color: active ? "#fff" : T.textMuted,
                          background: active ? T.activeBorder : T.tabBg,
                          border: `1px solid ${active ? T.activeBorder : T.border}`,
                          cursor: "pointer", transition: "all 0.18s",
                        }}
                      >
                        {tab}
                      </button>
                    );
                  })}
                </div>
              </div>
              <span style={{ fontSize: "13px", fontWeight: 600, color: T.activeBorder, cursor: "pointer" }}>
                See more
              </span>
            </div>

            {activeAsset === "Equity" ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
                {topTraded.map((item) => {
                  const loading = !item.live;
                  const chg = item.live?.change ?? 0;
                  const positive = chg >= 0;
                  const color = positive ? "#22c55e" : "#ef4444";
                  return (
                    <div
                      key={item.key}
                      onClick={() => {
                        if (item.live) {
                          navigate("/terminal/fno", {
                            state: {
                              indexData: {
                                name: item.name,
                                symbol: item.key.toUpperCase(),
                                value: item.live.value,
                                change: item.live.change,
                                change_pct: item.live.change_pct,
                              },
                            },
                          });
                        }
                      }}
                      style={{
                        position: "relative", background: T.card, border: `1px solid ${T.border}`,
                        borderRadius: "16px", padding: "18px", display: "flex", flexDirection: "column", gap: "14px",
                        transition: "border-color 0.18s, transform 0.18s", cursor: loading ? "default" : "pointer",
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLDivElement).style.borderColor = T.borderMid;
                        if (!loading) (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLDivElement).style.borderColor = T.border;
                        (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                        <span style={{ fontSize: "14px", fontWeight: 700, color: T.text }}>{item.name}</span>
                        <CandleSparkline bars={item.bars} positive={positive} />
                      </div>

                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                        <div>
                          <div style={{ fontSize: "19px", fontWeight: 700, color: T.text }}>
                            {loading ? "—" : `₹${fmt(item.live!.value)}`}
                          </div>
                          <div style={{ fontSize: "12px", fontWeight: 600, color: loading ? T.textDim : color }}>
                            {loading ? "Loading…" : `${fmtChange(chg)} (${fmtPct(item.live!.change_pct)})`}
                          </div>
                        </div>
                        <button
                          style={{
                            width: "30px", height: "30px", borderRadius: "50%",
                            background: T.tabBg, border: `1px solid ${T.border}`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            cursor: "pointer", flexShrink: 0,
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = T.tabHover; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = T.tabBg; }}
                        >
                          <Link2 style={{ width: "14px", height: "14px", color: T.textMuted }} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                minHeight: "160px", background: T.card, border: `1px solid ${T.border}`,
                borderRadius: "16px", fontSize: "13px", color: T.textMuted,
              }}>
                Commodities F&O data coming soon
              </div>
            )}
          </div>
        )}

        {/* ── Orders tab ── */}
        {activeSection === "Orders" && (
          <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px 24px" }}>
            <div style={{ fontSize: "17px", fontWeight: 700, color: T.text, marginBottom: "16px" }}>Order Book</div>

            {ordersError && (
              <div style={{
                fontSize: "13px", color: "#ef4444", background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.25)", borderRadius: "8px", padding: "10px 14px", marginBottom: "16px",
              }}>
                {ordersError}
              </div>
            )}

            {ordersLoading && orders.length === 0 ? (
              <div style={{ fontSize: "13px", color: T.textMuted, textAlign: "center", padding: "40px" }}>Loading orders…</div>
            ) : orders.length === 0 ? (
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                minHeight: "160px", background: T.card, border: `1px solid ${T.border}`,
                borderRadius: "16px", fontSize: "13px", color: T.textMuted,
              }}>
                No orders placed yet. Buy or sell an option from the terminal to see it here.
              </div>
            ) : (
              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "16px", overflow: "hidden" }}>
                {orders.map((o, i) => (
                  <div
                    key={o.id}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "14px 18px", borderBottom: i < orders.length - 1 ? `1px solid ${T.border}` : "none",
                      gap: "12px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, minWidth: 0 }}>
                      <span style={{
                        fontSize: "10px", fontWeight: 700, padding: "3px 8px", borderRadius: "100px",
                        color: o.side === "BUY" ? "#22c55e" : "#ef4444",
                        background: o.side === "BUY" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                        flexShrink: 0,
                      }}>
                        {o.side}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: "13px", fontWeight: 700, color: T.text, overflow: "hidden", textOverflow: "ellipsis" }}>
                          {o.symbol}
                        </div>
                        <div style={{ fontSize: "11px", color: T.textDim }}>
                          {o.exchange} · {o.order_type} · {o.product_type} · Qty {o.quantity}
                          {o.price != null && ` · ₹${fmt(o.price)}`}
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <span style={{
                        fontSize: "10px", fontWeight: 700, padding: "3px 8px", borderRadius: "100px",
                        color: statusColor(o.status), background: `${statusColor(o.status)}1a`,
                      }}>
                        {o.status.replace("_", " ")}
                      </span>
                      <div style={{ fontSize: "10px", color: T.textDim, marginTop: "4px" }}>{fmtDateTime(o.created_at)}</div>
                    </div>

                    {o.status === "PENDING" && (
                      <button
                        onClick={() => cancelOrder(o.id)}
                        disabled={cancellingId === o.id}
                        style={{
                          fontSize: "11px", fontWeight: 600, padding: "6px 12px", borderRadius: "8px",
                          background: "transparent", border: `1px solid ${T.border}`, color: T.textMuted,
                          cursor: cancellingId === o.id ? "not-allowed" : "pointer", flexShrink: 0,
                        }}
                      >
                        {cancellingId === o.id ? "Cancelling…" : "Cancel"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Positions tab ── */}
        {activeSection === "Positions" && (
          <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px 24px" }}>
            <div style={{ fontSize: "17px", fontWeight: 700, color: T.text, marginBottom: "4px" }}>Positions</div>
            <div style={{ fontSize: "12px", color: T.textDim, marginBottom: "16px" }}>
              Derived from executed orders · approximate until the backend exposes a dedicated positions endpoint
            </div>

            {positions.length === 0 ? (
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                minHeight: "160px", background: T.card, border: `1px solid ${T.border}`,
                borderRadius: "16px", fontSize: "13px", color: T.textMuted,
              }}>
                No open positions.
              </div>
            ) : (
              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "16px", overflow: "hidden" }}>
                {positions.map((p, i) => {
                  const avgPrice = p.netQty > 0
                    ? p.buyValue / (p.buyQty || 1)
                    : p.sellValue / (p.sellQty || 1);
                  return (
                    <div
                      key={p.symbol}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "14px 18px", borderBottom: i < positions.length - 1 ? `1px solid ${T.border}` : "none",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: 700, color: T.text }}>{p.symbol}</div>
                        <div style={{ fontSize: "11px", color: T.textDim }}>{p.exchange}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "13px", fontWeight: 700, color: p.netQty > 0 ? "#22c55e" : "#ef4444" }}>
                          {p.netQty > 0 ? "LONG" : "SHORT"} {Math.abs(p.netQty)}
                        </div>
                        <div style={{ fontSize: "11px", color: T.textDim }}>Avg ₹{fmt(avgPrice)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </main>

      <Footer isDark={isDark} />
    </div>
  );
}
