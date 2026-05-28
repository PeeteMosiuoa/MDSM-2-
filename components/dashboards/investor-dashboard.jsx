"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  LayoutDashboard,
  TrendingUp,
  Wallet,
  BarChart3,
  ShoppingCart,
  Bell,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  BookOpen,
  ArrowLeftRight,
  Users,
  MessageSquare,
  Coins,
  CheckCircle2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import DashboardShell from "@/components/dashboard-shell";
import MarketView from "@/components/investor/market-view";
import TradingPanel from "@/components/investor/trading-panel";
import PortfolioView from "@/components/investor/portfolio-view";
import WalletView from "@/components/investor/wallet-view";

import {
  getAllSecurities,
  getPortfolio,
  getWallet,
  getAlerts,
  getOrders,
  getMarketStats,
  getDividends,
  getDividendPayments,
  getBrokers,
  getMyBroker,
  assignBroker,
} from "@/lib/store";

const NAV_ITEMS = [
  { id: "overview",  label: "Overview",       icon: LayoutDashboard },
  { id: "market",    label: "Market Data",    icon: TrendingUp },
  { id: "trade",     label: "Trade",          icon: ShoppingCart },
  { id: "portfolio", label: "Portfolio",      icon: PieChart },
  { id: "dividends", label: "Dividends",      icon: DollarSign },
  { id: "wallet",    label: "Wallet",         icon: Wallet },
  { id: "orders",    label: "My Orders",      icon: BarChart3 },
  { id: "broker",    label: "My Broker",      icon: Users },
  { id: "alerts",    label: "Alerts",         icon: Bell },
  { id: "learn",     label: "Learn",          icon: BookOpen },
];

