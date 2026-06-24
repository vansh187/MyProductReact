import {
  Search, User, Sun, Moon, Wallet, X, IndianRupee,
  BarChart2, TrendingUp, PieChart, Activity,
  Bookmark, FileText, RefreshCw, Layers, List,
  Briefcase, LogOut, Settings, ArrowUpRight, ChevronDown,
} from "lucide-react";
import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

declare global {
  interface Window { Razorpay: any; }
}

interface HeaderProps {
  isDark: boolean;
  onToggleTheme: () => void;
}

/* ── Nav data ─────────────────────────────────────────── */
const NAV_ITEMS = [
  {
    label: "Stocks",
    accent: "#3b82f6",
    sections: [
      { heading: "Trade", items: [
        { icon: BarChart2,  title: "Explore Stocks",  desc: "Browse real-time market data",       color: "#3b82f6" },
        { icon: TrendingUp, title: "Positions",        desc: "Track your open positions",          color: "#8b5cf6" },
        { icon: FileText,   title: "Orders",           desc: "Manage pending & executed orders",   color: "#f59e0b" },
      ]},
      { heading: "Portfolio", items: [
        { icon: Briefcase, title: "My Holdings",  desc: "View your stock portfolio",           color: "#10b981" },
        { icon: Bookmark,  title: "Watchlist",    desc: "Monitor your tracked stocks",         color: "#ec4899" },
      ]},
    ],
  },
  {
    label: "Mutual Funds",
    accent: "#10b981",
    sections: [
      { heading: "Discover", items: [
        { icon: PieChart,  title: "Explore Funds",  desc: "Browse top-rated mutual funds",      color: "#10b981" },
        { icon: Activity,  title: "Dashboard",       desc: "Portfolio overview & analytics",     color: "#3b82f6" },
      ]},
      { heading: "Invest", items: [
        { icon: RefreshCw, title: "SIP Manager",  desc: "Manage systematic investment plans",  color: "#8b5cf6" },
        { icon: Bookmark,  title: "Watchlist",    desc: "Track your favourite funds",          color: "#f59e0b" },
      ]},
    ],
  },
  {
    label: "F&O",
    accent: "#f59e0b",
    sections: [
      { heading: "Futures & Options", items: [
        { icon: Layers,     title: "Explore F&O",  desc: "Options & futures market overview",  color: "#f59e0b" },
        { icon: TrendingUp, title: "Positions",    desc: "All your active F&O positions",      color: "#3b82f6" },
        { icon: List,       title: "Orders",       desc: "F&O order book & history",           color: "#10b981" },
      ]},
    ],
  },
];

