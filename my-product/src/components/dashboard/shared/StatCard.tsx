import type { ReactNode } from "react";
import type { DashTheme } from "./theme";

interface StatCardProps {
  theme: DashTheme;
  label: string;
  value: string;
  subValue?: string;
  subValueColor?: string;
  icon?: ReactNode;
  right?: ReactNode;
}

export function StatCard({ theme, label, value, subValue, subValueColor, icon, right }: StatCardProps) {
  return (
    <div
      style={{
        background: theme.cardBg,
        border: `1px solid ${theme.cardBorder}`,
        borderRadius: "14px",
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{
          fontSize: "11px", fontWeight: 700, color: theme.textMuted,
          textTransform: "uppercase", letterSpacing: "0.6px",
          display: "flex", alignItems: "center", gap: "6px",
        }}>
          {icon}
          {label}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "10px" }}>
        <div style={{ fontSize: "24px", fontWeight: 800, color: theme.text, letterSpacing: "-0.5px", lineHeight: 1.1 }}>
          {value}
        </div>
        {right}
      </div>

      {subValue && (
        <div style={{ fontSize: "13px", fontWeight: 600, color: subValueColor ?? theme.textMuted }}>
          {subValue}
        </div>
      )}
    </div>
  );
}

export function StatCardSkeleton({ theme }: { theme: DashTheme }) {
  return (
    <div style={{
      background: theme.cardBg,
      border: `1px solid ${theme.cardBorder}`,
      borderRadius: "14px",
      padding: "18px 20px",
      display: "flex",
      flexDirection: "column",
      gap: "10px",
    }}>
      <div style={{ height: "10px", width: "60%", borderRadius: "4px", background: theme.hover }} />
      <div style={{ height: "26px", width: "80%", borderRadius: "6px", background: theme.hover }} />
      <div style={{ height: "10px", width: "40%", borderRadius: "4px", background: theme.hover }} />
    </div>
  );
}
