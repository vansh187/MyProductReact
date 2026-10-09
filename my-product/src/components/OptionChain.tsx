import { useState, useEffect, useMemo, useCallback, useLayoutEffect, useRef, memo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Header } from "./header";
import { Footer } from "./footer";
import { ChevronLeft, RefreshCw } from "lucide-react";
import {
  BASE_URL, normalizeName, INDEX_MATCH_VARIANTS, UNDERLYING_DISPLAY,
  LOT_SIZE_MAP, DEFAULT_LOT_SIZE, STRIKE_STEP_MAP, DEFAULT_STRIKE_STEP,
  CURRENT_EXPIRY, SUPPORTED_UNDERLYING_SLUGS, buildOptionSymbol, extractErrorMessage,
  isoExpiryToDisplay,
  type IndexData,
} from "../lib/fno";
import { useIndicesSelector, findIndex } from "../lib/indicesStream";
import {
  getChainFeed, useChainFeed, useChainMeta, useLeg,
  type ChainFeed, type OptionLeg,
} from "../lib/optionChainStream";
import { mark, measure } from "../lib/perf";

const DARK = {
  bg:           "#0d1117",
  card:         "rgba(22,27,34,0.9)",
  cardSolid:    "#161b22",
  border:       "rgba(255,255,255,0.07)",
  borderMid:    "rgba(255,255,255,0.12)",
  text:         "#e6edf3",
  textMuted:    "#8b949e",
  textDim:      "#6e7681",
  textBody:     "#c9d1d9",
  headerBar:    "rgba(13,17,23,0.95)",
};

const LIGHT = {
  bg:           "#f0f4f8",
  card:         "rgba(255,255,255,0.95)",
  cardSolid:    "#ffffff",
  border:       "rgba(0,0,0,0.08)",
  borderMid:    "rgba(0,0,0,0.12)",
  text:         "#0f172a",
  textMuted:    "#64748b",
  textDim:      "#94a3b8",
  textBody:     "#334155",
  headerBar:    "rgba(240,244,248,0.97)",
};

type OrderSide = "BUY" | "SELL";
interface OrderTicket {
  strike: number;
  optionType: "CE" | "PE";
  side: OrderSide;
}

type Theme = typeof DARK;
type OnOrder = (strike: number, optionType: "CE" | "PE", side: OrderSide, leg: OptionLeg | undefined) => void;

// Display rule from the backend contract: a null price/IV is "none" and
// shows "–". Never substitute spot or any other value.
const NONE = "–";
const fmtOi = (n: number | null | undefined) => (n != null ? n.toLocaleString("en-IN") : NONE);
const fmtIv = (n: number | null | undefined) => (n != null ? (n * 100).toFixed(1) : NONE);
const fmtPx = (n: number | null | undefined) => (n != null ? `₹${n.toFixed(2)}` : NONE);

// LTP cell with a 300 ms green/red flash on change — a CSS class toggle on
// the DOM node, no extra React state.
function LtpCell({ leg, color, T }: { leg: OptionLeg | undefined; color: string; T: Theme }) {
  const ref = useRef<HTMLTableCellElement>(null);
  const prev = useRef<number | null | undefined>(leg?.ltp);
  const ltp = leg?.ltp;

  useEffect(() => {
    const el = ref.current;
    const before = prev.current;
    prev.current = ltp;
    if (!el || ltp == null || before == null || ltp === before) return;
    el.classList.remove("tick-up", "tick-down");
    void el.offsetWidth; // restart the animation
    el.classList.add(ltp > before ? "tick-up" : "tick-down");
  }, [ltp]);

  const stale = !!leg?.ltp_stale;
  return (
    <td
      ref={ref}
      title={stale ? "No trade today" : undefined}
      style={{ padding: "8px", color: stale ? T.textDim : color, fontWeight: 700, borderBottom: `1px solid ${T.border}`, textAlign: "center" }}
    >
      {fmtPx(ltp)}
      {stale && (leg?.bid != null || leg?.ask != null) && (
        <div style={{ fontSize: "9px", fontWeight: 500, color: T.textDim }}>
          {fmtPx(leg?.bid)} / {fmtPx(leg?.ask)}
        </div>
      )}
    </td>
  );
}

