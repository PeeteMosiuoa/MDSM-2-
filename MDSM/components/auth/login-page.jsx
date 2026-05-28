"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginUser } from "@/app/actions/auth";

export default function LoginPage({ onBack, onRegister, setUser }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Client-side validation
    const emailTrimmed = email.trim().toLowerCase();
    if (!emailTrimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
      const result = await loginUser({ email, password });

      if (result?.success && result?.user) {
        // Save full user object for session
        localStorage.setItem("user", JSON.stringify(result.user));
        // Save JWT token separately so API routes can use it
        if (result.token) localStorage.setItem("auth_token", result.token);

        // Map role string (e.g. "investor") to dashboard path
        const rolePaths = {
          investor: "/dashboards/investor-dashboard",
          broker: "/dashboards/broker-dashboard",
          issuer: "/dashboards/issuer-dashboard",
          regulator: "/dashboards/regulator-dashboard",
          admin: "/dashboards/admin-dashboard",
        };

        const userRole = result.user.role; // this is "investor", "broker", etc.

        const dashboardPath = rolePaths[userRole] || "/dashboard"; // fallback if role unknown

        console.log("[LOGIN SUCCESS] Redirecting to:", dashboardPath);

        router.push(dashboardPath);
      } else {
        setError(result?.error || "Unexpected login response. Please try again.");
      }
    } catch (err) {
      console.error("[LOGIN ERROR]:", err);
      setError("Login failed. Please check your credentials and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-transparent bg-grid px-4">
      <div className="w-full max-w-sm">
        <button
          onClick={onBack}
          className="mb-5 flex items-center gap-1.5 rounded-full border border-white/30 bg-black/40 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/60 hover:border-white/60"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Home
        </button>

        <div className="rounded-lg border border-white/10 bg-slate-800/75 backdrop-blur-md p-7 shadow-2xl">
          {/* Header */}
          <div className="mb-6 flex items-center gap-3 border-b border-white/10 pb-5">
            <div className="flex h-9 w-9 items-center justify-center rounded bg-primary">
              <BarChart3 className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-wide text-foreground">MDSM</h1>
              <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Trader Sign In
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-4 flex items-center gap-2 rounded border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-xs text-destructive">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.co.ls"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1.5 bg-white/10 border-white/15 font-mono text-sm focus:border-primary/50"
              />
            </div>

            <div>
              <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Password
              </Label>
              <div className="relative mt-1.5">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-white/10 border-white/15 pr-9 font-mono text-sm focus:border-primary/50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full bg-primary font-semibold text-primary-foreground hover:bg-primary/90" disabled={loading}>
              {loading ? "Authenticating…" : "Sign In"}
            </Button>
          </form>

          <div className="mt-5 border-t border-white/10 pt-4 text-center text-xs text-muted-foreground">
            No account?{" "}
            <button onClick={onRegister} className="font-semibold text-primary hover:text-primary/80 transition-colors">
              Register
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}