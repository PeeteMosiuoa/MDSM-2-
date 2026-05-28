"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import LandingPage from "../components/landing-page";
import LoginPage from "../components/auth/login-page";
import RegisterPage from "../components/auth/register-page";
import KycPage from "../components/auth/kyc-page";

// Lazy-load every dashboard — none of them ship in the initial JS bundle.
// A spinner is shown while the chunk loads (first visit to that dashboard only).
const loadingFallback = <div className="flex min-h-screen items-center justify-center text-muted-foreground text-sm">Loading…</div>;

const InvestorDashboard  = dynamic(() => import("../components/dashboards/investor-dashboard"),  { ssr: false, loading: () => loadingFallback });
const AdminDashboard     = dynamic(() => import("../components/dashboards/admin-dashboard"),     { ssr: false, loading: () => loadingFallback });
const RegulatorDashboard = dynamic(() => import("../components/dashboards/regulator-dashboard"), { ssr: false, loading: () => loadingFallback });
const IssuerDashboard    = dynamic(() => import("../components/dashboards/issuer-dashboard"),    { ssr: false, loading: () => loadingFallback });
const BrokerDashboard    = dynamic(() => import("../components/dashboards/broker-dashboard"),    { ssr: false, loading: () => loadingFallback });

export default function App() {
  const [page, setPage] = useState("landing");
  const [user, setUser] = useState(null);

  // Rehydrate session from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem("user");
      if (stored) {
        const u = JSON.parse(stored);
        if (u?.role) {
          setUser(u);
          setPage(u.role + "-dashboard");
        }
      }
    } catch {
      // corrupted storage — ignore
    }
  }, []);

  function handleLogout() {
    setUser(null);
    localStorage.removeItem("user");
    localStorage.removeItem("mdsm_session");
    setPage("landing");
  }

  switch (page) {
    case "landing":
      return (
        <LandingPage
          onLogin={() => setPage("login")}
          onRegister={() => setPage("register")}
        />
      );
    case "login":
      return (
        <LoginPage
          onBack={() => setPage("landing")}
          onRegister={() => setPage("register")}
          setUser={setUser}
        />
      );
    case "register":
      return (
        <RegisterPage
          onBack={() => setPage("landing")}
          onLogin={() => setPage("login")}
        />
      );
    case "kyc":
      return (
        <KycPage
          user={user}
          onComplete={() => setPage((user?.role ?? "investor") + "-dashboard")}
          onSkip={() => setPage((user?.role ?? "investor") + "-dashboard")}
        />
      );
    case "investor-dashboard":
      return <InvestorDashboard  user={user} onLogout={handleLogout} />;
    case "admin-dashboard":
      return <AdminDashboard     user={user} onLogout={handleLogout} />;
    case "regulator-dashboard":
      return <RegulatorDashboard user={user} onLogout={handleLogout} />;
    case "issuer-dashboard":
      return <IssuerDashboard    user={user} onLogout={handleLogout} />;
    case "broker-dashboard":
      return <BrokerDashboard    user={user} onLogout={handleLogout} />;
    default:
      return (
        <LandingPage
          onLogin={() => setPage("login")}
          onRegister={() => setPage("register")}
        />
      );
  }
}
