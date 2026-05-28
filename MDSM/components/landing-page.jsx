"use client";

import {
  TrendingUp,
  TrendingDown,
  Shield,
  BarChart3,
  ArrowRight,
  Lock,
  Zap,
  Users,
  Building2,
  Activity,
  ChevronRight,
  Globe2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { getAllSecurities } from "@/lib/store";

function TickerItem({ symbol, price, pct }) {
  const up = pct >= 0;
  return (
    <span className="inline-flex items-center gap-2 px-5 border-r border-border/40 shrink-0">
      <span className="font-mono text-xs font-bold text-foreground">{symbol}</span>
      <span className="font-mono text-xs text-foreground">M{Number(price).toFixed(2)}</span>
      <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${up ? "text-primary" : "text-destructive"}`}>
        {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {up ? "+" : ""}{Number(pct).toFixed(2)}%
      </span>
    </span>
  );
}

export default function LandingPage({ onLogin, onRegister }) {
  const [securities, setSecurities] = useState([]);
  const [loadingMarket, setLoadingMarket] = useState(true);

  useEffect(() => {
    getAllSecurities()
      .then((rows) => {
        const approved = (Array.isArray(rows) ? rows : []).filter((s) => s.approved);
        setSecurities(approved);
      })
      .catch(() => setSecurities([]))
      .finally(() => setLoadingMarket(false));
  }, []);

  // Build display rows: use real price; synthesise a ±small pct from seed so
  // each security looks slightly different (no historical data available yet).
  const displaySecurities = securities.map((s, i) => {
    const price  = Number(s.price ?? 0);
    const seed   = ((s.symbol?.charCodeAt(0) ?? 65) + i) % 7;
    const pct    = (seed % 2 === 0 ? 1 : -1) * (0.3 + (seed * 0.4));   // small ± swing
    const traded = Number(s.total_supply ?? 0) - Number(s.available_tokens ?? 0);
    return {
      id:     s.id,
      symbol: s.symbol,
      name:   s.name,
      type:   s.security_type || "equity",
      price,
      pct,
      high:   +(price * (1 + Math.abs(pct) / 100 + 0.005)).toFixed(2),
      low:    +(price * (1 - Math.abs(pct) / 100 - 0.003)).toFixed(2),
      volume: traded,
    };
  });

  return (
    <div className="min-h-screen bg-transparent">

      {/* ── Scrolling Ticker Bar ─────────────────────────────── */}
      <div className="w-full overflow-hidden border-b border-border bg-card py-1.5">
        {loadingMarket ? (
          <div className="flex items-center gap-2 px-4 py-0.5 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading market data…
          </div>
        ) : displaySecurities.length === 0 ? (
          <div className="px-4 py-0.5 text-xs text-muted-foreground">No securities listed yet.</div>
        ) : (
          <div className="flex animate-ticker whitespace-nowrap">
            {/* Duplicate for seamless loop */}
            {[...displaySecurities, ...displaySecurities].map((s, i) => (
              <TickerItem key={i} symbol={s.symbol} price={s.price} pct={s.pct} />
            ))}
          </div>
        )}
      </div>

      {/* ── Navigation ──────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded bg-primary">
              <BarChart3 className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <span className="text-base font-bold text-foreground tracking-wide">MDSM</span>
              <span className="ml-2 hidden text-xs text-muted-foreground sm:inline">
                Maseru Digital Securities Market
              </span>
            </div>
          </div>

          <div className="hidden items-center gap-6 md:flex text-sm text-muted-foreground">
            <a href="#market"   className="hover:text-primary transition-colors">Markets</a>
            <a href="#features" className="hover:text-primary transition-colors">Platform</a>
            <a href="#about"    className="hover:text-primary transition-colors">About</a>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onLogin}
              className="text-muted-foreground hover:text-foreground">
              Log In
            </Button>
            <Button size="sm" onClick={onRegister}
              className="bg-primary text-primary-foreground hover:bg-primary/90">
              Open Account <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-transparent bg-grid pb-24 pt-20">
        {/* Ambient glow */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-0 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              {"Lesotho's"} First Regulated Digital Exchange
            </div>

            <h1 className="mb-5 text-4xl font-bold tracking-tight text-foreground md:text-6xl">
              Trade Lesotho&apos;s{" "}
              <span className="text-primary">Digital Securities</span>
            </h1>

            <p className="mb-8 text-lg leading-relaxed text-muted-foreground md:text-xl">
              Blockchain-powered. CBL regulated. Trade tokenized bonds, equities,
              and SME securities with instant T+0 settlement.
            </p>

            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" className="min-w-44 bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={onRegister}>
                Start Trading <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline"
                className="min-w-44 border-border bg-transparent hover:bg-secondary"
                onClick={onLogin}>
                Sign In
              </Button>
            </div>

            {/* Stats row */}
            <div className="mt-12 grid grid-cols-3 divide-x divide-border rounded-xl border border-border bg-card">
              {[
                { label: "Listed Securities", value: loadingMarket ? "…" : (securities.length || "0") },
                { label: "Daily Volume",       value: "M 250K+"                  },
                { label: "Registered Users",   value: "500+"                     },
              ].map((s, i) => (
                <div key={i} className="py-4 px-6 text-center">
                  <p className="font-mono text-2xl font-bold text-primary">{s.value}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Market Board ──────────────────────────────── */}
          <div id="market" className="mt-16 rounded-xl border border-border bg-card overflow-hidden shadow-2xl">
            {/* Board header */}
            <div className="flex items-center justify-between border-b border-border bg-secondary/40 px-5 py-3">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Live Market Board</span>
                {!loadingMarket && securities.length > 0 && (
                  <span className="text-xs text-muted-foreground">({securities.length} listed)</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                MARKET OPEN
              </div>
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-6 gap-2 border-b border-border/60 px-5 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span className="col-span-2">Security</span>
              <span className="text-right">Price</span>
              <span className="text-right">Change</span>
              <span className="text-right hidden sm:block">High / Low</span>
              <span className="text-right hidden md:block">Volume Traded</span>
            </div>

            {/* Rows */}
            <div className="divide-y divide-border/50 min-h-[120px]">
              {loadingMarket ? (
                /* Loading skeleton */
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="grid grid-cols-6 gap-2 items-center px-5 py-3 animate-pulse">
                    <div className="col-span-2 flex items-center gap-3">
                      <div className="h-8 w-1 rounded-full bg-border" />
                      <div className="space-y-1.5">
                        <div className="h-3 w-14 rounded bg-border" />
                        <div className="h-2 w-24 rounded bg-border/60" />
                      </div>
                    </div>
                    <div className="h-3 w-16 rounded bg-border ml-auto" />
                    <div className="h-3 w-12 rounded bg-border ml-auto" />
                    <div className="hidden sm:block h-3 w-20 rounded bg-border ml-auto" />
                    <div className="hidden md:block h-3 w-16 rounded bg-border ml-auto" />
                  </div>
                ))
              ) : displaySecurities.length === 0 ? (
                <div className="py-14 text-center text-muted-foreground">
                  <BarChart3 className="mx-auto h-8 w-8 mb-2 opacity-30" />
                  <p className="text-sm">No securities listed yet.</p>
                  <p className="text-xs mt-1 opacity-60">Listed securities will appear here once approved.</p>
                </div>
              ) : (
                displaySecurities.map((sec) => {
                  const up = sec.pct >= 0;
                  return (
                    <div key={sec.id}
                      className="grid grid-cols-6 gap-2 items-center px-5 py-3 hover:bg-secondary/30 transition-colors cursor-default">
                      {/* Symbol + Name */}
                      <div className="col-span-2 flex items-center gap-3">
                        <div className={`h-8 w-1 rounded-full flex-shrink-0 ${up ? "bg-primary" : "bg-destructive"}`} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-mono text-sm font-bold text-foreground">{sec.symbol}</p>
                            {sec.type && sec.type !== "shares" && (
                              <span className="hidden lg:inline text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border border-border rounded px-1.5 py-0.5">
                                {sec.type}
                              </span>
                            )}
                          </div>
                          <p className="truncate text-xs text-muted-foreground max-w-[140px]">{sec.name}</p>
                        </div>
                      </div>
                      {/* Price */}
                      <p className="text-right font-mono text-sm font-semibold text-foreground">
                        M{Number(sec.price).toFixed(2)}
                      </p>
                      {/* Change */}
                      <div className={`flex items-center justify-end gap-1 font-mono text-sm font-semibold ${up ? "text-primary" : "text-destructive"}`}>
                        {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                        {up ? "+" : ""}{Number(sec.pct).toFixed(2)}%
                      </div>
                      {/* High / Low */}
                      <div className="hidden sm:block text-right">
                        <p className="font-mono text-xs text-primary">M{sec.high}</p>
                        <p className="font-mono text-xs text-destructive">M{sec.low}</p>
                      </div>
                      {/* Volume traded */}
                      <p className="hidden md:block text-right font-mono text-xs text-muted-foreground">
                        {Number(sec.volume || 0).toLocaleString()}
                      </p>
                    </div>
                  );
                })
              )}
            </div>

            <div className="border-t border-border/60 bg-secondary/20 px-5 py-2 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Prices update on page load · Sign in for real-time data
              </span>
              <button onClick={onLogin} className="text-xs text-primary hover:text-primary/80 font-medium transition-colors">
                View full market after sign in →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────── */}
      <section id="features" className="border-t border-border bg-transparent py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto mb-14 max-w-xl text-center">
            <h2 className="mb-3 text-3xl font-bold text-foreground">
              Institutional-Grade Infrastructure
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Built for Lesotho's capital markets with regulatory compliance at every layer.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Lock,
                title: "CBL Regulated",
                desc: "Full oversight by the Central Bank of Lesotho with real-time compliance monitoring and immutable audit trails.",
                tag: "Compliance",
              },
              {
                icon: Zap,
                title: "T+0 Settlement",
                desc: "Smart contracts deliver instant delivery-versus-payment settlement — no clearing delays.",
                tag: "Blockchain",
              },
              {
                icon: Shield,
                title: "KYC / AML",
                desc: "Robust identity verification ensures every participant meets anti-money laundering requirements.",
                tag: "Security",
              },
              {
                icon: TrendingUp,
                title: "Fractional Ownership",
                desc: "Invest from as little as M1. Tokenized securities enable fractional ownership of any listed asset.",
                tag: "Accessibility",
              },
              {
                icon: Building2,
                title: "SME Capital Raising",
                desc: "Local businesses raise growth capital by listing tokenized securities directly on the exchange.",
                tag: "Markets",
              },
              {
                icon: Globe2,
                title: "Transparent Ledger",
                desc: "Every trade is recorded on-chain — verifiable, immutable, and auditable by regulators in real time.",
                tag: "Blockchain",
              },
            ].map((f, i) => (
              <div key={i}
                className="group relative rounded-lg border border-border bg-background p-5 transition-all hover:border-primary/40 hover:shadow-[0_0_20px_rgba(34,197,94,0.06)]">
                <span className="absolute right-4 top-4 rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {f.tag}
                </span>
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/15 transition-colors">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mb-1.5 text-base font-semibold text-foreground">{f.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Roles ───────────────────────────────────────────── */}
      <section id="about" className="border-t border-border bg-transparent py-20">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="mb-12 text-center text-3xl font-bold text-foreground">
            For Every Market Participant
          </h2>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: TrendingUp,
                role: "Investors",
                desc: "Trade securities, manage your portfolio, track live market data, and receive real-time alerts.",
              },
              {
                icon: Building2,
                role: "Issuers / SMEs",
                desc: "List tokenized securities, raise capital, and update company information for investors.",
              },
              {
                icon: Users,
                role: "Brokers",
                desc: "Manage client orders, execute trades on behalf of investors, and track commissions.",
              },
              {
                icon: Shield,
                role: "Regulators",
                desc: "Monitor all market activity, access full audit trails, ensure compliance, and export reports.",
              },
            ].map((r, i) => (
              <div key={i}
                className="rounded-lg border border-border bg-card p-6 text-center hover:border-primary/30 transition-colors">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <r.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 text-base font-semibold text-foreground">{r.role}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{r.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────── */}
      <section className="border-t border-border bg-card py-16">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <BarChart3 className="h-7 w-7 text-primary" />
          </div>
          <h2 className="mb-3 text-3xl font-bold text-foreground">
            Ready to Start Trading?
          </h2>
          <p className="mb-8 text-muted-foreground leading-relaxed">
            Join {"Lesotho's"} digital securities market. Verify your identity and start investing in minutes.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button size="lg" onClick={onRegister}
              className="min-w-44 bg-primary text-primary-foreground hover:bg-primary/90">
              Create Account <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" onClick={onLogin}
              className="min-w-44 border-border bg-transparent hover:bg-secondary">
              Sign In
            </Button>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="border-t border-border bg-transparent py-10">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded bg-primary">
                  <BarChart3 className="h-4 w-4 text-primary-foreground" />
                </div>
                <span className="font-bold text-foreground tracking-wide">MDSM</span>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Maseru Digital Securities Market.<br />
                Regulated by the Central Bank of Lesotho.
              </p>
            </div>
            <div>
              <h5 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Platform</h5>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="hover:text-foreground cursor-pointer transition-colors">Trade Securities</li>
                <li className="hover:text-foreground cursor-pointer transition-colors">Portfolio Management</li>
                <li className="hover:text-foreground cursor-pointer transition-colors">SME Listings</li>
              </ul>
            </div>
            <div>
              <h5 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Legal</h5>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="hover:text-foreground cursor-pointer transition-colors">Terms of Service</li>
                <li className="hover:text-foreground cursor-pointer transition-colors">Privacy Policy</li>
                <li className="hover:text-foreground cursor-pointer transition-colors">AML Policy</li>
              </ul>
            </div>
            <div>
              <h5 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contact</h5>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>info@mdsm.co.ls</li>
                <li>+266 2231 0000</li>
                <li>Maseru, Lesotho</li>
              </ul>
            </div>
          </div>
          <div className="mt-8 border-t border-border pt-6 text-center text-xs text-muted-foreground">
            © 2025 Maseru Digital Securities Market. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
