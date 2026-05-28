"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  LayoutDashboard,
  Users,
  ShoppingCart,
  BarChart3,
  Play,
  Loader2,
  Link as LinkIcon,
  UserCheck,
  TrendingUp,
  TrendingDown,
  Lightbulb,
  PieChart,
  Shield,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  FileText,
  Star,
  Target,
  Briefcase,
  ChevronRight,
  Save,
  RefreshCw,
  Activity,
} from "lucide-react";

import DashboardShell from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

import {
  getAllSecurities,
  getTrades,
  getAlerts,
  getMarketStats,
  getPendingOrders,
  executeOrder,
  placeAndExecuteOrder,
  getBrokerClients,
  getPortfolio,
  getBrokerEarnings,
  getFilledLimitOrders,
} from "@/lib/store";

const BROKER_FEE_RATE = 0.05; // 5% per transaction

const NAV_ITEMS = [
  { id: "overview",    label: "Overview",         icon: LayoutDashboard },
  { id: "clients",     label: "Order Execution",  icon: ShoppingCart },
  { id: "execute",     label: "Place Order",       icon: Play },
  { id: "research",    label: "Market Research",   icon: TrendingUp },
  { id: "advisory",    label: "Advisory",          icon: Lightbulb },
  { id: "portfolios",  label: "Portfolios",        icon: PieChart },
  { id: "compliance",  label: "Compliance",        icon: Shield },
  { id: "history",     label: "Trade History",     icon: BarChart3 },
];

