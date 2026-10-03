import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Wallet, TrendingUp, Calendar, PieChart as PieChartIcon, ArrowRight } from "lucide-react";
import type { MFTheme } from "./theme";
import { fmtPct, fmtDate } from "../../lib/mutualfunds";
import { getSampleDashboard, type MFValuePoint, type MFAssetClass } from "../../lib/mfDashboardSample";

function fmtINR(n: unknown): string {
  if (n == null || typeof n !== "number" || isNaN(n)) return "—";
  return n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function fmtSignedINR(n: unknown): string {
  if (n == null || typeof n !== "number" || isNaN(n)) return "—";
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}₹${Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

const ASSET_CLASS_COLOR: Record<MFAssetClass, string> = {
  "Equity": "#3b82f6",
  "Debt": "#8b5cf6",
  "Gold & Silver": "#eab308",
  "Hybrid": "#ec4899",
};

const RANGES: { key: string; label: string; days: number }[] = [
  { key: "1m", label: "1M", days: 30 },
  { key: "3m", label: "3M", days: 90 },
  { key: "6m", label: "6M", days: 180 },
  { key: "1y", label: "1Y", days: 365 },
  { key: "all", label: "All", days: Infinity },
];

function StatTile({ label, value, sub, color, T }: { label: string; value: string; sub?: string; color?: string; T: MFTheme }) {
  return (
    <div style={{ background: T.cardSolid, border: `1px solid ${T.borderMid}`, borderRadius: "14px", padding: "16px", flex: 1, minWidth: "140px" }}>
      <div style={{ fontSize: "11px", color: T.textDim, fontWeight: 600, marginBottom: "6px" }}>{label}</div>
      <div style={{ fontSize: "20px", fontWeight: 700, color: color ?? T.text }}>{value}</div>
      {sub && <div style={{ fontSize: "11px", color: color ?? T.textDim, fontWeight: 600, marginTop: "3px" }}>{sub}</div>}
    </div>
  );
}

function ValueChart({ points, T }: { points: MFValuePoint[]; T: MFTheme }) {
  if (points.length < 2) {
    return <div style={{ height: "240px", display: "flex", alignItems: "center", justifyContent: "center", color: T.textDim, fontSize: "13px" }}>Not enough data to draw a chart.</div>;
  }
  const width = 800, height = 240, pad = 12;
  const all = [...points.map(p => p.value), ...points.map(p => p.invested)];
  const min = Math.min(...all), max = Math.max(...all);
  const range = max - min || 1;
  const stepX = (width - pad * 2) / (points.length - 1);
  const toY = (v: number) => pad + (height - pad * 2) * (1 - (v - min) / range);
  const valuePath = `M${points.map((p, i) => `${pad + i * stepX},${toY(p.value)}`).join(" L")}`;
  const investedPath = `M${points.map((p, i) => `${pad + i * stepX},${toY(p.invested)}`).join(" L")}`;
  const areaPath = `${valuePath} L${pad + (points.length - 1) * stepX},${height - pad} L${pad},${height - pad} Z`;
  const positive = points[points.length - 1].value >= points[0].value;
  const color = positive ? "#22c55e" : "#ef4444";

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "240px", display: "block" }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="dashValueFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#dashValueFill)" stroke="none" />
      <path d={investedPath} fill="none" stroke={T.textDim} strokeWidth="1.5" strokeDasharray="5 4" />
      <path d={valuePath} fill="none" stroke={color} strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function DonutChart({ segments, size = 148, strokeWidth = 20 }: { segments: { label: string; value: number; color: string }[]; size?: number; strokeWidth?: number }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let cumulative = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        {segments.map((seg, i) => {
          const frac = seg.value / total;
          const dash = Math.max(frac * circumference - 2, 0);
          const gap = circumference - dash;
          const offset = -cumulative * circumference;
          cumulative += frac;
          return (
            <circle
              key={i} cx={size / 2} cy={size / 2} r={radius} fill="none"
              stroke={seg.color} strokeWidth={strokeWidth} strokeLinecap="round"
              strokeDasharray={`${dash} ${gap}`} strokeDashoffset={offset}
            />
          );
        })}
      </g>
    </svg>
  );
}

export function MutualFundDashboard({ T }: { T: MFTheme }) {
  const navigate = useNavigate();
  const [range, setRange] = useState("6m");
  const data = useMemo(() => getSampleDashboard(), []);

  const rows = useMemo(() => data.holdings.map(h => {
    const invested_value = h.units * h.avg_nav;
    const current_value = h.units * h.current_nav;
    return { ...h, invested_value, current_value, returns: current_value - invested_value, returns_pct: ((current_value - invested_value) / invested_value) * 100 };
  }), [data.holdings]);

  const summary = useMemo(() => {
    const invested = rows.reduce((s, r) => s + r.invested_value, 0);
    const current = rows.reduce((s, r) => s + r.current_value, 0);
    const dayChange = rows.reduce((s, r) => s + r.current_value * (r.day_change_pct / 100), 0);
    const xirr = current > 0 ? rows.reduce((s, r) => s + r.xirr * r.current_value, 0) / current : 0;
    return {
      invested, current,
      returns: current - invested,
      returns_pct: invested > 0 ? ((current - invested) / invested) * 100 : 0,
      dayChange,
      dayChangePct: current > 0 ? (dayChange / current) * 100 : 0,
      xirr,
    };
  }, [rows]);

  const allocation = useMemo(() => {
    const byClass = new Map<MFAssetClass, number>();
    for (const r of rows) byClass.set(r.asset_class, (byClass.get(r.asset_class) ?? 0) + r.current_value);
    return Array.from(byClass.entries())
      .map(([label, value]) => ({ label, value, color: ASSET_CLASS_COLOR[label] }))
      .sort((a, b) => b.value - a.value);
  }, [rows]);

  const rangeDays = RANGES.find(r => r.key === range)?.days ?? 180;
  const chartPoints = useMemo(() => {
    if (!isFinite(rangeDays)) return data.valueHistory;
    const cutoff = Date.now() - rangeDays * 86400000;
    return data.valueHistory.filter(p => new Date(p.date).getTime() >= cutoff);
  }, [data.valueHistory, rangeDays]);

  const totalMonthlySip = data.sips.filter(s => s.status === "ACTIVE" && s.frequency === "Monthly").reduce((s, x) => s + x.amount, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      {/* Portfolio summary strip */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <StatTile T={T} label="Current Value" value={`₹${fmtINR(summary.current)}`} />
        <StatTile T={T} label="Invested" value={`₹${fmtINR(summary.invested)}`} />
        <StatTile T={T} label="Total Returns" value={fmtSignedINR(summary.returns)} sub={fmtPct(summary.returns_pct)} color={summary.returns >= 0 ? "#22c55e" : "#ef4444"} />
        <StatTile T={T} label="Day's P&L" value={fmtSignedINR(summary.dayChange)} sub={fmtPct(summary.dayChangePct)} color={summary.dayChange >= 0 ? "#22c55e" : "#ef4444"} />
        <StatTile T={T} label="XIRR" value={`${summary.xirr.toFixed(2)}%`} color={T.activeBorder} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "24px", alignItems: "start" }}>

        {/* Main column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px", minWidth: 0 }}>

          {/* Value over time */}
          <div style={{ background: T.cardSolid, border: `1px solid ${T.borderMid}`, borderRadius: "16px", padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px", marginBottom: "6px" }}>
              <div style={{ fontSize: "15px", fontWeight: 700, color: T.text }}>Portfolio Value</div>
              <div style={{ display: "flex", alignItems: "center", gap: "14px", fontSize: "11px", color: T.textDim }}>
                <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  <span style={{ width: "10px", height: "2px", background: summary.returns >= 0 ? "#22c55e" : "#ef4444", display: "inline-block" }} /> Value
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  <span style={{ width: "10px", height: "0", borderTop: `1.5px dashed ${T.textDim}`, display: "inline-block" }} /> Invested
                </span>
              </div>
            </div>
            <div style={{ display: "flex", gap: "6px", margin: "10px 0 14px" }}>
              {RANGES.map(r => (
                <button
                  key={r.key}
                  onClick={() => setRange(r.key)}
                  style={{
                    padding: "5px 12px", borderRadius: "7px", fontSize: "11px", fontWeight: 700, cursor: "pointer",
                    background: range === r.key ? T.activeBorder : T.tabBg,
                    border: `1px solid ${range === r.key ? T.activeBorder : T.border}`,
                    color: range === r.key ? "#fff" : T.textMuted,
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <ValueChart points={chartPoints} T={T} />
          </div>

          {/* Holdings */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <div style={{ fontSize: "15px", fontWeight: 700, color: T.text }}>Your Holdings</div>
              <span style={{ fontSize: "12px", color: T.textDim }}>{rows.length} fund{rows.length !== 1 ? "s" : ""}</span>
            </div>
            <div style={{ background: T.cardSolid, border: `1px solid ${T.borderMid}`, borderRadius: "16px", overflow: "hidden" }}>
              {rows.map((r, i) => (
                <div
                  key={r.scheme_code}
                  onClick={() => navigate(`/explore/mutualfunds/fund/${r.scheme_code}`)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: "14px",
                    padding: "14px 16px", borderBottom: i < rows.length - 1 ? `1px solid ${T.border}` : "none",
                    cursor: "pointer",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = T.tabHover; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.scheme_name}
                    </div>
                    <div style={{ fontSize: "11px", color: T.textDim, marginTop: "3px", display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{
                        padding: "2px 7px", borderRadius: "100px", fontWeight: 600,
                        background: `${ASSET_CLASS_COLOR[r.asset_class]}1a`, color: ASSET_CLASS_COLOR[r.asset_class],
                      }}>
                        {r.category}
                      </span>
                      <span>{r.units.toFixed(3)} units · Avg ₹{r.avg_nav.toFixed(2)}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: T.text }}>₹{fmtINR(r.current_value)}</div>
                    <div style={{ fontSize: "11px", fontWeight: 600, color: r.returns >= 0 ? "#22c55e" : "#ef4444" }}>
                      {fmtSignedINR(r.returns)} ({fmtPct(r.returns_pct)})
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0, minWidth: "70px" }}>
                    <div style={{ fontSize: "11px", color: T.textDim }}>XIRR</div>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: T.text }}>{r.xirr.toFixed(1)}%</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

          {/* Asset allocation */}
          <div style={{ background: T.cardSolid, border: `1px solid ${T.borderMid}`, borderRadius: "16px", padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", fontWeight: 700, color: T.text, marginBottom: "16px" }}>
              <PieChartIcon style={{ width: "15px", height: "15px", color: T.activeBorder }} /> Asset Allocation
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
              <DonutChart segments={allocation} />
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1, minWidth: 0 }}>
                {allocation.map(seg => (
                  <div key={seg.label} style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "11px" }}>
                    <span style={{ width: "8px", height: "8px", borderRadius: "3px", background: seg.color, flexShrink: 0 }} />
                    <span style={{ color: T.textBody, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{seg.label}</span>
                    <span style={{ color: T.textDim, fontWeight: 600 }}>{((seg.value / summary.current) * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* SIPs */}
          <div style={{ background: T.cardSolid, border: `1px solid ${T.borderMid}`, borderRadius: "16px", padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", fontWeight: 700, color: T.text }}>
                <Calendar style={{ width: "15px", height: "15px", color: T.activeBorder }} /> Active SIPs
              </div>
            </div>
            <div style={{ fontSize: "11px", color: T.textDim, marginBottom: "14px" }}>
              ₹{fmtINR(totalMonthlySip)} committed monthly
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {data.sips.map(sip => (
                <div key={sip.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", padding: "10px", borderRadius: "10px", background: T.tabBg, border: `1px solid ${T.border}` }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sip.scheme_name}</div>
                    <div style={{ fontSize: "10px", color: T.textDim, marginTop: "2px" }}>Next debit {fmtDate(sip.next_date)} · {sip.installments_done} done</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: T.text }}>₹{fmtINR(sip.amount)}</div>
                    <div style={{ fontSize: "10px", color: T.textDim }}>{sip.frequency}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick actions */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <button
              onClick={() => navigate("/explore/mutualfunds/search")}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px",
                padding: "12px 16px", borderRadius: "12px", fontSize: "13px", fontWeight: 700, cursor: "pointer",
                background: T.activeBorder, border: "none", color: "#fff",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: "8px" }}><Wallet style={{ width: "14px", height: "14px" }} /> Invest in a new fund</span>
              <ArrowRight style={{ width: "14px", height: "14px" }} />
            </button>
            <button
              onClick={() => navigate("/explore/mutualfunds", { state: { tab: "SIPs" } })}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px",
                padding: "12px 16px", borderRadius: "12px", fontSize: "13px", fontWeight: 700, cursor: "pointer",
                background: T.cardSolid, border: `1px solid ${T.border}`, color: T.text,
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: "8px" }}><TrendingUp style={{ width: "14px", height: "14px" }} /> Manage SIPs</span>
              <ArrowRight style={{ width: "14px", height: "14px" }} />
            </button>
          </div>
        </div>
      </div>

      <div style={{ fontSize: "11px", color: T.textDim, textAlign: "center" }}>
        Showing sample portfolio data — live syncing lands once the backend exposes your real holdings.
      </div>
    </div>
  );
}