/* ── NavDropdown ──────────────────────────────────────── */
function NavDropdown({ label, accent, sections }: typeof NAV_ITEMS[0]) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => { if (timer.current) clearTimeout(timer.current); setOpen(true); };
  const hide = () => { timer.current = setTimeout(() => setOpen(false), 120); };

  return (
    <div style={{ position: "relative" }} onMouseEnter={show} onMouseLeave={hide}>
      {/* Trigger */}
      <button style={{
        display: "flex", alignItems: "center", gap: "5px",
        padding: "6px 12px", borderRadius: "8px", border: "none", cursor: "pointer",
        background: open ? "rgba(255,255,255,0.08)" : "transparent",
        color: open ? "#e6edf3" : "#c9d1d9",
        fontSize: "14px", fontWeight: 500,
        transition: "background 0.15s, color 0.15s",
      }}>
        {label}
        <ChevronDown style={{
          width: "13px", height: "13px",
          transform: open ? "rotate(180deg)" : "rotate(0deg)",
          transition: "transform 0.2s",
          color: "#8b949e",
        }} />
      </button>

      {/* Panel */}
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0,
          zIndex: 200, minWidth: "320px",
          background: "#161b22",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "14px",
          boxShadow: "0 16px 48px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)",
          padding: "6px",
          overflow: "hidden",
        }}>
          {/* Accent bar at top */}
          <div style={{ height: "2px", background: `linear-gradient(90deg, ${accent}, transparent)`, marginBottom: "6px", borderRadius: "2px" }} />

          {sections.map((section, si) => (
            <div key={si} style={{ marginBottom: si < sections.length - 1 ? "4px" : 0 }}>
              {/* Section heading */}
              <div style={{ padding: "4px 10px 6px", fontSize: "10px", fontWeight: 700, color: "#6e7681", textTransform: "uppercase", letterSpacing: "0.8px" }}>
                {section.heading}
              </div>

              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <a key={item.title} href="#" style={{ textDecoration: "none", display: "block" }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
                  >
                    <div style={{
                      display: "flex", alignItems: "center", gap: "12px",
                      padding: "9px 10px", borderRadius: "9px",
                      transition: "background 0.12s",
                    }}>
                      <div style={{
                        width: "34px", height: "34px", borderRadius: "9px", flexShrink: 0,
                        background: `${item.color}1a`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <Icon style={{ width: "16px", height: "16px", color: item.color }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "13px", fontWeight: 600, color: "#e6edf3", marginBottom: "2px" }}>{item.title}</div>
                        <div style={{ fontSize: "11px", color: "#8b949e", lineHeight: 1.4 }}>{item.desc}</div>
                      </div>
                      <ArrowUpRight style={{ width: "13px", height: "13px", color: "#8b949e", flexShrink: 0, opacity: 0.6 }} />
                    </div>
                  </a>
                );
              })}

              {si < sections.length - 1 && (
                <div style={{ height: "1px", background: "rgba(255,255,255,0.06)", margin: "4px 10px" }} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Header ───────────────────────────────────────────── */
export function Header({ isDark, onToggleTheme }: HeaderProps) {
  const navigate = useNavigate();
  const [walletOpen, setWalletOpen]     = useState(false);
  const [amount, setAmount]             = useState("");
  const [success, setSuccess]           = useState(false);
  const [loading, setLoading]           = useState(false);
  const [searchFocus, setSearchFocus]   = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  async function handleLogout() {
    try {
      const token = localStorage.getItem("authToken");
      if (token) {
        await fetch("http://localhost:8000/v1/logout", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        });
      }
    } catch {
      // backend unreachable — still clear client state and redirect
    } finally {
      localStorage.clear();
      sessionStorage.clear();
      // Clear any auth cookies by expiring them
      document.cookie.split(";").forEach(c => {
        document.cookie = c.trim().split("=")[0] + "=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/";
      });
      navigate("/");
    }
  }

  const BASE_URL = "https://my-product-backend-j1hu.onrender.com";

  function handleSessionExpired() {
    localStorage.clear();
    sessionStorage.clear();
    navigate("/");
  }

  async function fetchWalletBalance() {
    setBalanceLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/v1/getWalletBalance`, {
        method: "GET",
        headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
      });
      if (res.status === 401) { handleSessionExpired(); return; }
      if (!res.ok) throw new Error(`Failed to fetch balance (${res.status})`);
      const data = await res.json();
      // Accept balance from common response shapes
      const raw = data?.balance ?? data?.walletBalance ?? data?.wallet_balance ?? 0;
      setWalletBalance(Number(raw));
    } catch (err) {
      console.error("Wallet balance fetch error:", err);
      setWalletBalance(null);
    } finally {
      setBalanceLoading(false);
    }
  }

  const loadRazorpay = () =>
    new Promise((resolve) => {
      if (window.Razorpay) return resolve(true);
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.body.appendChild(s);
    });

  async function handleAddFunds() {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) return;
    setLoading(true);
    const loaded = await loadRazorpay();
    if (!loaded) { alert("Razorpay SDK failed to load. Are you online?"); setLoading(false); return; }
    try {
      // ── Step 1: Create order ──────────────────────────────
      const res = await fetch(`${BASE_URL}/v1/addFundsToWallet`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
        body: JSON.stringify({ amount, currency: "INR" }),
      });

      if (res.status === 401) { handleSessionExpired(); return; }
      if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText);
        throw new Error(`Order creation failed (${res.status}): ${errText}`);
      }

      const orderData = await res.json();
      console.log("Order data from backend:", orderData);

      // Guard: backend must return a valid razorpay_order
      if (!orderData?.razorpay_order?.id) {
        throw new Error("Server did not return a valid Razorpay order. Please try again.");
      }

      // ── Step 2: Open Razorpay checkout ───────────────────
      const options = {
        key: orderData.key,
        amount: orderData.amount,
        currency: "INR",
        name: "PrimePipTrade",
        order_id: orderData.razorpay_order.id,
        userId: orderData.userId,
        notes: { user_id: orderData.userId },

        // ── Step 3: Verify payment on success ─────────────
        handler: async (response: any) => {
          // Razorpay does not catch async handler errors — wrap everything
          try {
            console.log("Razorpay response:", response);
            const verifyRes = await fetch(`${BASE_URL}/v1/VerifyFundPayements`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${localStorage.getItem("authToken")}`,
              },
              body: JSON.stringify({
                razorpay_order_id: orderData.razorpay_order.id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            if (!verifyRes.ok) {
              throw new Error(`Verification request failed (${verifyRes.status})`);
            }

            const vResponse = await verifyRes.json();
            // Backend returns status as a string "200"
            if (String(vResponse.status) === "200") {
              setSuccess(true);
              fetchWalletBalance();
              setTimeout(() => { setSuccess(false); setAmount(""); setWalletOpen(false); }, 2500);
            } else {
              alert("Payment verification failed. Please contact support.");
            }
          } catch (handlerErr) {
            console.error("Verification error:", handlerErr);
            alert(
              `Payment processed but verification failed.\nPayment ID: ${response?.razorpay_payment_id ?? "unknown"}\nPlease contact support.`
            );
          }
        },

        theme: { color: "#3b82f6" },
      };

      const paymentObject = new window.Razorpay(options);
      paymentObject.open();
    } catch (err) {
      console.error("Payment error:", err);
      alert(err instanceof Error ? err.message : "Failed to initiate payment. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <header style={{
      background: isDark ? "rgba(13,17,23,0.95)" : "rgba(255,255,255,0.95)",
      borderBottom: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.08)",
      position: "sticky", top: 0, zIndex: 100,
      backdropFilter: "blur(16px)",
      WebkitBackdropFilter: "blur(16px)",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 28px", height: "62px",
        maxWidth: "1400px", margin: "0 auto",
      }}>

        {/* ══ LEFT: Logo + Nav ══ */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>

          {/* Logo */}
          <a href="/home" style={{ display: "flex", alignItems: "center", gap: "12px", textDecoration: "none", marginRight: "20px" }}>
            <svg width="34" height="34" viewBox="0 0 32 32" fill="none">
              <defs>
                <linearGradient id="hL1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#818cf8"/><stop offset="100%" stopColor="#6366f1"/></linearGradient>
                <linearGradient id="hL2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#60a5fa"/><stop offset="100%" stopColor="#3b82f6"/></linearGradient>
                <linearGradient id="hL3" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#38bdf8"/><stop offset="100%" stopColor="#0ea5e9"/></linearGradient>
              </defs>
              <rect x="4" y="18" width="6" height="10" rx="1.5" fill="url(#hL1)"/>
              <rect x="13" y="10" width="6" height="18" rx="1.5" fill="url(#hL2)"/>
              <rect x="22" y="4" width="6" height="24" rx="1.5" fill="url(#hL3)"/>
            </svg>
            <span style={{ fontSize: "20px", fontWeight: 800, letterSpacing: "-0.5px", whiteSpace: "nowrap", lineHeight: 1 }}>
              <span style={{ color: isDark ? "#e6edf3" : "#0f172a" }}>PrimePip</span>
              <span style={{ background: "linear-gradient(90deg,#60a5fa,#818cf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>Trade</span>
              <span style={{ color: isDark ? "#6e7681" : "#94a3b8", fontWeight: 500, fontSize: "15px" }}>.com</span>
            </span>
          </a>

          {/* Divider */}
          <div style={{ width: "1px", height: "20px", background: "rgba(255,255,255,0.1)", marginRight: "8px" }} />

          {/* Nav items */}
          {NAV_ITEMS.map(nav => (
            <NavDropdown key={nav.label} {...nav} />
          ))}
        </div>

        {/* ══ RIGHT: Search + Wallet + Theme + Profile ══ */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>

          {/* ── Search ── */}
          <div style={{
            display: "flex", alignItems: "center", gap: "8px",
            height: "36px", width: "220px", padding: "0 12px",
            background: "rgba(255,255,255,0.05)",
            border: `1px solid ${searchFocus ? "rgba(59,130,246,0.55)" : "rgba(255,255,255,0.1)"}`,
            borderRadius: "10px",
            boxShadow: searchFocus ? "0 0 0 3px rgba(59,130,246,0.1)" : "none",
            transition: "border-color 0.2s, box-shadow 0.2s",
          }}>
            <Search style={{ width: "14px", height: "14px", color: "#6e7681", flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search stocks, funds…"
              onFocus={() => setSearchFocus(true)}
              onBlur={() => setSearchFocus(false)}
              style={{
                flex: 1, background: "none", border: "none", outline: "none",
                color: "#e6edf3", fontSize: "13px",
                "::placeholder": { color: "#6e7681" },
              } as React.CSSProperties}
            />
            <kbd style={{
              fontSize: "10px", color: "#6e7681",
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "4px", padding: "1px 5px", flexShrink: 0, fontFamily: "inherit",
            }}>⌘K</kbd>
          </div>

          {/* ── Add Funds (Wallet) ── */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => {
                const opening = !walletOpen;
                setWalletOpen(opening);
                setSuccess(false);
                setAmount("");
                if (opening) fetchWalletBalance();
              }}
              style={{
                display: "flex", alignItems: "center", gap: "6px",
                height: "36px", padding: "0 14px",
                background: walletOpen
                  ? "linear-gradient(90deg,rgba(59,130,246,0.25),rgba(99,102,241,0.2))"
                  : "rgba(59,130,246,0.12)",
                border: `1px solid ${walletOpen ? "rgba(59,130,246,0.5)" : "rgba(59,130,246,0.25)"}`,
                borderRadius: "10px", cursor: "pointer",
                color: "#60a5fa", fontSize: "13px", fontWeight: 600,
                transition: "all 0.2s",
              }}
              onMouseEnter={e => { if (!walletOpen) (e.currentTarget as HTMLElement).style.background = "rgba(59,130,246,0.18)"; }}
              onMouseLeave={e => { if (!walletOpen) (e.currentTarget as HTMLElement).style.background = "rgba(59,130,246,0.12)"; }}
            >
              <Wallet style={{ width: "14px", height: "14px" }} />
              Add Funds
            </button>

            {walletOpen && (
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 150 }} onClick={() => setWalletOpen(false)} />
                <div style={{
                  position: "absolute", right: 0, top: "calc(100% + 8px)", zIndex: 200,
                  width: "304px",
                  background: "#161b22",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "16px",
                  boxShadow: "0 24px 64px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.03)",
                  overflow: "hidden",
                }}>
                  {/* Header */}
                  <div style={{
                    padding: "16px 18px",
                    background: "linear-gradient(135deg,rgba(59,130,246,0.14),rgba(99,102,241,0.08))",
                    borderBottom: "1px solid rgba(255,255,255,0.07)",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "11px" }}>
                      <div style={{
                        width: "38px", height: "38px", borderRadius: "10px",
                        background: "linear-gradient(135deg,#3b82f6,#6366f1)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        boxShadow: "0 4px 12px rgba(59,130,246,0.35)",
                      }}>
                        <Wallet style={{ width: "18px", height: "18px", color: "#fff" }} />
                      </div>
                      <div>
                        <div style={{ fontSize: "14px", fontWeight: 700, color: "#e6edf3", lineHeight: 1.2 }}>Add Funds</div>
                        <div style={{ fontSize: "11px", color: "#8b949e", marginTop: "1px" }}>Secured by Razorpay</div>
                      </div>
                    </div>
                    <button onClick={() => setWalletOpen(false)} style={{
                      width: "28px", height: "28px", borderRadius: "7px",
                      background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.08)",
                      cursor: "pointer", color: "#8b949e",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <X style={{ width: "13px", height: "13px" }} />
                    </button>
                  </div>

                  {/* Balance */}
                  <div style={{ padding: "14px 18px 0" }}>
                    <div style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.15)",
                      borderRadius: "10px", padding: "10px 14px",
                    }}>
                      <div>
                        <div style={{ fontSize: "10px", color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>Available Balance</div>
                        {balanceLoading ? (
                          <div style={{ height: "24px", width: "90px", borderRadius: "6px", background: "rgba(255,255,255,0.08)", animation: "pulse 1.5s ease-in-out infinite" }} />
                        ) : (
                          <div style={{ fontSize: "20px", fontWeight: 800, color: "#4ade80", letterSpacing: "-0.5px" }}>
                            {walletBalance !== null
                              ? `₹${walletBalance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : "—"}
                          </div>
                        )}
                      </div>
                      <div style={{
                        width: "34px", height: "34px", borderRadius: "8px",
                        background: "rgba(74,222,128,0.12)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <IndianRupee style={{ width: "16px", height: "16px", color: "#4ade80" }} />
                      </div>
                    </div>
                  </div>

                  {/* Body */}
                  <div style={{ padding: "14px 18px 18px", display: "flex", flexDirection: "column", gap: "12px" }}>

                    {/* Amount Input */}
                    <div>
                      <div style={{ fontSize: "11px", fontWeight: 600, color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: "7px" }}>
                        Enter Amount (INR)
                      </div>
                      <div style={{
                        display: "flex", alignItems: "center",
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: "10px", height: "46px", padding: "0 14px",
                        gap: "8px",
                      }}>
                        <span style={{ fontSize: "18px", color: "#60a5fa", fontWeight: 700, lineHeight: 1 }}>₹</span>
                        <input
                          type="number"
                          placeholder="0"
                          value={amount}
                          onChange={e => setAmount(e.target.value)}
                          onKeyDown={e => e.key === "Enter" && handleAddFunds()}
                          min={1}
                          style={{
                            flex: 1, background: "none", border: "none", outline: "none",
                            color: "#e6edf3", fontSize: "20px", fontWeight: 700, letterSpacing: "-0.5px",
                          }}
                        />
                        {amount && (
                          <button onClick={() => setAmount("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#6e7681", padding: 0 }}>
                            <X style={{ width: "13px", height: "13px" }} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Quick Amounts */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "6px" }}>
                      {[500, 1000, 5000, 10000].map(p => (
                        <button key={p} onClick={() => setAmount(String(p))} style={{
                          height: "32px", borderRadius: "8px",
                          background: amount === String(p) ? "rgba(59,130,246,0.22)" : "rgba(255,255,255,0.04)",
                          border: `1px solid ${amount === String(p) ? "rgba(59,130,246,0.5)" : "rgba(255,255,255,0.09)"}`,
                          color: amount === String(p) ? "#60a5fa" : "#8b949e",
                          fontSize: "12px", fontWeight: 600, cursor: "pointer",
                          transition: "all 0.15s",
                        }}>
                          ₹{p >= 1000 ? `${p / 1000}K` : p}
                        </button>
                      ))}
                    </div>

                    {/* CTA Button */}
                    <button
                      onClick={handleAddFunds}
                      disabled={success || loading || !amount}
                      style={{
                        height: "42px", borderRadius: "10px", border: "none",
                        background: success
                          ? "linear-gradient(90deg,#10b981,#059669)"
                          : "linear-gradient(90deg,#3b82f6,#6366f1)",
                        color: "#fff", fontWeight: 700, fontSize: "14px",
                        cursor: !amount || success || loading ? "not-allowed" : "pointer",
                        opacity: !amount && !success && !loading ? 0.55 : 1,
                        transition: "opacity 0.2s",
                        letterSpacing: "0.2px",
                      }}
                    >
                      {success ? "✓  Funds Added!" : loading ? "Processing…" : "Proceed to Pay"}
                    </button>

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                      <div style={{ height: "1px", flex: 1, background: "rgba(255,255,255,0.06)" }} />
                      <span style={{ fontSize: "10px", color: "#6e7681" }}>100% secure · Instant credit</span>
                      <div style={{ height: "1px", flex: 1, background: "rgba(255,255,255,0.06)" }} />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ── Theme Toggle ── */}
          <button
            onClick={onToggleTheme}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            style={{
              width: "36px", height: "36px", borderRadius: "10px",
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.2s",
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.09)"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"}
          >
            {isDark
              ? <Sun  style={{ width: "15px", height: "15px", color: "#fbbf24" }} />
              : <Moon style={{ width: "15px", height: "15px", color: "#818cf8" }} />}
          </button>

          {/* ── Profile ── */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button style={{
                width: "36px", height: "36px", borderRadius: "10px",
                background: "linear-gradient(135deg,#3b82f6,#6366f1)",
                border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 2px 8px rgba(59,130,246,0.3)",
              }}>
                <User style={{ width: "15px", height: "15px", color: "#fff" }} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-44 z-[300]"
              style={{ background: "#161b22", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", padding: "4px" }}
            >
              <DropdownMenuLabel style={{ color: "#8b949e", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.6px" }}>
                My Account
              </DropdownMenuLabel>
              <DropdownMenuSeparator style={{ background: "rgba(255,255,255,0.07)" }} />
              <DropdownMenuItem style={{ color: "#e6edf3", fontSize: "13px", borderRadius: "7px", padding: "8px 10px", cursor: "pointer", gap: "9px" }}>
                <Settings style={{ width: "14px", height: "14px", color: "#8b949e" }} />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator style={{ background: "rgba(255,255,255,0.07)" }} />
              <DropdownMenuItem
                onClick={handleLogout}
                style={{ color: "#f87171", fontSize: "13px", borderRadius: "7px", padding: "8px 10px", cursor: "pointer", gap: "9px" }}
              >
                <LogOut style={{ width: "14px", height: "14px" }} />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