// ──────────────────────────────────────────────────────────────
// Shared helpers
// ──────────────────────────────────────────────────────────────
const fmt2 = (v) => Number(v ?? 0).toFixed(2);
const fmtN = (v) => Number(v ?? 0).toLocaleString();
const fmtDate = (v) => {
  if (!v) return "—";
  try { return new Date(v).toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" }); }
  catch { return "—"; }
};

// ──────────────────────────────────────────────────────────────
// MAIN COMPONENT - BrokerDashboard
// ──────────────────────────────────────────────────────────────

export default function BrokerDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab]       = useState("overview");
  const [securities, setSecurities]     = useState([]);
  const [trades, setTrades]             = useState([]);
  const [alerts, setAlerts]             = useState([]);
  const [stats, setStats]               = useState(null);
  const [clientOrders, setClientOrders] = useState([]);
  const [limitTrades, setLimitTrades]   = useState([]);
  const [investors, setInvestors]       = useState([]);
  const [earnings, setEarnings]         = useState({ earnings: [], totalEarned: 0 });
  const [isLoading, setIsLoading]       = useState(true);
  const [isPolling, setIsPolling]       = useState(false);

  const refreshData = useCallback(async (silent = false) => {
    if (isPolling && silent) return;
    if (!silent) setIsLoading(true);
    setIsPolling(true);

    try {
      const safeFetch = async (fn) => {
        try {
          const res = await fn();
          return Array.isArray(res) ? res : res?.data ?? res?.orders ?? res ?? [];
        } catch (e) {
          console.warn("Fetch failed:", e);
          return [];
        }
      };

      const [secs, trds, alrts, pendingsRaw, clientsRaw, earningsRaw, limitTradesRaw] = await Promise.all([
        safeFetch(getAllSecurities),
        safeFetch(getTrades),
        safeFetch(() => getAlerts(user?.id)),
        safeFetch(() => getPendingOrders(user?.id)),
        safeFetch(() => getBrokerClients(user?.id)),
        getBrokerEarnings(user?.id).catch(() => ({ earnings: [], totalEarned: 0 })),
        safeFetch(getFilledLimitOrders),
      ]);

      if (secs?.length > 0) setSecurities(secs);
      if (trds?.length > 0) setTrades(trds);
      if (alrts?.length > 0) setAlerts(alrts);
      if (earningsRaw) setEarnings(earningsRaw);
      if (limitTradesRaw?.length >= 0) setLimitTrades(limitTradesRaw);

      const investorsList = Array.isArray(clientsRaw) ? clientsRaw : [];
      setInvestors(investorsList);

      setClientOrders((prev) => {
        if (!pendingsRaw?.length && prev.length > 0) return prev;
        return (pendingsRaw || []).map((o) => {
          const sec = secs.find((s) => s.id === o.security_id);
          return {
            id: o.id,
            investor_id:  o.investor_id,
            security_id:  o.security_id,
            type:         o.type || "buy",
            quantity:     Number(o.quantity) || 0,
            price:        Number(o.price) || 0,
            total:        Number(o.total) || (Number(o.quantity || 0) * Number(o.price || 0)),
            status:       (o.status || "pending").toLowerCase(),
            created_at:   o.created_at || new Date().toISOString(),
            clientName:   o.investor_name || `Investor #${o.investor_id}`,
            clientEmail:  o.investor_email || "",
            symbol:       o.security_symbol || sec?.symbol || `Sec #${o.security_id}`,
            securityName: o.security_name  || sec?.name  || "Unknown",
            side:         (o.type || "buy").toUpperCase(),
          };
        });
      });

      if (!stats) setStats(getMarketStats?.() ?? null);
    } catch (err) {
      console.error("Refresh failed:", err);
    } finally {
      setIsLoading(false);
      setIsPolling(false);
    }
  }, [user?.id, stats]);

  useEffect(() => {
    refreshData(false);
    const interval = setInterval(() => refreshData(true), 20000);
    return () => clearInterval(interval);
  }, [refreshData]);

  const handleExecuteOrder = useCallback(async (orderId) => {
    try {
      const res = await executeOrder(orderId, user.id);
      if (!res?.success) throw new Error(res?.message || "Execution failed");
      setClientOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: "filled" } : o))
      );
      setTimeout(() => refreshData(true), 1200);
    } catch (err) {
      console.error("Execute failed:", err);
      alert(`Failed to execute order #${orderId}\n${err.message}`);
    }
  }, [user.id, refreshData]);

  const memoizedClientOrders = useMemo(() => clientOrders, [clientOrders]);

  if (isLoading && clientOrders.length === 0) {
    return (
      <DashboardShell user={user} onLogout={onLogout} navItems={NAV_ITEMS}
        activeTab={activeTab} onTabChange={setActiveTab} alerts={alerts}>
        <div className="flex h-[70vh] items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="relative h-14 w-14">
              <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20" />
              <div className="absolute inset-0 rounded-full border-t-2 border-emerald-500 animate-spin" />
            </div>
            <p className="text-slate-400 font-mono text-sm tracking-wider">LOADING BROKER TERMINAL…</p>
          </div>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell user={user} onLogout={onLogout} navItems={NAV_ITEMS}
      activeTab={activeTab} onTabChange={setActiveTab} alerts={alerts}>

      {activeTab === "overview" && (
        <BrokerOverview
          stats={stats} trades={trades} clientOrders={memoizedClientOrders}
          securities={securities} investors={investors} user={user}
          earnings={earnings}
        />
      )}

      {activeTab === "clients" && (
        <div className="space-y-6">
          <div className="px-1">
            <h2 className="text-xl font-bold text-white mb-0.5">Order Execution</h2>
            <p className="text-sm text-slate-400">Executed client orders and filled limit-order trades.</p>
          </div>
          {/* Registered clients strip */}
          <div className="rounded-xl border border-white/[0.06] bg-slate-900/60 p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-emerald-400" /> Registered Clients ({investors.length})
            </h3>
            {investors.length === 0 ? (
              <p className="text-sm text-slate-500">No investors have registered with you yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {investors.map((inv) => (
                  <div key={inv.id}
                    className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-slate-800/50 px-3 py-2">
                    <div className="h-7 w-7 rounded-full bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                      <span className="text-emerald-400 font-bold text-xs">
                        {(inv.full_name || "?")[0].toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-white">{inv.full_name}</p>
                      <p className="text-[10px] text-slate-500">{inv.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <ClientOrders clientOrders={memoizedClientOrders} onExecute={handleExecuteOrder} />
          <LimitOrderTrades limitTrades={limitTrades} />
        </div>
      )}

      {activeTab === "execute" && (
        <div className="space-y-4">
          <div className="px-1">
            <h2 className="text-xl font-bold text-white mb-0.5">Facilitate Transaction</h2>
            <p className="text-sm text-slate-400">
              Place and immediately execute a buy/sell order for a registered client.
            </p>
          </div>
          <ExecuteTrade
            securities={securities} investors={investors} brokerId={user?.id}
            onOrderSubmitted={(newOrder) => {
              setClientOrders((prev) => [...prev, newOrder]);
              refreshData(true);
            }}
          />
        </div>
      )}

      {activeTab === "research" && (
        <MarketResearch securities={securities} trades={trades} brokerId={user?.id} />
      )}

      {activeTab === "advisory" && (
        <InvestmentAdvisory investors={investors} brokerId={user?.id} />
      )}

      {activeTab === "portfolios" && (
        <PortfolioManagement investors={investors} securities={securities} />
      )}

      {activeTab === "compliance" && (
        <ComplianceAdmin investors={investors} trades={trades} brokerId={user?.id} />
      )}

      {activeTab === "history" && (
        <TradeHistory trades={trades} securities={securities} limitTrades={limitTrades} />
      )}
    </DashboardShell>
  );
}

// ──────────────────────────────────────────────────────────────
// OVERVIEW
// ──────────────────────────────────────────────────────────────

function BrokerOverview({ stats, trades, clientOrders, securities, investors, user, earnings }) {
  const pendingCount  = clientOrders.filter(o => o.status === "pending").length;
  const filledToday   = trades.filter(t => {
    const d = new Date(t.executed_at || t.created_at);
    return !isNaN(d) && d.toDateString() === new Date().toDateString();
  }).length;
  const kycOk  = investors.filter(i => i.kyc_status === "approved").length;
  const kycPct = investors.length ? Math.round((kycOk / investors.length) * 100) : 0;
  const totalVolume = trades.reduce((s, t) => s + Number(t.total || 0), 0);
  const totalFees   = earnings?.totalEarned ?? 0;

  const ROLES = [
    { title: "Order Execution",       desc: "Execute buy/sell orders on behalf of clients promptly and at best available price.", tab: "clients",    icon: ShoppingCart, color: "emerald" },
    { title: "Market Research",        desc: "Analyse securities, track price movements and provide market intelligence.", tab: "research",   icon: TrendingUp,   color: "blue" },
    { title: "Investment Advisory",    desc: "Provide personalised investment guidance based on client risk profiles.",     tab: "advisory",   icon: Lightbulb,    color: "amber" },
    { title: "Portfolio Management",   desc: "Monitor client holdings and ensure alignment with investment objectives.",    tab: "portfolios", icon: PieChart,     color: "purple" },
    { title: "Regulatory Compliance",  desc: "Maintain KYC records and ensure all transactions meet regulatory standards.", tab: "compliance", icon: Shield,       color: "rose" },
    { title: "Facilitating Transactions", desc: "Serve as intermediary between clients and the exchange for seamless trades.", tab: "execute", icon: Briefcase, color: "cyan" },
  ];

  const colorMap = {
    emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
    blue:    "bg-blue-500/10    border-blue-500/20    text-blue-400",
    amber:   "bg-amber-500/10   border-amber-500/20   text-amber-400",
    purple:  "bg-purple-500/10  border-purple-500/20  text-purple-400",
    rose:    "bg-rose-500/10    border-rose-500/20    text-rose-400",
    cyan:    "bg-cyan-500/10    border-cyan-500/20    text-cyan-400",
  };

  return (
    <div className="space-y-6">
      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Pending Orders"   value={pendingCount}                    accent="amber"   icon={Clock} />
        <KpiCard label="Clients"          value={investors.length}                accent="emerald" icon={Users} />
        <KpiCard label="KYC Compliant"    value={`${kycPct}%`}                    accent="blue"    icon={Shield} />
        <KpiCard label="Total Volume"     value={`M${totalVolume.toLocaleString(undefined,{maximumFractionDigits:0})}`} accent="purple" icon={Activity} />
      </div>

      {/* Fee earnings highlight */}
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-emerald-400 uppercase tracking-widest mb-1">Total Fee Earnings (5% per trade)</p>
          <p className="text-3xl font-bold font-mono text-white">M{fmt2(totalFees)}</p>
          <p className="text-xs text-slate-500 mt-1">Across {earnings?.earnings?.length ?? 0} executed transactions</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <KpiCard label="Trades Today"  value={filledToday}         accent="cyan"    icon={BarChart3} />
          <KpiCard label="All Trades"    value={trades.length}       accent="emerald" icon={BarChart3} />
        </div>
      </div>

      {/* Today snapshot */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Fee Rate"         value="5% / trade"                      accent="amber"   icon={Briefcase} />
        <KpiCard label="Securities"       value={securities.length}               accent="blue"    icon={TrendingUp} />
        <KpiCard label="All Trades"       value={trades.length}                   accent="emerald" icon={BarChart3} />
        <KpiCard label="Client Orders"    value={clientOrders.length}             accent="amber"   icon={ShoppingCart} />
      </div>

      {/* Recent fee earnings */}
      {earnings?.earnings?.length > 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-slate-900/60 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.06]">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Recent Commission Earnings</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  {["Security","Type","Trade Total","Fee (5%)","Investor","Date"].map(h => (
                    <th key={h} className="px-4 py-2 text-left text-[11px] font-medium text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {earnings.earnings.slice(0, 8).map((e, idx) => (
                  <tr key={e.order_id ?? idx} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                    <td className="px-4 py-2.5 font-mono font-bold text-emerald-400">{e.security_symbol}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold
                        ${e.type === "buy" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                        {(e.type || "").toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-slate-300">M{fmt2(e.total)}</td>
                    <td className="px-4 py-2.5 font-mono font-semibold text-emerald-400">M{fmt2(e.broker_fee)}</td>
                    <td className="px-4 py-2.5 text-slate-400 text-xs">{e.investor_name || `#${e.investor_id}`}</td>
                    <td className="px-4 py-2.5 text-slate-500 text-xs">{fmtDate(e.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6 roles grid */}
      <div>
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Broker Functions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {ROLES.map((role) => {
            const cls = colorMap[role.color];
            return (
              <div key={role.title}
                className={`rounded-xl border p-4 ${cls} flex flex-col gap-2`}>
                <div className="flex items-center gap-2">
                  <role.icon className="h-4 w-4 flex-shrink-0" />
                  <span className="text-sm font-semibold">{role.title}</span>
                </div>
                <p className="text-xs opacity-70 leading-relaxed">{role.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Securities quick look */}
      {securities.length > 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-slate-900/60 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.06]">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Live Market Snapshot</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  {["Symbol","Name","Price","Available"].map(h => (
                    <th key={h} className="px-4 py-2 text-left text-[11px] font-medium text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {securities.slice(0, 6).map((sec, idx) => (
                  <tr key={sec.id ?? idx} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                    <td className="px-4 py-2.5 font-mono font-bold text-emerald-400">{sec.symbol}</td>
                    <td className="px-4 py-2.5 text-slate-300">{sec.name || "—"}</td>
                    <td className="px-4 py-2.5 font-mono text-white">M{fmt2(sec.price)}</td>
                    <td className="px-4 py-2.5 font-mono text-slate-400">{fmtN(sec.available_tokens)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, accent = "emerald", icon: Icon }) {
  const map = {
    emerald: "border-emerald-500/20 text-emerald-400",
    amber:   "border-amber-500/20   text-amber-400",
    blue:    "border-blue-500/20    text-blue-400",
    purple:  "border-purple-500/20  text-purple-400",
    cyan:    "border-cyan-500/20    text-cyan-400",
    rose:    "border-rose-500/20    text-rose-400",
  };
  return (
    <div className={`rounded-xl border bg-slate-900/60 p-4 flex items-center gap-3 ${map[accent] ?? map.emerald}`}>
      <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-current/10`}>
        <Icon className={`h-4 w-4 ${map[accent]?.split(" ")[1]}`} />
      </div>
      <div>
        <p className="text-[11px] text-slate-500 uppercase tracking-wider font-medium">{label}</p>
        <p className="text-xl font-bold font-mono text-white leading-tight">{value}</p>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// ORDER EXECUTION — Client Orders
// ──────────────────────────────────────────────────────────────

function ClientOrders({ clientOrders, onExecute }) {
  const [filter, setFilter] = useState("pending");
  const [executingIds, setExecutingIds] = useState(new Set());

  const handleExecute = useCallback(async (orderId) => {
    setExecutingIds((prev) => new Set(prev).add(orderId));
    try {
      await onExecute(orderId);
    } finally {
      setExecutingIds((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }
  }, [onExecute]);

  const filtered = filter === "all"
    ? clientOrders
    : clientOrders.filter(o => o.status === filter);

  return (
    <div className="space-y-4">
      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap">
        {["pending","filled","all"].map(f => (
          <button key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all
              ${filter === f
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : "bg-slate-800/60 text-slate-500 border border-white/[0.06] hover:text-slate-300"}`}>
            {f === "all" ? "All" : f}
            {f !== "all" && (
              <span className="ml-1.5 opacity-60">
                ({clientOrders.filter(o => o.status === f).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-slate-900/60 p-12 text-center">
          <ShoppingCart className="mx-auto h-10 w-10 mb-3 text-slate-600" />
          <p className="text-slate-400 font-medium">No {filter === "all" ? "" : filter} orders</p>
          <p className="text-xs text-slate-600 mt-1">Client orders will appear here once submitted.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((order, idx) => (
            <div key={order.id ?? idx}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-white/[0.06] bg-slate-900/60 hover:border-white/[0.10] transition-all">
              {/* Left info */}
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className={`mt-0.5 h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0
                  ${order.side === "BUY" ? "bg-emerald-500/15" : "bg-red-500/15"}`}>
                  {order.side === "BUY"
                    ? <TrendingUp className="h-4 w-4 text-emerald-400" />
                    : <TrendingDown className="h-4 w-4 text-red-400" />}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded
                      ${order.side === "BUY" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                      {order.side}
                    </span>
                    <span className="font-mono font-bold text-white">{order.symbol}</span>
                    <span className="text-slate-400 text-sm">× {fmtN(order.quantity)}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Client: <span className="text-slate-300">{order.clientName}</span>
                    {order.clientEmail && <span className="ml-1 opacity-60">({order.clientEmail})</span>}
                  </p>
                  <p className="text-xs text-slate-500">
                    Price: <span className="font-mono text-slate-300">M{fmt2(order.price)}</span>
                    <span className="mx-2 opacity-40">·</span>
                    Total: <span className="font-mono text-white font-semibold">M{fmt2(order.total)}</span>
                  </p>
                  <p className="text-[11px] text-slate-600 mt-0.5">{fmtDate(order.created_at)}</p>
                </div>
              </div>
              {/* Right — status + action */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider
                  ${order.status === "filled"   ? "bg-emerald-500/15 text-emerald-400"
                  : order.status === "pending"  ? "bg-amber-500/15 text-amber-400"
                  : order.status === "rejected" ? "bg-red-500/15 text-red-400"
                  : "bg-slate-700 text-slate-400"}`}>
                  {order.status}
                </span>
                {order.status === "pending" && (
                  <Button
                    size="sm"
                    disabled={executingIds.has(order.id)}
                    onClick={() => handleExecute(order.id)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white h-8 px-3 text-xs gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {executingIds.has(order.id) ? (
                      <><Loader2 className="h-3 w-3 animate-spin" /> Executing…</>
                    ) : (
                      <><Play className="h-3 w-3" /> Execute</>
                    )}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// FACILITATING TRANSACTIONS — Place & Execute Order
// ──────────────────────────────────────────────────────────────

function ExecuteTrade({ securities, investors, brokerId, onOrderSubmitted }) {
  const [form, setForm] = useState({ clientId: "", securityId: "", side: "buy", quantity: "" });
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (securities.length > 0 && !form.securityId) {
      setForm((prev) => ({ ...prev, securityId: securities[0].id }));
    }
  }, [securities, form.securityId]);

  const update = (key, value) =>
    setForm((prev) => ({
      ...prev,
      [key]: key === "clientId" || key === "securityId" ? Number(value) || "" : value,
    }));

  const selectedSecurity = securities.find((s) => s.id === form.securityId);
  const estimatedTotal   = (Number(form.quantity) || 0) * (Number(selectedSecurity?.price) || 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback(null);
    setLoading(true);
    try {
      if (!brokerId) throw new Error("Broker identity missing");
      const quantity = Number(form.quantity);
      if (!Number.isInteger(quantity) || quantity < 1) throw new Error("Quantity must be a positive whole number");
      const price = Number(selectedSecurity?.price);
      if (!price || price <= 0) throw new Error("Invalid security price");
      if (!form.clientId) throw new Error("Please select a client investor");

      const res = await placeAndExecuteOrder(brokerId, form.clientId, form.securityId, form.side, quantity, price);
      if (!res?.success) throw new Error(res?.message || "Failed to execute order");

      const client = investors.find((i) => i.id === form.clientId);
      onOrderSubmitted({
        id: res.orderId, investor_id: form.clientId, security_id: form.securityId,
        type: form.side, quantity, price, total: quantity * price,
        status: "filled", created_at: new Date().toISOString(),
        clientName: client?.full_name || client?.name || "Client",
        symbol: selectedSecurity?.symbol || "—",
        side: form.side.toUpperCase(),
      });
      setFeedback({ success: true, message: `✅ Order #${res.orderId} executed\n${form.side.toUpperCase()} ${quantity} ${selectedSecurity?.symbol} @ M${fmt2(price)}\nTotal: M${fmt2(quantity * price)} for ${client?.full_name || "client"}` });
      setForm((prev) => ({ ...prev, quantity: "" }));
    } catch (err) {
      setFeedback({ success: false, message: err.message || "Failed to execute order." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl">
      <div className="rounded-2xl border border-white/[0.06] bg-slate-900/60 p-6">
        <h3 className="text-lg font-bold text-white mb-1">Place & Execute Client Order</h3>
        <p className="text-sm text-slate-400 mb-6">As licensed broker, this order is filled immediately.</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Client */}
          <div>
            <Label className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Client Investor</Label>
            <select value={form.clientId} onChange={(e) => update("clientId", e.target.value)} required disabled={loading || investors.length === 0}
              className="w-full mt-2 border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm bg-slate-800 text-white focus:ring-1 focus:ring-emerald-500 outline-none transition-all">
              <option value="">— Select client —</option>
              {investors.map((inv) => (
                <option key={inv.id} value={inv.id}>{inv.full_name || "Investor"} {inv.email ? `(${inv.email})` : ""}</option>
              ))}
            </select>
          </div>

          {/* Side + Security */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Side</Label>
              <div className="mt-2 flex rounded-lg bg-slate-800 p-1 border border-white/[0.08]">
                {["buy", "sell"].map((s) => (
                  <button key={s} type="button" onClick={() => update("side", s)} disabled={loading}
                    className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${
                      form.side === s
                        ? s === "buy" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
                        : "text-slate-500 hover:text-slate-300"}`}>
                    {s.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Security</Label>
              <select value={form.securityId} onChange={(e) => update("securityId", e.target.value)} disabled={loading || securities.length === 0}
                className="w-full mt-2 border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm bg-slate-800 text-white focus:ring-1 focus:ring-emerald-500 outline-none transition-all">
                {securities.map((s) => (
                  <option key={s.id} value={s.id}>{s.symbol} — M{fmt2(s.price)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Quantity */}
          <div>
            <Label className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Quantity</Label>
            <Input type="number" min="1" step="1" placeholder="Number of tokens" value={form.quantity}
              onChange={(e) => update("quantity", e.target.value)} disabled={loading} required
              className="mt-2 bg-slate-800 border-white/[0.08] text-white font-mono placeholder:text-slate-600" />
          </div>

          {/* Preview */}
          {selectedSecurity && form.quantity && !isNaN(estimatedTotal) && (
            <div className="rounded-xl bg-slate-800/60 border border-white/[0.06] p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Price / token</span>
                <span className="font-mono text-white">M{fmt2(selectedSecurity.price)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Trade total</span>
                <span className="font-mono text-white">M{fmt2(estimatedTotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-amber-400 flex items-center gap-1">
                  <Briefcase className="h-3 w-3" /> Broker fee (5%)
                </span>
                <span className="font-mono text-amber-400">M{fmt2(estimatedTotal * BROKER_FEE_RATE)}</span>
              </div>
              <div className="flex justify-between text-base font-bold border-t border-white/[0.06] pt-2">
                <span className="text-slate-300">
                  {form.side === "buy" ? "Total charged to client" : "Net client receives"}
                </span>
                <span className="font-mono text-emerald-400">
                  M{fmt2(form.side === "buy"
                    ? estimatedTotal * (1 + BROKER_FEE_RATE)
                    : estimatedTotal * (1 - BROKER_FEE_RATE))}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 text-right">
                Commission to broker: M{fmt2(estimatedTotal * BROKER_FEE_RATE)}
              </p>
            </div>
          )}

          <Button type="submit" disabled={loading || !brokerId || !form.clientId || !form.quantity || !form.securityId}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5">
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Executing…</> : "Execute Order for Client"}
          </Button>
        </form>

        {feedback && (
          <div className={`mt-5 rounded-xl p-4 border text-sm whitespace-pre-line
            ${feedback.success
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
              : "bg-red-500/10 border-red-500/20 text-red-300"}`}>
            {feedback.message}
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// MARKET RESEARCH & ANALYSIS
// ──────────────────────────────────────────────────────────────

function MarketResearch({ securities, trades, brokerId }) {
  const [search, setSearch]     = useState("");
  const [notes, setNotes]       = useState(() => {
    try { return JSON.parse(localStorage.getItem(`broker_research_${brokerId}`) || "{}"); }
    catch { return {}; }
  });
  const [editingNote, setEditingNote] = useState(null);
  const [noteText, setNoteText]       = useState("");

  const saveNotes = (updated) => {
    setNotes(updated);
    try { localStorage.setItem(`broker_research_${brokerId}`, JSON.stringify(updated)); } catch {}
  };

  const handleSaveNote = (secId) => {
    saveNotes({ ...notes, [secId]: noteText });
    setEditingNote(null);
    setNoteText("");
  };

  // Market stats
  const totalCap      = securities.reduce((s, sec) => s + Number(sec.price || 0) * Number(sec.total_supply || 0), 0);
  const avgPrice      = securities.length ? securities.reduce((s, sec) => s + Number(sec.price || 0), 0) / securities.length : 0;
  const totalTrades   = trades.length;

  const filtered = securities.filter(sec =>
    !search || sec.symbol?.toLowerCase().includes(search.toLowerCase()) || sec.name?.toLowerCase().includes(search.toLowerCase())
  );

  // Compute per-security trade counts
  const tradeCounts = trades.reduce((acc, t) => {
    const id = t.security_id;
    acc[id] = (acc[id] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white mb-0.5">Market Analysis & Research</h2>
        <p className="text-sm text-slate-400">Monitor live securities, track volume, and record research notes per instrument.</p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Listed Securities" value={securities.length}        accent="emerald" icon={Briefcase} />
        <KpiCard label="Avg Price"         value={`M${fmt2(avgPrice)}`}     accent="blue"    icon={TrendingUp} />
        <KpiCard label="Total Market Cap"  value={`M${(totalCap/1e6).toFixed(1)}M`} accent="purple" icon={BarChart3} />
        <KpiCard label="Total Trades"      value={totalTrades}              accent="amber"   icon={Activity} />
      </div>

      {/* Search + table */}
      <div className="rounded-xl border border-white/[0.06] bg-slate-900/60 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/[0.06] flex items-center gap-3">
          <Search className="h-4 w-4 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search symbol or name…"
            className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-600 outline-none" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.04]">
                {["Symbol","Name","Price","Supply","Available","Trades","Research Note"].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[11px] font-medium text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-600">No securities found</td></tr>
              ) : filtered.map((sec, idx) => (
                <tr key={sec.id ?? idx} className="border-b border-white/[0.03] hover:bg-white/[0.02] group">
                  <td className="px-4 py-3 font-mono font-bold text-emerald-400">{sec.symbol}</td>
                  <td className="px-4 py-3 text-slate-300 max-w-[160px] truncate">{sec.name || "—"}</td>
                  <td className="px-4 py-3 font-mono text-white">M{fmt2(sec.price)}</td>
                  <td className="px-4 py-3 font-mono text-slate-400">{fmtN(sec.total_supply)}</td>
                  <td className="px-4 py-3 font-mono text-slate-400">{fmtN(sec.available_tokens)}</td>
                  <td className="px-4 py-3 font-mono text-slate-400">{tradeCounts[sec.id] || 0}</td>
                  <td className="px-4 py-3">
                    {editingNote === sec.id ? (
                      <div className="flex items-center gap-2">
                        <input autoFocus value={noteText} onChange={e => setNoteText(e.target.value)}
                          placeholder="Add research note…"
                          className="flex-1 bg-slate-800 border border-white/[0.08] rounded px-2 py-1 text-xs text-white outline-none focus:border-emerald-500/50" />
                        <button onClick={() => handleSaveNote(sec.id)}
                          className="text-emerald-400 hover:text-emerald-300"><Save className="h-3.5 w-3.5" /></button>
                        <button onClick={() => { setEditingNote(null); setNoteText(""); }}
                          className="text-slate-600 hover:text-slate-400"><XCircle className="h-3.5 w-3.5" /></button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditingNote(sec.id); setNoteText(notes[sec.id] || ""); }}
                        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors">
                        <FileText className="h-3 w-3" />
                        <span className="max-w-[160px] truncate">{notes[sec.id] || <em className="opacity-40">Add note</em>}</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Insight cards */}
      <div>
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Research Insights</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { icon: TrendingUp, color: "emerald", title: "Most Traded",
              body: (() => { const top = Object.entries(tradeCounts).sort((a,b)=>b[1]-a[1])[0]; const s = securities.find(sec=>sec.id===Number(top?.[0])); return top ? `${s?.symbol || "N/A"} — ${top[1]} trades` : "No trades yet"; })() },
            { icon: Star, color: "amber", title: "Highest Price",
              body: (() => { const s = [...securities].sort((a,b)=>Number(b.price)-Number(a.price))[0]; return s ? `${s.symbol} @ M${fmt2(s.price)}` : "—"; })() },
            { icon: Target, color: "blue", title: "Largest Supply",
              body: (() => { const s = [...securities].sort((a,b)=>Number(b.total_supply)-Number(a.total_supply))[0]; return s ? `${s.symbol} — ${fmtN(s.total_supply)} tokens` : "—"; })() },
            { icon: Activity, color: "purple", title: "Best Liquidity",
              body: (() => { const s = [...securities].sort((a,b)=>Number(b.available_tokens)-Number(a.available_tokens))[0]; return s ? `${s.symbol} — ${fmtN(s.available_tokens)} available` : "—"; })() },
          ].map(item => (
            <div key={item.title} className={`rounded-xl border p-4
              ${item.color === "emerald" ? "border-emerald-500/20 bg-emerald-500/5"
              : item.color === "amber"   ? "border-amber-500/20  bg-amber-500/5"
              : item.color === "blue"    ? "border-blue-500/20   bg-blue-500/5"
              :                            "border-purple-500/20  bg-purple-500/5"}`}>
              <div className="flex items-center gap-2 mb-1">
                <item.icon className={`h-4 w-4 ${item.color === "emerald" ? "text-emerald-400" : item.color === "amber" ? "text-amber-400" : item.color === "blue" ? "text-blue-400" : "text-purple-400"}`} />
                <span className="text-xs font-semibold text-slate-300">{item.title}</span>
              </div>
              <p className="font-mono text-sm text-white">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// INVESTMENT ADVISORY
// ──────────────────────────────────────────────────────────────

const RISK_PROFILES = ["Conservative", "Moderate", "Aggressive"];
const RISK_COLORS   = { Conservative: "blue", Moderate: "amber", Aggressive: "rose" };

function InvestmentAdvisory({ investors, brokerId }) {
  const [selected, setSelected] = useState(null);
  const [profiles, setProfiles] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`broker_advisory_${brokerId}`) || "{}"); }
    catch { return {}; }
  });
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);

  const client = investors.find(i => i.id === selected);

  const saveProfile = () => {
    const updated = { ...profiles, [selected]: { ...profiles[selected], notes } };
    setProfiles(updated);
    try { localStorage.setItem(`broker_advisory_${brokerId}`, JSON.stringify(updated)); } catch {}
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const setRisk = (risk) => {
    const updated = { ...profiles, [selected]: { ...profiles[selected], risk } };
    setProfiles(updated);
    try { localStorage.setItem(`broker_advisory_${brokerId}`, JSON.stringify(updated)); } catch {}
  };

  const handleSelect = (id) => {
    setSelected(id);
    setNotes(profiles[id]?.notes || "");
    setSaved(false);
  };

  const RECOMMENDATIONS = {
    Conservative: [
      "Focus on low-volatility, dividend-paying securities",
      "Limit equity exposure to ≤ 40% of portfolio",
      "Prioritise capital preservation over growth",
      "Review holdings quarterly",
    ],
    Moderate: [
      "Balanced mix of growth and income securities",
      "Target equity/fixed-income split of 60/40",
      "Diversify across at least 5 different securities",
      "Review holdings semi-annually",
    ],
    Aggressive: [
      "Maximise exposure to high-growth securities",
      "Accept higher short-term volatility for long-term gains",
      "Monitor portfolio weekly",
      "Suitable for long-term investment horizon (5+ years)",
    ],
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white mb-0.5">Investment Advisory</h2>
        <p className="text-sm text-slate-400">Assign risk profiles and record personalised advisory notes for each client.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Client list */}
        <div className="rounded-xl border border-white/[0.06] bg-slate-900/60 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.06]">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Clients ({investors.length})</span>
          </div>
          {investors.length === 0 ? (
            <div className="p-6 text-center text-slate-600 text-sm">No registered clients yet.</div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {investors.map(inv => {
                const risk = profiles[inv.id]?.risk;
                const col  = risk ? RISK_COLORS[risk] : null;
                return (
                  <button key={inv.id} onClick={() => handleSelect(inv.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all
                      ${selected === inv.id ? "bg-emerald-500/10" : "hover:bg-white/[0.03]"}`}>
                    <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-slate-300">{(inv.full_name || "?")[0].toUpperCase()}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white truncate">{inv.full_name}</p>
                      {risk && (
                        <span className={`text-[10px] font-semibold
                          ${col === "blue" ? "text-blue-400" : col === "amber" ? "text-amber-400" : "text-rose-400"}`}>
                          {risk}
                        </span>
                      )}
                    </div>
                    <ChevronRight className={`h-4 w-4 flex-shrink-0 transition-colors ${selected === inv.id ? "text-emerald-400" : "text-slate-700"}`} />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Advisory panel */}
        <div className="lg:col-span-2 rounded-xl border border-white/[0.06] bg-slate-900/60 p-5">
          {!client ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center gap-3">
              <Lightbulb className="h-10 w-10 text-slate-700" />
              <p className="text-slate-500 text-sm">Select a client to view their advisory profile.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Client header */}
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-slate-700 flex items-center justify-center">
                  <span className="text-lg font-bold text-white">{(client.full_name || "?")[0].toUpperCase()}</span>
                </div>
                <div>
                  <p className="font-semibold text-white">{client.full_name}</p>
                  <p className="text-xs text-slate-500">{client.email}</p>
                  <p className="text-xs text-slate-600">Client since {fmtDate(client.assigned_at)}</p>
                </div>
              </div>

              {/* Risk profile */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Risk Profile</p>
                <div className="flex gap-2">
                  {RISK_PROFILES.map(r => {
                    const col = RISK_COLORS[r];
                    const active = profiles[selected]?.risk === r;
                    return (
                      <button key={r} onClick={() => setRisk(r)}
                        className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-all
                          ${active
                            ? col === "blue" ? "bg-blue-500/20 border-blue-500/40 text-blue-400"
                            : col === "amber" ? "bg-amber-500/20 border-amber-500/40 text-amber-400"
                            : "bg-rose-500/20 border-rose-500/40 text-rose-400"
                          : "border-white/[0.06] text-slate-500 hover:text-slate-300 hover:border-white/10"}`}>
                        {r}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Recommendations */}
              {profiles[selected]?.risk && (
                <div className="rounded-xl border border-white/[0.06] bg-slate-800/40 p-4">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Target className="h-3.5 w-3.5" /> Recommendations for {profiles[selected].risk} Profile
                  </p>
                  <ul className="space-y-1.5">
                    {RECOMMENDATIONS[profiles[selected].risk].map((rec, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500/60 flex-shrink-0 mt-0.5" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Advisory notes */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Advisory Notes</p>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4}
                  placeholder="Record investment objectives, constraints, specific instructions…"
                  className="w-full bg-slate-800 border border-white/[0.08] rounded-lg p-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-emerald-500/40 resize-none transition-all" />
              </div>

              <button onClick={saveProfile}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all
                  ${saved ? "bg-emerald-600/80 text-white" : "bg-slate-700 hover:bg-slate-600 text-slate-300"}`}>
                {saved ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                {saved ? "Saved!" : "Save Advisory Notes"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// PORTFOLIO MANAGEMENT
// ──────────────────────────────────────────────────────────────

function PortfolioManagement({ investors, securities }) {
  const [selected, setSelected]     = useState(null);
  const [portfolio, setPortfolio]   = useState(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);

  const loadPortfolio = async (clientId) => {
    setSelected(clientId);
    setPortfolio(null);
    setError(null);
    setLoading(true);
    try {
      const res = await getPortfolio(clientId);
      setPortfolio(res);
    } catch (err) {
      setError(err.message || "Failed to load portfolio");
    } finally {
      setLoading(false);
    }
  };

  const client = investors.find(i => i.id === selected);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white mb-0.5">Portfolio Management</h2>
        <p className="text-sm text-slate-400">View and monitor each client's holdings and portfolio performance.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Client picker */}
        <div className="rounded-xl border border-white/[0.06] bg-slate-900/60 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.06]">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Select Client</span>
          </div>
          {investors.length === 0 ? (
            <div className="p-6 text-center text-slate-600 text-sm">No registered clients.</div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {investors.map(inv => (
                <button key={inv.id} onClick={() => loadPortfolio(inv.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all
                    ${selected === inv.id ? "bg-emerald-500/10 border-l-2 border-emerald-500" : "hover:bg-white/[0.03]"}`}>
                  <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-slate-300">{(inv.full_name || "?")[0].toUpperCase()}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{inv.full_name}</p>
                    <p className="text-[11px] text-slate-500 truncate">{inv.email}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Portfolio details */}
        <div className="lg:col-span-3">
          {!selected ? (
            <div className="rounded-xl border border-white/[0.06] bg-slate-900/60 flex flex-col items-center justify-center min-h-[300px] gap-3">
              <PieChart className="h-10 w-10 text-slate-700" />
              <p className="text-slate-500 text-sm">Select a client to view their portfolio.</p>
            </div>
          ) : loading ? (
            <div className="rounded-xl border border-white/[0.06] bg-slate-900/60 flex flex-col items-center justify-center min-h-[300px] gap-3">
              <RefreshCw className="h-8 w-8 text-emerald-500 animate-spin" />
              <p className="text-slate-400 text-sm">Loading portfolio…</p>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
              <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          ) : portfolio ? (
            <div className="space-y-4">
              {/* Portfolio KPIs */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-white/[0.06] bg-slate-900/60 p-4">
                  <p className="text-[11px] text-slate-500 uppercase tracking-wider">Total Value</p>
                  <p className="text-xl font-bold font-mono text-white">M{fmt2(portfolio.totalValue)}</p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-slate-900/60 p-4">
                  <p className="text-[11px] text-slate-500 uppercase tracking-wider">Holdings</p>
                  <p className="text-xl font-bold font-mono text-white">{portfolio.portfolio?.length || 0}</p>
                </div>
                <div className={`rounded-xl border p-4 ${Number(portfolio.totalGain) >= 0 ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5"}`}>
                  <p className="text-[11px] text-slate-500 uppercase tracking-wider">Total Gain/Loss</p>
                  <p className={`text-xl font-bold font-mono ${Number(portfolio.totalGain) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {Number(portfolio.totalGain) >= 0 ? "+" : ""}M{fmt2(portfolio.totalGain)}
                  </p>
                </div>
              </div>

              {/* Holdings table */}
              <div className="rounded-xl border border-white/[0.06] bg-slate-900/60 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Holdings — {client?.full_name}
                  </span>
                </div>
                {!portfolio.portfolio?.length ? (
                  <div className="p-8 text-center text-slate-600 text-sm">This client has no holdings yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/[0.04]">
                          {["Security","Symbol","Units","Buy Price","Current Price","Value","Gain/Loss"].map(h => (
                            <th key={h} className="px-4 py-2.5 text-left text-[11px] font-medium text-slate-500 uppercase tracking-wider">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {portfolio.portfolio.map((h, idx) => {
                          const gain = Number(h.gain ?? 0);
                          return (
                            <tr key={h.security_id ?? idx} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                              <td className="px-4 py-3 text-slate-300">{h.name || "—"}</td>
                              <td className="px-4 py-3 font-mono font-bold text-emerald-400">{h.symbol || "—"}</td>
                              <td className="px-4 py-3 font-mono text-white">{fmtN(h.units)}</td>
                              <td className="px-4 py-3 font-mono text-slate-400">M{fmt2(h.avgCost)}</td>
                              <td className="px-4 py-3 font-mono text-white">M{fmt2(h.price)}</td>
                              <td className="px-4 py-3 font-mono font-semibold text-white">M{fmt2(h.currentValue)}</td>
                              <td className={`px-4 py-3 font-mono font-semibold ${gain >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                {gain >= 0 ? "+" : ""}M{fmt2(gain)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// REGULATORY COMPLIANCE & ADMINISTRATION
// ──────────────────────────────────────────────────────────────

const COMPLIANCE_ITEMS = [
  "KYC documents verified",
  "Risk disclosure acknowledged",
  "Investment agreement signed",
  "Suitability assessment completed",
  "Client information up to date",
];

function ComplianceAdmin({ investors, trades, brokerId }) {
  const [checklist, setChecklist] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`broker_compliance_${brokerId}`) || "{}"); }
    catch { return {}; }
  });

  const toggleCheck = (clientId, item) => {
    const key = `${clientId}_${item}`;
    const updated = { ...checklist, [key]: !checklist[key] };
    setChecklist(updated);
    try { localStorage.setItem(`broker_compliance_${brokerId}`, JSON.stringify(updated)); } catch {}
  };

  const clientScore = (clientId) => {
    const done = COMPLIANCE_ITEMS.filter(item => checklist[`${clientId}_${item}`]).length;
    return { done, total: COMPLIANCE_ITEMS.length };
  };

  const kycLabel = (status) => {
    if (!status || status === "pending")    return { label: "Pending",  cls: "bg-slate-700 text-slate-400" };
    if (status === "submitted")             return { label: "Submitted", cls: "bg-amber-500/15 text-amber-400" };
    if (status === "approved")              return { label: "Approved",  cls: "bg-emerald-500/15 text-emerald-400" };
    if (status === "rejected")              return { label: "Rejected",  cls: "bg-red-500/15 text-red-400" };
    return { label: status, cls: "bg-slate-700 text-slate-400" };
  };

  const allCompliant = investors.filter(i => {
    const { done, total } = clientScore(i.id);
    return i.kyc_status === "approved" && done === total;
  }).length;

  const [expanded, setExpanded] = useState(null);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white mb-0.5">Regulatory Compliance & Administration</h2>
        <p className="text-sm text-slate-400">Track KYC status, compliance checklists, and maintain regulatory records per client.</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Total Clients"   value={investors.length}                                     accent="blue"    icon={Users} />
        <KpiCard label="KYC Approved"    value={investors.filter(i=>i.kyc_status==="approved").length} accent="emerald" icon={CheckCircle2} />
        <KpiCard label="KYC Pending"     value={investors.filter(i=>!i.kyc_status||i.kyc_status==="pending"||i.kyc_status==="submitted").length} accent="amber" icon={Clock} />
        <KpiCard label="Fully Compliant" value={allCompliant}                                         accent="purple"  icon={Shield} />
      </div>

      {/* Client compliance table */}
      <div className="rounded-xl border border-white/[0.06] bg-slate-900/60 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/[0.06]">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Client Compliance Status</span>
        </div>

        {investors.length === 0 ? (
          <div className="p-8 text-center text-slate-600 text-sm">No registered clients yet.</div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {investors.map(inv => {
              const kyc     = kycLabel(inv.kyc_status);
              const { done, total } = clientScore(inv.id);
              const pct     = Math.round((done / total) * 100);
              const isOpen  = expanded === inv.id;

              return (
                <div key={inv.id}>
                  {/* Row */}
                  <button onClick={() => setExpanded(isOpen ? null : inv.id)}
                    className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.02] transition-all text-left">
                    {/* Avatar */}
                    <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-slate-300">{(inv.full_name||"?")[0].toUpperCase()}</span>
                    </div>
                    {/* Name + email */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{inv.full_name}</p>
                      <p className="text-xs text-slate-500 truncate">{inv.email}</p>
                    </div>
                    {/* KYC badge */}
                    <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex-shrink-0 ${kyc.cls}`}>{kyc.label}</span>
                    {/* Progress */}
                    <div className="hidden sm:flex items-center gap-2 flex-shrink-0 w-32">
                      <div className="flex-1 h-1.5 rounded-full bg-slate-700 overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${pct === 100 ? "bg-emerald-500" : pct > 50 ? "bg-amber-500" : "bg-rose-500"}`}
                          style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[11px] text-slate-500 font-mono w-10 text-right">{done}/{total}</span>
                    </div>
                    {/* Assigned date */}
                    <span className="hidden lg:block text-xs text-slate-600 flex-shrink-0 w-24 text-right">
                      {fmtDate(inv.assigned_at)}
                    </span>
                    <ChevronRight className={`h-4 w-4 text-slate-600 flex-shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                  </button>

                  {/* Checklist expansion */}
                  {isOpen && (
                    <div className="px-6 pb-4 bg-slate-800/30">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 pt-2">Compliance Checklist</p>
                      <div className="space-y-1.5">
                        {COMPLIANCE_ITEMS.map(item => {
                          const key   = `${inv.id}_${item}`;
                          const done  = checklist[key];
                          return (
                            <label key={item} className="flex items-center gap-3 cursor-pointer group">
                              <div onClick={() => toggleCheck(inv.id, item)}
                                className={`h-4 w-4 rounded border flex items-center justify-center flex-shrink-0 transition-all
                                  ${done ? "bg-emerald-500 border-emerald-500" : "border-slate-600 group-hover:border-slate-400"}`}>
                                {done && <CheckCircle2 className="h-3 w-3 text-white" />}
                              </div>
                              <span className={`text-sm transition-colors ${done ? "text-slate-400 line-through" : "text-slate-300"}`}>
                                {item}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                      {/* Client details */}
                      <div className="mt-3 pt-3 border-t border-white/[0.06] grid grid-cols-2 gap-2 text-xs">
                        {[
                          ["Phone",     inv.phone || "—"],
                          ["Account",   inv.is_active ? "Active" : "Inactive"],
                          ["KYC",       (inv.kyc_status || "pending").replace(/^\w/, c => c.toUpperCase())],
                          ["Member since", fmtDate(inv.created_at)],
                        ].map(([k, v]) => (
                          <div key={k}>
                            <span className="text-slate-600">{k}: </span>
                            <span className="text-slate-300">{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Regulatory reminders */}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
        <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" /> Regulatory Reminders
        </h3>
        <ul className="space-y-1 text-xs text-amber-300/70">
          {[
            "Ensure all client KYC documents are current and re-verified annually.",
            "Record and retain all client communications and trade instructions for 5 years.",
            "Report suspicious transactions to the Financial Intelligence Centre (FIC) within 24 hours.",
            "Obtain signed suitability assessment before recommending any investment product.",
            "Maintain segregation of client funds from firm's own assets at all times.",
          ].map((r, i) => <li key={i} className="flex items-start gap-2"><span className="mt-0.5 opacity-50">•</span>{r}</li>)}
        </ul>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// LIMIT ORDER TRADES (order-book fills visible to broker)
// ──────────────────────────────────────────────────────────────

function LimitOrderTrades({ limitTrades }) {
  if (!limitTrades?.length) return (
    <div className="rounded-xl border border-white/[0.06] bg-slate-900/60 p-6">
      <div className="flex items-center gap-2 mb-1">
        <Activity className="h-4 w-4 text-blue-400" />
        <h3 className="text-sm font-semibold text-slate-300">Limit Order Fills</h3>
      </div>
      <p className="text-xs text-slate-600 mt-2">No limit order trades have been settled yet.</p>
    </div>
  );

  return (
    <div className="rounded-xl border border-white/[0.06] bg-slate-900/60 overflow-hidden">
      <div className="px-5 py-3 border-b border-white/[0.06] flex items-center gap-2">
        <Activity className="h-4 w-4 text-blue-400" />
        <span className="text-xs font-semibold text-slate-300 uppercase tracking-widest">
          Limit Order Fills ({limitTrades.length})
        </span>
        <span className="ml-auto text-[10px] text-slate-600">Resting (open/partial) orders are hidden</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.04]">
              {["Settled","Security","Buyer","Seller","Qty","Price","Total","Clearing Fee"].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-[11px] font-medium text-slate-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {limitTrades.map((t, idx) => (
              <tr key={t.id ?? idx} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                <td className="px-4 py-3 text-xs font-mono text-slate-500">
                  {t.settled_at ? new Date(t.settled_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                </td>
                <td className="px-4 py-3">
                  <span className="font-mono font-bold text-emerald-400">{t.symbol}</span>
                  <div className="text-[10px] text-slate-600 truncate max-w-[100px]">{t.security_name}</div>
                </td>
                <td className="px-4 py-3 text-xs text-slate-300">{t.buyer_name || `#${t.buyer_id}`}</td>
                <td className="px-4 py-3 text-xs text-slate-300">{t.seller_name || `#${t.seller_id}`}</td>
                <td className="px-4 py-3 font-mono text-white">{fmtN(t.quantity)}</td>
                <td className="px-4 py-3 font-mono text-slate-300">M{fmt2(t.price)}</td>
                <td className="px-4 py-3 font-mono font-semibold text-white">M{fmt2(t.total)}</td>
                <td className="px-4 py-3 font-mono text-amber-400">
                  M{fmt2((Number(t.buyer_fee) || 0) + (Number(t.seller_fee) || 0))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// TRADE HISTORY
// ──────────────────────────────────────────────────────────────

function TradeHistory({ trades, securities, limitTrades = [] }) {
  const [view, setView] = useState("market");

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white mb-0.5">Trade History</h2>
          <p className="text-sm text-slate-400">Complete record of all executed trades on this platform.</p>
        </div>
        <div className="flex gap-2">
          {[["market","Market Orders"],["limit","Limit Order Fills"]].map(([v, label]) => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all
                ${view === v
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "bg-slate-800/60 text-slate-500 border border-white/[0.06] hover:text-slate-300"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {view === "market" && (
        <div className="rounded-xl border border-white/[0.06] bg-slate-900/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  {["Time","Security","Type","Qty","Price","Total","Fee (5%)","Status","On-Chain"].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-medium text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trades.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-600">No market trades recorded yet</td>
                  </tr>
                ) : trades.slice().reverse().map((trade, idx) => {
                  const sec    = securities.find(s => s.id === (trade.security_id || trade.securityId));
                  const tv     = trade.executed_at || trade.created_at;
                  let fmtTime  = "—";
                  try {
                    const d = new Date(tv);
                    if (!isNaN(d)) fmtTime = d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).replace(/,\s*/, " ");
                  } catch {}
                  const isBuy  = (trade.type || "").trim().toLowerCase() === "buy";
                  const fee    = Number(trade.broker_fee ?? 0) || +(Number(trade.total || 0) * BROKER_FEE_RATE).toFixed(2);

                  return (
                    <tr key={trade.id ?? idx} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                      <td className="px-4 py-3 text-xs font-mono text-slate-500">{fmtTime}</td>
                      <td className="px-4 py-3">
                        <div className="font-mono font-bold text-emerald-400">{sec?.symbol || `#${trade.security_id || "?"}`}</div>
                        <div className="text-xs text-slate-500 truncate max-w-[120px]">{sec?.name || "—"}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold
                          ${isBuy ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                          {(trade.type || "—").toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-white">{fmtN(trade.quantity)}</td>
                      <td className="px-4 py-3 font-mono text-slate-300">M{fmt2(trade.price)}</td>
                      <td className="px-4 py-3 font-mono font-semibold text-white">M{fmt2(trade.total)}</td>
                      <td className="px-4 py-3 font-mono font-semibold text-amber-400">M{fmt2(fee)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold
                          ${trade.status?.toLowerCase() === "filled"  ? "bg-emerald-500/15 text-emerald-400"
                          : trade.status?.toLowerCase() === "pending" ? "bg-amber-500/15 text-amber-400"
                          :                                              "bg-slate-700 text-slate-400"}`}>
                          {(trade.status || "—").toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {trade.onchain_tx_hash ? (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 font-mono text-xs text-emerald-400" title={trade.onchain_tx_hash}>
                            <LinkIcon className="h-3 w-3" />
                            {trade.onchain_tx_hash.slice(0, 10)}…
                          </span>
                        ) : <span className="text-slate-700 text-xs">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === "limit" && (
        limitTrades.length === 0 ? (
          <div className="rounded-xl border border-white/[0.06] bg-slate-900/60 p-10 text-center">
            <Activity className="mx-auto h-10 w-10 mb-3 text-slate-600" />
            <p className="text-slate-400 font-medium">No limit order fills yet</p>
            <p className="text-xs text-slate-600 mt-1">Settled order-book matches will appear here.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-white/[0.06] bg-slate-900/60 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.04]">
                    {["Settled","Security","Buyer","Seller","Qty","Price","Total","Clearing Fee"].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-[11px] font-medium text-slate-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {limitTrades.map((t, idx) => (
                    <tr key={t.id ?? idx} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                      <td className="px-4 py-3 text-xs font-mono text-slate-500">
                        {t.settled_at ? new Date(t.settled_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-emerald-400">{t.symbol}</span>
                        <div className="text-[10px] text-slate-600 truncate max-w-[100px]">{t.security_name}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-300">{t.buyer_name || `#${t.buyer_id}`}</td>
                      <td className="px-4 py-3 text-xs text-slate-300">{t.seller_name || `#${t.seller_id}`}</td>
                      <td className="px-4 py-3 font-mono text-white">{fmtN(t.quantity)}</td>
                      <td className="px-4 py-3 font-mono text-slate-300">M{fmt2(t.price)}</td>
                      <td className="px-4 py-3 font-mono font-semibold text-white">M{fmt2(t.total)}</td>
                      <td className="px-4 py-3 font-mono text-amber-400">
                        M{fmt2((Number(t.buyer_fee) || 0) + (Number(t.seller_fee) || 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </div>
  );
}
