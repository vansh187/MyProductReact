import { useEffect, useMemo, useState } from "react";
import { Wallet, TrendingUp, TrendingDown, HandCoins } from "lucide-react";
import {
  fetchAssetClassSummary,
  fetchEquityCurve,
  fetchHoldings,
  fmtCurrency,
  fmtSigned,
  fmtPct,
  pnlColor,
  MOCK_NEWS,
  type AssetClassSummary,
  type EquityCurvePoint,
  type HoldingRow,
  type RangeKey,
} from "../../lib/dashboard";
import type { DashTheme } from "./shared/theme";
import { StatCard, StatCardSkeleton } from "./shared/StatCard";
import { EquityCurveChart } from "./shared/EquityCurveChart";
import { NewsSection } from "./shared/NewsSection";
import { TableCard, thStyle, tdStyle, EmptyRow } from "./shared/TableCard";

interface StocksViewProps {
  theme: DashTheme;
}

export function StocksView({ theme }: StocksViewProps) {
  const [summary, setSummary] = useState<AssetClassSummary | null>(null);
  const [holdings, setHoldings] = useState<HoldingRow[]>([]);
  const [points, setPoints] = useState<EquityCurvePoint[]>([]);
  const [range, setRange] = useState<RangeKey>("1M");
  const [loading, setLoading] = useState(true);
  const [curveLoading, setCurveLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([fetchAssetClassSummary("STOCKS"), fetchHoldings("STOCKS")])
      .then(([s, h]) => {
        if (cancelled) return;
        setSummary(s);
        setHoldings(h.portfolio);
      })
      .catch((err) => !cancelled && setError(err.message ?? "Failed to load stocks data"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setCurveLoading(true);
    fetchEquityCurve("STOCKS", range)
      .then((p) => !cancelled && setPoints(p))
      .catch(() => !cancelled && setPoints([]))
      .finally(() => !cancelled && setCurveLoading(false));
    return () => {
      cancelled = true;
    };
  }, [range]);

  const { topGainer, topLoser } = useMemo(() => {
    if (holdings.length === 0) return { topGainer: null, topLoser: null };
    const withPct = holdings.map((h) => ({
      ...h,
      pnlPct: h.avg_price > 0 ? (h.pnl / (h.avg_price * h.quantity)) * 100 : 0,
    }));
    const gainer = withPct.reduce((a, b) => (b.pnlPct > a.pnlPct ? b : a));
    const loser = withPct.reduce((a, b) => (b.pnlPct < a.pnlPct ? b : a));
    return { topGainer: gainer, topLoser: loser };
  }, [holdings]);

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
            <StatCard theme={theme} label="Total Stock Portfolio Value" value={fmtCurrency(summary.net_value)} icon={<Wallet style={{ width: 13, height: 13 }} />} />
            <StatCard
              theme={theme}
              label="Total Unrealized P&L"
              value={fmtSigned(summary.total_unrealized_pnl)}
              icon={<HandCoins style={{ width: 13, height: 13 }} />}
              subValueColor={pnlColor(summary.total_unrealized_pnl)}
            />
            <StatCard
              theme={theme}
              label="Today's P&L"
              value={fmtSigned(summary.todays_pnl)}
              icon={<TrendingUp style={{ width: 13, height: 13 }} />}
              subValueColor={pnlColor(summary.todays_pnl)}
            />
          </>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "16px", alignItems: "stretch" }}>
        <EquityCurveChart
          theme={theme}
          title="Stock Portfolio Performance"
          points={points}
          range={range}
          onRangeChange={setRange}
          loading={curveLoading}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}`, borderRadius: "14px", padding: "16px 18px" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: "12px" }}>
              Top Gainer &amp; Loser
            </div>
            {holdings.length === 0 ? (
              <div style={{ fontSize: "12px", color: theme.textDim }}>No holdings yet.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {topGainer && (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <TrendingUp style={{ width: 14, height: 14, color: theme.green }} />
                    <span style={{ fontSize: "13px", fontWeight: 700, color: theme.text }}>{topGainer.symbol}</span>
                    <span style={{ marginLeft: "auto", fontSize: "13px", fontWeight: 700, color: theme.green }}>{fmtPct(topGainer.pnlPct)}</span>
                  </div>
                )}
                {topLoser && (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <TrendingDown style={{ width: 14, height: 14, color: theme.red }} />
                    <span style={{ fontSize: "13px", fontWeight: 700, color: theme.text }}>{topLoser.symbol}</span>
                    <span style={{ marginLeft: "auto", fontSize: "13px", fontWeight: 700, color: theme.red }}>{fmtPct(topLoser.pnlPct)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <TableCard theme={theme} title="Detailed Holdings (Stocks)">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Ticker", "Avg. Purchase Price", "Quantity", "Total Invested", "CMP", "Current Value", "P&L (Gain/Loss)"].map((h) => (
                <th key={h} style={thStyle(theme)}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <EmptyRow theme={theme} colSpan={7} message="Loading holdings…" />
            ) : holdings.length === 0 ? (
              <EmptyRow theme={theme} colSpan={7} message="No equity holdings yet." />
            ) : (
              holdings.map((h) => {
                const invested = h.avg_price * h.quantity;
                const currentValue = h.current_price * h.quantity;
                const pnlPct = invested > 0 ? (h.pnl / invested) * 100 : 0;
                return (
                  <tr key={h.symbol}>
                    <td style={{ ...tdStyle(theme), fontWeight: 700 }}>{h.symbol}</td>
                    <td style={tdStyle(theme)}>{fmtCurrency(h.avg_price)}</td>
                    <td style={tdStyle(theme)}>{h.quantity}</td>
                    <td style={tdStyle(theme)}>{fmtCurrency(invested)}</td>
                    <td style={tdStyle(theme)}>{fmtCurrency(h.current_price)}</td>
                    <td style={tdStyle(theme)}>{fmtCurrency(currentValue)}</td>
                    <td style={{ ...tdStyle(theme), color: pnlColor(h.pnl), fontWeight: 700 }}>
                      {fmtSigned(h.pnl)} ({fmtPct(pnlPct)})
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </TableCard>

      <NewsSection theme={theme} title="Stock News" items={MOCK_NEWS.stocks} />
    </div>
  );
}
