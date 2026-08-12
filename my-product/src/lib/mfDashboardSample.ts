// No backend endpoint exists yet for a user's actual mutual fund
// holdings/SIPs/portfolio value (confirmed: neither the Mutual Funds catalog
// API nor the old Stocks/F&O dashboard API cover personal MF investments).
// This file is realistic placeholder data structured so swapping in a real
// portfolio endpoint later only means replacing what's inside
// getSampleDashboard() — every consumer already reads through the same
// typed shape.

export type MFAssetClass = "Equity" | "Debt" | "Gold & Silver" | "Hybrid";

export interface MFHolding {
  scheme_code: number;
  scheme_name: string;
  fund_house: string;
  category: string;
  asset_class: MFAssetClass;
  units: number;
  avg_nav: number;
  current_nav: number;
  day_change_pct: number;
  xirr: number;
}

export interface MFSip {
  id: string;
  scheme_code: number;
  scheme_name: string;
  amount: number;
  frequency: "Monthly" | "Weekly" | "Quarterly";
  next_date: string;
  installments_done: number;
  status: "ACTIVE" | "PAUSED";
}

export interface MFValuePoint {
  date: string;
  value: number;
  invested: number;
}

export interface MFDashboardData {
  holdings: MFHolding[];
  sips: MFSip[];
  valueHistory: MFValuePoint[];
}

const HOLDINGS: MFHolding[] = [
  { scheme_code: 122639, scheme_name: "Parag Parikh Flexi Cap Fund - Direct Plan - Growth", fund_house: "PPFAS Mutual Fund", category: "Equity - Flexi Cap", asset_class: "Equity", units: 245.312, avg_nav: 68.4, current_nav: 92.33, day_change_pct: 0.62, xirr: 22.4 },
  { scheme_code: 118989, scheme_name: "HDFC Mid Cap Fund - Growth Option - Direct Plan", fund_house: "HDFC Mutual Fund", category: "Equity - Mid Cap", asset_class: "Equity", units: 88.104, avg_nav: 178.2, current_nav: 236.72, day_change_pct: -0.34, xirr: 18.9 },
  { scheme_code: 143567, scheme_name: "SBI Small Cap Fund - Direct Plan - Growth", fund_house: "SBI Mutual Fund", category: "Equity - Small Cap", asset_class: "Equity", units: 52.771, avg_nav: 148.6, current_nav: 172.05, day_change_pct: 1.12, xirr: 15.6 },
  { scheme_code: 101234, scheme_name: "SBI Gold Direct Plan - Growth", fund_house: "SBI Mutual Fund", category: "Gold & Silver", asset_class: "Gold & Silver", units: 310.5, avg_nav: 18.9, current_nav: 24.31, day_change_pct: 0.18, xirr: 12.1 },
  { scheme_code: 119512, scheme_name: "HDFC Corporate Bond Fund - Direct Plan - Growth", fund_house: "HDFC Mutual Fund", category: "Debt - Corporate Bond", asset_class: "Debt", units: 612.4, avg_nav: 24.1, current_nav: 25.83, day_change_pct: 0.02, xirr: 7.2 },
];

const SIPS: MFSip[] = [
  { id: "sip-1", scheme_code: 122639, scheme_name: "Parag Parikh Flexi Cap Fund", amount: 5000, frequency: "Monthly", next_date: "2026-09-05", installments_done: 18, status: "ACTIVE" },
  { id: "sip-2", scheme_code: 118989, scheme_name: "HDFC Mid Cap Fund", amount: 3000, frequency: "Monthly", next_date: "2026-09-10", installments_done: 11, status: "ACTIVE" },
  { id: "sip-3", scheme_code: 101234, scheme_name: "SBI Gold Direct Plan", amount: 2000, frequency: "Monthly", next_date: "2026-09-15", installments_done: 6, status: "ACTIVE" },
];

// Deterministic synthetic value-over-time series (no Math.random) so the
// chart looks the same on every load instead of jittering on refresh.
function buildValueHistory(): MFValuePoint[] {
  const days = 365;
  const points: MFValuePoint[] = [];
  const start = new Date();
  start.setDate(start.getDate() - days);
  let invested = 40000;
  for (let i = 0; i <= days; i += 5) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    if (i > 0 && i % 30 < 5) invested += 10000; // roughly monthly SIP top-ups
    const growth = 1 + (i / days) * 0.24 + Math.sin(i / 27) * 0.035;
    points.push({
      date: d.toISOString().slice(0, 10),
      value: Math.round(invested * growth),
      invested,
    });
  }
  return points;
}

export function getSampleDashboard(): MFDashboardData {
  return { holdings: HOLDINGS, sips: SIPS, valueHistory: buildValueHistory() };
}
