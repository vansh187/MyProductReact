import type { ReactNode, CSSProperties } from "react";
import type { DashTheme } from "./theme";

interface TableCardProps {
  theme: DashTheme;
  title: string;
  right?: ReactNode;
  children: ReactNode;
}

export function TableCard({ theme, title, right, children }: TableCardProps) {
  return (
    <div style={{
      background: theme.cardBg,
      border: `1px solid ${theme.cardBorder}`,
      borderRadius: "14px",
      padding: "18px 20px",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <div style={{ fontSize: "13px", fontWeight: 700, color: theme.text }}>{title}</div>
        {right}
      </div>
      <div style={{ overflowX: "auto" }}>{children}</div>
    </div>
  );
}

export function thStyle(theme: DashTheme): CSSProperties {
  return {
    textAlign: "left",
    fontSize: "11px",
    fontWeight: 700,
    color: theme.textMuted,
    textTransform: "uppercase",
    letterSpacing: "0.4px",
    padding: "0 12px 10px",
    borderBottom: `1px solid ${theme.cardBorder}`,
    whiteSpace: "nowrap",
  };
}

export function tdStyle(theme: DashTheme): CSSProperties {
  return {
    padding: "12px",
    fontSize: "13px",
    color: theme.text,
    borderBottom: `1px solid ${theme.cardBorder}`,
    whiteSpace: "nowrap",
  };
}

export function EmptyRow({ theme, colSpan, message }: { theme: DashTheme; colSpan: number; message: string }) {
  return (
    <tr>
      <td colSpan={colSpan} style={{ padding: "28px 12px", textAlign: "center", color: theme.textDim, fontSize: "13px" }}>
        {message}
      </td>
    </tr>
  );
}
