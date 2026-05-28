"use client";

import { useRouter } from "next/navigation";

export default function DashboardsRoot() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center">
      <button
        onClick={() => router.replace("/")}
        className="px-6 py-3 rounded-lg bg-primary text-primary-foreground"
      >
        ACCESS YOUR DASHBOARD
      </button>
    </div>
  );
}