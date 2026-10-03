import { Newspaper } from "lucide-react";
import type { NewsItem } from "../../../lib/dashboard";
import type { DashTheme } from "./theme";

interface NewsSectionProps {
  theme: DashTheme;
  title: string;
  items: NewsItem[];
}

const SENTIMENT_COLOR: Record<NewsItem["sentiment"], string> = {
  positive: "#00E676",
  negative: "#FF5252",
  neutral: "#8b949e",
};

export function NewsSection({ theme, title, items }: NewsSectionProps) {
  return (
    <div style={{
      background: theme.cardBg,
      border: `1px solid ${theme.cardBorder}`,
      borderRadius: "14px",
      padding: "18px 20px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
        <Newspaper style={{ width: "15px", height: "15px", color: theme.accent }} />
        <div style={{ fontSize: "13px", fontWeight: 700, color: theme.text }}>{title}</div>
        <div style={{
          marginLeft: "auto", fontSize: "10px", fontWeight: 600, color: theme.textDim,
          border: `1px solid ${theme.cardBorder}`, borderRadius: "6px", padding: "2px 6px",
        }}>
          Demo data
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        {items.map((item, i) => (
          <div
            key={i}
            style={{
              display: "flex", alignItems: "flex-start", gap: "10px",
              padding: "10px 0",
              borderTop: i > 0 ? `1px solid ${theme.cardBorder}` : "none",
            }}
          >
            <div style={{
              width: "6px", height: "6px", borderRadius: "50%", marginTop: "6px", flexShrink: 0,
              background: SENTIMENT_COLOR[item.sentiment],
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "13px", color: theme.text, lineHeight: 1.4, marginBottom: "3px" }}>
                {item.headline}
              </div>
              <div style={{ fontSize: "11px", color: theme.textDim }}>
                {item.source} · {item.time}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
