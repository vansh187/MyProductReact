import { useMemo, useState, useEffect, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { Calculator, Sparkles, ArrowRight } from "lucide-react";
import type { MFTheme } from "./theme";
import { LuxuryModal } from "./LuxuryModal";

// The luxury slider's thumb color is set via a CSS custom property (read by
// the injected <style> block below) so each SliderField instance can have a
// different accent without generating a separate stylesheet rule per one.
type SliderStyle = CSSProperties & { "--thumb-color"?: string };

function fmtINR(n: number): string {
  return Math.round(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

interface SliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  prefix?: string;
  suffix?: string;
  accent: string;
  T: MFTheme;
  onChange: (v: number) => void;
}

function SliderField({ label, value, min, max, step, prefix, suffix, accent, T, onChange }: SliderFieldProps) {
  const pct = ((value - min) / (max - min)) * 100;
  const trackColor = T.border === "rgba(255,255,255,0.07)" ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)";

  // The number box needs its own local text state — driving it straight off
  // `value` meant clearing the field (empty string -> Number("") === 0)
  // silently snapped to `min` mid-keystroke instead of letting the user
  // finish typing. Only commit (and clamp) on blur or a valid live parse;
  // an empty/partial field is left alone until then.
  const [text, setText] = useState(String(value));
  useEffect(() => { setText(String(value)); }, [value]);

  function commit() {
    const n = Number(text);
    if (text.trim() === "" || isNaN(n)) {
      setText(String(value));
      return;
    }
    const clamped = Math.min(max, Math.max(min, n));
    onChange(clamped);
    setText(String(clamped));
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
        <span style={{ fontSize: "12px", fontWeight: 600, color: T.textMuted }}>{label}</span>
        <div style={{
          display: "flex", alignItems: "center", gap: "2px", padding: "5px 10px", borderRadius: "8px",
          background: `${accent}14`, border: `1px solid ${accent}40`,
        }}>
          {prefix && <span style={{ fontSize: "13px", fontWeight: 700, color: accent }}>{prefix}</span>}
          <input
            type="number"
            value={text}
            min={min}
            max={max}
            step={step}
            onChange={e => {
              const raw = e.target.value;
              setText(raw);
              // Only propagate live while mid-typing if the number is
              // already in range — clamping a not-yet-finished number
              // (e.g. "4" while typing "45000") would push a clamped value
              // back through the value->text sync effect and corrupt what
              // the user is still typing. Out-of-range values are clamped
              // once they're finished, in commit() on blur/Enter instead.
              if (raw.trim() === "") return;
              const n = Number(raw);
              if (!isNaN(n) && n >= min && n <= max) onChange(n);
            }}
            onBlur={commit}
            onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            style={{
              width: suffix ? "44px" : "72px", border: "none", outline: "none", background: "transparent",
              fontSize: "13px", fontWeight: 700, color: accent, textAlign: "right",
            }}
          />
          {suffix && <span style={{ fontSize: "13px", fontWeight: 700, color: accent }}>{suffix}</span>}
        </div>
      </div>
      <input
        type="range"
        className="luxury-slider"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={e => onChange(Number(e.target.value))}
        style={{
          width: "100%", height: "5px", borderRadius: "100px", appearance: "none", cursor: "pointer",
          background: `linear-gradient(to right, ${accent} 0%, ${accent} ${pct}%, ${trackColor} ${pct}%, ${trackColor} 100%)`,
          "--thumb-color": accent,
        } as SliderStyle}
      />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
        <span style={{ fontSize: "10px", color: T.textDim }}>{prefix}{min.toLocaleString("en-IN")}{suffix}</span>
        <span style={{ fontSize: "10px", color: T.textDim }}>{prefix}{max.toLocaleString("en-IN")}{suffix}</span>
      </div>
    </div>
  );
}

function ResultDonut({ investedPct, accent, T }: { investedPct: number; accent: string; T: MFTheme }) {
  const size = 132, strokeWidth = 16;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const investedDash = Math.max((investedPct / 100) * circumference - 2, 0);
  const trackColor = T.border === "rgba(255,255,255,0.07)" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={accent} strokeWidth={strokeWidth}
          strokeLinecap="round" strokeDasharray={`${investedDash} ${circumference}`}
        />
      </g>
    </svg>
  );
}

