// app/dashboards/issuer-dashboard/page.jsx
/*import IssuerDashboard from "@/components/dashboard/issuer-dashboard";

export default function Page() {
  return <IssuerDashboard />;
}*/


"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import InvestorDashboard from "@/components/dashboards/issuer-dashboard";

export default function InvestorDashboardPage() {
  const [user, setUser] = useState(null);
  const router = useRouter();

  /* ===============================
     Load Logged User
  =============================== */

  useEffect(() => {
    const storedUser = localStorage.getItem("user");

    if (!storedUser) {
      router.push("/");
      return;
    }

    try {
      setUser(JSON.parse(storedUser));
    } catch {
      router.push("/");
    }
  }, [router]);

  /* ===============================
     Logout Function (GLOBAL SIGNOUT)
  =============================== */

  function handleLogout() {
    localStorage.removeItem("user");
    localStorage.removeItem("auth_token");
    router.push("/");
  }

  if (!user) return null;

  return (
    <InvestorDashboard
      user={user}
      onLogout={handleLogout}
    />
  );
}