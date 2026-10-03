import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { GitCompare, Calculator, Bookmark } from "lucide-react";
import { MOCK_NEWS } from "../../lib/dashboard";
import type { DashTheme } from "./shared/theme";
import { NewsSection } from "./shared/NewsSection";
import { MutualFundDashboard } from "../mutualfunds/Dashboard";
import { SipCalculatorModal } from "../mutualfunds/SipCalculator";
import { CompareFundsModal } from "../mutualfunds/CompareFunds";
import { useWishlist } from "../mutualfunds/useWishlist";
import { DARK as MF_DARK, LIGHT as MF_LIGHT } from "../mutualfunds/theme";

interface MutualFundsViewProps {
  theme: DashTheme;
  isDark: boolean;
}

export function MutualFundsView({ theme, isDark }: MutualFundsViewProps) {
  const navigate = useNavigate();
  const mfTheme = isDark ? MF_DARK : MF_LIGHT;
  const { list: wishlist } = useWishlist();
  const [modal, setModal] = useState<"sip" | "compare" | null>(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
        <QuickAction theme={theme} icon={<Calculator style={{ width: 14, height: 14 }} />} label="SIP Calculator" onClick={() => setModal("sip")} />
        <QuickAction theme={theme} icon={<GitCompare style={{ width: 14, height: 14 }} />} label="Compare Funds" onClick={() => setModal("compare")} />
        <QuickAction
          theme={theme}
          icon={<Bookmark style={{ width: 14, height: 14 }} />}
          label={`Wishlist${wishlist.length ? ` (${wishlist.length})` : ""}`}
          onClick={() => navigate("/explore/mutualfunds", { state: { tab: "Watchlist" } })}
        />
      </div>

      <MutualFundDashboard T={mfTheme} />

      <NewsSection theme={theme} title="Mutual Fund News" items={MOCK_NEWS.mutualfunds} />

      {modal === "sip" && <SipCalculatorModal T={mfTheme} onClose={() => setModal(null)} />}
      {modal === "compare" && <CompareFundsModal T={mfTheme} onClose={() => setModal(null)} />}
    </div>
  );
}

function QuickAction({ theme, icon, label, onClick }: { theme: DashTheme; icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: "7px",
        padding: "8px 14px", borderRadius: "9px",
        background: theme.cardBg, border: `1px solid ${theme.cardBorder}`,
        color: theme.text, fontSize: "12.5px", fontWeight: 600, cursor: "pointer",
      }}
    >
      {icon}
      {label}
    </button>
  );
}
