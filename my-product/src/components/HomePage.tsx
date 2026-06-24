import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "./header";
import { HeroSection } from "./hero-section";
import { Footer } from "./footer";

export default function HomePage() {
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(() => localStorage.getItem("theme") !== "light");

  // Redirect to landing page if no auth token (expired or never logged in)
  useEffect(() => {
    if (!localStorage.getItem("authToken")) {
      navigate("/", { replace: true });
    }
  }, []);

  useEffect(() => {
    // LandingPage.css sets overflow:hidden on html/body globally — override it here
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
    document.documentElement.classList.toggle("dark", isDark);
    // Override LandingPage.css which hardcodes body background globally
    document.body.style.backgroundColor = isDark ? "#0d1117" : "#f0f4f8";
    return () => {
      document.documentElement.classList.remove("dark");
      document.body.style.backgroundColor = "";
    };
  }, [isDark]);

  const pageBg = isDark ? "#0d1117" : "#f0f4f8";

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: pageBg }}>
      <Header isDark={isDark} onToggleTheme={() => setIsDark((d) => { const next = !d; localStorage.setItem("theme", next ? "dark" : "light"); return next; })} />
      <main style={{ flex: 1 }}>
        <HeroSection isDark={isDark} />
        <Footer isDark={isDark} />
      </main>
    </div>
  );
}
