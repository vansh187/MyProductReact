// Dark-mode-first fintech palette per the PrimePipTrade dashboard spec.
// Light variant is a reasonable inverse so the existing app-wide theme
// toggle still works, since every other page in this app supports both.
export const DASH_THEME = {
  dark: {
    pageBg:     "#0B0E14",
    cardBg:     "#151A23",
    cardBorder: "#1E2532",
    text:       "#e6edf3",
    textMuted:  "#8b949e",
    textDim:    "#6e7681",
    green:      "#00E676",
    red:        "#FF5252",
    accent:     "#3b82f6",
    hover:      "rgba(255,255,255,0.04)",
    tabActive:  "rgba(59,130,246,0.15)",
    tabInactiveText: "#8b949e",
  },
  light: {
    pageBg:     "#f0f4f8",
    cardBg:     "#ffffff",
    cardBorder: "#e2e8f0",
    text:       "#0f172a",
    textMuted:  "#64748b",
    textDim:    "#94a3b8",
    green:      "#059669",
    red:        "#dc2626",
    accent:     "#3b82f6",
    hover:      "rgba(0,0,0,0.03)",
    tabActive:  "rgba(59,130,246,0.1)",
    tabInactiveText: "#64748b",
  },
} as const;

export type DashTheme = typeof DASH_THEME.dark;

export function themeFor(isDark: boolean): DashTheme {
  return isDark ? DASH_THEME.dark : DASH_THEME.light;
}
