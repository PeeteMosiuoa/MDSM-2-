"use client";

import { useState, useEffect } from "react";
import {
  BarChart3,
  LogOut,
  Menu,
  X,
  Bell,
  CheckCircle2,
  CircleAlert,
  Activity,
  ChevronLeft,
  ChevronRight,
  Loader2,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { getAllSecurities } from "@/lib/store";

export default function DashboardShell({
  user,
  onLogout,
  navItems = [],
  activeTab,
  onTabChange,
  alerts = [],
  children,
}) {
  const [sidebarOpen, setSidebarOpen]         = useState(false);       // mobile drawer
  const [collapsed, setCollapsed]             = useState(() => {       // desktop collapse
    try { return localStorage.getItem("sidebar_collapsed") === "true"; }
    catch { return false; }
  });
  const [showAlerts, setShowAlerts]           = useState(false);
  const [livePrices, setLivePrices]           = useState([]);
  const [pricesLoading, setPricesLoading]     = useState(true);

  // Persist collapse preference
  useEffect(() => {
    try { localStorage.setItem("sidebar_collapsed", String(collapsed)); } catch {}
  }, [collapsed]);

  // Fetch live securities for sidebar ticker
  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const secs = await getAllSecurities();
        if (mounted) {
          const approved = (Array.isArray(secs) ? secs : [])
            .filter((s) => s.approved);
          setLivePrices(approved);
        }
      } catch {
        // silently fall back to empty
      } finally {
        if (mounted) setPricesLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 30_000); // refresh every 30 s
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  const [readIds,    setReadIds]    = useState(() => {
    try {
      const saved = localStorage.getItem("read_alerts");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });
  const [clearedIds, setClearedIds] = useState(() => {
    try {
      const saved = localStorage.getItem("cleared_alerts");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });

  useEffect(() => {
    try { localStorage.setItem("read_alerts",    JSON.stringify(Array.from(readIds)));    } catch {}
  }, [readIds]);
  useEffect(() => {
    try { localStorage.setItem("cleared_alerts", JSON.stringify(Array.from(clearedIds))); } catch {}
  }, [clearedIds]);

  const alertsArray  = (Array.isArray(alerts) ? alerts : Object.values(alerts || {}))
    .filter((a) => a?.id != null && !clearedIds.has(a.id));
  const unreadAlerts = alertsArray.filter((a) => !readIds.has(a.id));

  const markAsRead  = (id) => { if (id != null) setReadIds((p) => new Set([...p, id])); };
  const markAllRead = () => setReadIds(new Set(alertsArray.map((a) => a.id)));
  const clearOne    = (id) => {
    if (id == null) return;
    setClearedIds((p) => new Set([...p, id]));
    setReadIds((p)    => new Set([...p, id]));
  };
  const clearAll    = () => {
    const ids = new Set(alertsArray.map((a) => a.id));
    setClearedIds((p) => new Set([...p, ...ids]));
    setReadIds((p)    => new Set([...p, ...ids]));
  };

  const toggleCollapse = () => setCollapsed((c) => !c);

  return (
    <div className="flex flex-col h-screen bg-transparent">

      {/* ── Scrolling Market Ticker — very top of page (matches landing) ── */}
      <div className="w-full overflow-hidden border-b border-border bg-card py-1.5 shrink-0 z-50 subpixel-antialiased">
        {pricesLoading ? (
          <div className="flex items-center gap-2 px-4 py-0.5 text-xs text-white">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading market data…
          </div>
        ) : livePrices.length === 0 ? (
          <div className="px-4 py-0.5 text-xs text-white">No securities listed yet.</div>
        ) : (
          <div className="flex animate-ticker whitespace-nowrap">
            {[...livePrices, ...livePrices].map((sec, i) => {
              const price = Number(sec.price ?? 0);
              const seed  = ((sec.symbol?.charCodeAt(0) ?? 65) + (i % livePrices.length)) % 7;
              const pct   = Number(sec.prev_price) > 0 && Number(sec.prev_price) !== price
                ? ((price - Number(sec.prev_price)) / Number(sec.prev_price)) * 100
                : (seed % 2 === 0 ? 1 : -1) * (0.3 + seed * 0.4);
              const up = pct >= 0;
              return (
                <span key={i} className="inline-flex items-center gap-2 px-5 border-r border-border/40 shrink-0">
                  <span className="font-mono text-xs font-bold text-white">{sec.symbol}</span>
                  <span className="font-mono text-xs text-white">M{price.toFixed(2)}</span>
                  <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${up ? "text-primary" : "text-destructive"}`}>
                    {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {up ? "+" : ""}{pct.toFixed(2)}%
                  </span>
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Sidebar + Main row ──────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden min-h-0">

      {/* ── Sidebar ─────────────────────────────────────────── */}
      {/*
        Mobile:  fixed drawer (translate-x trick)
        Desktop: static flex item whose width drives the main area automatically
      */}
      <aside
        className={[
          "fixed inset-y-0 left-0 z-40 flex flex-col",
          "border-r border-border bg-[hsl(var(--sidebar-background))]",
          "transition-all duration-300 ease-in-out",
          // desktop — participate in normal flex flow + dynamic width
          "lg:static lg:inset-auto lg:z-auto",
          collapsed ? "lg:w-16" : "lg:w-60",
          // always 240 px wide as a drawer; mobile show/hide via translate
          "w-60",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        ].join(" ")}
      >
        {/* Brand row */}
        <div className="flex items-center justify-between border-b border-border px-3 py-3.5 min-h-[52px]">
          <div className={`flex items-center gap-2.5 overflow-hidden transition-all duration-300 ${collapsed ? "lg:justify-center lg:w-full" : ""}`}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary">
              <BarChart3 className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className={`transition-all duration-200 overflow-hidden ${collapsed ? "lg:hidden" : ""}`}>
              <p className="text-sm font-bold text-white tracking-wider whitespace-nowrap">MDSM</p>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white capitalize whitespace-nowrap">
                {user?.role || "User"} Portal
              </p>
            </div>
          </div>
          {/* Mobile close */}
          <button onClick={() => setSidebarOpen(false)} className="text-white lg:hidden hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
          {!collapsed && (
            <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-widest text-white">
              Navigation
            </p>
          )}
          {(navItems || []).map((item) => {
            const Icon   = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id ?? `nav-${item.label}`}
                onClick={() => { onTabChange?.(item.id); setSidebarOpen(false); }}
                title={collapsed ? item.label : undefined}
                className={`relative flex w-full items-center gap-2.5 rounded px-3 py-2 text-sm transition-colors
                  ${collapsed ? "lg:justify-center lg:px-0" : ""}
                  ${active
                    ? "bg-primary/15 text-primary font-semibold"
                    : "text-white hover:bg-secondary"
                  }`}
              >
                {active && <span className="absolute left-0 h-6 w-0.5 rounded-r bg-primary" />}
                {Icon && <Icon className="h-4 w-4 shrink-0" />}
                <span className={`truncate transition-all duration-200 ${collapsed ? "lg:hidden" : ""}`}>
                  {item.label}
                </span>
                {item.badge && !collapsed && (
                  <Badge variant="secondary" className="ml-auto bg-primary/15 text-primary text-[10px] px-1.5 py-0">
                    {item.badge}
                  </Badge>
                )}
              </button>
            );
          })}
        </nav>

        {/* User Info */}
        <div className="border-t border-border p-3">
          <div className={`mb-2 flex items-center gap-2.5 overflow-hidden ${collapsed ? "lg:justify-center" : ""}`}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary/20 text-xs font-bold text-primary">
              {user?.name?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <div className={`min-w-0 flex-1 transition-all duration-200 ${collapsed ? "lg:hidden" : ""}`}>
              <p className="truncate text-xs font-semibold text-white">
                {user?.name || "User"}
              </p>
              <p className="truncate text-[10px] font-medium text-white">
                {user?.email || ""}
              </p>
            </div>
          </div>
          <button
            onClick={onLogout}
            title={collapsed ? "Sign Out" : undefined}
            className={`flex w-full items-center gap-2 rounded border border-border py-1.5 text-xs
              font-medium text-white transition-colors
              hover:border-destructive/40 hover:text-destructive
              ${collapsed ? "lg:justify-center" : "justify-center"}`}
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" />
            <span className={`transition-all duration-200 ${collapsed ? "lg:hidden" : ""}`}>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Main ────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">

        {/* Top Bar */}
        <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 lg:px-5 subpixel-antialiased">
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button onClick={() => setSidebarOpen(true)} className="text-white lg:hidden hover:text-white">
              <Menu className="h-5 w-5" />
            </button>
            {/* Desktop collapse toggle */}
            <button
              onClick={toggleCollapse}
              className="hidden lg:flex items-center justify-center h-7 w-7 rounded text-white hover:bg-secondary transition-colors"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
            <div>
              <h2 className="text-base font-extrabold text-white tracking-tight">
                {navItems.find((n) => n.id === activeTab)?.label || "Dashboard"}
              </h2>
              <p className="hidden text-xs font-semibold text-white sm:block">
                {new Date().toLocaleDateString("en-ZA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Market status pill */}
            <div className="hidden items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 sm:flex">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-primary">Live</span>
            </div>

            {/* ── Notification Bell ────────────────────────────── */}
            <div className="relative">
              <button
                onClick={() => setShowAlerts(!showAlerts)}
                className={`relative flex h-8 w-8 items-center justify-center rounded-lg transition-colors focus:outline-none ${
                  showAlerts
                    ? "bg-primary/15 text-primary"
                    : "text-white hover:bg-secondary"
                }`}
              >
                <Bell className="h-[17px] w-[17px]" />
                {unreadAlerts.length > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold leading-none text-white ring-2 ring-card">
                    {unreadAlerts.length > 9 ? "9+" : unreadAlerts.length}
                  </span>
                )}
              </button>

              {/* Click-away backdrop */}
              {showAlerts && (
                <div className="fixed inset-0 z-40" onClick={() => setShowAlerts(false)} />
              )}

              {showAlerts && (
                <div className="absolute right-0 top-10 z-50 w-[340px] overflow-hidden rounded-xl border border-border bg-card shadow-2xl ring-1 ring-black/10 sm:w-[380px]">

                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-semibold tracking-tight text-white">Notifications</h3>
                      {alertsArray.length > 0 && (
                        <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                          {alertsArray.length}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {unreadAlerts.length > 0 && (
                        <button
                          onClick={markAllRead}
                          className="rounded px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10 transition-colors"
                        >
                          Mark all read
                        </button>
                      )}
                      {alertsArray.length > 0 && (
                        <button
                          onClick={clearAll}
                          className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-white hover:bg-destructive/10 hover:text-destructive transition-colors"
                        >
                          <X className="h-3 w-3" />
                          Clear all
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Body */}
                  {alertsArray.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                        <Bell className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">All caught up</p>
                        <p className="mt-0.5 text-xs text-white">No notifications right now</p>
                      </div>
                    </div>
                  ) : (
                    <div className="max-h-[380px] divide-y divide-border/60 overflow-y-auto">
                      {alertsArray
                        .filter((a) => a && typeof a === "object")
                        .map((alert, index) => {
                          const key    = alert.id != null ? `alert-${alert.id}` : `alert-${index}`;
                          const isRead = readIds.has(alert.id);
                          const isSuccess = alert.type === "success" || alert.alert_type === "success";
                          const isWarning = alert.type === "warning" || alert.alert_type === "warning";
                          const title  = alert.title || (alert.message?.split("\n")[0]) || "Notification";
                          const body   = alert.title ? alert.message : alert.message?.split("\n").slice(1).join(" ").trim();
                          return (
                            <div
                              key={key}
                              className={`group relative flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-secondary/50 cursor-pointer ${isRead ? "bg-muted/20" : ""}`}
                              onClick={() => !isRead && markAsRead(alert.id)}
                            >
                              {/* Icon */}
                              <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                                isSuccess ? "bg-primary/20 text-primary"
                                : isWarning ? "bg-amber-500/20 text-amber-500"
                                : "bg-destructive/20 text-destructive"
                              }`}>
                                {isSuccess
                                  ? <CheckCircle2 className="h-3.5 w-3.5" />
                                  : <CircleAlert  className="h-3.5 w-3.5" />}
                              </div>

                              {/* Content */}
                              <div className="flex-1 min-w-0 pr-6">
                                <p className="text-xs font-semibold leading-snug text-white">{title}</p>
                                {body && (
                                  <p className="mt-0.5 text-[11px] leading-relaxed text-white line-clamp-2">{body}</p>
                                )}
                                <p className="mt-1 text-[10px] font-medium text-white">
                                  {alert.created_at
                                    ? new Date(alert.created_at).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" })
                                    : "Just now"}
                                </p>
                              </div>

                              {/* Unread dot */}
                              {!isRead && (
                                <span className="absolute right-4 top-4 h-1.5 w-1.5 rounded-full bg-primary" />
                              )}

                              {/* Per-item dismiss button (appears on hover) */}
                              <button
                                onClick={(e) => { e.stopPropagation(); clearOne(alert.id); }}
                                className="absolute right-3 top-3 hidden rounded p-0.5 text-white hover:bg-destructive/15 hover:text-destructive group-hover:flex transition-colors"
                                title="Dismiss"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          );
                        })}
                    </div>
                  )}

                  {/* Footer */}
                  {alertsArray.length > 0 && (
                    <div className="border-t border-border/60 bg-muted/30 px-4 py-2 text-center">
                      <p className="text-[11px] font-medium text-white">
                        {unreadAlerts.length > 0
                          ? `${unreadAlerts.length} unread notification${unreadAlerts.length !== 1 ? "s" : ""}`
                          : "All notifications read"}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-transparent p-4 lg:p-5">
          {children}
        </main>
      </div>

      </div>{/* end sidebar+main row */}
    </div>
  );
}
