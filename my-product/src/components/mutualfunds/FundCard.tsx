import type { MFFundSummary } from "../../lib/mutualfunds";
import { fmtPct } from "../../lib/mutualfunds";
import type { MFTheme } from "./theme";

// No per-fund branding data comes from the API (no logo URLs), so the
// avatar mark/color are derived deterministically from the fund house name
// instead of being hardcoded per fund.
const ACCENT_PALETTE = ["#3b82f6", "#f97316", "#dc2626", "#16a34a", "#8b5cf6", "#0ea5e9", "#eab308", "#ec4899"];

function accentFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return ACCENT_PALETTE[h % ACCENT_PALETTE.length];
}

function markFor(fundHouse: string): string {
  const cleaned = fundHouse.replace(/\s*Mutual Fund\s*$/i, "").trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function FundCard({ fund, T, onClick }: { fund: MFFundSummary; T: MFTheme; onClick?: () => void }) {
  const hasReturns = fund.return_3y != null;
  const positive = hasReturns && fund.return_3y! >= 0;
  const accent = accentFor(fund.fund_house || String(fund.scheme_code));
  const mark = markFor(fund.fund_house || fund.scheme_name);

  return (
    <div
      onClick={onClick}
      style={{
        background: T.card, border: `1px solid ${T.border}`, borderRadius: "16px",
        padding: "16px", display: "flex", flexDirection: "column", gap: "12px",
        cursor: onClick ? "pointer" : "default", transition: "border-color 0.18s, transform 0.18s",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = T.borderMid;
        if (onClick) (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = T.border;
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
      }}
    >
      <div style={{
        width: "40px", height: "40px", borderRadius: "10px",
        background: `${accent}22`, color: accent,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "11px", fontWeight: 700, flexShrink: 0,
      }}>
        {mark}
      </div>
      <div
        title={fund.scheme_name}
        style={{
          fontSize: "13px", fontWeight: 700, color: T.text, lineHeight: 1.4, minHeight: "36px",
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
        }}
      >
        {fund.scheme_name}
      </div>
      <div style={{ fontSize: "11px", color: T.textDim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {fund.fund_house}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
        <span style={{ fontSize: "16px", fontWeight: 700, color: hasReturns ? (positive ? "#22c55e" : "#ef4444") : T.textDim }}>
          {hasReturns ? fmtPct(fund.return_3y) : "--"}
        </span>
        <span style={{ fontSize: "11px", color: T.textDim, fontWeight: 600 }}>{hasReturns ? "3Y" : "NA"}</span>
      </div>
    </div>
  );
}
