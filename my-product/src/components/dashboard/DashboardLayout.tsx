import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Settings } from "lucide-react";
import { Header } from "../header";
import { Footer } from "../footer";
import { themeFor } from "./shared/theme";
import { OverallView } from "./OverallView";
import { StocksView } from "./StocksView";
import { FnoView } from "./FnoView";
import { MutualFundsView } from "./MutualFundsView";

type DashboardTab = "Overall" | "Stocks" | "Mutual Funds" | "F&O";

const TABS: DashboardTab[] = ["Overall", "Stocks", "Mutual Funds", "F&O"];

export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const [isDark, setIsDark] = useState(() => localStorage.getItem("theme") !== "light");
  const [activeTab, setActiveTab] = useState<DashboardTab>(
    (location.state as { tab?: DashboardTab } | null)?.tab ?? "Overall"
  );

  const theme = themeFor(isDark);

  useEffect(() => {
    if (!localStorage.getItem("authToken")) {
      navigate("/", { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    document.body.style.backgroundColor = theme.pageBg;
    document.body.style.overflow = "auto";
    document.body.style.height = "auto";
    document.documentElement.style.overflow = "auto";
    document.documentElement.style.height = "auto";
    return () => {
      document.documentElement.classList.remove("dark");
      document.body.style.backgroundColor = "";
    };
  }, [isDark, theme.pageBg]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: theme.pageBg }}>
      <Header
        isDark={isDark}
        onToggleTheme={() =>
          setIsDark((d) => {
            const next = !d;
            localStorage.setItem("theme", next ? "dark" : "light");
            return next;
          })
        }
      />

      {/* Secondary sub-nav */}
      <div style={{
        borderBottom: `1px solid ${theme.cardBorder}`,
        background: theme.pageBg,
        position: "sticky", top: "62px", zIndex: 40,
      }}>
        <div style={{
          maxWidth: "1400px", margin: "0 auto", padding: "0 28px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", gap: "4px" }}>
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: "14px 16px",
                  border: "none",
                  borderBottom: `2px solid ${activeTab === tab ? theme.accent : "transparent"}`,
                  background: "transparent",
                  color: activeTab === tab ? theme.text : theme.tabInactiveText,
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "color 0.15s, border-color 0.15s",
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          <button
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "7px 12px", borderRadius: "8px",
              background: "transparent", border: `1px solid ${theme.cardBorder}`,
              color: theme.textMuted, fontSize: "12px", fontWeight: 600, cursor: "pointer",
            }}
          >
            <Settings style={{ width: "13px", height: "13px" }} />
            Portfolio Settings
          </button>
        </div>
      </div>

      <main style={{ flex: 1, maxWidth: "1400px", width: "100%", margin: "0 auto", padding: "20px 28px 40px" }}>
        {activeTab === "Overall" && <OverallView theme={theme} />}
        {activeTab === "Stocks" && <StocksView theme={theme} />}
        {activeTab === "Mutual Funds" && <MutualFundsView theme={theme} isDark={isDark} />}
        {activeTab === "F&O" && <FnoView theme={theme} />}
      </main>

      <Footer isDark={isDark} />
    </div>
  );
}