export default function InvestorDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [securities, setSecurities] = useState([]);
  const [portfolioData, setPortfolioData] = useState({ portfolio: [], totalValue: 0, totalGain: 0 });
  const [wallet, setWallet] = useState({ balance: 0, currency: "LSL" });
  const [alerts, setAlerts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState(null);

  const [myBroker, setMyBroker] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toasts, setToasts] = useState([]);

  // Toast helper
  const showToast = useCallback((message, type = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
  }, []);

  // Update wallet balance instantly from child components
  const updateWalletBalance = useCallback((newBalance) => {
    setWallet((prev) => ({ ...prev, balance: Number(newBalance) || 0 }));
    showToast(`Wallet updated: M${Number(newBalance || 0).toLocaleString()}`, "success");
  }, [showToast]);

  // ── Data refresh ───────────────────────────────────────────────────────
  const refreshFullDashboard = useCallback(async (silent = false) => {
    if (!user?.id) return;
    if (!silent) setLoading(true);
    setError(null);

    try {
      const [
        securitiesData,
        portfolioResult,
        walletData,
        alertsData,
        ordersData,
        statsData,
        brokerData,
      ] = await Promise.all([
        getAllSecurities(),
        getPortfolio(user.id),
        getWallet(user.id),
        getAlerts(user.id),
        getOrders(user.id),
        getMarketStats(),
        getMyBroker(user.id).catch(() => null),
      ]);
      setMyBroker(brokerData ?? null);

      // Debug logs (remove later if not needed)
      console.log("📊 Securities count:", securitiesData?.length || 0);
      if (securitiesData?.length > 0) {
        console.log("First security:", JSON.stringify(securitiesData[0], null, 2));
      }

      console.log("📈 Portfolio holdings count:", portfolioResult?.portfolio?.length || 0);
      if (portfolioResult?.portfolio?.length > 0) {
        console.log("First holding:", JSON.stringify(portfolioResult.portfolio[0], null, 2));
      }
      console.log("Portfolio totals from backend:", {
        totalValue: portfolioResult?.totalValue,
        totalGain: portfolioResult?.totalGain,
      });

      setSecurities(Array.isArray(securitiesData) ? securitiesData : []);
      setPortfolioData(
        portfolioResult && typeof portfolioResult === "object"
          ? portfolioResult
          : { portfolio: [], totalValue: 0, totalGain: 0 }
      );

      const walletObj = walletData && typeof walletData === "object"
        ? { ...walletData, balance: Number(walletData.balance) || 0 }
        : { balance: 0, currency: "LSL" };
      setWallet(walletObj);

      setAlerts(Array.isArray(alertsData) ? alertsData : []);
      setOrders(Array.isArray(ordersData) ? ordersData : []);
      setStats(statsData ?? null);
    } catch (err) {
      console.error("Dashboard refresh failed:", err);
      if (!silent) setError("Failed to load dashboard data. Retrying...");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    refreshFullDashboard();

    const interval = setInterval(() => refreshFullDashboard(true), 45000);
    return () => clearInterval(interval);
  }, [refreshFullDashboard, user?.id]);

  // ── Derived stats (now mostly from backend) ─────────────────────────────
  const dashboardStats = useMemo(() => ({
    totalPortfolioValue: portfolioData.totalValue || 0,
    totalGainLoss: portfolioData.totalGain || 0,
    totalDividends: portfolioData.totalDividends || 0,
    portfolioChangePercent:
      portfolioData.totalValue > 0 && portfolioData.totalValue - portfolioData.totalGain !== 0
        ? (((portfolioData.totalGain) / (portfolioData.totalValue - portfolioData.totalGain)) * 100).toFixed(2)
        : "0.00",
    walletBalance: Number(wallet?.balance || 0),
  }), [portfolioData, wallet?.balance]);

  // ── Shared formatters ───────────────────────────────────────────────────
  const fmtM = (v) =>
    v == null || isNaN(v)
      ? "—"
      : `M${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const secType = (sec) => {
    if (sec?.type?.trim()) return sec.type.charAt(0).toUpperCase() + sec.type.slice(1).toLowerCase();
    const n = (sec?.name || "").toLowerCase();
    if (n.includes("fund")) return "Fund";
    if (n.includes("bond")) return "Bond";
    if (n.includes("share")) return "Shares";
    return "Equity";
  };

  // ── StatCard ─────────────────────────────────────────────────────────────
  function StatCard({ title, value, sub, accent = "blue", trend, trendValue }) {
    const accents = {
      blue:   { bar: "bg-blue-500",    icon: "bg-blue-500/15 text-blue-400",   text: "text-blue-400" },
      green:  { bar: "bg-emerald-500", icon: "bg-emerald-500/15 text-emerald-400", text: "text-emerald-400" },
      red:    { bar: "bg-red-500",     icon: "bg-red-500/15 text-red-400",     text: "text-red-400" },
      violet: { bar: "bg-violet-500",  icon: "bg-violet-500/15 text-violet-400", text: "text-violet-400" },
    };
    const a = accents[accent] || accents.blue;
    const isUp = trend === "up";
    return (
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-slate-900 p-5">
        <div className={`absolute left-0 top-0 h-full w-1 ${a.bar}`} />
        <p className="text-xs font-medium uppercase tracking-widest text-slate-400 mb-3">{title}</p>
        <p className="text-2xl font-bold text-white font-mono leading-none">{value}</p>
        {sub && <p className="mt-1.5 text-xs text-slate-500">{sub}</p>}
        {trend && trendValue && (
          <div className={`mt-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
            isUp ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
          }`}>
            {isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {trendValue}
          </div>
        )}
      </div>
    );
  }

  // ── Overview Tab ─────────────────────────────────────────────────────────
  function OverviewTab() {
    const { totalPortfolioValue, totalGainLoss, totalDividends, portfolioChangePercent, walletBalance } = dashboardStats;
    const portfolio = portfolioData.portfolio || [];
    const isGain = totalGainLoss >= 0;

    return (
      <div className="space-y-6 p-6">

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            <span className="h-2 w-2 rounded-full bg-red-400 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Broker status strip */}
        {!myBroker ? (
          <div className="flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/8 px-5 py-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15">
                <Users className="h-4 w-4 text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-300">No broker assigned</p>
                <p className="text-xs text-slate-400 mt-0.5">Select a dedicated broker to start trading</p>
              </div>
            </div>
            <Button size="sm" onClick={() => setActiveTab("broker")}
              className="bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 h-8 text-xs">
              Select Broker →
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/8 px-5 py-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15">
                <Users className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-300">Broker · {myBroker.broker_name}</p>
                <p className="text-xs text-slate-400 mt-0.5">{myBroker.broker_email}</p>
              </div>
            </div>
            <button onClick={() => setActiveTab("broker")}
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors">
              Change
            </button>
          </div>
        )}

        {/* KPI row */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Wallet Balance"
            value={fmtM(walletBalance)}
            accent="blue"
            sub="Available cash"
          />
          <StatCard
            title="Portfolio Value"
            value={totalPortfolioValue > 0 ? fmtM(totalPortfolioValue) : portfolio.length > 0 ? "Loading…" : "M0.00"}
            accent="violet"
            sub={`${portfolio.length} holding${portfolio.length !== 1 ? "s" : ""}`}
          />
          <StatCard
            title="Total Gain / Loss"
            value={`${isGain ? "+" : "-"}${fmtM(Math.abs(totalGainLoss))}`}
            accent={isGain ? "green" : "red"}
            sub={
              totalDividends > 0
                ? `incl. ${fmtM(totalDividends)} dividends/income`
                : totalPortfolioValue > 0
                  ? `${isGain ? "+" : ""}${portfolioChangePercent}% on cost basis`
                  : "No holdings yet"
            }
            trend={totalGainLoss !== 0 ? (isGain ? "up" : "down") : null}
            trendValue={totalGainLoss !== 0 ? `${Math.abs(portfolioChangePercent)}%` : null}
          />
          <StatCard
            title="Open Orders"
            value={orders.filter((o) => o.status === "pending").length.toString()}
            accent="violet"
            sub={`${orders.length} total`}
          />
        </div>

        {/* Market snapshot + Recent orders side-by-side */}
        <div className="grid gap-4 lg:grid-cols-5">

          {/* Market snapshot — 3 cols */}
          <div className="lg:col-span-3 rounded-2xl border border-white/[0.06] bg-slate-900 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <div>
                <p className="font-semibold text-white">Market Snapshot</p>
                <p className="text-xs text-slate-400 mt-0.5">Top listed securities</p>
              </div>
              <button onClick={() => setActiveTab("market")}
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                Full market <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {securities.length === 0 ? (
              <div className="py-12 text-center">
                <TrendingUp className="h-8 w-8 mx-auto text-slate-600 mb-2" />
                <p className="text-sm text-slate-500">No securities listed yet</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.04]">
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Symbol</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Name</th>
                    <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">Price</th>
                    <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">Mkt Cap</th>
                  </tr>
                </thead>
                <tbody>
                  {securities.slice(0, 6).map((sec, idx) => {
                    const cap = sec.price && sec.total_supply ? Number(sec.price) * Number(sec.total_supply) : 0;
                    return (
                      <tr key={sec.id ?? idx} className="border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors cursor-pointer"
                        onClick={() => setActiveTab("trade")}>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-500/15 text-[10px] font-bold text-blue-400">
                              {(sec.symbol || "?").slice(0, 2)}
                            </div>
                            <span className="font-mono font-bold text-white text-sm">{sec.symbol || "—"}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-slate-300 text-xs">{sec.name || "—"}</td>
                        <td className="px-5 py-3.5 text-right font-mono font-semibold text-white text-sm">
                          {sec.price != null ? fmtM(sec.price) : "—"}
                        </td>
                        <td className="px-5 py-3.5 text-right text-xs text-slate-400">
                          {cap > 0 ? `M${(cap / 1_000_000).toFixed(1)}M` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Recent orders — 2 cols */}
          <div className="lg:col-span-2 rounded-2xl border border-white/[0.06] bg-slate-900 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <div>
                <p className="font-semibold text-white">Recent Orders</p>
                <p className="text-xs text-slate-400 mt-0.5">Last 5</p>
              </div>
              <button onClick={() => setActiveTab("orders")}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                See all →
              </button>
            </div>

            {orders.length === 0 ? (
              <div className="py-12 text-center">
                <ShoppingCart className="h-8 w-8 mx-auto text-slate-600 mb-2" />
                <p className="text-sm text-slate-500">No orders yet</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {[...orders].reverse().slice(0, 5).map((o, idx) => {
                  const isBuy = (o.type || "").toLowerCase() === "buy";
                  const statusClr = {
                    filled: "text-emerald-400",
                    pending: "text-amber-400",
                    processing: "text-blue-400",
                    cancelled: "text-red-400",
                  }[o.status] || "text-slate-400";
                  return (
                    <div key={o.id ?? idx} className="flex items-center justify-between px-5 py-3 hover:bg-white/[0.03] transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`flex h-7 w-7 items-center justify-center rounded-md text-[10px] font-bold flex-shrink-0 ${
                          isBuy ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
                        }`}>
                          {isBuy ? "B" : "S"}
                        </div>
                        <div className="min-w-0">
                          <p className="font-mono font-bold text-white text-sm truncate">{o.symbol || `#${o.security_id}`}</p>
                          <p className="text-[10px] text-slate-500 truncate">{Number(o.quantity ?? 0).toLocaleString()} × M{Number(o.price ?? 0).toFixed(2)}</p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-2">
                        <p className="font-mono font-semibold text-white text-sm">M{Number(o.total ?? 0).toFixed(2)}</p>
                        <p className={`text-[10px] capitalize font-medium ${statusClr}`}>{o.status || "pending"}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Holdings strip */}
        {portfolio.length > 0 && (
          <div className="rounded-2xl border border-white/[0.06] bg-slate-900 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <p className="font-semibold text-white">My Holdings</p>
              <button onClick={() => setActiveTab("portfolio")} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                Full portfolio →
              </button>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {portfolio.slice(0, 5).map((h, idx) => {
                const symbol      = h.security?.symbol || h.symbol || `#${h.securityId}`;
                const units       = Number(h.units ?? h.quantity ?? 0);
                const currentVal  = Number(h.currentValue ?? h.current_value ?? 0);
                const totalPnl    = Number(h.gain ?? 0);           // capital gain + dividends
                const divIncome   = Number(h.dividendIncome ?? 0);
                const pnlPct      = Number(h.gainPercent ?? 0);
                return (
                  <div key={h.securityId ?? h.security_id ?? idx} className="flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.03] transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-violet-500/15 text-[10px] font-bold text-violet-400">
                        {symbol.slice(0, 2)}
                      </div>
                      <div>
                        <p className="font-mono font-bold text-white text-sm">{symbol}</p>
                        <p className="text-xs text-slate-400">{units.toLocaleString()} shares</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-semibold text-white text-sm">{fmtM(currentVal)}</p>
                      <p className={`text-xs font-medium ${totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {totalPnl >= 0 ? "+" : ""}{fmtM(Math.abs(totalPnl))} ({totalPnl >= 0 ? "+" : ""}{pnlPct}%)
                      </p>
                      {divIncome > 0 && (
                        <p className="text-[10px] text-amber-400">incl. {fmtM(divIncome)} income</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!user || !user.id) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-slate-400">Please sign in to access your dashboard.</p>
      </div>
    );
  }

  return (
    <DashboardShell
      navItems={NAV_ITEMS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      user={user}
      onLogout={onLogout}
      loading={loading}
    >
      {loading ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-slate-700 border-t-blue-500 animate-spin" />
          <p className="text-xs text-slate-500 animate-pulse">Loading dashboard…</p>
        </div>
      ) : (
        <>
          {activeTab === "overview" && <OverviewTab />}

          {activeTab === "market" && <MarketView securities={securities} stats={stats} />}

          {activeTab === "trade" && (
            <TradingPanel
              user={user}
              securities={securities}
              portfolio={portfolioData.portfolio}
              wallet={wallet}
              onTradeComplete={() => setTimeout(() => refreshFullDashboard(true), 1200)}
              onWalletChange={updateWalletBalance}
            />
          )}

          {activeTab === "wallet" && (
            <WalletView
              user={user}
              wallet={wallet}
              onRefresh={() => setTimeout(() => refreshFullDashboard(true), 1200)}
              onBalanceChange={(newWallet) => {
                if (newWallet?.balance != null) {
                  updateWalletBalance(newWallet.balance);
                }
              }}
            />
          )}

          {activeTab === "portfolio" && (
            <PortfolioView
              portfolio={portfolioData.portfolio}
              securities={securities}
              totalValue={portfolioData.totalValue}
              totalGain={portfolioData.totalGain}
              totalDividends={portfolioData.totalDividends}
            />
          )}

          {activeTab === "orders" && (
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">My Orders</h2>
                  <p className="text-xs text-slate-400 mt-0.5">{orders.length} total order{orders.length !== 1 ? "s" : ""}</p>
                </div>
              </div>
              {orders.length === 0 ? (
                <div className="rounded-2xl border border-white/[0.06] bg-slate-900 py-16 text-center">
                  <ShoppingCart className="h-10 w-10 mx-auto text-slate-600 mb-3" />
                  <p className="text-slate-400 font-medium">No orders yet</p>
                  <p className="text-xs text-slate-500 mt-1">Your executed and pending orders will appear here</p>
                </div>
              ) : (
                <div className="rounded-2xl border border-white/[0.06] bg-slate-900 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        {["Date","Security","Side","Qty","Price","Total","Fee","Status","On-Chain"].map((h) => (
                          <th key={h} className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 ${h === "Qty" || h === "Price" || h === "Total" || h === "Fee" ? "text-right" : "text-left"}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...orders].reverse().map((o) => {
                        const isBuy = (o.type || "").toLowerCase() === "buy";
                        const statusMap = {
                          filled:     { bg: "bg-emerald-500/15", text: "text-emerald-400" },
                          pending:    { bg: "bg-amber-500/15",   text: "text-amber-400" },
                          processing: { bg: "bg-blue-500/15",    text: "text-blue-400" },
                          cancelled:  { bg: "bg-red-500/15",     text: "text-red-400" },
                        };
                        const s = statusMap[o.status] || { bg: "bg-slate-700", text: "text-slate-400" };
                        return (
                          <tr key={o.id} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.03] transition-colors">
                            <td className="px-4 py-3.5 text-xs text-slate-400 whitespace-nowrap">
                              {new Date(o.created_at || Date.now()).toLocaleString("en-ZA", { dateStyle: "short", timeStyle: "short" })}
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="font-mono font-bold text-white">{o.symbol || `#${o.security_id}`}</span>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-bold ${
                                isBuy ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
                              }`}>
                                {(o.type || "—").toUpperCase()}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-right font-mono text-slate-200">{Number(o.quantity ?? 0).toLocaleString()}</td>
                            <td className="px-4 py-3.5 text-right font-mono text-slate-200">M{Number(o.price ?? 0).toFixed(2)}</td>
                            <td className="px-4 py-3.5 text-right font-mono font-bold text-white">M{Number(o.total ?? 0).toFixed(2)}</td>
                            <td className="px-4 py-3.5 text-right font-mono text-amber-400">
                              {Number(o.broker_fee ?? 0) > 0
                                ? `M${Number(o.broker_fee).toFixed(2)}`
                                : <span className="text-slate-600">—</span>}
                            </td>
                            <td className="px-4 py-3.5">
                              <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${s.bg} ${s.text}`}>
                                {o.status || "pending"}
                              </span>
                            </td>
                            <td className="px-4 py-3.5">
                              {o.onchain_tx_hash ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2 py-0.5 font-mono text-[10px] text-blue-400" title={o.onchain_tx_hash}>
                                  ✓ {o.onchain_tx_hash.slice(0, 8)}…
                                </span>
                              ) : <span className="text-xs text-slate-600">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === "dividends" && <InvestorDividends user={user} />}

          {activeTab === "broker" && (
            <BrokerSelector
              user={user}
              myBroker={myBroker}
              onAssigned={(b) => setMyBroker(b)}
            />
          )}

          {activeTab === "learn" && <BrokerRelationshipDiagram />}

          {activeTab === "alerts" && (
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">Notifications</h2>
                  <p className="text-xs text-slate-400 mt-0.5">{alerts.length} notification{alerts.length !== 1 ? "s" : ""}</p>
                </div>
                <button onClick={() => refreshFullDashboard(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300 hover:bg-white/[0.08] transition-colors">
                  Refresh
                </button>
              </div>

              {alerts.length === 0 ? (
                <div className="rounded-2xl border border-white/[0.06] bg-slate-900 py-16 text-center">
                  <Bell className="h-10 w-10 mx-auto text-slate-600 mb-3" />
                  <p className="text-slate-400 font-medium">No notifications</p>
                  <p className="text-xs text-slate-500 mt-1">Order confirmations, dividend payments and system alerts appear here</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {alerts.map((a) => {
                    const typeMap = {
                      error:   { dot: "bg-red-500",     border: "border-red-500/20",   bg: "bg-red-500/5" },
                      warning: { dot: "bg-amber-500",   border: "border-amber-500/20", bg: "bg-amber-500/5" },
                      success: { dot: "bg-emerald-500", border: "border-emerald-500/20", bg: "bg-emerald-500/5" },
                      info:    { dot: "bg-blue-500",    border: "border-blue-500/20",  bg: "bg-blue-500/5" },
                    };
                    const t = typeMap[a.alert_type || a.type] || typeMap.info;
                    return (
                      <div key={a.id} className={`flex items-start gap-4 rounded-xl border ${t.border} ${t.bg} px-5 py-4`}>
                        <span className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${t.dot}`} />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-white text-sm">{a.title || "Notification"}</p>
                          {a.message && a.title && (
                            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{a.message}</p>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 flex-shrink-0 mt-0.5 whitespace-nowrap">
                          {new Date(a.created_at || Date.now()).toLocaleString("en-ZA", { dateStyle: "short", timeStyle: "short" })}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </DashboardShell>
  );
}

// ─── Investor Dividend History ─────────────────────────────────────────────────
function InvestorDividends({ user }) {
  const [dividends, setDividends] = useState([]);
  const [myPayments, setMyPayments] = useState({});
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    getDividends(user?.id, "investor")
      .then((rows) => setDividends(Array.isArray(rows) ? rows : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user?.id]);

  // Fetch per-investor payment amounts for paid dividends
  useEffect(() => {
    dividends.filter((d) => d.status === "paid").forEach(async (div) => {
      try {
        const payments = await getDividendPayments(div.id, user?.id);
        const mine = payments[0];
        if (mine) setMyPayments((prev) => ({ ...prev, [div.id]: parseFloat(mine.amount) }));
      } catch (_) {}
    });
  }, [dividends, user?.id]);

  const grandTotal = Object.values(myPayments).reduce((s, v) => s + v, 0);
  // suppress unused warning from removed totalEarned state

  const fmtDate = (v) => {
    if (!v) return "—";
    try { return new Date(v).toISOString().slice(0, 10); } catch { return "—"; }
  };

  const statusColor = (s) => ({
    declared:   "text-blue-400",
    processing: "text-yellow-400",
    paid:       "text-primary",
    cancelled:  "text-destructive",
  }[s] || "text-muted-foreground");

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Dividend History</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Dividends declared for securities you hold or have held.
        </p>
      </div>

      {/* Summary card */}
      {grandTotal > 0 && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <DollarSign className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total dividends received</p>
            <p className="text-2xl font-bold text-primary font-mono">M{grandTotal.toFixed(2)}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-muted-foreground text-sm">Loading dividends…</div>
      ) : dividends.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <DollarSign className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <p className="font-medium">No dividends yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Dividends will appear here once declared for securities you hold.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-6 gap-2 border-b border-border bg-secondary/30 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <span className="col-span-2">Security</span>
            <span className="text-right">Per Share</span>
            <span className="text-right">Ex-Date</span>
            <span className="text-right">Pay Date</span>
            <span className="text-right">Your Payment</span>
          </div>
          <div className="divide-y divide-border/50">
            {dividends.map((div) => (
              <div key={div.id} className="grid grid-cols-6 gap-2 items-center px-4 py-3 hover:bg-secondary/20 transition-colors">
                <div className="col-span-2">
                  <p className="font-mono text-sm font-bold">{div.security_symbol}</p>
                  <p className="text-xs text-muted-foreground truncate">{div.security_name}</p>
                </div>
                <p className="text-right font-mono text-sm">M{parseFloat(div.amount_per_share).toFixed(4)}</p>
                <p className="text-right text-xs text-muted-foreground">{fmtDate(div.ex_dividend_date)}</p>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{fmtDate(div.payment_date)}</p>
                  <span className={`text-[10px] font-semibold capitalize ${statusColor(div.status)}`}>
                    {div.status}
                  </span>
                </div>
                <p className="text-right font-mono text-sm font-semibold text-primary">
                  {myPayments[div.id] != null
                    ? `M${myPayments[div.id].toFixed(2)}`
                    : div.status === "paid" ? "—" : <span className="text-muted-foreground text-xs">Pending</span>}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Broker Selector ──────────────────────────────────────────────────────────
function BrokerSelector({ user, myBroker, onAssigned }) {
  const [brokers, setBrokers]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [selected, setSelected]   = useState(myBroker?.broker_id ?? null);
  const [success, setSuccess]     = useState("");
  const [error, setError]         = useState("");

  useEffect(() => {
    getBrokers()
      .then((rows) => setBrokers(Array.isArray(rows) ? rows : []))
      .catch(() => setBrokers([]))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    if (!selected) { setError("Please select a broker first."); return; }
    setSaving(true); setError(""); setSuccess("");
    try {
      const result = await assignBroker(user.id, selected);
      if (result?.error) { setError(result.error); return; }
      setSuccess(`Broker assigned: ${result.broker_name}`);
      onAssigned({ broker_id: selected, broker_name: result.broker_name });
    } catch (e) {
      setError(e.message || "Failed to assign broker.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-bold">My Broker</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Select a dedicated broker. All your orders will be routed through them for execution.
        </p>
      </div>

      {/* Current assignment */}
      {myBroker && (
        <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 flex items-center gap-3">
          <Users className="h-5 w-5 text-primary flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-primary">Currently assigned</p>
            <p className="text-sm text-foreground font-medium">{myBroker.broker_name}</p>
            <p className="text-xs text-muted-foreground">{myBroker.broker_email}</p>
          </div>
        </div>
      )}

      {/* Broker list */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading brokers…</p>
      ) : brokers.length === 0 ? (
        <div className="rounded-xl border border-border bg-secondary/20 p-6 text-center">
          <Users className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">No brokers are registered on this platform yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground mb-3">Available brokers</p>
          {brokers.map((b) => {
            const isCurrently = myBroker?.broker_id === b.id;
            const isSelected  = selected === b.id;
            return (
              <button
                key={b.id}
                onClick={() => setSelected(b.id)}
                className={`w-full text-left rounded-xl border px-5 py-4 transition-colors ${
                  isSelected
                    ? "border-primary bg-primary/15"
                    : "border-border bg-secondary/20 hover:bg-secondary/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`font-semibold text-sm ${isSelected ? "text-primary" : "text-foreground"}`}>
                      {b.full_name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{b.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isCurrently && (
                      <span className="text-[10px] border border-primary/30 bg-primary/10 text-primary rounded-full px-2 py-0.5 font-semibold">
                        Current
                      </span>
                    )}
                    {isSelected && (
                      <div className="h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                        <div className="h-2 w-2 rounded-full bg-white" />
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {error   && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-primary">{success}</p>}

      <Button onClick={handleSave} disabled={saving || !selected || brokers.length === 0} className="w-full sm:w-auto">
        {saving ? "Saving…" : myBroker ? "Change Broker" : "Confirm Broker"}
      </Button>
    </div>
  );
}

// ─── Investor–Broker Relationship Diagram ─────────────────────────────────────
function BrokerRelationshipDiagram() {
  const [activeLayer, setActiveLayer] = useState(null);

  const layers = [
    {
      id: "relationship",
      icon: ArrowLeftRight,
      title: "Core Relationship",
      color: "from-blue-600/20 to-blue-500/10 border-blue-500/30",
      headerColor: "bg-blue-600/20 text-blue-300",
      accentColor: "text-blue-400",
      dotColor: "bg-blue-500",
    },
    {
      id: "broker-types",
      icon: Users,
      title: "Broker Types",
      color: "from-violet-600/20 to-violet-500/10 border-violet-500/30",
      headerColor: "bg-violet-600/20 text-violet-300",
      accentColor: "text-violet-400",
      dotColor: "bg-violet-500",
    },
    {
      id: "communication",
      icon: MessageSquare,
      title: "Communication Channels",
      color: "from-cyan-600/20 to-cyan-500/10 border-cyan-500/30",
      headerColor: "bg-cyan-600/20 text-cyan-300",
      accentColor: "text-cyan-400",
      dotColor: "bg-cyan-500",
    },
    {
      id: "compensation",
      icon: Coins,
      title: "Compensation Models",
      color: "from-amber-600/20 to-amber-500/10 border-amber-500/30",
      headerColor: "bg-amber-600/20 text-amber-300",
      accentColor: "text-amber-400",
      dotColor: "bg-amber-500",
    },
    {
      id: "practices",
      icon: CheckCircle2,
      title: "Investor Best Practices",
      color: "from-emerald-600/20 to-emerald-500/10 border-emerald-500/30",
      headerColor: "bg-emerald-600/20 text-emerald-300",
      accentColor: "text-emerald-400",
      dotColor: "bg-emerald-500",
    },
  ];

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Investor–Broker Relationship</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          A five-layer map of how investors and brokers interact — from the core agency relationship
          to compensation structures and regulatory best practices.
        </p>
      </div>

      {/* ── LAYER 1: Core Relationship ─────────────────────────── */}
      <section className={`rounded-xl border bg-gradient-to-br p-6 space-y-5 ${layers[0].color}`}>
        <div className="flex items-center gap-3">
          <div className={`rounded-lg px-3 py-1.5 text-sm font-semibold flex items-center gap-2 ${layers[0].headerColor}`}>
            <ArrowLeftRight className="h-4 w-4" /> Layer 1 — Core Relationship
          </div>
        </div>

        {/* Investor ↔ Broker ↔ Exchange */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-4">
          {/* Investor box */}
          <div className="flex flex-col items-center gap-2 w-40">
            <div className="rounded-xl bg-blue-500/20 border border-blue-500/40 px-5 py-4 text-center w-full">
              <p className="font-bold text-blue-300 text-base">Investor</p>
              <p className="text-xs text-muted-foreground mt-0.5">Principal</p>
            </div>
          </div>

          {/* Arrows: investor ↔ broker */}
          <div className="flex flex-col items-center gap-1 text-xs text-muted-foreground md:w-32 text-center">
            <span className={`text-[10px] font-medium ${layers[0].accentColor}`}>Orders & Instructions →</span>
            <div className="flex items-center gap-1 w-full">
              <div className="h-px flex-1 bg-blue-500/40" />
              <ArrowLeftRight className="h-3 w-3 text-blue-400" />
              <div className="h-px flex-1 bg-blue-500/40" />
            </div>
            <span className={`text-[10px] font-medium ${layers[0].accentColor}`}>← Execution, Advice &amp; Settlement</span>
            <div className="mt-2 rounded-full border border-blue-500/30 px-2 py-0.5 text-[10px] text-blue-300 bg-blue-500/10">
              KYC Obligation
            </div>
          </div>

          {/* Broker box */}
          <div className="flex flex-col items-center gap-2 w-40">
            <div className="rounded-xl bg-blue-500/20 border border-blue-500/40 px-5 py-4 text-center w-full">
              <p className="font-bold text-blue-300 text-base">Broker</p>
              <p className="text-xs text-muted-foreground mt-0.5">Agent / Fiduciary</p>
            </div>
          </div>

          {/* Arrows: broker → exchange */}
          <div className="flex flex-col items-center gap-1 text-xs text-muted-foreground md:w-28 text-center">
            <span className={`text-[10px] font-medium ${layers[0].accentColor}`}>Routes Orders →</span>
            <div className="flex items-center gap-1 w-full">
              <div className="h-px flex-1 bg-blue-500/40" />
              <ArrowLeftRight className="h-3 w-3 text-blue-400" />
              <div className="h-px flex-1 bg-blue-500/40" />
            </div>
            <span className={`text-[10px] font-medium ${layers[0].accentColor}`}>← Price Discovery</span>
          </div>

          {/* Exchange box */}
          <div className="flex flex-col items-center gap-2 w-40">
            <div className="rounded-xl bg-blue-500/20 border border-blue-500/40 px-5 py-4 text-center w-full">
              <p className="font-bold text-blue-300 text-base">Exchange</p>
              <p className="text-xs text-muted-foreground mt-0.5">MDSM Market</p>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground border-l-2 border-blue-500/40 pl-3">
          Before advising or executing, the broker must understand the investor's goals, risk tolerance,
          and financial situation — this is the <strong className="text-blue-300">KYC obligation</strong>.
        </p>
      </section>

      {/* ── LAYER 2: Broker Types ──────────────────────────────── */}
      <section className={`rounded-xl border bg-gradient-to-br p-6 space-y-4 ${layers[1].color}`}>
        <div className="flex items-center gap-3">
          <div className={`rounded-lg px-3 py-1.5 text-sm font-semibold flex items-center gap-2 ${layers[1].headerColor}`}>
            <Users className="h-4 w-4" /> Layer 2 — Broker Types by Level of Touch
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              name: "Full-Service",
              tag: "High Touch",
              tagColor: "bg-violet-500/20 text-violet-300 border-violet-500/30",
              desc: "Proactive and personalized. The broker actively monitors your portfolio, calls you with ideas, and tailors advice to your individual goals.",
              traits: ["Personalised advice", "Proactive outreach", "Portfolio management", "Higher fees"],
            },
            {
              name: "Hybrid",
              tag: "Mid Touch",
              tagColor: "bg-violet-400/20 text-violet-200 border-violet-400/30",
              desc: "Digital-first execution with the option to access a human advisor for complex decisions or material events — usually for an additional fee.",
              traits: ["Digital platform", "On-demand human advisor", "Flexible pricing", "Mid-range fees"],
            },
            {
              name: "Discount",
              tag: "Low Touch",
              tagColor: "bg-violet-300/15 text-violet-300 border-violet-300/20",
              desc: "Purely execution-driven. You direct all decisions yourself. The broker only places the order — no advice, no outreach.",
              traits: ["Self-directed", "Execution only", "Lowest fees", "Online platform"],
            },
          ].map((bt) => (
            <div key={bt.name} className="rounded-lg border border-violet-500/20 bg-violet-500/10 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-violet-200">{bt.name}</p>
                <span className={`text-[10px] font-semibold border rounded-full px-2 py-0.5 ${bt.tagColor}`}>{bt.tag}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{bt.desc}</p>
              <ul className="space-y-1">
                {bt.traits.map((t) => (
                  <li key={t} className="flex items-center gap-2 text-xs text-violet-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-violet-400 flex-shrink-0" />{t}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ── LAYER 3: Communication Channels ───────────────────── */}
      <section className={`rounded-xl border bg-gradient-to-br p-6 space-y-4 ${layers[2].color}`}>
        <div className="flex items-center gap-3">
          <div className={`rounded-lg px-3 py-1.5 text-sm font-semibold flex items-center gap-2 ${layers[2].headerColor}`}>
            <MessageSquare className="h-4 w-4" /> Layer 3 — Communication Channels
          </div>
        </div>

        <div className="space-y-3">
          {[
            {
              channel: "Digital Platforms & Email Newsletters",
              availability: "All broker types",
              dot: "bg-emerald-400",
              note: "Universal. Market updates, trade confirmations, account statements and regulatory notices are delivered digitally.",
            },
            {
              channel: "Phone Calls",
              availability: "Material events only",
              dot: "bg-amber-400",
              note: "Reserved for significant portfolio events — earnings surprises, large price moves, corporate actions, or risk threshold breaches.",
            },
            {
              channel: "In-Person Meetings",
              availability: "High-net-worth clients",
              dot: "bg-red-400",
              note: "Typically restricted to HNW relationships or annual review appointments. Full-service brokers only.",
            },
          ].map((ch) => (
            <div key={ch.channel} className="flex items-start gap-3 rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-4">
              <span className={`mt-1.5 h-2.5 w-2.5 rounded-full flex-shrink-0 ${ch.dot}`} />
              <div className="flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-cyan-200 text-sm">{ch.channel}</p>
                  <span className="text-[10px] border border-cyan-500/30 rounded-full px-2 py-0.5 text-cyan-300 bg-cyan-500/10">
                    {ch.availability}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{ch.note}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── LAYER 4: Compensation ──────────────────────────────── */}
      <section className={`rounded-xl border bg-gradient-to-br p-6 space-y-4 ${layers[3].color}`}>
        <div className="flex items-center gap-3">
          <div className={`rounded-lg px-3 py-1.5 text-sm font-semibold flex items-center gap-2 ${layers[3].headerColor}`}>
            <Coins className="h-4 w-4" /> Layer 4 — Compensation Models
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-amber-200">Commission-Based</p>
              <span className="text-[10px] border border-red-400/40 rounded-full px-2 py-0.5 text-red-300 bg-red-500/10">
                ⚠ Churn Risk
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              The broker earns a fee <strong className="text-amber-300">per trade executed</strong>. This creates a structural
              incentive to recommend more frequent trading — known as <em>churning</em> — even when it may not serve
              the investor's best interest.
            </p>
            <div className="rounded border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              Conflict-of-interest disclosure required by law.
            </div>
          </div>

          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-amber-200">Asset-Based (AUM) Fee</p>
              <span className="text-[10px] border border-emerald-400/40 rounded-full px-2 py-0.5 text-emerald-300 bg-emerald-500/10">
                ✓ Better Aligned
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              The broker charges a percentage of <strong className="text-amber-300">assets under management</strong>. Because the
              broker's income grows only when the portfolio grows, incentives are better aligned with
              the investor's long-term success.
            </p>
            <div className="rounded border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              Conflict-of-interest disclosure required by law.
            </div>
          </div>
        </div>
      </section>

      {/* ── LAYER 5: Investor Practices ───────────────────────── */}
      <section className={`rounded-xl border bg-gradient-to-br p-6 space-y-4 ${layers[4].color}`}>
        <div className="flex items-center gap-3">
          <div className={`rounded-lg px-3 py-1.5 text-sm font-semibold flex items-center gap-2 ${layers[4].headerColor}`}>
            <CheckCircle2 className="h-4 w-4" /> Layer 5 — Investor Best Practices
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              number: "01",
              title: "Set Communication Preferences Early",
              desc: "Define your preferred channel, frequency, and the types of events that warrant a direct call. Document this in writing with your broker at onboarding.",
            },
            {
              number: "02",
              title: "Maintain a Regular Review Cadence",
              desc: "Schedule periodic portfolio reviews — quarterly at minimum. Use them to reassess risk tolerance, rebalance allocations, and evaluate whether your broker's recommendations still align with your goals.",
            },
            {
              number: "03",
              title: "Verify Regulatory Standing",
              desc: "Before committing funds, confirm that your broker is licensed and in good standing with the relevant regulatory authority. Check for any disciplinary history or outstanding complaints.",
            },
          ].map((p) => (
            <div key={p.number} className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 space-y-2">
              <span className="text-3xl font-black text-emerald-500/30 leading-none">{p.number}</span>
              <p className="font-semibold text-emerald-200 text-sm">{p.title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}