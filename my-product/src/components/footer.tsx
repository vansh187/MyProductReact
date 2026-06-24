import { Mail, Phone, MapPin, Globe, Play, Share2, Camera, Shield, ChevronRight } from "lucide-react";

const DARK = {
  bg:           "#0d1117",
  bgTop:        "transparent",
  card:         "rgba(22,27,34,0.8)",
  border:       "rgba(255,255,255,0.07)",
  borderBar:    "rgba(255,255,255,0.06)",
  borderBottom: "rgba(255,255,255,0.05)",
  text:         "#e6edf3",
  textMuted:    "#8b949e",
  textDim:      "#6e7681",
  textBody:     "#c9d1d9",
  socialBg:     "rgba(255,255,255,0.05)",
  socialBorder: "rgba(255,255,255,0.08)",
  trustBg:      "rgba(0,0,0,0.2)",
};

const LIGHT = {
  bg:           "#f0f4f8",
  bgTop:        "transparent",
  card:         "#ffffff",
  border:       "rgba(0,0,0,0.08)",
  borderBar:    "rgba(0,0,0,0.06)",
  borderBottom: "rgba(0,0,0,0.05)",
  text:         "#0f172a",
  textMuted:    "#64748b",
  textDim:      "#94a3b8",
  textBody:     "#334155",
  socialBg:     "rgba(0,0,0,0.04)",
  socialBorder: "rgba(0,0,0,0.1)",
  trustBg:      "rgba(0,0,0,0.03)",
};

const NAV = {
  products: [
    "Explore Stocks",
    "Mutual Funds",
    "Futures & Options",
    "Watchlist",
    "Portfolio",
    "SIP Manager",
  ],
  company: [
    { label: "About Us" },
    { label: "Careers", badge: "Hiring" },
    { label: "Blog" },
    { label: "Press" },
    { label: "Investor Relations" },
  ],
  legal: [
    "Privacy Policy",
    "Terms of Service",
    "Risk Disclosure",
    "Grievance Policy",
    "Cookie Policy",
  ],
};

const SOCIALS = [
  { icon: Share2, label: "Twitter / X" },
  { icon: Globe, label: "Website" },
  { icon: Play, label: "YouTube" },
  { icon: Camera, label: "Instagram" },
];

const TRUST_ITEMS = [
  { icon: Shield, label: "SEBI Registered", sub: "INZ000000000" },
  { icon: Shield, label: "NSE Member", sub: "90765" },
  { icon: Shield, label: "BSE Member", sub: "6789" },
  { icon: Shield, label: "AMFI Registered", sub: "ARN-000000" },
];

function FooterLink({ children, href = "#", T }: { children: React.ReactNode; href?: string; T: typeof DARK }) {
  return (
    <a
      href={href}
      style={{ color: T.textMuted, fontSize: "14px", textDecoration: "none", display: "flex", alignItems: "center", gap: "4px", lineHeight: 1.6 }}
      onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = T.text; }}
      onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = T.textMuted; }}
    >
      <ChevronRight style={{ width: "13px", height: "13px", opacity: 0.4, flexShrink: 0 }} />
      {children}
    </a>
  );
}

function ColHeading({ children, T }: { children: React.ReactNode; T: typeof DARK }) {
  return (
    <div style={{ marginBottom: "20px" }}>
      <h4 style={{ fontSize: "12px", fontWeight: 700, color: T.text, letterSpacing: "1.5px", textTransform: "uppercase", margin: "0 0 10px" }}>{children}</h4>
      <div style={{ width: "28px", height: "2px", background: "linear-gradient(90deg, #3b82f6, #8b5cf6)", borderRadius: "2px" }} />
    </div>
  );
}

