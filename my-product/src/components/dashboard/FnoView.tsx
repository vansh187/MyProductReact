import { Fragment, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Wallet, HandCoins, CalendarClock, Info } from "lucide-react";
import {
  fetchAssetClassSummary,
  fetchEquityCurve,
  fetchFnoPositions,
  fmtCurrency,
  fmtSigned,
  pnlColor,
  mockGreeksFor,
  formatTimeToExpiry,
  MOCK_NEWS,
  type AssetClassSummary,
  type EquityCurvePoint,
  type FnoPositionRow,
  type RangeKey,
  type ExpiryUrgency,
} from "../../lib/dashboard";
import type { DashTheme } from "./shared/theme";
import { StatCard, StatCardSkeleton } from "./shared/StatCard";
import { EquityCurveChart } from "./shared/EquityCurveChart";
import { NewsSection } from "./shared/NewsSection";
import { TableCard, thStyle, tdStyle, EmptyRow } from "./shared/TableCard";

interface FnoViewProps {
  theme: DashTheme;
}

function instrumentLabel(p: FnoPositionRow): string {
  if (p.contract_type === "FUTURES") return `${p.underlying ?? p.symbol} FUT`;
  if (p.strike && p.option_type) return `${p.underlying ?? p.symbol} ${p.strike} ${p.option_type}`;
  return p.symbol;
}

function fmtExpiryDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function urgencyColor(theme: DashTheme, urgency: ExpiryUrgency): string {
  if (urgency === "expired") return theme.textDim;
  if (urgency === "critical") return theme.red;
  if (urgency === "warning") return "#f59e0b";
  return theme.textMuted;
}

