import { TrendingUp, Wallet, Gem, Building2, Building, Store, type LucideIcon } from "lucide-react";

export const BASE_URL = "https://api.primepiptrade.com";
// All mutual-fund endpoints are public reads, no auth header required.
export const MF_API_BASE = `${BASE_URL}/api/mutual-funds`;

export interface MFFundSummary {
  scheme_code: number;
  scheme_name: string;
  fund_house: string;
  scheme_category: string;
  scheme_type: string;
  latest_nav: number | null;
  return_3y: number | null;
}

export interface MFCollectionTile {
  key: string;
  title: string;
  icon_hint: string;
}

export interface MFExploreResponse {
  popular_funds: MFFundSummary[];
  collections: MFCollectionTile[];
}

export interface MFCategoriesResponse {
  categories: string[];
  fund_houses: string[];
}

export interface MFFundDetail {
  scheme_code: number;
  scheme_name: string;
  fund_house: string;
  scheme_category: string;
  scheme_type: string;
  isin_growth: string | null;
  isin_div_reinvestment: string | null;
  min_sip_amount: number | null;
  fund_size_aum: number | null;
  expense_ratio: number | null;
  rating: number | null;
  holdings: string | null;
}

export interface MFNavPoint {
  nav_date: string;
  nav: number;
}

export interface MFNavReturns {
  return_1m: number | null;
  return_6m: number | null;
  return_1y: number | null;
  return_3y: number | null;
  return_5y: number | null;
  day_change_pct: number | null;
  latest_nav: number | null;
}

export type NavChartPeriod = "1m" | "6m" | "1y" | "3y" | "5y" | "all";

export interface MFNavChartResponse {
  scheme_code: number;
  period: NavChartPeriod;
  points: MFNavPoint[];
  returns: MFNavReturns;
  is_live: boolean;
}

// icon_hint -> icon component. Falls back to TrendingUp for any hint the
// backend adds later that the frontend doesn't recognise yet.
export const ICON_HINT_MAP: Record<string, LucideIcon> = {
  "trending-up": TrendingUp,
  "wallet": Wallet,
  "ingot": Gem,
  "building": Building2,
  "building-2": Building,
  "storefront": Store,
};
export const DEFAULT_COLLECTION_ICON: LucideIcon = TrendingUp;

export function fmtPct(n: unknown): string {
  if (n == null || typeof n !== "number" || isNaN(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

export function fmtNav(n: unknown): string {
  if (n == null || typeof n !== "number" || isNaN(n)) return "—";
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function humanizeKey(key: string): string {
  return key.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

// The API returns { detail: "..." } on errors (occasionally an array of
// pydantic validation issues), same shape used across the rest of the app.
export function extractErrorMessage(body: any, fallback: string): string {
  const detail = body?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d: any) => {
        const field = Array.isArray(d?.loc) ? d.loc.slice(-1)[0] : d?.loc;
        return field ? `${field}: ${d?.msg ?? "invalid value"}` : d?.msg ?? "invalid value";
      })
      .join("; ");
  }
  return fallback;
}
