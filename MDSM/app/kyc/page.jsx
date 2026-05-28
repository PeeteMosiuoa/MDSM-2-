"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import KycPage from "../../components/auth/kyc-page";

export default function Kyc() {
  const router = useRouter();

  const [session, setSession] = useState(null);
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    console.log("[KYC WRAPPER] Checking session...");

    const storedUser = localStorage.getItem("tempUser") || localStorage.getItem("user");

    if (!storedUser) {
      console.warn("[KYC WRAPPER] No session found → redirecting to register");
      setError("No active registration session. Redirecting...");
      setTimeout(() => router.replace("/register"), 1500);
      setIsChecking(false);
      return;
    }

    try {
      const parsedUser = JSON.parse(storedUser);

      if (!parsedUser || !parsedUser.id) {
        console.error("[KYC WRAPPER] Invalid session object");
        localStorage.removeItem("user");
        localStorage.removeItem("tempUser");
        router.replace("/register");
        return;
      }

      // Optional: If user already has kyc_status = submitted/approved, go to dashboard
      if (parsedUser.kyc_status === "submitted" || parsedUser.kyc_status === "approved") {
        const dashboard = getDashboardRoute(parsedUser.role);
        console.log("[KYC WRAPPER] KYC already submitted → redirecting to dashboard");
        router.replace(dashboard);
        return;
      }

      setSession(parsedUser);
    } catch (err) {
      console.error("[KYC WRAPPER] Failed to parse session:", err);
      localStorage.removeItem("user");
      localStorage.removeItem("tempUser");
      router.replace("/register");
    } finally {
      setIsChecking(false);
    }
  }, [router]);

  const getDashboardRoute = (role) => {
    const defaultDashboards = {
      investor: "/dashboards/investor-dashboard",
      broker: "/dashboards/broker-dashboard",
      issuer: "/dashboards/issuer-dashboard",
      regulator: "/dashboards/regulator-dashboard",
      admin: "/dashboards/admin-dashboard",
    };
    return defaultDashboards[role?.toLowerCase()] || "/dashboards";
  };

  if (isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Checking authentication…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-destructive">{error}</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const userRole = session.role?.toLowerCase() || "investor";
  const targetDashboard = getDashboardRoute(userRole);

  return (
    <KycPage
      user={session}
      targetDashboard={targetDashboard}
      onComplete={() => {
        console.log("[KYC WRAPPER] onComplete called - forcing dashboard redirect");

        // Move tempUser → user (if needed)
        const tempUser = localStorage.getItem("tempUser");
        if (tempUser) {
          localStorage.setItem("user", tempUser);
          localStorage.removeItem("tempUser");
        }

        // HARD REDIRECT is more reliable after KYC submission
        const finalDashboard = getDashboardRoute(userRole);
        window.location.href = finalDashboard;
      }}
    />
  );
}