import { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Header } from "./header";
import { Footer } from "./footer";
import { ChevronLeft, RefreshCw } from "lucide-react";
import {
  BASE_URL, normalizeName, INDEX_MATCH_VARIANTS, UNDERLYING_DISPLAY,
  LOT_SIZE_MAP, DEFAULT_LOT_SIZE, STRIKE_STEP_MAP, DEFAULT_STRIKE_STEP,
  CURRENT_EXPIRY, SUPPORTED_UNDERLYING_SLUGS, buildOptionSymbol, extractErrorMessage,
  isoExpiryToDisplay,
  type MarketData, type IndexData, type OptionChainResponse,
} from "../lib/fno";

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

  // Live spot price + change%, kept fresh by the indices stream — used only
  // for the header ticker (the chain's own repricing uses chainData.spot,
  // the exact spot the backend used when it computed that snapshot).
  const [livePrice, setLivePrice] = useState({
    value: indexData.value,
    change: indexData.change,
    change_pct: indexData.change_pct,
  });
  // The real live option chain (real LTP/OI/IV per strike, ~20 strikes each
  // side of spot, pushed by the backend's Shoonya-backed stream). No
  // synthetic fallback — if this underlying isn't supported or the stream
  // has nothing yet, chainStatus reflects that honestly instead of showing
  // fake numbers.
  const [chainData, setChainData] = useState<OptionChainResponse | null>(null);
  const [chainStatus, setChainStatus] = useState<"connecting" | "live" | "reconnecting" | "unavailable">("connecting");
  const [chainErrorMessage, setChainErrorMessage] = useState<string | null>(null);
  // From the same indices stream, so we can tell "market's closed, there's
  // genuinely no live session right now" apart from "connection dropped,
  // retrying" — those are very different situations and shouldn't share a
  // perpetual "Reconnecting…" message.
  const [marketStatus, setMarketStatus] = useState<string | null>(null);
  const marketClosed = marketStatus === "closed";

  const strikes = chainData?.strikes ?? [];
  const spot = chainData?.spot ?? livePrice.value;
  const expiryDisplay = chainData?.expiry ? isoExpiryToDisplay(chainData.expiry) : CURRENT_EXPIRY;
  const atmStrike = useMemo(() => Math.round(spot / strikeStep) * strikeStep, [spot, strikeStep]);

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

  function openOrderTicket(strike: number, optionType: "CE" | "PE", side: OrderSide, premium: number) {
    setOrderTicket({ strike, optionType, side });
    setOrderQtyLots(1);
    setOrderType("LIMIT");
    setOrderProductType("MIS");
    setOrderPrice(Math.round(premium * 100) / 100);
    setOrderError(null);
    setOrderResult(null);
  }

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

  const isUp = livePrice.change >= 0;
  const changeColor = isUp ? "#22c55e" : "#ef4444";

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

  // Header ticker's spot/change% — separate from the option chain's own
  // spot (chainData.spot), since this endpoint carries day-level change%
  // that the option-chain stream doesn't.
  useEffect(() => {
    const matchVariants = INDEX_MATCH_VARIANTS[symbolKey] ?? [symbolKey];
    const es = new EventSource(`${BASE_URL}/api/market/indices/stream`);

    es.onmessage = (event) => {
      try {
        const data: MarketData = JSON.parse(event.data);
        setMarketStatus(data.market_status);
        const matchedIndex = data.indices.find(i => {
          const normalized = normalizeName(i.name || "");
          return matchVariants.some(v => normalized === v || normalized.includes(v));
        });
        if (!matchedIndex) return;
        setLivePrice({ value: matchedIndex.value, change: matchedIndex.change, change_pct: matchedIndex.change_pct });
      } catch (e) {
        console.error("[OptionChain] Stream parse error:", e);
      }
    };

    // Per EventSource semantics, the browser auto-reconnects on its own after
    // a drop — closing here would permanently kill that.
    es.onerror = () => {
      console.error("[OptionChain] Indices stream connection error — awaiting auto-reconnect");
    };

    return () => es.close();
  }, [symbolKey]);

  // The real live option chain. Backend contract:
  //  - sends the current snapshot immediately on connect
  //  - a new frame arrives only when data actually changes (event-driven,
  //    not a fixed poll interval)
  //  - on a Shoonya disconnect, exactly one frame with
  //    errors:[{reason:"shoonya_disconnected"}] arrives (last-known strikes
  //    still included, not wiped) then it goes quiet until reconnected
  //  - the browser's native EventSource reconnect handles connection drops;
  //    we must not call es.close() on error or that stops working
  useEffect(() => {
    const slug = SUPPORTED_UNDERLYING_SLUGS[symbolKey];
    if (!slug) {
      setChainStatus("unavailable");
      setChainErrorMessage(`Live option chain isn't available for ${indexData.symbol} yet.`);
      return;
    }

    setChainStatus("connecting");
    setChainErrorMessage(null);
    const es = new EventSource(`${BASE_URL}/api/market/${slug}/optionchain/stream`);

    es.onmessage = (event) => {
      try {
        const data: OptionChainResponse = JSON.parse(event.data);
        const errs = data.errors ?? [];
        const disconnected = errs.some(e => e.reason === "shoonya_disconnected");
        const noData = errs.some(e => e.reason === "no_option_data" || e.reason === "no_expiry_available");

        if (disconnected) {
          setChainStatus("reconnecting");
          if (Array.isArray(data.strikes) && data.strikes.length > 0) setChainData(data);
          return;
        }
        if (noData) {
          setChainStatus("unavailable");
          setChainErrorMessage("No option chain data is available for this expiry right now.");
          return;
        }

        setChainData(data);
        setChainStatus("live");
        setChainErrorMessage(null);
      } catch (e) {
        console.error("[OptionChain] chain stream parse error:", e);
      }
    };

    es.onerror = () => {
      console.error("[OptionChain] chain stream connection error — awaiting auto-reconnect");
      setChainStatus("reconnecting");
    };

    return () => es.close();
  }, [symbolKey, indexData.symbol]);

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

          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "18px", fontWeight: 700, color: T.text }}>
              ₹{livePrice.value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: "12px", fontWeight: 600, color: changeColor }}>
              {isUp ? "+" : ""}{livePrice.change.toFixed(2)} ({isUp ? "+" : ""}{livePrice.change_pct.toFixed(2)}%)
            </div>
          </div>
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
                {strikes.map(({ strike, ce, pe }) => {
                  const isAtm = strike === atmStrike;
                  return (
                    <tr key={strike} style={{ background: isAtm ? "rgba(59,130,246,0.06)" : "transparent" }}>
                      <td style={{ padding: "8px", color: T.textDim, borderBottom: `1px solid ${T.border}`, textAlign: "center" }}>
                        {ce?.oi != null ? ce.oi.toLocaleString("en-IN") : "-"}
                      </td>
                      <td style={{ padding: "8px", color: T.textDim, borderBottom: `1px solid ${T.border}`, textAlign: "center" }}>
                        {ce?.iv != null ? (ce.iv * 100).toFixed(1) : "-"}
                      </td>
                      <td style={{ padding: "8px", color: "#22c55e", fontWeight: 700, borderBottom: `1px solid ${T.border}`, textAlign: "center" }}>
                        {ce?.ltp != null ? `₹${ce.ltp.toFixed(2)}` : "-"}
                      </td>
                      <td style={{ padding: "6px 4px", borderBottom: `1px solid ${T.border}`, textAlign: "center" }}>
                        {ce ? (
                          <div style={{ display: "flex", gap: "4px", justifyContent: "center" }}>
                            <button
                              onClick={() => openOrderTicket(strike, "CE", "BUY", ce.ltp)}
                              title={`Buy ${underlyingDisplay} ${strike} CE`}
                              style={{
                                padding: "4px 8px", fontSize: "10px", fontWeight: 700, borderRadius: "5px",
                                background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.4)",
                                color: "#22c55e", cursor: "pointer",
                              }}
                            >
                              Buy
                            </button>
                            <button
                              onClick={() => openOrderTicket(strike, "CE", "SELL", ce.ltp)}
                              title={`Sell ${underlyingDisplay} ${strike} CE`}
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
                      <td style={{
                        padding: "8px 12px", color: isAtm ? "#3b82f6" : T.text, fontWeight: 700,
                        borderBottom: `1px solid ${T.border}`, textAlign: "center", background: T.card,
                        borderLeft: `1px solid ${T.border}`, borderRight: `1px solid ${T.border}`,
                      }}>
                        {strike.toLocaleString("en-IN")}
                        {isAtm && <div style={{ fontSize: "8px", color: "#3b82f6", fontWeight: 700 }}>ATM</div>}
                      </td>
                      <td style={{ padding: "6px 4px", borderBottom: `1px solid ${T.border}`, textAlign: "center" }}>
                        {pe ? (
                          <div style={{ display: "flex", gap: "4px", justifyContent: "center" }}>
                            <button
                              onClick={() => openOrderTicket(strike, "PE", "BUY", pe.ltp)}
                              title={`Buy ${underlyingDisplay} ${strike} PE`}
                              style={{
                                padding: "4px 8px", fontSize: "10px", fontWeight: 700, borderRadius: "5px",
                                background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.4)",
                                color: "#22c55e", cursor: "pointer",
                              }}
                            >
                              Buy
                            </button>
                            <button
                              onClick={() => openOrderTicket(strike, "PE", "SELL", pe.ltp)}
                              title={`Sell ${underlyingDisplay} ${strike} PE`}
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
                      <td style={{ padding: "8px", color: "#ef4444", fontWeight: 700, borderBottom: `1px solid ${T.border}`, textAlign: "center" }}>
                        {pe?.ltp != null ? `₹${pe.ltp.toFixed(2)}` : "-"}
                      </td>
                      <td style={{ padding: "8px", color: T.textDim, borderBottom: `1px solid ${T.border}`, textAlign: "center" }}>
                        {pe?.iv != null ? (pe.iv * 100).toFixed(1) : "-"}
                      </td>
                      <td style={{ padding: "8px", color: T.textDim, borderBottom: `1px solid ${T.border}`, textAlign: "center" }}>
                        {pe?.oi != null ? pe.oi.toLocaleString("en-IN") : "-"}
                      </td>
                    </tr>
                  );
                })}
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
          const quote = strikes.find(o => o.strike === orderTicket.strike);
          const leg = quote ? (orderTicket.optionType === "CE" ? quote.ce : quote.pe) : null;
          const premium = leg ? leg.ltp : orderPrice;
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