export function SipCalculatorModal({ T, onClose }: { T: MFTheme; onClose: () => void }) {
  const navigate = useNavigate();
  const [monthly, setMonthly] = useState(10000);
  const [rate, setRate] = useState(12);
  const [years, setYears] = useState(10);
  const accent = T.activeBorder;

  const result = useMemo(() => {
    const months = years * 12;
    const monthlyRate = rate / 12 / 100;
    const invested = monthly * months;
    const futureValue = monthlyRate === 0
      ? invested
      : monthly * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) * (1 + monthlyRate);
    const returns = futureValue - invested;
    return {
      invested,
      returns,
      total: futureValue,
      investedPct: invested > 0 ? (invested / futureValue) * 100 : 0,
    };
  }, [monthly, rate, years]);

  return (
    <LuxuryModal T={T} icon={Calculator} title="SIP Calculator" subtitle="Plan your systematic investment, live" onClose={onClose}>
      <style>{`
        .luxury-slider::-webkit-slider-thumb {
          appearance: none; width: 20px; height: 20px; border-radius: 50%;
          background: var(--thumb-color); border: 3px solid #fff;
          box-shadow: 0 2px 10px rgba(0,0,0,0.35), 0 0 0 3px color-mix(in srgb, var(--thumb-color) 30%, transparent);
          cursor: pointer;
        }
        .luxury-slider::-moz-range-thumb {
          width: 20px; height: 20px; border-radius: 50%; border: 3px solid #fff;
          background: var(--thumb-color); box-shadow: 0 2px 10px rgba(0,0,0,0.35);
          cursor: pointer;
        }
      `}</style>

      {/* Inputs */}
      <div style={{ display: "flex", flexDirection: "column", gap: "22px", marginBottom: "26px" }}>
        <SliderField label="Monthly Investment" value={monthly} min={500} max={200000} step={500} prefix="₹" accent={accent} T={T} onChange={setMonthly} />
        <SliderField label="Expected Return Rate (p.a.)" value={rate} min={1} max={30} step={0.5} suffix="%" accent={accent} T={T} onChange={setRate} />
        <SliderField label="Time Period" value={years} min={1} max={40} step={1} suffix=" yr" accent={accent} T={T} onChange={setYears} />
      </div>

      {/* Results */}
      <div style={{
        background: `linear-gradient(135deg, ${accent}12, transparent)`,
        border: `1px solid ${accent}33`, borderRadius: "18px", padding: "24px",
        display: "flex", alignItems: "center", gap: "24px", flexWrap: "wrap",
      }}>
        <ResultDonut investedPct={result.investedPct} accent={accent} T={T} />

        <div style={{ flex: 1, minWidth: "220px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", fontWeight: 700, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              <Sparkles style={{ width: "12px", height: "12px", color: accent }} /> Total Value
            </div>
            <div style={{ fontSize: "32px", fontWeight: 800, color: T.text, letterSpacing: "-0.5px" }}>
              ₹{fmtINR(result.total)}
            </div>
          </div>

          <div style={{ display: "flex", gap: "20px" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: T.textMuted, fontWeight: 600 }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "3px", background: accent }} /> Invested
              </div>
              <div style={{ fontSize: "15px", fontWeight: 700, color: T.text, marginTop: "3px" }}>₹{fmtINR(result.invested)}</div>
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: T.textMuted, fontWeight: 600 }}>
                <span style={{
                  width: "8px", height: "8px", borderRadius: "3px",
                  background: T.border === "rgba(255,255,255,0.07)" ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)",
                }} /> Est. Returns
              </div>
              <div style={{ fontSize: "15px", fontWeight: 700, color: "#22c55e", marginTop: "3px" }}>+₹{fmtINR(result.returns)}</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ fontSize: "11px", color: T.textDim, marginTop: "14px", textAlign: "center" }}>
        Mutual fund investments are subject to market risk. Figures are indicative, not guaranteed returns.
      </div>

      <button
        onClick={() => { onClose(); navigate("/explore/mutualfunds/search"); }}
        style={{
          width: "100%", marginTop: "18px", padding: "14px", borderRadius: "12px", border: "none",
          background: `linear-gradient(135deg, ${accent}, ${accent}cc)`, color: "#fff",
          fontSize: "14px", fontWeight: 700, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
          boxShadow: `0 10px 26px ${accent}40`,
        }}
      >
        Explore funds to start this SIP <ArrowRight style={{ width: "15px", height: "15px" }} />
      </button>
    </LuxuryModal>
  );
}
