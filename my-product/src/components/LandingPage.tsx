import React, { useState, useEffect } from 'react';
import { BarChart2, Shield, Zap, User, Lock, Eye, EyeOff, Sun, Moon } from 'lucide-react';
import './LandingPage.css';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { Footer } from './footer';

interface MarketIndex { name: string; value: number; change_pct: number; }
interface MarketData  { market_status: string; indices: MarketIndex[]; }

export default function LandingPage() {
  const BASE_URL = "https://my-product-backend-j1hu.onrender.com";
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isDark, setIsDark] = useState(() => localStorage.getItem("theme") !== "light");
  const navigate = useNavigate();

  const handleGoogleCredential = async (idToken: string) => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch(`${BASE_URL}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token: idToken }),
      });
      const data = await res.json();
      const token = data?.Token ?? data?.token;
      if (token) {
        localStorage.setItem('authToken', token);
        navigate('/home');
      } else {
        setErrorMsg(data?.Message ?? 'Google login failed. Please try again.');
      }
    } catch {
      setErrorMsg('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const [marketData, setMarketData] = useState<MarketData | null>(() => {
    try {
      const cached = localStorage.getItem("cachedMarketData");
      if (cached) return JSON.parse(cached) as MarketData;
    } catch { /* ignore */ }
    return null;
  });

  useEffect(() => {
    let controller = new AbortController();

    const fetchMarket = () => {
      controller.abort();
      controller = new AbortController();
      fetch(`${BASE_URL}/api/market/indices`, { signal: controller.signal })
        .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); })
        .then((d: unknown) => {
          if (d && typeof d === "object" && "indices" in d) {
            const data = d as MarketData;
            data.indices = Array.isArray(data.indices) ? data.indices : [];
            setMarketData(data);
            localStorage.setItem("cachedMarketData", JSON.stringify(data));
          }
        })
        .catch(e => { if (e?.name !== "AbortError") console.error("[market/indices]", e); });
    };
    fetchMarket();
    const id = setInterval(fetchMarket, 10_000);
    return () => { clearInterval(id); controller.abort(); };
  }, []);

  useEffect(() => {
    localStorage.setItem("theme", isDark ? "dark" : "light");
    document.body.style.backgroundColor = isDark ? "#020613" : "#f0f4f8";
    return () => { document.body.style.backgroundColor = ""; };
  }, [isDark]);
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');

    try {
      if (isLogin) {
        const response = await fetch(`${BASE_URL}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        if (response.ok) {
          const data = await response.json();
          console.log('[login response]', data);
          const token = data?.Token ?? data?.token ?? data?.access_token ?? data?.auth_token ?? data?.jwt;
          if (token) {
            localStorage.setItem('authToken', token);
            navigate('/home');
          } else {
            setErrorMsg('Invalid credentials. Please check your email and password.');
          }
        } else if (response.status === 401 || response.status === 400) {
          setErrorMsg('Invalid credentials. Please check your email and password.');
        } else {
          setErrorMsg('Login failed. Please try again later.');
        }
      } else {
        const response = await fetch(`${BASE_URL}/signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            first_name: firstName,
            last_name: lastName,
            email,
            password,
            phone_number: phoneNumber,
          }),
        });

        if (response.ok) {
          setIsLogin(true);
          setErrorMsg('');
          setEmail(''); setPassword(''); setFirstName(''); setLastName(''); setPhoneNumber('');
        } else {
          setErrorMsg('Sign up failed. Please check your details and try again.');
        }
      }
    } catch {
      setErrorMsg('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (

    <div className={`landing-page-root${isDark ? "" : " light-mode"}`}>

      {/* 1. HORIZONTAL LIVE PRICE MARQUEE */}
      {(() => {
        const isOpen = marketData?.market_status === "open";
        const dotColor = isOpen ? "#4ade80" : "#f87171";
        const items = marketData?.indices ?? [];
        const renderItems = () => items.map((idx, i) => {
          const chgPct = (typeof idx.change_pct === "number" && !isNaN(idx.change_pct)) ? idx.change_pct : 0;
          const positive = chgPct >= 0;
          const pct = (positive ? "+" : "") + chgPct.toFixed(2) + "%";
          const rawVal = (typeof idx.value === "number" && !isNaN(idx.value)) ? idx.value : null;
          const val = rawVal != null ? rawVal.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "—";
          return (
            <span key={i} className="ticker-item">
              <span className={isOpen ? "dot-live" : undefined} style={{ display: "inline-block", width: "7px", height: "7px", borderRadius: "50%", background: dotColor, boxShadow: `0 0 5px ${dotColor}`, verticalAlign: "middle", marginRight: "6px" }} />
              {idx.name ? String(idx.name).toUpperCase() : "—"}{" "}
              <span className={positive ? "ticker-up" : "ticker-down"}>{val} ({pct})</span>
            </span>
          );
        });
        return (
          <div className="ticker-wrap">
            <div className="ticker-move">
              <div style={{ display: 'inline-flex' }}>{renderItems()}</div>
              <div style={{ display: 'inline-flex' }}>{renderItems()}</div>
            </div>
          </div>
        );
      })()}

      {/* 2. DUAL COLUMN DESIGN GRID */}
      <div className="main-layout-container">
        
        {/* LEFT COLUMN: BRAND DETAILS */}
        <div className="brand-column">
          
          <div className="logo-container">
            <div className="logo-graphic">
              <div className="logo-bar-left"></div>
              <div className="logo-bar-center"></div>
              <div className="logo-bar-right"></div>
            </div>
            <span>PrimePipTrade.com</span>
          </div>

          <h1 className="hero-title">
            Trade Smarter.<br />
            <span className="gradient-text">Invest Better.</span>
          </h1>
          
          <p className="hero-subtitle">
            A powerful platform for modern traders to track, analyze and grow.
          </p>

          <div className="feature-list">
            <div className="feature-item">
              <div className="feature-icon-box blue">
                <BarChart2 size={20} />
              </div>
              <div>
                <h3 className="feature-title">Real-time Market Data</h3>
                <p className="feature-desc">Get live updates and real-time insights.</p>
              </div>
            </div>

            <div className="feature-item">
              <div className="feature-icon-box blue">
                <Shield size={20} />
              </div>
              <div>
                <h3 className="feature-title">Secure & Reliable</h3>
                <p className="feature-desc">Bank-grade security for your account.</p>
              </div>
            </div>

            <div className="feature-item">
              <div className="feature-icon-box blue">
                <Zap size={20} />
              </div>
              <div>
                <h3 className="feature-title">Instant Access & Precision Execution</h3>
                <p className="feature-desc">Execute trades and manage portfolio with speed.</p>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: WHITE INTERACTIVE CARD VIEW */}
        <div className="auth-column">
          <div className="auth-card">
            
            <div className="auth-header">
              <h2 className="auth-title">
                {isLogin ? 'Welcome Back!' : 'Get Started'}
              </h2>
              <p className="auth-subtitle">
                {isLogin ? 'Login to access your trading dashboard' : 'Create an account to unlock the matrix console'}
              </p>
            </div>

            <form onSubmit={handleLogin} className="auth-form">
             {/* --- EMAIL --- */}
<div className="input-group">
  <label className="input-label">Email</label>
  <div className="input-wrapper">
    <User size={16} color="#94a3b8" className="input-icon-left" />
    <input 
      name="email"
      type="email" 
      value={email}
      onChange={(e)=>setEmail(e.target.value)}
      required
      placeholder="Enter your email"
      className="form-input"
    />
  </div>
</div>

{/* --- SIGNUP ONLY FIELDS --- */}
{!isLogin && (
  <>
    <div className="input-group">
      <label className="input-label">First Name</label>
      <div className="input-wrapper">
        <input 
          name="first_name" 
          value={firstName} 
          onChange={(e)=>setFirstName(e.target.value)}
          required 
          placeholder="Enter your first name" 
          className="form-input" 
        />
      </div>
    </div>
    
    <div className="input-group">
      <label className="input-label">Last Name</label>
      <div className="input-wrapper">
        <input 
          name="last_name" 
          value={lastName} 
          onChange={(e)=>setLastName(e.target.value)}
          required 
          placeholder="Enter your last name" 
          className="form-input" 
        />
      </div>
    </div>

    <div className="input-group">
      <label className="input-label">Phone Number</label>
      <div className="input-wrapper">
        <input 
          name="phone_number" 
          value={phoneNumber} 
          onChange={(e)=>setPhoneNumber(e.target.value)}
          required 
          placeholder="Enter your phone number" 
          className="form-input" 
        />
      </div>
    </div>
  </>
)}

{/* --- PASSWORD --- */}
<div className="input-group">
  <label className="input-label">Password</label>
  <div className="input-wrapper">
    <Lock size={16} color="#94a3b8" className="input-icon-left" />
    <input 
      name="password"
      type={showPassword ? 'text' : 'password'}
      value={password}
      onChange={(e)=>setPassword(e.target.value)}
      required
      placeholder="Enter your password"
      className="form-input password-pad"
    />
    <div onClick={() => setShowPassword(!showPassword)} className="password-toggle-btn">
      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
    </div>
  </div>
</div>

              {isLogin && (
                <div className="form-extras-row">
                  <label className="remember-label">
                    <input type="checkbox" className="remember-checkbox" />
                    Remember Me
                  </label>
                  <span className="forgot-link">Forgot Password?</span>
                </div>
              )}

              <button
                type="submit"
                className="submit-action-btn"
                disabled={isLoading}
              >
                {isLoading ? 'Authenticating...' : (isLogin ? 'Login' : 'Sign Up')}
              </button>

              {errorMsg && (
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: '8px',
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: '8px', padding: '10px 14px',
                }}>
                  <span style={{ color: '#ef4444', fontSize: '18px', lineHeight: 1, flexShrink: 0 }}>⚠</span>
                  <span style={{ color: '#ef4444', fontSize: '13px', fontWeight: 500, lineHeight: 1.4 }}>
                    {errorMsg}
                  </span>
                </div>
              )}
            </form>

            <div className="oauth-divider">
              <div className="divider-line"></div>
              <span className="divider-text">or continue with</span>
            </div>

            <div className="oauth-button-row">
              <GoogleLogin
                onSuccess={(credentialResponse) => {
                  if (credentialResponse.credential) {
                    handleGoogleCredential(credentialResponse.credential);
                  }
                }}
                onError={() => setErrorMsg('Google login was cancelled or failed.')}
                theme="outline"
                size="large"
                width="100%"
                text="signin_with"
                shape="rectangular"
              />
            </div>

            <div className="view-toggle-footer">
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
              <span onClick={() => { setIsLogin(v => !v); setErrorMsg(''); }} className="view-toggle-link">
                {isLogin ? 'Sign Up' : 'Login'}
              </span>
            </div>

          </div>
        </div>

      </div>

      <Footer isDark={isDark} />

      {/* Theme toggle — fixed top-right */}
      <button
        onClick={() => setIsDark(d => !d)}
        title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
        style={{
          position: 'fixed', top: '54px', right: '16px', zIndex: 200,
          width: '40px', height: '40px', borderRadius: '50%',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.15)'}`,
          background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          color: isDark ? '#e2e8f0' : '#334155',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          transition: 'background 0.2s, border 0.2s, color 0.2s',
          boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.1)',
        }}
      >
        {isDark ? <Sun size={17} /> : <Moon size={17} />}
      </button>

    </div>
  );
}