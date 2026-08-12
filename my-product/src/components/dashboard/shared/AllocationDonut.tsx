import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { fmtCurrencyCompact } from "../../../lib/dashboard";
import type { DashTheme } from "./theme";

interface AllocationSlice {
  name: string;
  value: number;
  color: string;
}

interface AllocationDonutProps {
  theme: DashTheme;
  title: string;
  data: AllocationSlice[];
  height?: number;
}

export function AllocationDonut({ theme, title, data, height = 220 }: AllocationDonutProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div style={{
      background: theme.cardBg,
      border: `1px solid ${theme.cardBorder}`,
      borderRadius: "14px",
      padding: "18px 20px",
    }}>
      <div style={{ fontSize: "11px", fontWeight: 700, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: "10px" }}>
        {title}
      </div>

      {total === 0 ? (
        <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: theme.textDim, fontSize: "13px" }}>
          No allocation data yet.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%" paddingAngle={2}>
              {data.map((slice) => (
                <Cell key={slice.name} fill={slice.color} stroke={theme.cardBg} strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}`, borderRadius: "10px", fontSize: "12px" }}
              formatter={(value: number, name: string) => [fmtCurrencyCompact(value), name]}
            />
            <Legend
              verticalAlign="bottom"
              height={28}
              formatter={(value) => <span style={{ color: theme.textMuted, fontSize: "11px" }}>{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
