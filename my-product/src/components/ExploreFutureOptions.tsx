import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "./header";
import { Footer } from "./footer";
import { BarChart2, TrendingUp, Activity, Layers, Terminal, List } from "lucide-react";

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
  { key: "nifty50",     label: "Nifty 50",     icon: TrendingUp, accent: "#3b82f6", symbol: "NIFTY"     },
  { key: "sensex",      label: "Sensex",        icon: Activity,   accent: "#10b981", symbol: "SENSEX"    },
  { key: "banknifty",   label: "Bank Nifty",    icon: BarChart2,  accent: "#f59e0b", symbol: "BANKNIFTY" },
  { key: "midcpnifty",  label: "MidcpNifty",    icon: Layers,     accent: "#8b5cf6", symbol: "MIDCPNIFTY"},
  { key: "finnifty",    label: "FinNifty",      icon: List,       accent: "#ec4899", symbol: "FINNIFTY"  },
];

const SECTION_TABS = ["Stocks", "Mutual Funds", "F&O"];

export default function ExploreFutureOptions() {
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(() => localStorage.getItem("theme") !== "light");
  const [activeSection, setActiveSection] = useState("F&O");
  const [hoveredIndex, setHoveredIndex] = useState<string | null>(null);
  const T = isDark ? DARK : LIGHT;

  useEffect(() => {
    if (!localStorage.getItem("authToken")) navigate("/", { replace: true });
  }, []);

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
                  style={{ position: "relative" }}
                  onMouseEnter={() => setHoveredIndex(idx.key)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  {/* Index tab pill */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: "7px",
                    padding: "8px 16px", borderRadius: "10px",
                    background: hovered ? T.tabHover : T.tabBg,
                    border: `1px solid ${hovered ? idx.accent + "55" : T.border}`,
                    cursor: "pointer", transition: "all 0.18s", userSelect: "none",
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
                      {/* Card header */}
                      <div style={{ padding: "8px 12px 10px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                        <div style={{ width: "28px", height: "28px", borderRadius: "8px", background: `${idx.accent}20`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Icon style={{ width: "14px", height: "14px", color: idx.accent }} />
                        </div>
                        <div>
                          <div style={{ fontSize: "13px", fontWeight: 700, color: T.text }}>{idx.label}</div>
                          <div style={{ fontSize: "11px", color: T.textDim }}>{idx.symbol}</div>
                        </div>
                      </div>

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

        {/* ── Main content placeholder ── */}
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "40px 24px" }}>
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            minHeight: "400px", background: T.card, border: `1px solid ${T.border}`,
            borderRadius: "20px", gap: "16px",
          }}>
            <div style={{ width: "56px", height: "56px", borderRadius: "16px", background: "rgba(139,92,246,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Terminal style={{ width: "28px", height: "28px", color: "#8b5cf6" }} />
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "18px", fontWeight: 700, color: T.text, marginBottom: "8px" }}>F&O Explorer</div>
              <div style={{ fontSize: "14px", color: T.textMuted }}>Hover over an index above to view Option Chain or open Terminal</div>
            </div>
          </div>
        </div>

      </main>

      <Footer isDark={isDark} />
    </div>
  );
}