export function FnoView({ theme }: FnoViewProps) {
  const [summary, setSummary] = useState<AssetClassSummary | null>(null);
  const [positions, setPositions] = useState<FnoPositionRow[]>([]);
  const [points, setPoints] = useState<EquityCurvePoint[]>([]);
  const [range, setRange] = useState<RangeKey>("1M");
  const [loading, setLoading] = useState(true);
  const [curveLoading, setCurveLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([fetchAssetClassSummary("FNO"), fetchFnoPositions()])
      .then(([s, p]) => {
        if (cancelled) return;
        setSummary(s);
        setPositions(p);
      })
      .catch((err) => !cancelled && setError(err.message ?? "Failed to load F&O data"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setCurveLoading(true);
    fetchEquityCurve("FNO", range)
      .then((p) => !cancelled && setPoints(p))
      .catch(() => !cancelled && setPoints([]))
      .finally(() => !cancelled && setCurveLoading(false));
    return () => {
      cancelled = true;
    };
  }, [range]);

  const openPositions = useMemo(() => positions.filter((p) => p.status === "OPEN"), [positions]);
  const nearestExpiry = useMemo(() => {
    let soonest: { expiry: string; countdown: ReturnType<typeof formatTimeToExpiry> } | null = null;
    for (const p of openPositions) {
      const countdown = formatTimeToExpiry(p.expiry, now);
      if (!countdown || countdown.urgency === "expired" || !p.expiry) continue;
      if (!soonest || p.expiry < soonest.expiry) soonest = { expiry: p.expiry, countdown };
    }
    return soonest?.countdown ?? null;
  }, [openPositions, now]);

  if (error) {
    return <div style={{ padding: "40px", textAlign: "center", color: theme.red }}>{error}</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
        {loading || !summary ? (
          <>
            <StatCardSkeleton theme={theme} />
            <StatCardSkeleton theme={theme} />
            <StatCardSkeleton theme={theme} />
          </>
        ) : (
          <>
            <StatCard theme={theme} label="Derivatives Portfolio Value" value={fmtCurrency(summary.net_value)} icon={<Wallet style={{ width: 13, height: 13 }} />} />
            <StatCard
              theme={theme}
              label="Total Unrealized P&L"
              value={fmtSigned(summary.total_unrealized_pnl)}
              icon={<HandCoins style={{ width: 13, height: 13 }} />}
              subValue="No live F&O price feed — always ₹0"
            />
            <StatCard
              theme={theme}
              label="Upcoming Expiry"
              value={nearestExpiry ? nearestExpiry.text : "—"}
              icon={<CalendarClock style={{ width: 13, height: 13 }} />}
              subValueColor={nearestExpiry ? urgencyColor(theme, nearestExpiry.urgency) : undefined}
              subValue={openPositions.length ? `${openPositions.length} open contract${openPositions.length === 1 ? "" : "s"}` : "No open contracts"}
            />
          </>
        )}
      </div>

      <EquityCurveChart
        theme={theme}
        title="Derivatives P&L Trend (Realized Only)"
        points={points}
        range={range}
        onRangeChange={setRange}
        loading={curveLoading}
      />

      <TableCard theme={theme} title="Active Positions (F&O)">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["", "Instrument", "Expiry", "Product", "Lot Size", "Net Qty", "Avg. Price", "Realized P&L", "Status"].map((h) => (
                <th key={h} style={thStyle(theme)}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <EmptyRow theme={theme} colSpan={9} message="Loading positions…" />
            ) : positions.length === 0 ? (
              <EmptyRow theme={theme} colSpan={9} message="No F&O positions yet." />
            ) : (
              positions.map((p) => {
                const isOpen = expanded === p.symbol;
                const greeks = mockGreeksFor(p.symbol);
                const countdown = p.status === "OPEN" ? formatTimeToExpiry(p.expiry, now) : null;
                return (
                  <Fragment key={p.symbol}>
                    <tr onClick={() => setExpanded(isOpen ? null : p.symbol)} style={{ cursor: "pointer" }}>
                      <td style={{ ...tdStyle(theme), width: "28px" }}>
                        {isOpen ? <ChevronUp style={{ width: 14, height: 14, color: theme.textMuted }} /> : <ChevronDown style={{ width: 14, height: 14, color: theme.textMuted }} />}
                      </td>
                      <td style={{ ...tdStyle(theme), fontWeight: 700 }}>{instrumentLabel(p)}</td>
                      <td style={tdStyle(theme)}>
                        <div>{fmtExpiryDate(p.expiry)}</div>
                        {countdown && (
                          <div style={{ fontSize: "11px", fontWeight: 700, color: urgencyColor(theme, countdown.urgency) }}>
                            {countdown.text} left
                          </div>
                        )}
                      </td>
                      <td style={tdStyle(theme)}>{p.product_type}</td>
                      <td style={tdStyle(theme)}>{p.lot_size ?? "—"}</td>
                      <td style={tdStyle(theme)}>{p.netqty}</td>
                      <td style={tdStyle(theme)}>{fmtCurrency(p.netavgprc)}</td>
                      <td style={{ ...tdStyle(theme), color: pnlColor(p.realized_pnl), fontWeight: 700 }}>{fmtSigned(p.realized_pnl)}</td>
                      <td style={tdStyle(theme)}>
                        <span style={{
                          fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "6px",
                          background: p.status === "OPEN" ? "rgba(0,230,118,0.12)" : "rgba(139,148,158,0.12)",
                          color: p.status === "OPEN" ? theme.green : theme.textMuted,
                        }}>
                          {p.status}
                        </span>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr key={`${p.symbol}-greeks`}>
                        <td colSpan={9} style={{ padding: "0 12px 16px", borderBottom: `1px solid ${theme.cardBorder}` }}>
                          <div style={{
                            background: theme.hover, border: `1px solid ${theme.cardBorder}`, borderRadius: "10px",
                            padding: "14px 16px", display: "flex", flexDirection: "column", gap: "10px",
                          }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: theme.textDim }}>
                              <Info style={{ width: 12, height: 12 }} />
                              Greeks &amp; IV shown here are illustrative placeholders — this platform has no live F&amp;O
                              price feed and does not compute real Greeks. Do not use for trading decisions.
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: "12px" }}>
                              {[
                                ["Delta (Δ)", greeks.delta],
                                ["Theta (Θ)", greeks.theta],
                                ["Gamma (Γ)", greeks.gamma],
                                ["Vega (V)", greeks.vega],
                                ["IV", `${greeks.iv}%`],
                                ["IV Skew", `${greeks.ivSkew}%`],
                              ].map(([label, value]) => (
                                <div key={label as string}>
                                  <div style={{ fontSize: "10px", color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: "3px" }}>{label}</div>
                                  <div style={{ fontSize: "14px", fontWeight: 700, color: theme.text }}>{value}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </TableCard>

      <NewsSection theme={theme} title="F&O News" items={MOCK_NEWS.fno} />
    </div>
  );
}