export function Footer({ isDark }: { isDark: boolean }) {
  const T = isDark ? DARK : LIGHT;
  return (
    <footer style={{ background: T.bg, borderTop: `1px solid ${T.border}` }}>

      {/* ── MAIN GRID ── */}
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "64px 24px 48px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 1fr", gap: "48px", alignItems: "start" }}>

          {/* Brand column */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <defs>
                  <linearGradient id="fl1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#818cf8"/><stop offset="100%" stopColor="#6366f1"/></linearGradient>
                  <linearGradient id="fl2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#60a5fa"/><stop offset="100%" stopColor="#3b82f6"/></linearGradient>
                  <linearGradient id="fl3" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#38bdf8"/><stop offset="100%" stopColor="#0ea5e9"/></linearGradient>
                </defs>
                <rect x="4" y="18" width="6" height="10" rx="1.5" fill="url(#fl1)"/>
                <rect x="13" y="10" width="6" height="18" rx="1.5" fill="url(#fl2)"/>
                <rect x="22" y="4" width="6" height="24" rx="1.5" fill="url(#fl3)"/>
              </svg>
              <span style={{ fontWeight: 800, fontSize: "18px", color: T.text, letterSpacing: "-0.5px" }}>
                PrimePip<span style={{ color: "#60a5fa" }}>Trade</span>
                <span style={{ color: T.textMuted, fontWeight: 400, fontSize: "14px" }}>.com</span>
              </span>
            </div>

            <p style={{ fontSize: "14px", color: T.textMuted, lineHeight: 1.75, marginBottom: "28px", maxWidth: "280px" }}>
              India's most trusted platform for smarter trading in stocks, mutual funds, and F&O — powered by real‑time market intelligence.
            </p>

            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: "8px", padding: "8px 14px", marginBottom: "28px" }}>
              <Shield style={{ width: "14px", height: "14px", color: "#10b981" }} />
              <span style={{ fontSize: "12px", color: "#10b981", fontWeight: 600 }}>SEBI Regulated · AMFI Registered</span>
            </div>

            <div>
              <p style={{ fontSize: "11px", color: T.textDim, fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase", marginBottom: "12px" }}>Follow us</p>
              <div style={{ display: "flex", gap: "10px" }}>
                {SOCIALS.map(({ icon: Icon, label }) => (
                  <a key={label} href="#" title={label}
                    style={{ width: "36px", height: "36px", borderRadius: "10px", background: T.socialBg, border: `1px solid ${T.socialBorder}`, display: "flex", alignItems: "center", justifyContent: "center", color: T.textMuted, textDecoration: "none", transition: "all 0.2s" }}
                    onMouseEnter={e => { const el = e.currentTarget as HTMLAnchorElement; el.style.background = "rgba(59,130,246,0.15)"; el.style.borderColor = "rgba(59,130,246,0.35)"; el.style.color = "#60a5fa"; }}
                    onMouseLeave={e => { const el = e.currentTarget as HTMLAnchorElement; el.style.background = T.socialBg; el.style.borderColor = T.socialBorder; el.style.color = T.textMuted; }}
                  >
                    <Icon style={{ width: "15px", height: "15px" }} />
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Products */}
          <div>
            <ColHeading T={T}>Products</ColHeading>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
              {NAV.products.map(link => (
                <li key={link}><FooterLink T={T}>{link}</FooterLink></li>
              ))}
            </ul>
          </div>

          {/* Company + Legal */}
          <div>
            <ColHeading T={T}>Company</ColHeading>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
              {NAV.company.map(({ label, badge }) => (
                <li key={label}>
                  <FooterLink T={T}>
                    {label}
                    {badge && (
                      <span style={{ fontSize: "10px", fontWeight: 700, background: "rgba(59,130,246,0.15)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.25)", padding: "1px 7px", borderRadius: "100px", marginLeft: "4px" }}>
                        {badge}
                      </span>
                    )}
                  </FooterLink>
                </li>
              ))}
            </ul>
            <div style={{ marginTop: "32px" }}>
              <ColHeading T={T}>Legal</ColHeading>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
                {NAV.legal.map(link => (
                  <li key={link}><FooterLink T={T}>{link}</FooterLink></li>
                ))}
              </ul>
            </div>
          </div>

          {/* Contact */}
          <div>
            <ColHeading T={T}>Contact Us</ColHeading>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {[
                { icon: Mail,   label: "EMAIL",  color: "#60a5fa", bg: "rgba(59,130,246,0.12)",  content: <a href="mailto:support@primepiptrade.com" style={{ fontSize: "13px", color: T.textBody, textDecoration: "none" }}>support@primepiptrade.com</a> },
                { icon: Phone,  label: "PHONE",  color: "#10b981", bg: "rgba(16,185,129,0.12)",  content: <a href="tel:+919876543210" style={{ fontSize: "13px", color: T.textBody, textDecoration: "none" }}>+91 98765 43210</a> },
                { icon: MapPin, label: "OFFICE", color: "#f59e0b", bg: "rgba(245,158,11,0.12)",  content: <p style={{ fontSize: "13px", color: T.textBody, margin: 0, lineHeight: 1.6 }}>Level 12, Bandra Kurla Complex<br />Mumbai, Maharashtra 400051</p> },
              ].map(({ icon: Icon, label, color, bg, content }) => (
                <div key={label} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "12px", padding: "14px 16px", display: "flex", alignItems: "flex-start", gap: "12px" }}>
                  <div style={{ width: "32px", height: "32px", borderRadius: "8px", flexShrink: 0, background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon style={{ width: "15px", height: "15px", color }} />
                  </div>
                  <div>
                    <p style={{ fontSize: "11px", color: T.textDim, fontWeight: 600, margin: "0 0 3px", letterSpacing: "0.5px" }}>{label}</p>
                    {content}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* ── TRUST BAR ── */}
      <div style={{ borderTop: `1px solid ${T.borderBar}`, background: T.trustBg }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "20px 24px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: "8px 32px" }}>
            {TRUST_ITEMS.map(({ icon: Icon, label, sub }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                <Icon style={{ width: "13px", height: "13px", color: "#10b981" }} />
                <span style={{ fontSize: "12px", color: T.textMuted, fontWeight: 500 }}>
                  {label}
                  <span style={{ color: T.textDim, fontWeight: 400, marginLeft: "5px" }}>{sub}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── BOTTOM BAR ── */}
      <div style={{ borderTop: `1px solid ${T.borderBottom}` }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "18px 24px", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
          <p style={{ fontSize: "13px", color: T.textDim, margin: 0 }}>
            © {new Date().getFullYear()} PrimePipTrade.com. All rights reserved.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            {["Privacy Policy", "Terms", "Risk Disclosure"].map((item, i, arr) => (
              <span key={item} style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                <a href="#"
                  style={{ fontSize: "12px", color: T.textDim, textDecoration: "none" }}
                  onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.color = T.textBody}
                  onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.color = T.textDim}
                >{item}</a>
                {i < arr.length - 1 && <span style={{ color: T.border, fontSize: "16px", lineHeight: 1 }}>·</span>}
              </span>
            ))}
          </div>
        </div>
      </div>

    </footer>
  );
}
