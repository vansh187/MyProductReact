import { useRef, useEffect, type ReactNode } from "react";
import { X, type LucideIcon } from "lucide-react";
import type { MFTheme } from "./theme";

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

// Shared premium modal chrome (overlay, glass card, gradient icon badge,
// Escape-to-close, focus trap) used by every "Products and Tools" feature
// modal — keeps them visually and behaviorally consistent by construction
// instead of each one re-implementing the same accessibility plumbing.
export function LuxuryModal({
  T, icon: Icon, title, subtitle, onClose, children, width = "680px",
}: {
  T: MFTheme;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  onClose: () => void;
  children: ReactNode;
  width?: string;
}) {
  const accent = T.activeBorder;
  const cardRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeBtnRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !cardRef.current) return;
      const focusable = cardRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: "20px",
      }}
      onClick={onClose}
    >
      <style>{`
        .luxury-modal-scroll { scrollbar-gutter: stable; }
        .luxury-modal-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
        .luxury-modal-scroll::-webkit-scrollbar-track { background: transparent; }
        .luxury-modal-scroll::-webkit-scrollbar-thumb {
          background-color: ${accent}73;
          border-radius: 100px;
          border: 2px solid ${T.cardSolid};
          background-clip: padding-box;
        }
        .luxury-modal-scroll::-webkit-scrollbar-thumb:hover { background-color: ${accent}b3; }
      `}</style>

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={e => e.stopPropagation()}
        className="luxury-modal-scroll"
        style={{
          width, maxWidth: "100%", maxHeight: "92vh", overflowY: "auto",
          background: T.cardSolid, borderRadius: "24px", border: `1px solid ${T.borderMid}`,
          boxShadow: `0 0 0 1px ${accent}22, 0 40px 100px rgba(0,0,0,0.55)`,
          padding: "28px",
          scrollbarWidth: "thin",
          scrollbarColor: `${accent}73 transparent`,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "26px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{
              width: "48px", height: "48px", borderRadius: "14px", flexShrink: 0,
              background: `linear-gradient(135deg, ${accent}, ${accent}99)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `0 8px 20px ${accent}44`,
            }}>
              <Icon style={{ width: "22px", height: "22px", color: "#fff" }} />
            </div>
            <div>
              <div style={{ fontSize: "18px", fontWeight: 800, color: T.text, letterSpacing: "-0.2px" }}>{title}</div>
              <div style={{ fontSize: "12px", color: T.textDim }}>{subtitle}</div>
            </div>
          </div>
          <button
            ref={closeBtnRef}
            onClick={onClose}
            aria-label={`Close ${title}`}
            style={{
              width: "32px", height: "32px", borderRadius: "10px", flexShrink: 0,
              background: T.tabBg, border: `1px solid ${T.border}`, color: T.textMuted,
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
            }}
          >
            <X style={{ width: "15px", height: "15px" }} />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}
