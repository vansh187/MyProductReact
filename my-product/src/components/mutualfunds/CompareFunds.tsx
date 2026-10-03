import { useState, useEffect, useRef } from "react";
import { GitCompare, Search, X, Plus, Crown } from "lucide-react";
import type { MFTheme } from "./theme";
import { LuxuryModal } from "./LuxuryModal";
import {
  MF_API_BASE, fmtPct, fmtNav,
  type MFFundSummary, type MFFundDetail, type MFNavChartResponse,
} from "../../lib/mutualfunds";

const MAX_SLOTS = 3;

function markFor(fundHouse: string): string {
  const cleaned = fundHouse.replace(/\s*Mutual Fund\s*$/i, "").trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

interface FundDetails {
  detail: MFFundDetail | null;
  chart: MFNavChartResponse | null;
  loading: boolean;
  error: string | null;
}

function CompareSlot({
  index, fund, accent, T, onSelect, onRemove,
}: {
  index: number;
  fund: MFFundSummary | null;
  accent: string;
  T: MFTheme;
  onSelect: (f: MFFundSummary) => void;
  onRemove: () => void;
}) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [results, setResults] = useState<MFFundSummary[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 350);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    if (!debounced) { setResults([]); return; }
    let cancelled = false;
    const controller = new AbortController();
    setSearching(true);
    fetch(`${MF_API_BASE}/search?q=${encodeURIComponent(debounced)}&page_size=6`, { signal: controller.signal })
      .then(async r => ({ ok: r.ok, body: await r.json() }))
      .then(({ ok, body }) => { if (!cancelled && ok) setResults(Array.isArray(body) ? body : []); })
      .catch(e => { if (!cancelled && e?.name !== "AbortError") setResults([]); })
      .finally(() => { if (!cancelled) setSearching(false); });
    return () => { cancelled = true; controller.abort(); };
  }, [debounced]);

  if (fund) {
    const mark = markFor(fund.fund_house || fund.scheme_name);
    return (
      <div style={{
        position: "relative", background: T.card, border: `1px solid ${accent}55`, borderRadius: "14px",
        padding: "14px", display: "flex", flexDirection: "column", gap: "8px", minHeight: "108px",
      }}>
        <button
          onClick={onRemove}
          aria-label={`Remove ${fund.scheme_name} from comparison`}
          style={{
            position: "absolute", top: "8px", right: "8px", width: "22px", height: "22px", borderRadius: "7px",
            background: T.tabBg, border: `1px solid ${T.border}`, color: T.textMuted,
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
          }}
        >
          <X style={{ width: "12px", height: "12px" }} />
        </button>
        <div style={{
          width: "32px", height: "32px", borderRadius: "9px", background: `${accent}22`, color: accent,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 700,
        }}>
          {mark}
        </div>
        <div style={{
          fontSize: "12px", fontWeight: 700, color: T.text, lineHeight: 1.35, paddingRight: "18px",
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
        }}>
          {fund.scheme_name}
        </div>
        <div style={{ fontSize: "10px", color: T.textDim }}>{fund.fund_house}</div>
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: "8px", padding: "10px 12px", minHeight: "108px",
        background: T.tabBg, border: `1px dashed ${T.borderMid}`, borderRadius: "14px",
      }}>
        <Search style={{ width: "14px", height: "14px", color: T.textDim, flexShrink: 0 }} />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={`Search fund ${index + 1}…`}
          style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: "12px", color: T.text }}
        />
      </div>

      {debounced && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 20,
          background: T.cardSolid, border: `1px solid ${T.borderMid}`, borderRadius: "12px",
          boxShadow: "0 16px 40px rgba(0,0,0,0.35)", padding: "6px", maxHeight: "220px", overflowY: "auto",
        }}>
          {searching ? (
            <div style={{ padding: "12px", fontSize: "12px", color: T.textDim, textAlign: "center" }}>Searching…</div>
          ) : results.length === 0 ? (
            <div style={{ padding: "12px", fontSize: "12px", color: T.textDim, textAlign: "center" }}>No matches.</div>
          ) : results.map(f => (
            <div
              key={f.scheme_code}
              onClick={() => { onSelect(f); setQuery(""); }}
              style={{ padding: "9px 10px", borderRadius: "8px", cursor: "pointer" }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = T.tabHover; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
            >
              <div style={{ fontSize: "12px", fontWeight: 700, color: T.text }}>{f.scheme_name}</div>
              <div style={{ fontSize: "10px", color: T.textDim }}>{f.fund_house}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function metricRow(
  label: string,
  funds: (MFFundSummary | null)[],
  values: (number | null)[],
  fmt: (n: number | null) => string,
  T: MFTheme,
  higherIsBetter = true,
) {
  const numeric = values.filter((v): v is number => v != null);
  const best = numeric.length > 1 ? (higherIsBetter ? Math.max(...numeric) : Math.min(...numeric)) : null;

  return (
    <div key={label} style={{ display: "grid", gridTemplateColumns: `140px repeat(${funds.length}, 1fr)`, gap: "10px", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${T.border}` }}>
      <div style={{ fontSize: "11px", fontWeight: 600, color: T.textDim }}>{label}</div>
      {funds.map((f, i) => {
        if (!f) return <div key={i} />;
        const v = values[i];
        const isBest = best != null && v === best;
        return (
          <div
            key={i}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: "5px",
              fontSize: "13px", fontWeight: 700, color: isBest ? "#22c55e" : T.text,
              padding: "4px 8px", borderRadius: "8px",
              background: isBest ? "rgba(34,197,94,0.1)" : "transparent",
            }}
          >
            {isBest && <Crown style={{ width: "11px", height: "11px", flexShrink: 0 }} />}
            {fmt(v)}
          </div>
        );
      })}
    </div>
  );
}

function textRow(label: string, funds: (MFFundSummary | null)[], values: (string | null)[], T: MFTheme) {
  return (
    <div key={label} style={{ display: "grid", gridTemplateColumns: `140px repeat(${funds.length}, 1fr)`, gap: "10px", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${T.border}` }}>
      <div style={{ fontSize: "11px", fontWeight: 600, color: T.textDim }}>{label}</div>
      {funds.map((f, i) => (
        <div key={i} style={{ fontSize: "12px", fontWeight: 600, color: T.textBody, textAlign: "center" }}>
          {f ? (values[i] ?? "—") : ""}
        </div>
      ))}
    </div>
  );
}

export function CompareFundsModal({ T, onClose }: { T: MFTheme; onClose: () => void }) {
  const accent = T.activeBorder;
  const [slotCount, setSlotCount] = useState(2);
  const [selected, setSelected] = useState<(MFFundSummary | null)[]>([null, null, null]);
  const [details, setDetails] = useState<Record<number, FundDetails>>({});
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  function handleSelect(index: number, fund: MFFundSummary) {
    setSelected(prev => { const next = [...prev]; next[index] = fund; return next; });

    if (details[fund.scheme_code]) return;
    setDetails(prev => ({ ...prev, [fund.scheme_code]: { detail: null, chart: null, loading: true, error: null } }));

    Promise.all([
      fetch(`${MF_API_BASE}/${fund.scheme_code}`).then(async r => ({ ok: r.ok, body: await r.json() })),
      fetch(`${MF_API_BASE}/${fund.scheme_code}/nav-chart?period=1y`).then(async r => ({ ok: r.ok, body: await r.json() })),
    ])
      .then(([d, c]) => {
        if (!mountedRef.current) return;
        setDetails(prev => ({
          ...prev,
          [fund.scheme_code]: {
            detail: d.ok ? d.body : null,
            chart: c.ok ? c.body : null,
            loading: false,
            error: d.ok && c.ok ? null : "Some data for this fund couldn't be loaded.",
          },
        }));
      })
      .catch(() => {
        if (!mountedRef.current) return;
        setDetails(prev => ({ ...prev, [fund.scheme_code]: { detail: null, chart: null, loading: false, error: "Network error while loading this fund." } }));
      });
  }

  function handleRemove(index: number) {
    setSelected(prev => { const next = [...prev]; next[index] = null; return next; });
  }

  const activeSlots = selected.slice(0, slotCount);
  const filledCount = activeSlots.filter(Boolean).length;
  const anyLoading = activeSlots.some(f => f && details[f.scheme_code]?.loading);

  return (
    <LuxuryModal T={T} icon={GitCompare} title="Compare Funds" subtitle="Search up to 3 funds and compare them side by side" onClose={onClose} width="820px">
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${slotCount}, 1fr)`, gap: "14px", marginBottom: "10px" }}>
        {activeSlots.map((f, i) => (
          <CompareSlot key={i} index={i} fund={f} accent={accent} T={T} onSelect={fund => handleSelect(i, fund)} onRemove={() => handleRemove(i)} />
        ))}
      </div>

      {slotCount < MAX_SLOTS && (
        <button
          onClick={() => setSlotCount(c => Math.min(MAX_SLOTS, c + 1))}
          style={{
            display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "9px",
            fontSize: "12px", fontWeight: 700, cursor: "pointer", marginBottom: "24px",
            background: "transparent", border: `1px dashed ${T.borderMid}`, color: T.textMuted,
          }}
        >
          <Plus style={{ width: "13px", height: "13px" }} /> Add another fund
        </button>
      )}
      {slotCount === MAX_SLOTS && <div style={{ marginBottom: "24px" }} />}

      {filledCount < 2 ? (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center", minHeight: "120px",
          background: T.tabBg, border: `1px solid ${T.border}`, borderRadius: "14px",
          fontSize: "13px", color: T.textDim, textAlign: "center", padding: "20px",
        }}>
          Select at least 2 funds above to see a side-by-side comparison.
        </div>
      ) : anyLoading ? (
        <div style={{ padding: "40px", textAlign: "center", fontSize: "13px", color: T.textMuted }}>Loading comparison…</div>
      ) : (
        <div style={{ background: `linear-gradient(135deg, ${accent}0d, transparent)`, border: `1px solid ${accent}2a`, borderRadius: "16px", padding: "18px 16px" }}>
          <div style={{ display: "grid", gridTemplateColumns: `140px repeat(${slotCount}, 1fr)`, gap: "10px", marginBottom: "4px" }}>
            <div />
            {activeSlots.map((f, i) => (
              <div key={i} style={{ fontSize: "11px", fontWeight: 700, color: accent, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {f?.scheme_name ?? ""}
              </div>
            ))}
          </div>

          {textRow("Category", activeSlots, activeSlots.map(f => f ? (details[f.scheme_code]?.detail?.scheme_category ?? f.scheme_category) : null), T)}
          {textRow("Fund House", activeSlots, activeSlots.map(f => f?.fund_house ?? null), T)}
          {metricRow("Latest NAV", activeSlots, activeSlots.map(f => f ? (details[f.scheme_code]?.chart?.returns.latest_nav ?? f.latest_nav) : null), v => v == null ? "—" : `₹${fmtNav(v)}`, T)}
          {metricRow("1M Return", activeSlots, activeSlots.map(f => f ? details[f.scheme_code]?.chart?.returns.return_1m ?? null : null), fmtPct, T)}
          {metricRow("6M Return", activeSlots, activeSlots.map(f => f ? details[f.scheme_code]?.chart?.returns.return_6m ?? null : null), fmtPct, T)}
          {metricRow("1Y Return", activeSlots, activeSlots.map(f => f ? details[f.scheme_code]?.chart?.returns.return_1y ?? null : null), fmtPct, T)}
          {metricRow("3Y Return", activeSlots, activeSlots.map(f => f ? details[f.scheme_code]?.chart?.returns.return_3y ?? null : null), fmtPct, T)}
          {metricRow("5Y Return", activeSlots, activeSlots.map(f => f ? details[f.scheme_code]?.chart?.returns.return_5y ?? null : null), fmtPct, T)}
        </div>
      )}

      <div style={{ fontSize: "11px", color: T.textDim, marginTop: "14px", textAlign: "center" }}>
        <Crown style={{ width: "10px", height: "10px", display: "inline", verticalAlign: "-1px", marginRight: "4px" }} />
        marks the best figure in each row. Past returns don't guarantee future performance.
      </div>
    </LuxuryModal>
  );
}
