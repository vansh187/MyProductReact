import React, { useState } from 'react';
import { BarChart2, Shield, Zap, User, Lock, Eye, EyeOff } from 'lucide-react';
import './LandingPage.css';
import { useNavigate } from 'react-router-dom';

export default function LandingPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const navigate=useNavigate();
  const handleMockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert(`Mock login executed for username: ${email}`);
  };
  const handleLogin = async (e: React.FormEvent) => {
  e.preventDefault();
  setIsLoading(true);

  try {
              
            if(isLogin){
                const response = await fetch('http://localhost:8000/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
                });

                if (response.ok) {
                const data = await response.json();
                console.log('Login successful:', data);
                localStorage.setItem('authToken', data.Token)
                setIsLogin(true);
                navigate('/home');

                } else {
                alert('Login failed. Please check your credentials.');
                }
              }else{
                const response = await fetch('http://localhost:8000/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ first_name: firstName, 
                   last_name: lastName, 
                    email: email, 
                password: password, 
                  phone_number: phoneNumber}),
                });

                if (response.ok) {
                const data = await response.json();
                console.log('signup successful:', data);
                alert('Account created successfully! Please login.');
                setIsLogin(true)
                navigate('/');

                } else {
                alert('Login failed. Please check your credentials.');
                }
              }
            } catch (error) {
                console.error('API Error:', error);
                alert('An error occurred. Please try again later.');
            } finally {
                setIsLoading(false);
            }
    } ;

  return (
    
    <div className="landing-page-root">
      
      {/* 1. HORIZONTAL LIVE PRICE MARQUEE */}
      <div className="ticker-wrap">
        <div className="ticker-move">
          <div style={{ display: 'inline-flex' }}>
            <span className="ticker-item">NIFTY 50 <span className="ticker-up">24,532.10 (+0.45%)</span></span>
            <span className="ticker-item">SENSEX <span className="ticker-up">80,123.50 (+0.51%)</span></span>
            <span className="ticker-item">BANK NIFTY <span className="ticker-down">52,100.20 (-0.12%)</span></span>
            <span className="ticker-item">INDIA VIX <span className="ticker-down">12.45 (-3.15%)</span></span>
            <span className="ticker-item">TCS <span className="ticker-up">3,982.15 (+0.85%)</span></span>
            <span className="ticker-item">RELIANCE <span className="ticker-up">2,912.40 (+1.20%)</span></span>
          </div>
          {/* Double mapped instance to ensure continuous flow seamlessly */}
          <div style={{ display: 'inline-flex' }}>
            <span className="ticker-item">NIFTY 50 <span className="ticker-up">24,532.10 (+0.45%)</span></span>
            <span className="ticker-item">SENSEX <span className="ticker-up">80,123.50 (+0.51%)</span></span>
            <span className="ticker-item">BANK NIFTY <span className="ticker-down">52,100.20 (-0.12%)</span></span>
            <span className="ticker-item">INDIA VIX <span className="ticker-down">12.45 (-3.15%)</span></span>
            <span className="ticker-item">TCS <span className="ticker-up">3,982.15 (+0.85%)</span></span>
            <span className="ticker-item">RELIANCE <span className="ticker-up">2,912.40 (+1.20%)</span></span>
          </div>
        </div>
      </div>

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

            <form onSubmit={handleMockSubmit} className="auth-form">
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
                     onClick={handleLogin} 
                    className="submit-action-btn"
                         disabled={isLoading}
                        >
                    {isLoading ? 'Authenticating...' : (isLogin ? 'Login' : 'Sign Up')}
            </button>
            </form>

            <div className="oauth-divider">
              <div className="divider-line"></div>
              <span className="divider-text">or continue with</span>
            </div>

            <div className="oauth-button-row">
              <button className="oauth-btn" onClick={() => alert('OAuth Integration Coming Soon')}>
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#EA4335" d="M12 5.04c1.64 0 3.12.56 4.28 1.67l3.2-3.2C17.52 1.58 14.96 1 12 1 7.35 1 3.42 3.67 1.52 7.56l3.72 2.88C6.12 7.52 8.84 5.04 12 5.04z"/>
                  <path fill="#4285F4" d="M23.48 12.25c0-.82-.07-1.6-.22-2.36H12v4.51h6.44c-.28 1.47-1.11 2.71-2.36 3.55l3.66 2.84c2.14-1.98 3.38-4.89 3.38-8.54z"/>
                  <path fill="#FBBC05" d="M5.24 14.44A7.16 7.16 0 0 1 4.8 12c0-.85.15-1.67.44-2.44L1.52 6.68A11.94 11.94 0 0 0 0 12c0 1.92.45 3.74 1.52 5.32l3.72-2.88z"/>
                  <path fill="#34A853" d="M12 23c3.24 0 5.97-1.08 7.96-2.91l-3.66-2.84c-1.01.68-2.31 1.09-4.3 1.09-3.16 0-5.88-2.48-6.84-5.40L1.44 17.8C3.34 21.69 7.27 24 12 24z"/>
                </svg>
              </button>

            </div>

            <div className="view-toggle-footer">
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
              <span onClick={() => setIsLogin(!isLogin)} className="view-toggle-link">
                {isLogin ? 'Sign Up' : 'Login'}
              </span>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}