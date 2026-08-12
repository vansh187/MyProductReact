import { PiggyBank } from "lucide-react";
import { MOCK_NEWS } from "../../lib/dashboard";
import type { DashTheme } from "./shared/theme";
import { NewsSection } from "./shared/NewsSection";

interface MutualFundsViewProps {
  theme: DashTheme;
}

export function MutualFundsView({ theme }: MutualFundsViewProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{
        background: theme.cardBg, border: `1px solid ${theme.cardBorder}`, borderRadius: "14px",
        padding: "48px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: "14px",
        textAlign: "center",
      }}>
        <div style={{
          width: "52px", height: "52px", borderRadius: "14px",
          background: "rgba(16,185,129,0.12)", display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <PiggyBank style={{ width: "24px", height: "24px", color: "#10b981" }} />
        </div>
        <div style={{ fontSize: "16px", fontWeight: 700, color: theme.text }}>Mutual Funds — Coming Soon</div>
        <div style={{ fontSize: "13px", color: theme.textMuted, maxWidth: "420px", lineHeight: 1.6 }}>
          Mutual fund tracking (SIPs, NAV, XIRR, category allocation) isn't wired up on the backend yet.
          This tab is reserved for that once the data model exists.
        </div>
      </div>

      <NewsSection theme={theme} title="Mutual Fund News" items={MOCK_NEWS.mutualfunds} />
    </div>
  );
}
