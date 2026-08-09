import { RefreshCw } from "lucide-react";
import type { MFTheme } from "./theme";

export function LoadingBlock({ T, label = "Loading…" }: { T: MFTheme; label?: string }) {
  return (
    <div style={{ fontSize: "13px", color: T.textMuted, textAlign: "center", padding: "40px" }}>
      {label}
    </div>
  );
}

export function EmptyBlock({ T, message }: { T: MFTheme; message: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      minHeight: "140px", background: T.card, border: `1px solid ${T.border}`,
      borderRadius: "16px", fontSize: "13px", color: T.textMuted, textAlign: "center", padding: "24px",
    }}>
      {message}
    </div>
  );
}

export function ErrorBlock({ T, message, onRetry }: { T: MFTheme; message: string; onRetry?: () => void }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px",
      minHeight: "140px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.25)",
      borderRadius: "16px", padding: "24px", textAlign: "center",
    }}>
      <div style={{ fontSize: "13px", color: "#ef4444", fontWeight: 600 }}>{message}</div>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px", borderRadius: "8px",
            background: T.card, border: `1px solid ${T.border}`, color: T.text, fontSize: "12px", fontWeight: 600, cursor: "pointer",
          }}
        >
          <RefreshCw style={{ width: "13px", height: "13px" }} /> Retry
        </button>
      )}
    </div>
  );
}

// Fallback rendered by a section-scoped ErrorBoundary (see ErrorBoundary.tsx's
// `fallback` prop) — keeps a render crash contained to one section instead of
// blanking the whole page, matching the pattern established in OverallDashboard.tsx.
export function SectionErrorFallback({ error, onRetry, T }: { error: Error; onRetry: () => void; T: MFTheme }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "10px",
      minHeight: "140px", padding: "24px", borderRadius: "16px", textAlign: "center",
      background: T.card, border: "1px solid rgba(239,68,68,0.25)",
    }}>
      <div style={{ fontSize: "13px", color: "#ef4444", fontWeight: 700 }}>Something went wrong loading this section</div>
      <div style={{ fontSize: "12px", color: T.textMuted, maxWidth: "380px" }}>
        {error.message || "An unexpected error occurred while rendering this section."}
      </div>
      <button
        onClick={onRetry}
        style={{
          padding: "7px 16px", borderRadius: "8px", background: "rgba(239,68,68,0.12)",
          border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", fontSize: "12px", fontWeight: 700, cursor: "pointer",
        }}
      >
        Retry
      </button>
    </div>
  );
}