// One side (CE or PE) of a strike row. Subscribes to a single token, so a
// tick on that leg re-renders these four cells and nothing else.
function LegCells({ feed, token, side, strike, underlyingDisplay, onOrder, T }: {
  feed: ChainFeed | null; token: string | null; side: "CE" | "PE"; strike: number;
  underlyingDisplay: string; onOrder: OnOrder; T: Theme;
}) {
  const leg = useLeg(feed, token);
  const cell = { padding: "8px", color: T.textDim, borderBottom: `1px solid ${T.border}`, textAlign: "center" as const };

  const order = (
    <td style={{ padding: "6px 4px", borderBottom: `1px solid ${T.border}`, textAlign: "center" }}>
      {leg ? (
        <div style={{ display: "flex", gap: "4px", justifyContent: "center" }}>
          <button
            onClick={() => onOrder(strike, side, "BUY", feed?.getLeg(token))}
            title={`Buy ${underlyingDisplay} ${strike} ${side}`}
            style={{
              padding: "4px 8px", fontSize: "10px", fontWeight: 700, borderRadius: "5px",
              background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.4)",
              color: "#22c55e", cursor: "pointer",
            }}
          >
            Buy
          </button>
          <button
            onClick={() => onOrder(strike, side, "SELL", feed?.getLeg(token))}
            title={`Sell ${underlyingDisplay} ${strike} ${side}`}
            style={{
              padding: "4px 8px", fontSize: "10px", fontWeight: 700, borderRadius: "5px",
              background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)",
              color: "#ef4444", cursor: "pointer",
            }}
          >
            Sell
          </button>
        </div>
      ) : (
        <span style={{ color: T.textDim, fontSize: "10px" }}>No quote</span>
      )}
    </td>
  );
  const ltp = <LtpCell leg={leg} color={side === "CE" ? "#22c55e" : "#ef4444"} T={T} />;
  const iv = <td style={cell}>{fmtIv(leg?.iv)}</td>;
  const oi = <td style={cell}>{fmtOi(leg?.oi)}</td>;

  return side === "CE"
    ? <>{oi}{iv}{ltp}{order}</>
    : <>{order}{ltp}{iv}{oi}</>;
}

// Re-renders only when its own props change (ATM moving, theme) — never on
// a price tick; ticks go straight to LegCells.
const StrikeRow = memo(function StrikeRow({ feed, strike, ceToken, peToken, isAtm, underlyingDisplay, onOrder, T }: {
  feed: ChainFeed | null; strike: number; ceToken: string | null; peToken: string | null;
  isAtm: boolean; underlyingDisplay: string; onOrder: OnOrder; T: Theme;
}) {
  return (
    <tr style={{ background: isAtm ? "rgba(59,130,246,0.06)" : "transparent" }}>
      <LegCells feed={feed} token={ceToken} side="CE" strike={strike} underlyingDisplay={underlyingDisplay} onOrder={onOrder} T={T} />
      <td style={{
        padding: "8px 12px", color: isAtm ? "#3b82f6" : T.text, fontWeight: 700,
        borderBottom: `1px solid ${T.border}`, textAlign: "center", background: T.card,
        borderLeft: `1px solid ${T.border}`, borderRight: `1px solid ${T.border}`,
      }}>
        {strike.toLocaleString("en-IN")}
        {isAtm && <div style={{ fontSize: "8px", color: "#3b82f6", fontWeight: 700 }}>ATM</div>}
      </td>
      <LegCells feed={feed} token={peToken} side="PE" strike={strike} underlyingDisplay={underlyingDisplay} onOrder={onOrder} T={T} />
    </tr>
  );
});

