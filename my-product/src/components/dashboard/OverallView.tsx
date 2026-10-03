import { useEffect, useState } from "react";
import { Wallet, TrendingUp, Activity, ListOrdered } from "lucide-react";
import {
  fetchAssetClassSummary,
  fetchDashboardSummary,
  fetchEquityCurve,
  fmtCurrency,
  fmtSigned,
  fmtPct,
  pnlColor,
  type AssetClassSummary,
  type DashboardSummary,
  type EquityCurvePoint,
  type RangeKey,
} from "../../lib/dashboard";
import type { DashTheme } from "./shared/theme";
import { StatCard, StatCardSkeleton } from "./shared/StatCard";
import { EquityCurveChart } from "./shared/EquityCurveChart";
import { AllocationDonut } from "./shared/AllocationDonut";
import { NewsSection } from "./shared/NewsSection";
import { TableCard, thStyle, tdStyle } from "./shared/TableCard";
import { MOCK_NEWS } from "../../lib/dashboard";

interface OverallViewProps {
  theme: DashTheme;
}

export function OverallView({ theme }: OverallViewProps) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [allSummary, setAllSummary] = useState<AssetClassSummary | null>(null);
  const [stocksSummary, setStocksSummary] = useState<AssetClassSummary | null>(null);
  const [fnoSummary, setFnoSummary] = useState<AssetClassSummary | null>(null);
  const [points, setPoints] = useState<EquityCurvePoint[]>([]);
  const [range, setRange] = useState<RangeKey>("1M");
  const [loading, setLoading] = useState(true);
  const [curveLoading, setCurveLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      fetchDashboardSummary(),
      fetchAssetClassSummary("ALL"),
      fetchAssetClassSummary("STOCKS"),
      fetchAssetClassSummary("FNO"),
    ])
      .then(([d, all, stocks, fno]) => {
        if (cancelled) return;
        setSummary(d);
        setAllSummary(all);
        setStocksSummary(stocks);
        setFnoSummary(fno);
      })
      .catch((err) => !cancelled && setError(err.message ?? "Failed to load dashboard"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setCurveLoading(true);
    fetchEquityCurve("ALL", range)
      .then((p) => !cancelled && setPoints(p))
      .catch(() => !cancelled && setPoints([]))
      .finally(() => !cancelled && setCurveLoading(false));
    return () => {
      cancelled = true;
    };
  }, [range]);

  // net_value per bucket includes buying_power (shared cash pool), so it must
  // be subtracted back out here - otherwise the same cash balance gets
  // counted once per bucket and the slice proportions come out wrong.
  const allocation = [
    { name: "Stocks", value: Math.max(0, (stocksSummary?.net_value ?? 0) - (stocksSummary?.buying_power ?? 0)), color: "#3b82f6" },
    { name: "F&O", value: Math.max(0, (fnoSummary?.net_value ?? 0) - (fnoSummary?.buying_power ?? 0)), color: "#f59e0b" },
    { name: "Mutual Funds", value: 0, color: "#10b981" },
  ];

  if (error) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: theme.red }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Row 1: primary summary tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
        {loading || !allSummary ? (
          <>
            <StatCardSkeleton theme={theme} />
            <StatCardSkeleton theme={theme} />
            <StatCardSkeleton theme={theme} />
            <StatCardSkeleton theme={theme} />
          </>
        ) : (
          <>
            <StatCard theme={theme} label="Net Value" value={fmtCurrency(allSummary.net_value)} icon={<Wallet style={{ width: 13, height: 13 }} />} />
            <StatCard
              theme={theme}
              label="Today's P&L"
              value={fmtSigned(allSummary.todays_pnl)}
              icon={<TrendingUp style={{ width: 13, height: 13 }} />}
              subValueColor={pnlColor(allSummary.todays_pnl)}
              subValue={allSummary.net_value ? fmtPct((allSummary.todays_pnl / allSummary.net_value) * 100) : undefined}
            />
            <StatCard
              theme={theme}
              label="Unrealized P&L"
              value={fmtSigned(allSummary.total_unrealized_pnl)}
              icon={<Activity style={{ width: 13, height: 13 }} />}
              subValueColor={pnlColor(allSummary.total_unrealized_pnl)}
            />
            <StatCard theme={theme} label="Buying Power" value={fmtCurrency(allSummary.buying_power)} icon={<Wallet style={{ width: 13, height: 13 }} />} />
          </>
        )}
      </div>

      {/* Row 2: order/trade activity */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
        {loading || !summary ? (
          <>
            <StatCardSkeleton theme={theme} />
            <StatCardSkeleton theme={theme} />
            <StatCardSkeleton theme={theme} />
          </>
        ) : (
          <>
            <StatCard
              theme={theme}
              label="Total Orders"
              value={String(summary.orders.total_orders)}
              icon={<ListOrdered style={{ width: 13, height: 13 }} />}
              subValue={`${summary.orders.executed_orders} executed · ${summary.orders.pending_orders} pending`}
            />
            <StatCard
              theme={theme}
              label="Total Trades"
              value={String(summary.trades.total_trades)}
              icon={<Activity style={{ width: 13, height: 13 }} />}
              subValue={`${summary.trades.buy_trades} buy · ${summary.trades.sell_trades} sell`}
            />
            <StatCard
              theme={theme}
              label="Invested (Equity)"
              value={fmtCurrency(summary.portfolio.total_invested)}
              icon={<Wallet style={{ width: 13, height: 13 }} />}
              subValueColor={pnlColor(summary.portfolio.return_percentage)}
              subValue={fmtPct(summary.portfolio.return_percentage)}
            />
          </>
        )}
      </div>

      {/* Performance chart + allocation */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "16px", alignItems: "stretch" }}>
        <EquityCurveChart
          theme={theme}
          title="Total Portfolio Net Value Trend"
          points={points}
          range={range}
          onRangeChange={setRange}
          loading={curveLoading}
        />
        <AllocationDonut theme={theme} title="Asset Allocation" data={allocation} />
      </div>

      {/* Asset-category breakdown */}
      <TableCard theme={theme} title="Asset Category Breakdown">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Asset Category", "Net Value", "Today's P&L"].map((h) => (
                <th key={h} style={thStyle(theme)}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { name: "Stocks", data: stocksSummary },
              { name: "F&O", data: fnoSummary },
            ].map((row) => (
              <tr key={row.name}>
                <td style={tdStyle(theme)}>{row.name}</td>
                <td style={tdStyle(theme)}>{row.data ? fmtCurrency(row.data.net_value) : "—"}</td>
                <td style={{ ...tdStyle(theme), color: row.data ? pnlColor(row.data.todays_pnl) : theme.textMuted }}>
                  {row.data ? fmtSigned(row.data.todays_pnl) : "—"}
                </td>
              </tr>
            ))}
            <tr>
              <td style={{ ...tdStyle(theme), color: theme.textDim }}>Mutual Funds</td>
              <td style={{ ...tdStyle(theme), color: theme.textDim }} colSpan={2}>Coming soon</td>
            </tr>
          </tbody>
        </table>
      </TableCard>

      <NewsSection theme={theme} title="Market News" items={MOCK_NEWS.overall} />
    </div>
  );
}
