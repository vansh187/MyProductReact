import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { EquityCurvePoint, RangeKey } from "../../../lib/dashboard";
import { RANGE_OPTIONS, fmtCurrencyCompact } from "../../../lib/dashboard";
import type { DashTheme } from "./theme";

interface EquityCurveChartProps {
  theme: DashTheme;
  title: string;
  points: EquityCurvePoint[];
  range: RangeKey;
  onRangeChange: (range: RangeKey) => void;
  loading?: boolean;
  height?: number;
}

function formatAxisTime(iso: string, range: RangeKey): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  if (range === "1D") return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

export function EquityCurveChart({ theme, title, points, range, onRangeChange, loading, height = 260 }: EquityCurveChartProps) {
  const chartData = points.map((p) => ({
    ...p,
    label: formatAxisTime(p.captured_at, range),
  }));

  const isUp = points.length >= 2 ? points[points.length - 1].net_value >= points[0].net_value : true;
  const lineColor = isUp ? theme.green : theme.red;

  return (
    <div style={{
      background: theme.cardBg,
      border: `1px solid ${theme.cardBorder}`,
      borderRadius: "14px",
      padding: "18px 20px",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px", flexWrap: "wrap", gap: "10px" }}>
        <div style={{ fontSize: "11px", fontWeight: 700, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.6px" }}>
          {title}
        </div>
        <div style={{ display: "flex", gap: "4px" }}>
          {RANGE_OPTIONS.map((r) => (
            <button
              key={r}
              onClick={() => onRangeChange(r)}
              style={{
                padding: "4px 10px",
                borderRadius: "7px",
                border: "none",
                fontSize: "11px",
                fontWeight: 600,
                cursor: "pointer",
                background: r === range ? theme.tabActive : "transparent",
                color: r === range ? theme.accent : theme.tabInactiveText,
                transition: "background 0.15s, color 0.15s",
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: theme.textDim, fontSize: "13px" }}>
          Loading chart…
        </div>
      ) : chartData.length === 0 ? (
        <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: theme.textDim, fontSize: "13px" }}>
          No history yet for this range.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id="equityCurveFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={lineColor} stopOpacity={0.35} />
                <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={theme.cardBorder} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: theme.textDim, fontSize: 11 }}
              axisLine={{ stroke: theme.cardBorder }}
              tickLine={false}
              minTickGap={24}
            />
            <YAxis
              tick={{ fill: theme.textDim, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => fmtCurrencyCompact(v)}
              width={64}
            />
            <Tooltip
              contentStyle={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}`, borderRadius: "10px", fontSize: "12px" }}
              labelStyle={{ color: theme.textMuted }}
              formatter={(value: number) => [fmtCurrencyCompact(value), "Net Value"]}
            />
            <Area type="monotone" dataKey="net_value" stroke={lineColor} strokeWidth={2} fill="url(#equityCurveFill)" />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