// Header spot/change% from the shared indices stream. Its own component so
// index ticks re-render this block only, not the chain table.
function LiveSpot({ symbolKey, fallback, T }: { symbolKey: string; fallback: IndexData; T: Theme }) {
  const variants = INDEX_MATCH_VARIANTS[symbolKey] ?? [symbolKey];
  const live = useIndicesSelector(s => findIndex(s.indices, variants));
  const value = live?.value ?? fallback.value;
  const change = live?.change ?? fallback.change;
  const changePct = live?.change_pct ?? fallback.change_pct;
  const isUp = change >= 0;
  const changeColor = isUp ? "#22c55e" : "#ef4444";
  return (
    <div style={{ textAlign: "right" }}>
      <div style={{ fontSize: "18px", fontWeight: 700, color: T.text }}>
        ₹{value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
      </div>
      <div style={{ fontSize: "12px", fontWeight: 600, color: changeColor }}>
        {isUp ? "+" : ""}{change.toFixed(2)} ({isUp ? "+" : ""}{changePct.toFixed(2)}%)
      </div>
    </div>
  );
}

export default function OptionChain() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isDark, setIsDark] = useState(() => localStorage.getItem("theme") !== "light");
  const T = isDark ? DARK : LIGHT;

  const indexData: IndexData = (location.state as any)?.indexData ?? {
    name: "NIFTY 50",
    symbol: "NIFTY",
    value: 24320.00,
    change: 2.30,
    change_pct: 0.01,
  };

  const symbolKey = normalizeName(indexData.symbol || "");
  const underlyingDisplay = UNDERLYING_DISPLAY[symbolKey] ?? indexData.symbol;
  const lotSize = LOT_SIZE_MAP[symbolKey] ?? DEFAULT_LOT_SIZE;
  const strikeStep = STRIKE_STEP_MAP[symbolKey] ?? DEFAULT_STRIKE_STEP;

  // The real live option chain (real LTP/OI/IV per strike, ~20 strikes each
  // side of spot), from the shared delta-protocol feed in
  // src/lib/optionChainStream.ts. This component only subscribes to the
  // row layout and status; prices are subscribed per cell (LegCells). No
  // synthetic fallback — if this underlying isn't supported or the stream
  // has nothing yet, chainStatus reflects that honestly.
  const slug = SUPPORTED_UNDERLYING_SLUGS[symbolKey];
  const feed = useMemo(() => (slug ? getChainFeed(slug) : null), [slug]);
  useChainFeed(feed);
  const strikes = useChainMeta(feed, m => m.rows);
  const chainStatus = useChainMeta(feed, m => (slug ? m.status : "unavailable"));
  const errorReason = useChainMeta(feed, m => m.errorReason);
  const chainExpiry = useChainMeta(feed, m => m.exp);
  // ATM from the chain's own spot (the exact spot the backend priced with);
  // a primitive, so spot ticks that don't move ATM don't re-render.
  const chainAtm = useChainMeta(feed, m => (m.spot != null ? Math.round(m.spot / strikeStep) * strikeStep : null));
  const atmStrike = chainAtm ?? Math.round(indexData.value / strikeStep) * strikeStep;

  const chainErrorMessage = !slug
    ? `Live option chain isn't available for ${indexData.symbol} yet.`
    : errorReason === "no_option_data" || errorReason === "no_expiry_available"
    ? "No option chain data is available for this expiry right now."
    : errorReason === "initialization_failed" || errorReason === "option_chain_failed"
    ? "The live option chain couldn't be started. Please try again shortly."
    : null;

  // From the shared indices stream, so we can tell "market's closed, there's
  // genuinely no live session right now" apart from "connection dropped,
  // retrying" — those are very different situations and shouldn't share a
  // perpetual "Reconnecting…" message.
  const marketStatus = useIndicesSelector(s => s.marketStatus);
  const marketClosed = marketStatus === "closed";

  const expiryDisplay = chainExpiry ? isoExpiryToDisplay(chainExpiry) : CURRENT_EXPIRY;

  // Perf (localStorage.perf = "1"): first rows on screen.
  const firstPaintDone = useRef(false);
  useLayoutEffect(() => {
    if (firstPaintDone.current || strikes.length === 0) return;
    firstPaintDone.current = true;
    mark("chain:first-paint");
    measure("chain first-msg→first-paint", "chain:first-msg");
    measure("chain click→first-paint", "chain:click");
  }, [strikes.length]);

  const [orderTicket, setOrderTicket] = useState<OrderTicket | null>(null);
  const [orderQtyLots, setOrderQtyLots] = useState(1);
  const [orderType, setOrderType] = useState<"MARKET" | "LIMIT">("LIMIT");
  const [orderProductType, setOrderProductType] = useState<"MIS" | "NRML">("MIS");
  const [orderPrice, setOrderPrice] = useState(0);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [orderResult, setOrderResult] = useState<{
    orderId: number;
    status: string;
    message: string;
    brokerOrderId?: string;
    matchedQty?: number;
    remainingQty?: number;
    tradeId?: number;
  } | null>(null);

  // Stable (only calls state setters) so memoized rows never re-render for it.
  const openOrderTicket = useCallback<OnOrder>((strike, optionType, side, leg) => {
    // Prefill with the leg's own price only (LTP, else the side you'd cross);
    // no quote at all leaves it blank rather than inventing one.
    const premium = leg?.ltp ?? (side === "BUY" ? leg?.ask : leg?.bid) ?? 0;
    setOrderTicket({ strike, optionType, side });
    setOrderQtyLots(1);
    setOrderType("LIMIT");
    setOrderProductType("MIS");
    setOrderPrice(Math.round(premium * 100) / 100);
    setOrderError(null);
    setOrderResult(null);
  }, []);

  // Live quote for the leg in the open order ticket (null token = no ticket).
  const ticketRow = orderTicket ? strikes.find(r => r.strike === orderTicket.strike) : undefined;
  const ticketLeg = useLeg(feed, ticketRow ? (orderTicket!.optionType === "CE" ? ticketRow.ceToken : ticketRow.peToken) : null);

  function closeOrderTicket() {
    setOrderTicket(null);
    setOrderError(null);
    setOrderResult(null);
    setIsSubmittingOrder(false);
  }

  async function placeOrder() {
    if (!orderTicket) return;
    if (orderType === "LIMIT" && (!orderPrice || orderPrice <= 0)) {
      setOrderError("Enter a valid limit price.");
      return;
    }

    const symbol = buildOptionSymbol(underlyingDisplay, expiryDisplay, orderTicket.strike, orderTicket.optionType);
    const payload: Record<string, unknown> = {
      symbol,
      exchange: "NFO",
      side: orderTicket.side,
      quantity: orderQtyLots * lotSize,
      order_type: orderType,
      product_type: orderProductType,
      validity: "DAY",
      client_order_id: `FNO-${Date.now()}`,
    };
    if (orderType === "LIMIT") payload.price = orderPrice;

    setOrderError(null);
    setIsSubmittingOrder(true);
    try {
      // Live production trading: real order placed on the Shoonya broker
      // account (F&O only), not the internal simulator. Replaces the old
      // simulated flow below, kept for reference:
      //
      // const res = await fetch(`${BASE_URL}/orders`, {
      //   method: "POST",
      //   headers: {
      //     "Content-Type": "application/json",
      //     Authorization: `Bearer ${localStorage.getItem("authToken")}`,
      //   },
      //   body: JSON.stringify(payload),
      // });
      // const body = await res.json();
      // if (!res.ok || !body?.success) {
      //   setOrderError(extractErrorMessage(body, "Order could not be placed. Please try again."));
      //   return;
      // }
      // const exec = body.execution ?? {};
      // setOrderResult({
      //   orderId: body.order_id,
      //   status: exec.status ?? "PENDING",
      //   message: exec.message ?? "Order submitted",
      //   matchedQty: exec.matched_quantity,
      //   remainingQty: exec.remaining_quantity,
      //   tradeId: exec.trade_id,
      // });

      const res = await fetch(`${BASE_URL}/createLiveOrder`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
        body: JSON.stringify(payload),
      });

      // 202 means the broker call timed out / gave an unexpected response —
      // the order may have actually gone through. This is NOT a failure, but
      // resubmitting blindly risks placing a duplicate real order, so we
      // surface it as a distinct "uncertain" result (no retry action) rather
      // than routing it through the error banner, which stays editable.
      if (res.status === 202) {
        const body = await res.json().catch(() => ({} as any));
        setOrderResult({
          orderId: 0,
          status: "UNCERTAIN",
          message: extractErrorMessage(body, "Order was submitted but broker confirmation timed out — check your order book before retrying."),
        });
        return;
      }

      const body = await res.json();

      if (!res.ok || !body?.success) {
        setOrderError(extractErrorMessage(body, "Order could not be placed. Please try again."));
        return;
      }

      setOrderResult({
        orderId: body.order_id,
        brokerOrderId: body.broker_order_id,
        status: body.status ?? "PENDING",
        message: body.broker_order_id
          ? `Live order placed on the exchange (broker ref ${body.broker_order_id}).`
          : "Order submitted.",
      });
    } catch (e) {
      console.error("[OptionChain] order placement failed:", e);
      setOrderError("Network error — order was not placed. Please check your connection and try again.");
    } finally {
      setIsSubmittingOrder(false);
    }
  }

  useEffect(() => {
    if (!localStorage.getItem("authToken")) navigate("/", { replace: true });
  }, []);

  useEffect(() => {
    document.body.style.overflow = "auto";
    document.body.style.height = "auto";
    document.documentElement.style.overflow = "auto";
    document.documentElement.style.height = "auto";
    return () => {
      document.body.style.overflow = "";
      document.body.style.height = "";
      document.documentElement.style.overflow = "";
      document.documentElement.style.height = "";
    };
  }, []);

  useEffect(() => {
    document.body.style.backgroundColor = isDark ? "#0d1117" : "#f0f4f8";
    return () => { document.body.style.backgroundColor = ""; };
  }, [isDark]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: T.bg }}>
      <Header
        isDark={isDark}
        onToggleTheme={() => setIsDark(d => { const n = !d; localStorage.setItem("theme", n ? "dark" : "light"); return n; })}
      />

      <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>

        {/* ── Top Header ── */}
        <div style={{
          borderBottom: `1px solid ${T.border}`, background: T.headerBar,
          padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              onClick={() => navigate(-1)}
              style={{
                width: "32px", height: "32px", borderRadius: "8px",
                background: T.card, border: `1px solid ${T.border}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: T.textMuted,
              }}
              
            >
              <ChevronLeft size={18} />
            </button>

            <div>
              <div style={{ fontSize: "15px", fontWeight: 700, color: T.text }}>
                {indexData.name} Option Chain
              </div>
              <div style={{ fontSize: "11px", color: T.textMuted, display: "flex", alignItems: "center", gap: "6px" }}>
                NSE · Expiry {expiryDisplay}
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: "4px",
                  color: marketClosed ? T.textDim : chainStatus === "live" ? "#22c55e" : chainStatus === "reconnecting" ? "#f59e0b" : T.textDim,
                }}>
                  <RefreshCw size={11} />
                  {marketClosed
                    ? "Market closed"
                    : chainStatus === "live" ? "Live"
                    : chainStatus === "connecting" ? "Connecting…"
                    : chainStatus === "reconnecting" ? "Reconnecting…"
                    : "Unavailable"}
                </span>
              </div>
            </div>
          </div>

          <LiveSpot symbolKey={symbolKey} fallback={indexData} T={T} />
        </div>

        {/* ── Option Chain Table ── */}
        <div style={{ flex: 1, padding: "16px 20px", overflow: "auto" }}>
          <div style={{
            background: T.cardSolid, border: `1px solid ${T.borderMid}`, borderRadius: "14px",
            overflow: "hidden",
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr>
                  <th colSpan={4} style={{ position: "sticky", top: 0, zIndex: 2, padding: "10px", color: "#22c55e", background: "rgba(34,197,94,0.16)", fontSize: "12px", fontWeight: 700, borderBottom: `1px solid ${T.border}` }}>
                    CALLS
                  </th>
                  <th style={{ position: "sticky", top: 0, zIndex: 2, padding: "10px", color: T.text, background: T.cardSolid, fontSize: "12px", fontWeight: 700, borderBottom: `1px solid ${T.border}` }}>
                    STRIKE
                  </th>
                  <th colSpan={4} style={{ position: "sticky", top: 0, zIndex: 2, padding: "10px", color: "#ef4444", background: "rgba(239,68,68,0.16)", fontSize: "12px", fontWeight: 700, borderBottom: `1px solid ${T.border}` }}>
                    PUTS
                  </th>
                </tr>
                <tr style={{ color: T.textMuted, fontSize: "10px" }}>
                  <th style={{ padding: "6px 8px", fontWeight: 600, borderBottom: `1px solid ${T.border}` }}>OI</th>
                  <th style={{ padding: "6px 8px", fontWeight: 600, borderBottom: `1px solid ${T.border}` }}>IV%</th>
                  <th style={{ padding: "6px 8px", fontWeight: 600, borderBottom: `1px solid ${T.border}` }}>LTP</th>
                  <th style={{ padding: "6px 8px", fontWeight: 600, borderBottom: `1px solid ${T.border}` }}>Order</th>
                  <th style={{ padding: "6px 8px", fontWeight: 600, borderBottom: `1px solid ${T.border}` }}></th>
                  <th style={{ padding: "6px 8px", fontWeight: 600, borderBottom: `1px solid ${T.border}` }}>Order</th>
                  <th style={{ padding: "6px 8px", fontWeight: 600, borderBottom: `1px solid ${T.border}` }}>LTP</th>
                  <th style={{ padding: "6px 8px", fontWeight: 600, borderBottom: `1px solid ${T.border}` }}>IV%</th>
                  <th style={{ padding: "6px 8px", fontWeight: 600, borderBottom: `1px solid ${T.border}` }}>OI</th>
                </tr>
              </thead>
              <tbody>
                {strikes.map(r => (
                  <StrikeRow
                    key={r.strike}
                    feed={feed}
                    strike={r.strike}
                    ceToken={r.ceToken}
                    peToken={r.peToken}
                    isAtm={r.strike === atmStrike}
                    underlyingDisplay={underlyingDisplay}
                    onOrder={openOrderTicket}
                    T={T}
                  />
                ))}
              </tbody>
            </table>
            {strikes.length === 0 && (
              <div style={{ padding: "40px 20px", textAlign: "center" }}>
                <div style={{ fontSize: "14px", fontWeight: 700, color: T.textMuted, marginBottom: "6px" }}>
                  {marketClosed
                    ? "Market is closed"
                    : chainStatus === "unavailable"
                    ? (chainErrorMessage ?? "Live option chain isn't available for this underlying.")
                    : chainStatus === "connecting"
                    ? "Connecting to the live option chain…"
                    : "Waiting for option chain data…"}
                </div>
                <div style={{ fontSize: "12px", color: T.textDim }}>
                  {marketClosed
                    ? "The option chain is a live-only feed and has no data outside NSE trading hours (09:15–15:30 IST, Mon–Fri) — it'll resume automatically when the market reopens."
                    : chainStatus === "reconnecting"
                    ? "Reconnecting to the live feed — this updates automatically."
                    : null}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Order Ticket Modal ── */}
        {orderTicket && (() => {
          const premium = ticketLeg?.ltp ?? orderPrice;
          const effectivePrice = orderType === "MARKET" ? premium : orderPrice;
          const totalValue = effectivePrice * orderQtyLots * lotSize;
          const isBuy = orderTicket.side === "BUY";
          const sideColor = isBuy ? "#22c55e" : "#ef4444";

          return (
            <div
              style={{
                position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
                display: "flex", alignItems: "center", justifyContent: "center",
                zIndex: 200,
              }}
              onClick={closeOrderTicket}
            >
              <div
                onClick={e => e.stopPropagation()}
                style={{
                  width: "560px", maxWidth: "92vw", background: T.cardSolid,
                  border: `1px solid ${T.borderMid}`, borderRadius: "16px",
                  padding: "20px", display: "flex", flexDirection: "column", gap: "16px",
                  boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
                }}
              >
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: "15px", fontWeight: 700, color: T.text }}>
                      {underlyingDisplay} {orderTicket.strike} {orderTicket.optionType}
                    </div>
                    <div style={{ fontSize: "11px", color: T.textMuted }}>Expiry: {expiryDisplay} · NSE</div>
                  </div>
                  <button
                    onClick={closeOrderTicket}
                    style={{
                      width: "28px", height: "28px", borderRadius: "8px",
                      background: T.card, border: `1px solid ${T.border}`, color: T.textMuted,
                      cursor: "pointer", fontSize: "14px",
                    }}
                  >
                    ✕
                  </button>
                </div>

                {orderResult ? (
                  /* ── Confirmation view ── */
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", padding: "12px 0" }}>
                    <div style={{
                      width: "48px", height: "48px", borderRadius: "50%",
                      background: orderResult.status === "EXECUTED" ? "rgba(34,197,94,0.15)"
                        : orderResult.status === "PARTIALLY_EXECUTED" ? "rgba(59,130,246,0.15)"
                        : orderResult.status === "UNCERTAIN" ? "rgba(245,158,11,0.15)" : "rgba(245,158,11,0.15)",
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px",
                    }}>
                      {orderResult.status === "EXECUTED" ? "✓"
                        : orderResult.status === "PARTIALLY_EXECUTED" ? "◐"
                        : orderResult.status === "UNCERTAIN" ? "⚠"
                        : "⏳"}
                    </div>
                    <div style={{ fontSize: "15px", fontWeight: 700, color: T.text, textAlign: "center" }}>
                      {orderResult.status === "EXECUTED" && "Order Executed"}
                      {orderResult.status === "PARTIALLY_EXECUTED" && "Order Partially Executed"}
                      {orderResult.status === "PENDING" && "Live Order Placed"}
                      {orderResult.status === "UNCERTAIN" && "Order Status Uncertain"}
                    </div>
                    <div style={{ fontSize: "12px", color: T.textMuted, textAlign: "center" }}>{orderResult.message}</div>
                    {orderResult.status === "UNCERTAIN" && (
                      <div style={{
                        fontSize: "11px", color: "#f59e0b", textAlign: "center", background: "rgba(245,158,11,0.08)",
                        border: "1px solid rgba(245,158,11,0.25)", borderRadius: "8px", padding: "8px 10px",
                      }}>
                        Don't resubmit — check your order book before placing this order again.
                      </div>
                    )}
                    <div style={{
                      width: "100%", background: T.card, border: `1px solid ${T.border}`, borderRadius: "10px",
                      padding: "12px", fontSize: "12px", color: T.textBody, display: "flex", flexDirection: "column", gap: "6px",
                    }}>
                      {orderResult.orderId > 0 && (
                        <div style={{ display: "flex", justifyContent: "space-between" }}><span>Order ID</span><span style={{ fontWeight: 700, color: T.text }}>{orderResult.orderId}</span></div>
                      )}
                      <div style={{ display: "flex", justifyContent: "space-between" }}><span>{orderTicket.side} · {underlyingDisplay} {orderTicket.strike} {orderTicket.optionType}</span></div>
                      {orderResult.brokerOrderId != null && (
                        <div style={{ display: "flex", justifyContent: "space-between" }}><span>Broker Order ID</span><span style={{ fontWeight: 700, color: T.text }}>{orderResult.brokerOrderId}</span></div>
                      )}
                      {orderResult.tradeId != null && (
                        <div style={{ display: "flex", justifyContent: "space-between" }}><span>Trade ID</span><span style={{ fontWeight: 700, color: T.text }}>{orderResult.tradeId}</span></div>
                      )}
                      {orderResult.matchedQty != null && (
                        <div style={{ display: "flex", justifyContent: "space-between" }}><span>Matched Qty</span><span style={{ fontWeight: 700, color: "#22c55e" }}>{orderResult.matchedQty}</span></div>
                      )}
                      {orderResult.remainingQty != null && (
                        <div style={{ display: "flex", justifyContent: "space-between" }}><span>Remaining Qty</span><span style={{ fontWeight: 700, color: T.text }}>{orderResult.remainingQty}</span></div>
                      )}
                    </div>
                    <button
                      onClick={closeOrderTicket}
                      style={{
                        width: "100%", padding: "12px", fontSize: "14px", fontWeight: 700, borderRadius: "10px",
                        background: T.card, border: `1px solid ${T.border}`, color: T.text, cursor: "pointer", marginTop: "4px",
                      }}
                    >
                      Done
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Body: left = buy/sell + description, right = qty/price */}
                    <div style={{ display: "flex", gap: "20px" }}>

                      {/* Left column */}
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button
                            onClick={() => setOrderTicket(t => t && { ...t, side: "BUY" })}
                            style={{
                              flex: 1, padding: "8px", fontSize: "12px", fontWeight: 700,
                              background: isBuy ? "rgba(34,197,94,0.15)" : T.card,
                              border: `1px solid ${isBuy ? "#22c55e" : T.border}`,
                              borderRadius: "8px", color: isBuy ? "#22c55e" : T.textMuted, cursor: "pointer",
                            }}
                          >
                            BUY
                          </button>
                          <button
                            onClick={() => setOrderTicket(t => t && { ...t, side: "SELL" })}
                            style={{
                              flex: 1, padding: "8px", fontSize: "12px", fontWeight: 700,
                              background: !isBuy ? "rgba(239,68,68,0.15)" : T.card,
                              border: `1px solid ${!isBuy ? "#ef4444" : T.border}`,
                              borderRadius: "8px", color: !isBuy ? "#ef4444" : T.textMuted, cursor: "pointer",
                            }}
                          >
                            SELL
                          </button>
                        </div>

                        <div style={{
                          fontSize: "13px", lineHeight: 1.6, color: T.textBody,
                          background: T.card, border: `1px solid ${T.border}`, borderRadius: "10px", padding: "12px",
                        }}>
                          You are{" "}
                          <span style={{ fontWeight: 700, color: sideColor }}>{isBuy ? "BUYING" : "SELLING"}</span>
                          {" "}{orderQtyLots} lot{orderQtyLots !== 1 ? "s" : ""} ({(orderQtyLots * lotSize).toLocaleString("en-IN")} qty) of{" "}
                          <span style={{ fontWeight: 700, color: T.text }}>
                            {underlyingDisplay} {orderTicket.strike} {orderTicket.optionType}
                          </span>
                          {" "}{orderType === "MARKET" ? "at market price" : <>at ₹{orderPrice.toFixed(2)} per unit</>}, expiring {expiryDisplay}.
                        </div>

                        <div>
                          <label style={{ fontSize: "11px", color: T.textMuted }}>Product</label>
                          <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                            {(["MIS", "NRML"] as const).map(pt => (
                              <button
                                key={pt}
                                onClick={() => setOrderProductType(pt)}
                                style={{
                                  flex: 1, padding: "6px", fontSize: "11px", fontWeight: 600,
                                  background: orderProductType === pt ? "rgba(139,92,246,0.15)" : T.card,
                                  border: `1px solid ${orderProductType === pt ? "#8b5cf6" : T.border}`,
                                  borderRadius: "6px", color: orderProductType === pt ? "#8b5cf6" : T.textMuted, cursor: "pointer",
                                }}
                              >
                                {pt}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Right column */}
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "10px" }}>
                        <div style={{ fontSize: "11px", color: T.textMuted }}>
                          Lot Size: <span style={{ fontWeight: 700, color: T.text }}>{lotSize}</span>
                          {" "}· Min Qty: <span style={{ fontWeight: 700, color: T.text }}>1 lot ({lotSize})</span>
                        </div>

                        <div>
                          <label style={{ fontSize: "11px", color: T.textMuted }}>Quantity (lots)</label>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                            <button
                              onClick={() => setOrderQtyLots(q => Math.max(1, q - 1))}
                              style={{ width: "28px", height: "28px", borderRadius: "8px", background: T.card, border: `1px solid ${T.border}`, color: T.text, cursor: "pointer" }}
                            >
                              −
                            </button>
                            <span style={{ fontSize: "14px", fontWeight: 700, color: T.text, minWidth: "24px", textAlign: "center" }}>
                              {orderQtyLots}
                            </span>
                            <button
                              onClick={() => setOrderQtyLots(q => q + 1)}
                              style={{ width: "28px", height: "28px", borderRadius: "8px", background: T.card, border: `1px solid ${T.border}`, color: T.text, cursor: "pointer" }}
                            >
                              +
                            </button>
                            <span style={{ fontSize: "11px", color: T.textDim }}>= {(orderQtyLots * lotSize).toLocaleString("en-IN")} qty</span>
                          </div>
                        </div>

                        <div>
                          <label style={{ fontSize: "11px", color: T.textMuted }}>Order Type</label>
                          <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                            {(["LIMIT", "MARKET"] as const).map(ot => (
                              <button
                                key={ot}
                                onClick={() => setOrderType(ot)}
                                style={{
                                  flex: 1, padding: "6px", fontSize: "11px", fontWeight: 600,
                                  background: orderType === ot ? "rgba(59,130,246,0.15)" : T.card,
                                  border: `1px solid ${orderType === ot ? "#3b82f6" : T.border}`,
                                  borderRadius: "6px", color: orderType === ot ? "#3b82f6" : T.textMuted, cursor: "pointer",
                                }}
                              >
                                {ot}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label style={{ fontSize: "11px", color: T.textMuted }}>Price {orderType === "MARKET" && "(at LTP)"}</label>
                          <input
                            type="number"
                            value={orderType === "MARKET" ? premium.toFixed(2) : orderPrice}
                            disabled={orderType === "MARKET"}
                            onChange={e => setOrderPrice(parseFloat(e.target.value) || 0)}
                            style={{
                              width: "100%", marginTop: "4px", padding: "8px 10px", fontSize: "13px", fontWeight: 600,
                              background: orderType === "MARKET" ? T.border : T.card, border: `1px solid ${T.border}`,
                              borderRadius: "8px", color: T.text, boxSizing: "border-box",
                            }}
                          />
                        </div>

                        <div style={{ fontSize: "12px", color: T.textMuted, display: "flex", justifyContent: "space-between", paddingTop: "4px", borderTop: `1px solid ${T.border}` }}>
                          <span>Order Value</span>
                          <span style={{ fontWeight: 700, color: T.text }}>₹{totalValue.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    </div>

                    {orderError && (
                      <div style={{
                        fontSize: "12px", color: "#ef4444", textAlign: "center", background: "rgba(239,68,68,0.08)",
                        border: "1px solid rgba(239,68,68,0.25)", borderRadius: "8px", padding: "8px",
                      }}>
                        {orderError}
                      </div>
                    )}

                    <button
                      onClick={placeOrder}
                      disabled={isSubmittingOrder}
                      style={{
                        padding: "12px", fontSize: "14px", fontWeight: 700, borderRadius: "10px",
                        background: isBuy ? "#22c55e" : "#ef4444", border: "none", color: "#fff",
                        cursor: isSubmittingOrder ? "not-allowed" : "pointer", opacity: isSubmittingOrder ? 0.7 : 1,
                      }}
                    >
                      {isSubmittingOrder ? "Placing Order…" : `Place ${orderTicket.side} Order`}
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })()}

      </main>

      <Footer isDark={isDark} />
    </div>
  );
}
