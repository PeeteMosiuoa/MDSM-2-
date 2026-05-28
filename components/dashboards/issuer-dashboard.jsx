"use client";

import { useState, useEffect, useCallback } from "react";
import {
  LayoutDashboard,
  FileText,
  Building2,
  BarChart3,
  PlusCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  DollarSign,
  TrendingUp,
  Landmark,
  BarChart2,
  Info,
  ChevronDown,
  ChevronUp,
  Calendar,
  Send,
  AlertTriangle,
  XCircle,
  RefreshCw,
  FileCheck,
  Upload,
  Paperclip,
  Download,
  X,
} from "lucide-react";
import DashboardShell from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getListings,
  submitListing,
  getAlerts,
  getIssuerProfilesForUser,
  getIssuerSecurityStats,
  getIssuerTrades,
  getTokenHolders,
  getDividends,
  declareDividend,
  processDividend,
  getReportDeadlines,
  getIssuerReports,
  submitReport,
} from "@/lib/store";

const NAV_ITEMS = [
  { id: "overview",       label: "Overview",          icon: LayoutDashboard },
  { id: "listings",       label: "My Securities",     icon: FileText },
  { id: "trading",        label: "Trading Activity",  icon: TrendingUp },
  { id: "dividends",      label: "Dividends",         icon: DollarSign },
  { id: "reports",        label: "Reports",           icon: FileCheck },
  { id: "tokens",         label: "Token Management",  icon: BarChart3 },
  { id: "new-listing",    label: "Submit Security",   icon: PlusCircle },
  { id: "company",        label: "Company Data",      icon: Building2 },
];

export default function IssuerDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [securities, setSecurities] = useState([]);
  const [myListings, setMyListings] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [tokenStats, setTokenStats] = useState([]);
  const [issuerTrades, setIssuerTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Issuer profile → get the issuers.id for stats queries
  const [issuerId, setIssuerId] = useState(null);

  const refreshData = useCallback(async (silent = false) => {
    if (!user?.id) return;
    if (!silent) setLoading(true);
    setError(null);

    try {
      const [listingsRes, alertsRes, issuersRes] = await Promise.all([
        getListings(user),
        getAlerts(user.id),
        getIssuerProfilesForUser(user.id),
      ]);

      const fetchedListings = Array.isArray(listingsRes) ? listingsRes : listingsRes?.rows ?? [];
      const fetchedAlerts   = Array.isArray(alertsRes)   ? alertsRes   : [];
      const issuerProfile   = Array.isArray(issuersRes)  ? issuersRes[0] : issuersRes;

      // Only show this issuer's own approved/listed securities in overview stats
      const fetchedSecurities = fetchedListings.filter(
        (s) => s.approved || s.status === "listed"
      );

      setSecurities(fetchedSecurities);
      setMyListings(fetchedListings);
      setAlerts(fetchedAlerts);

      if (issuerProfile?.id) {
        setIssuerId(issuerProfile.id);
        const [stats, trades] = await Promise.all([
          getIssuerSecurityStats(issuerProfile.id).catch(() => []),
          getIssuerTrades(issuerProfile.id).catch(() => []),
        ]);
        setTokenStats(Array.isArray(stats) ? stats : []);
        setIssuerTrades(Array.isArray(trades) ? trades : []);
      }
    } catch (err) {
      console.error("refreshData failed:", err);
      setError("Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    refreshData(false);
    const interval = setInterval(() => refreshData(true), 30000); // silent every 30s
    return () => clearInterval(interval);
  }, [refreshData]);

  const handleNewListingSuccess = useCallback(() => {
    refreshData(false);
    setActiveTab("listings");
  }, [refreshData]);

  if (loading && securities.length === 0 && myListings.length === 0) {
    return (
      <DashboardShell user={user} onLogout={onLogout} navItems={NAV_ITEMS} activeTab={activeTab}>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
            <p className="text-muted-foreground">Loading dashboard…</p>
          </div>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      user={user}
      onLogout={onLogout}
      navItems={NAV_ITEMS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      alerts={alerts}
    >
      {error && (
        <div className="mb-6 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            <p>{error}</p>
          </div>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => refreshData(false)}>
            Try Again
          </Button>
        </div>
      )}

      {activeTab === "overview"       && <IssuerOverview securities={securities} listings={myListings} tokenStats={tokenStats} />}
      {activeTab === "listings"       && <MyListings listings={myListings} securities={securities} />}
      {activeTab === "trading"        && <TradingActivity trades={issuerTrades} onRefresh={() => refreshData(true)} />}
      {activeTab === "dividends"      && <DividendManager user={user} securities={myListings} />}
      {activeTab === "reports"        && <ReportsManager user={user} issuerId={issuerId} securities={myListings} />}
      {activeTab === "tokens"         && <TokenManagement tokenStats={tokenStats} />}
      {activeTab === "new-listing"    && <NewListingForm user={user} onSuccess={handleNewListingSuccess} />}
      {activeTab === "company"        && <CompanyData user={user} />}
    </DashboardShell>
  );
}

// ────────────────────────────────────────────────
// IssuerOverview
// ────────────────────────────────────────────────
function IssuerOverview({ securities, listings, tokenStats }) {
  const stats = Array.isArray(tokenStats) ? tokenStats : [];

  const totalMarketCap  = stats.reduce((s, t) => s + Number(t.price ?? 0) * Number(t.total_supply ?? 0), 0);
  const totalTokens     = stats.reduce((s, t) => s + Number(t.total_supply ?? 0), 0);
  const totalVolume     = stats.reduce((s, t) => s + Number(t.total_volume ?? 0), 0);
  const pendingCount    = listings.filter((l) => !l.approved).length;

  const fmt  = (v) => `M${Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtN = (v) => Number(v || 0).toLocaleString();

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Listed Securities"  value={stats.filter(s => s.approved).length} icon={BarChart3} />
        <StatCard title="Pending Approval"   value={pendingCount}                         icon={Clock} />
        <StatCard title="Total Market Cap"   value={fmt(totalMarketCap)}                  icon={Building2} />
        <StatCard title="Tokens in Circulation" value={fmtN(totalTokens)}                icon={BarChart3} />
      </div>

      {stats.length > 0 && (
        <div className="rounded-xl border bg-card p-5">
          <h3 className="mb-4 text-lg font-semibold">Your Securities Performance</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary text-left">
                  <th className="px-4 py-3 font-medium text-muted-foreground">Symbol</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Name</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Price</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Supply</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Holders</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Trades</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Volume</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => (
                  <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                    <td className="px-4 py-3 font-mono font-bold">{s.symbol}</td>
                    <td className="px-4 py-3">{s.name}</td>
                    <td className="px-4 py-3 text-right font-mono">{fmt(s.price)}</td>
                    <td className="px-4 py-3 text-right font-mono">{fmtN(s.total_supply)}</td>
                    <td className="px-4 py-3 text-right font-mono">{s.holder_count ?? 0}</td>
                    <td className="px-4 py-3 text-right font-mono">{s.trade_count ?? 0}</td>
                    <td className="px-4 py-3 text-right font-mono">{fmt(s.total_volume)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={s.approved ? "approved" : "pending"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Total Volume stat */}
      {totalVolume > 0 && (
        <div className="rounded-xl border bg-card p-4 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Total Trading Volume (all securities)</span>
          <span className="text-xl font-bold">{fmt(totalVolume)}</span>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────
// TradingActivity — secondary-market trades for issuer's securities
// ────────────────────────────────────────────────
function TradingActivity({ trades, onRefresh }) {
  const [filterSymbol, setFilterSymbol] = useState("all");
  const list = Array.isArray(trades) ? trades : [];

  // Unique symbols for the filter pills
  const symbols = [...new Set(list.map((t) => t.symbol).filter(Boolean))];

  const filtered = filterSymbol === "all"
    ? list
    : list.filter((t) => t.symbol === filterSymbol);

  const totalVolume = filtered.reduce((s, t) => s + Number(t.total ?? 0), 0);
  const totalTrades = filtered.length;

  const fmt   = (v) => `M${Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtN  = (v) => Number(v || 0).toLocaleString();
  const fmtDt = (v) => v ? new Date(v).toLocaleString("en-ZA", { dateStyle: "short", timeStyle: "short" }) : "—";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">Trading Activity</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Secondary-market trades on your securities
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* Summary strip */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total Trades</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{fmtN(totalTrades)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total Volume</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{fmt(totalVolume)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Securities Traded</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{symbols.length}</p>
        </div>
      </div>

      {/* Symbol filter pills */}
      {symbols.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {["all", ...symbols].map((sym) => (
            <button
              key={sym}
              onClick={() => setFilterSymbol(sym)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                filterSymbol === sym
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:text-foreground"
              }`}
            >
              {sym === "all" ? "All" : sym}
            </button>
          ))}
        </div>
      )}

      {/* Trades table */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card py-16 text-center">
          <TrendingUp className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">No trades yet</p>
          <p className="text-xs text-muted-foreground">
            Trades will appear here once investors buy or sell your securities on the secondary market.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary text-left">
                {["Date", "Security", "Buyer", "Seller", "Qty", "Price", "Total", "Fee", "Status"].map((h) => (
                  <th
                    key={h}
                    className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground ${
                      ["Qty","Price","Total","Fee"].includes(h) ? "text-right" : ""
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((t, i) => {
                const isFilled = !t.status || t.status === "settled" || t.status === "filled";
                return (
                  <tr key={t.id ?? i} className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {fmtDt(t.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono font-bold text-foreground">{t.symbol}</span>
                      <p className="text-[11px] text-muted-foreground leading-none mt-0.5">{t.security_name}</p>
                    </td>
                    <td className="px-4 py-3">
                      {t.buyer_name
                        ? <span className="text-foreground">{t.buyer_name}</span>
                        : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {t.seller_name
                        ? <span className="text-foreground">{t.seller_name}</span>
                        : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-foreground">{fmtN(t.quantity)}</td>
                    <td className="px-4 py-3 text-right font-mono text-foreground">{fmt(t.price)}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-foreground">{fmt(t.total)}</td>
                    <td className="px-4 py-3 text-right font-mono text-amber-500">
                      {Number(t.broker_fee) > 0 ? fmt(t.broker_fee) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${
                        isFilled
                          ? "bg-emerald-500/15 text-emerald-500"
                          : "bg-amber-500/15 text-amber-500"
                      }`}>
                        {t.status || "settled"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────
// TokenManagement — detailed token view per security
// ────────────────────────────────────────────────
function TokenManagement({ tokenStats }) {
  const [selected, setSelected] = useState(null);
  const [holders, setHolders]   = useState([]);
  const [loadingHolders, setLoadingHolders] = useState(false);

  const stats = Array.isArray(tokenStats) ? tokenStats : [];

  async function loadHolders(securityId) {
    setLoadingHolders(true);
    try {
      const data = await getTokenHolders(securityId);
      setHolders(Array.isArray(data) ? data : []);
    } catch {
      setHolders([]);
    } finally {
      setLoadingHolders(false);
    }
  }

  function selectSecurity(s) {
    setSelected(s);
    loadHolders(s.id);
  }

  const fmt  = (v) => `M${Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtN = (v) => Number(v || 0).toLocaleString();

  if (stats.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-12 text-center">
        <BarChart3 className="mx-auto mb-4 h-12 w-12 text-muted-foreground/60" />
        <h3 className="text-lg font-medium">No approved securities yet</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Once a listing is approved, token data will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Token Management</h2>

      {/* Security selector */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <button
            key={s.id}
            onClick={() => selectSecurity(s)}
            className={`rounded-xl border p-4 text-left transition-all hover:border-primary/60 ${
              selected?.id === s.id ? "border-primary bg-primary/5" : "border-border bg-card"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono font-bold text-lg">{s.symbol}</span>
              <StatusBadge status={s.approved ? "approved" : "pending"} />
            </div>
            <p className="text-sm text-muted-foreground mb-3">{s.name}</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-muted-foreground">Supply</span><br /><span className="font-semibold">{fmtN(s.total_supply)}</span></div>
              <div><span className="text-muted-foreground">Holders</span><br /><span className="font-semibold">{s.holder_count ?? 0}</span></div>
              <div><span className="text-muted-foreground">Price</span><br /><span className="font-semibold">{fmt(s.price)}</span></div>
              <div><span className="text-muted-foreground">Trades</span><br /><span className="font-semibold">{s.trade_count ?? 0}</span></div>
            </div>
            {s.tx_hash && (
              <p className="mt-2 text-xs text-muted-foreground truncate">
                Mint tx: <span className="font-mono">{s.tx_hash.slice(0, 20)}…</span>
              </p>
            )}
          </button>
        ))}
      </div>

      {/* Holder table for selected security */}
      {selected && (
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">
              {selected.symbol} — Token Holders
            </h3>
            <span className="text-sm text-muted-foreground">
              {fmtN(selected.total_supply)} tokens issued
            </span>
          </div>

          {loadingHolders ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : holders.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No holders yet — tokens are held by the issuer wallet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary text-left">
                    <th className="px-4 py-3 font-medium text-muted-foreground">Holder</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Email</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Tokens</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">% of Supply</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Wallet</th>
                  </tr>
                </thead>
                <tbody>
                  {holders.map((h) => {
                    const pct = selected.total_supply > 0
                      ? ((Number(h.quantity) / Number(selected.total_supply)) * 100).toFixed(2)
                      : "0.00";
                    return (
                      <tr key={h.user_id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3 font-medium">{h.full_name || `User #${h.user_id}`}</td>
                        <td className="px-4 py-3 text-muted-foreground">{h.email || "—"}</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold">{fmtN(h.quantity)}</td>
                        <td className="px-4 py-3 text-right font-mono">{pct}%</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {h.wallet_address
                            ? `${h.wallet_address.slice(0, 8)}…${h.wallet_address.slice(-6)}`
                            : "No wallet"}
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
    </div>
  );
}

function StatusBadge({ status }) {
  const base = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize";
  const styles = {
    pending: "bg-yellow-100 text-yellow-800 border border-yellow-300",
    approved: "bg-green-100 text-green-800 border border-green-300",
  };
  const key = (status || "pending").toLowerCase();
  return <span className={`${base} ${styles[key] || "bg-gray-100 text-gray-800"}`}>{key === "pending" ? "Pending" : "Approved"}</span>;
}
// ────────────────────────────────────────────────
// MyListings – shows pending + approved
// ────────────────────────────────────────────────
function MyListings({ listings, securities }) {
  const allItems = [
    ...listings.map(l => ({ ...l, isListing: true })),
    ...securities.map(s => ({ ...s, isListing: false })),
  ];

  if (allItems.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-12 text-center">
        <FileText className="mx-auto mb-4 h-12 w-12 text-muted-foreground/60" />
        <h3 className="mt-2 text-lg font-medium">No securities yet</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Submit your first security from the "Submit Security" tab.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold">My Securities & Listings</h2>
      <div className="space-y-3">
        {allItems.map((item) => (
          <div
            //key={item.id}
            key={item.isListing ? `listing-${item.id}` : `security-${item.id}`}
            className="flex flex-col gap-1 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-medium">{item.name || item.symbol || "Unnamed"}</p>
              <p className="text-sm text-muted-foreground">
                {item.symbol || "—"} • {item.isListing ? "Submitted" : "Created"}{" "}
                {item.created_at ? new Date(item.created_at).toLocaleDateString() : "—"}
              </p>
            </div>
            <StatusBadge status={item.approved ? "approved" : "pending"} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────
// NewListingForm – fixed state keys + better submit
// ────────────────────────────────────────────────
function NewListingForm({ user, onSuccess }) {
  const [formData, setFormData] = useState({
    name: "",
    symbol: "",
    type: "equity",
    description: "",
    totalTokens: "",
    initialPrice: "",          // ← fixed key name
    sector: "",
  });

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formError, setFormError] = useState(null);

  const update = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value ?? "" }));
    setFormError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    const nameTrimmed   = formData.name.trim();
    const symbolTrimmed = formData.symbol.trim();

    if (!nameTrimmed)                   { setFormError("Security name is required.");                   return; }
    if (nameTrimmed.length < 3)         { setFormError("Security name must be at least 3 characters."); return; }
    if (nameTrimmed.length > 120)       { setFormError("Security name must be 120 characters or fewer."); return; }
    if (!symbolTrimmed)                 { setFormError("Ticker symbol is required.");                   return; }
    if (symbolTrimmed.length < 2)       { setFormError("Ticker symbol must be at least 2 characters."); return; }
    if (!/^[A-Z0-9]{2,8}$/.test(symbolTrimmed)) { setFormError("Symbol must be 2–8 uppercase letters/numbers only."); return; }

    const totalTokensNum  = Number(formData.totalTokens);
    const initialPriceNum = Number(formData.initialPrice);

    if (!formData.totalTokens || isNaN(totalTokensNum) || totalTokensNum < 1)
      { setFormError("Total tokens must be a whole number ≥ 1.");      return; }
    if (!Number.isInteger(totalTokensNum))
      { setFormError("Total tokens must be a whole number (no decimals)."); return; }
    if (totalTokensNum > 1_000_000_000_000)
      { setFormError("Total tokens cannot exceed 1 trillion.");          return; }
    if (!formData.initialPrice || isNaN(initialPriceNum) || initialPriceNum <= 0)
      { setFormError("Initial price must be greater than 0.");           return; }
    if (initialPriceNum > 1_000_000)
      { setFormError("Initial price cannot exceed M1,000,000.");         return; }
    if (formData.description && formData.description.length > 1000)
      { setFormError("Description must be 1,000 characters or fewer."); return; }

    setLoading(true);

    try {
      await submitListing(
        {
          name: formData.name,
          symbol: formData.symbol,
          totalTokens: totalTokensNum,
          initialPrice: initialPriceNum,
          type: formData.type,
          description: formData.description,
          sector: formData.sector,
        },
        user
      );

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err) {
      console.error("Submit failed:", err);
      setFormError(err.message || "Failed to submit. Try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="rounded-xl border bg-card p-10 text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-green-600" />
        <h3 className="mt-4 text-xl font-bold">Listing Submitted Successfully</h3>
        <p className="mt-3 text-muted-foreground">
          Your security has been submitted for review.<br />
          You will be notified once processed.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Submit New Security Listing</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          All listings are reviewed before tokenization and public listing.
        </p>

        {formError && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label>Security Name <span className="text-red-500">*</span></Label>
              <Input value={formData.name} onChange={(e) => { update("name", e.target.value); setFormError(null); }}
                placeholder="Lesotho Tech Corporation" maxLength={120} className="mt-1.5" />
              <p className="mt-1 text-[11px] text-muted-foreground">3–120 characters</p>
            </div>
            <div>
              <Label>Symbol (Ticker) <span className="text-red-500">*</span></Label>
              <Input
                value={formData.symbol}
                onChange={(e) => { update("symbol", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8)); setFormError(null); }}
                placeholder="LTC"
                className="mt-1.5 font-mono"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">2–8 uppercase letters/numbers (e.g. LTC, BOND1)</p>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label>Security Type <span className="text-red-500">*</span></Label>
              <select value={formData.type} onChange={(e) => update("type", e.target.value)} className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2" required>
                <option value="equity">Equity (Shares)</option>
                <option value="bond">Bond / Debt Instrument</option>
                <option value="fund">Fund / ETF Unit</option>
                <option value="debt">Debt Security</option>
              </select>
            </div>
            <div>
              <Label>Sector <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input value={formData.sector} onChange={(e) => update("sector", e.target.value)} placeholder="e.g. Financial Services" maxLength={80} className="mt-1.5" />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label>Total Tokens to Issue <span className="text-red-500">*</span></Label>
              <Input type="number" min="1" max="1000000000000" step="1" value={formData.totalTokens}
                onChange={(e) => { update("totalTokens", e.target.value); setFormError(null); }}
                placeholder="1000000" className="mt-1.5" />
              <p className="mt-1 text-[11px] text-muted-foreground">Whole number, 1 – 1,000,000,000,000</p>
            </div>
            <div>
              <Label>Initial Price per Token (M) <span className="text-red-500">*</span></Label>
              <Input type="number" min="0.01" max="1000000" step="0.01" value={formData.initialPrice}
                onChange={(e) => { update("initialPrice", e.target.value); setFormError(null); }}
                placeholder="5.00" className="mt-1.5" />
              <p className="mt-1 text-[11px] text-muted-foreground">In Maloti (M), max 2 decimal places</p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label>Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <span className={`text-[11px] ${formData.description.length > 900 ? "text-amber-400" : "text-muted-foreground"}`}>
                {formData.description.length}/1000
              </span>
            </div>
            <textarea
              value={formData.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="Describe the company, purpose of issuance, rights attached to the security…"
              rows={4} maxLength={1000}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="rounded-lg bg-muted/50 p-4 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Review & Tokenization Process</p>
            <ol className="mt-2 list-decimal space-y-1 pl-4">
              <li>Submit application (this form)</li>
              <li>Compliance & legal review by admin</li>
              <li>Token smart contract generation</li>
              <li>Deployment on blockchain</li>
              <li>Listing on the market</li>
            </ol>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Submitting..." : "Submit for Review"}
          </Button>
        </form>
      </div>
    </div>
  );
}


// ─── Reports Manager ──────────────────────────────────────────────────────────
function ReportsManager({ user, issuerId, securities = [] }) {
  const today = new Date().toISOString().split("T")[0];

  const [deadlines, setDeadlines]   = useState([]);
  const [reports, setReports]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm]     = useState(false);
  const [success, setSuccess]       = useState("");
  const [error, setError]           = useState("");

  // File upload state
  const [docFile, setDocFile]         = useState(null);   // File object
  const [docUploading, setDocUploading] = useState(false);
  const [docUrl, setDocUrl]           = useState("");     // uploaded URL
  const [docName, setDocName]         = useState("");     // original filename
  const [docError, setDocError]       = useState("");

  const ALLOWED_EXT = [".pdf", ".xlsx", ".xls"];
  const ALLOWED_MIME = [
    "application/pdf",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ];

  function handleFileChange(e) {
    setDocError("");
    setDocUrl("");
    setDocName("");
    const file = e.target.files?.[0];
    if (!file) { setDocFile(null); return; }
    if (!ALLOWED_MIME.includes(file.type)) {
      setDocError("Only PDF (.pdf) or Excel (.xlsx, .xls) files are accepted.");
      setDocFile(null);
      e.target.value = "";
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setDocError("File must be 10 MB or smaller.");
      setDocFile(null);
      e.target.value = "";
      return;
    }
    setDocFile(file);
  }

  async function uploadDocument() {
    if (!docFile) return null;
    setDocUploading(true);
    setDocError("");
    try {
      const fd = new FormData();
      fd.append("file", docFile);
      const token = typeof window !== "undefined"
        ? localStorage.getItem("auth_token")
        : null;
      const res = await fetch("/api/reports/upload", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Upload failed");
      setDocUrl(data.url);
      setDocName(data.name);
      return { url: data.url, name: data.name };
    } catch (err) {
      setDocError(err.message);
      return null;
    } finally {
      setDocUploading(false);
    }
  }

  function clearDocument() {
    setDocFile(null);
    setDocUrl("");
    setDocName("");
    setDocError("");
  }

  const [form, setForm] = useState({
    report_type: "quarterly",
    title: "",
    description: "",
    period_start: "",
    period_end: "",
    due_date: "",
    security_id: "",
    notes: "",
  });

  async function load() {
    setLoading(true);
    try {
      const [dl, rpts] = await Promise.all([
        issuerId ? getReportDeadlines(issuerId) : [],
        issuerId ? getIssuerReports(issuerId)   : [],
      ]);
      setDeadlines(Array.isArray(dl)   ? dl   : []);
      setReports(Array.isArray(rpts)   ? rpts : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [issuerId]);

  // Auto-fill dates when a deadline is clicked
  function prefill(dl) {
    setForm(f => ({
      ...f,
      report_type:  dl.report_type,
      title:        dl.label,
      period_start: dl.period_start?.toISOString?.().split("T")[0] ?? "",
      period_end:   dl.period_end?.toISOString?.().split("T")[0]   ?? "",
      due_date:     dl.due_date?.toISOString?.().split("T")[0]     ?? "",
    }));
    setShowForm(true);
    setError(""); setSuccess("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!issuerId) { setError("Issuer profile not loaded yet — try again shortly."); return; }

    // ── Client-side validation ─────────────────────────────────────────────
    const titleTrimmed = form.title.trim();
    if (!titleTrimmed) { setError("Report title is required."); return; }
    if (titleTrimmed.length < 5) { setError("Report title must be at least 5 characters."); return; }
    if (titleTrimmed.length > 200) { setError("Report title must be 200 characters or fewer."); return; }

    const descTrimmed = form.description.trim();
    if (!descTrimmed) { setError("Report summary / description is required."); return; }
    if (descTrimmed.length < 20) { setError("Description must be at least 20 characters — provide a meaningful summary."); return; }
    if (descTrimmed.length > 5000) { setError("Description must be 5,000 characters or fewer."); return; }

    if (form.period_start && form.period_end && form.period_start >= form.period_end) {
      setError("Period End must be after Period Start."); return;
    }
    if (form.notes && form.notes.length > 500) {
      setError("Additional notes must be 500 characters or fewer."); return;
    }

    // Document required
    if (!docFile && !docUrl) {
      setError("A supporting document (PDF or Excel) is required before submitting.");
      return;
    }
    // ── End validation ─────────────────────────────────────────────────────

    setSubmitting(true); setError(""); setSuccess("");
    try {
      // Upload file if not yet uploaded
      let finalDocUrl = docUrl;
      let finalDocName = docName;
      if (docFile && !docUrl) {
        const uploaded = await uploadDocument();
        if (!uploaded) { setSubmitting(false); return; }
        finalDocUrl  = uploaded.url;
        finalDocName = uploaded.name;
      }

      const res = await submitReport(user?.id, issuerId, {
        ...form,
        security_id:   form.security_id ? parseInt(form.security_id) : null,
        document_url:  finalDocUrl,
        document_name: finalDocName,
      });
      if (res?.error) { setError(res.error); return; }
      setSuccess("Report submitted successfully.");
      setShowForm(false);
      setForm({ report_type:"quarterly", title:"", description:"", period_start:"", period_end:"", due_date:"", security_id:"", notes:"" });
      clearDocument();
      load();
    } catch (err) { setError(err.message); }
    finally { setSubmitting(false); }
  }

  const urgencyStyle = (u) => ({
    overdue:  { bar: "bg-red-500",    badge: "bg-red-500/10 text-red-400 border-red-500/20",    icon: XCircle,       label: "Overdue" },
    critical: { bar: "bg-orange-500", badge: "bg-orange-500/10 text-orange-400 border-orange-500/20", icon: AlertTriangle, label: "Due Soon" },
    warning:  { bar: "bg-yellow-500", badge: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", icon: Clock,         label: "Upcoming" },
    ok:       { bar: "bg-emerald-500",badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: CheckCircle2,  label: "On Track" },
  }[u] || { bar:"bg-gray-500", badge:"bg-gray-500/10 text-gray-400 border-gray-500/20", icon: Clock, label: "—" });

  const typeLabel = { quarterly:"Quarterly", annual:"Annual", current:"Current" };
  const fmtDate   = (d) => d ? new Date(d).toLocaleDateString("en-ZA", { day:"numeric", month:"short", year:"numeric" }) : "—";

  if (loading) return (
    <div className="flex items-center justify-center py-20 text-muted-foreground">
      <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading reports…
    </div>
  );

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-primary" /> Regulatory Reports
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Submit and track your quarterly, annual, and current reports
          </p>
        </div>
        <button onClick={() => { setShowForm(s => !s); setError(""); setSuccess(""); }}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
          <Send className="h-4 w-4" /> File a Report
        </button>
      </div>

      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {success}
        </div>
      )}

      {/* Deadline Tracker */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" /> Filing Deadlines
        </h3>
        {deadlines.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            No deadlines computed yet — deadlines are generated once you have an approved security listed.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {deadlines.map(dl => {
              const sty = urgencyStyle(dl.filed ? "ok" : dl.urgency);
              const Icon = sty.icon;
              return (
                <div key={dl.id} className="relative overflow-hidden rounded-xl border border-border bg-card p-4">
                  <div className={`absolute left-0 top-0 h-full w-1 ${sty.bar}`} />
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="text-xs font-semibold text-foreground">{dl.label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Period: {fmtDate(dl.period_start)} – {fmtDate(dl.period_end)}
                      </p>
                    </div>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold shrink-0 ${sty.badge}`}>
                      <Icon className="h-3 w-3" />
                      {dl.filed ? "Filed" : sty.label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Due date</p>
                      <p className="text-xs font-semibold text-foreground">{fmtDate(dl.due_date)}</p>
                    </div>
                    {!dl.filed && (
                      <div className="text-right">
                        <p className="text-[10px] text-muted-foreground">{dl.days_left < 0 ? "Overdue by" : "Days left"}</p>
                        <p className={`text-sm font-bold ${dl.days_left < 0 ? "text-red-400" : dl.days_left <= 7 ? "text-orange-400" : "text-foreground"}`}>
                          {Math.abs(dl.days_left)}d
                        </p>
                      </div>
                    )}
                  </div>
                  {!dl.filed && (
                    <button onClick={() => prefill(dl)}
                      className="mt-3 w-full rounded border border-primary/30 py-1.5 text-[11px] font-medium text-primary hover:bg-primary/10 transition-colors">
                      File This Report
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Submission Form */}
      {showForm && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-5 text-sm font-semibold text-foreground flex items-center gap-2">
            <Send className="h-4 w-4 text-primary" /> Submit Report
          </h3>
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Report Type *</Label>
                <select value={form.report_type}
                  onChange={e => setForm(f => ({ ...f, report_type: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="quarterly">Quarterly Report</option>
                  <option value="annual">Annual Report</option>
                  <option value="current">Current Report (Material Event)</option>
                </select>
              </div>
              <div>
                <Label>Related Security (optional)</Label>
                <select value={form.security_id}
                  onChange={e => setForm(f => ({ ...f, security_id: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">All Securities / General</option>
                  {securities.filter(s => s.approved || s.status === "listed").map(s => (
                    <option key={s.id} value={s.id}>{s.symbol} — {s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label>Report Title *</Label>
                <span className={`text-[10px] ${form.title.length > 190 ? "text-destructive" : "text-muted-foreground"}`}>
                  {form.title.length}/200
                </span>
              </div>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Q2 2025 Quarterly Financial Report"
                maxLength={200}
                className="mt-1" required />
              {form.title.length > 0 && form.title.trim().length < 5 && (
                <p className="mt-1 text-[11px] text-destructive">At least 5 characters required.</p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label>Period Start</Label>
                <Input type="date" value={form.period_start}
                  onChange={e => setForm(f => ({ ...f, period_start: e.target.value }))}
                  className="mt-1" />
              </div>
              <div>
                <Label>Period End</Label>
                <Input type="date" value={form.period_end}
                  onChange={e => setForm(f => ({ ...f, period_end: e.target.value }))}
                  className={`mt-1 ${form.period_start && form.period_end && form.period_end <= form.period_start ? "border-destructive" : ""}`} />
                {form.period_start && form.period_end && form.period_end <= form.period_start && (
                  <p className="mt-1 text-[11px] text-destructive">End must be after start date.</p>
                )}
              </div>
              <div>
                <Label>Filing Deadline</Label>
                <Input type="date" value={form.due_date}
                  onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                  className="mt-1" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label>Report Summary / Description *</Label>
                <span className={`text-[10px] ${form.description.length > 4800 ? "text-destructive" : "text-muted-foreground"}`}>
                  {form.description.length}/5000
                </span>
              </div>
              <textarea value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={5} required maxLength={5000}
                placeholder="Provide a summary of the report contents, key financial highlights, material events, or other relevant disclosures…"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              {form.description.length > 0 && form.description.trim().length < 20 && (
                <p className="mt-1 text-[11px] text-destructive">Please provide at least 20 characters of description.</p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label>Additional Notes (optional)</Label>
                <span className={`text-[10px] ${(form.notes?.length || 0) > 480 ? "text-destructive" : "text-muted-foreground"}`}>
                  {form.notes?.length || 0}/500
                </span>
              </div>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Any regulatory notes, auditor info, restatement flags…"
                maxLength={500}
                className="mt-1" />
            </div>

            {/* ── Document Upload ───────────────────────────────── */}
            <div>
              <Label className="flex items-center gap-1.5">
                <Paperclip className="h-3.5 w-3.5" /> Supporting Document <span className="text-destructive">*</span>
              </Label>
              <p className="text-[11px] text-muted-foreground mt-0.5 mb-2">
                PDF or Excel file required (max 10 MB).
              </p>

              {/* File selected / uploaded */}
              {docFile ? (
                <div className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${
                  docUrl ? "border-emerald-500/40 bg-emerald-500/10" : "border-border bg-secondary/30"
                }`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <Paperclip className={`h-4 w-4 shrink-0 ${docUrl ? "text-emerald-500" : "text-muted-foreground"}`} />
                    <span className="truncate text-foreground font-medium">{docFile.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      ({(docFile.size / 1024).toFixed(0)} KB)
                    </span>
                    {docUrl && <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />}
                  </div>
                  <button type="button" onClick={clearDocument}
                    className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-secondary/20 px-6 py-6 hover:border-primary/50 hover:bg-secondary/40 transition-all">
                  <Upload className="mb-2 h-6 w-6 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Click to choose file</span>
                  <span className="text-xs text-muted-foreground mt-0.5">PDF, XLSX, or XLS — up to 10 MB</span>
                  <input
                    type="file"
                    accept=".pdf,.xlsx,.xls,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </label>
              )}

              {docError && (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {docError}
                </p>
              )}
              {docUploading && (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Uploading document…
                </p>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={submitting || docUploading || (!docFile && !docUrl)} className="flex items-center gap-2">
                {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {submitting ? "Submitting…" : "Submit Report"}
              </Button>
              <Button type="button" variant="outline" onClick={() => { setShowForm(false); clearDocument(); }}>Cancel</Button>
            </div>
          </form>
        </div>
      )}

      {/* Filed Reports History */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" /> Filing History
        </h3>
        {reports.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No reports filed yet. Use the deadlines above or "File a Report" to submit your first report.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  {["Type","Title","Period","Filed On","Document","Status"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {reports.map(r => (
                  <tr key={r.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-3">
                      <span className="rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize
                        border-primary/20 bg-primary/10 text-primary">
                        {typeLabel[r.report_type] || r.report_type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-medium text-foreground">{r.title}</p>
                      {r.security_symbol && <p className="text-[10px] text-muted-foreground">{r.security_symbol}</p>}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {r.period_start && r.period_end
                        ? `${fmtDate(r.period_start)} – ${fmtDate(r.period_end)}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(r.filed_at)}</td>
                    <td className="px-4 py-3">
                      {r.document_url ? (
                        <a
                          href={r.document_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary hover:bg-primary/20 transition-colors"
                          title={r.document_name || "Download document"}
                        >
                          <Download className="h-3 w-3" />
                          {r.document_name
                            ? r.document_name.length > 20
                              ? r.document_name.slice(0, 18) + "…"
                              : r.document_name
                            : "Download"}
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize
                        ${r.status === "accepted" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : r.status === "rejected" ? "bg-red-500/10 text-red-400 border-red-500/20"
                          : "bg-blue-500/10 text-blue-400 border-blue-500/20"}`}>
                        {r.status === "accepted" ? <CheckCircle2 className="h-3 w-3" />
                         : r.status === "rejected" ? <XCircle className="h-3 w-3" />
                         : <Clock className="h-3 w-3" />}
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function CompanyData({ user }) {
  const company = user.companyData || {};
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-xl border bg-card p-6">
        <h2 className="text-xl font-semibold">Company Profile</h2>
        <div className="mt-5 space-y-4 divide-y divide-border">
          <InfoRow label="Company Name" value={company.companyName || user.name || "—"} />
          <InfoRow label="Registration #" value={company.registrationNumber || "Not provided"} />
          <InfoRow label="Sector" value={company.sector || "—"} />
          <InfoRow label="Email" value={user.email} />
          <InfoRow label="Account Status" value={user.status || "Active"} />
          <InfoRow label="KYC Status" value={user.kyc?.status || "Pending"} />
          <InfoRow
            label="Member Since"
            value={
              user.createdAt
                ? new Date(user.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
                : "—"
            }
          />
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between py-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function StatCard({ title, value, icon: Icon }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
        <div className="rounded-lg bg-primary/10 p-2">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

// ─── Security-type helpers ─────────────────────────────────────────────────────

/**
 * Maps a security type string to income-payment metadata so that the
 * dividend form, labels, and table can adapt automatically.
 *
 * Shares / Equity  → "Dividend"    – discretionary, from profits, not guaranteed
 * Bond   / Debt    → "Interest"    – contractual coupon, fixed schedule
 * Fund             → "Distribution"– pass-through from underlying holdings
 */
function incomeProfile(type) {
  const t = (type || "").toLowerCase();
  if (t === "bond" || t === "debt") {
    return {
      label:         "Interest / Coupon",
      perUnitLabel:  "Interest per Token (M)",
      paymentLabel:  "Payment Date",
      exDateLabel:   null,           // bonds don't use ex-dividend date
      unitWord:      "token",
      paymentVerb:   "Pay Interest",
      declareVerb:   "Schedule Interest Payment",
      color:         "amber",
      icon:          Landmark,
      guaranteed:    true,
      concept: {
        title: "Bond / Debt — Interest (Coupon)",
        badge: "Contractual obligation",
        badgeColor: "amber",
        body: "Unlike shares, bonds do not pay dividends. Instead they pay interest (also called a \"coupon\"). These payments are a contractual obligation — fixed in amount and schedule (typically semi-annually) regardless of whether the company made a profit. Failing to pay constitutes a default.",
        schedule: "Semi-annual or quarterly fixed payments",
        priority: "Bondholders are paid before equity shareholders",
      },
    };
  }
  if (t === "fund") {
    return {
      label:         "Distribution",
      perUnitLabel:  "Distribution per Unit (M)",
      paymentLabel:  "Distribution Date",
      exDateLabel:   "Ex-Distribution Date",
      unitWord:      "unit",
      paymentVerb:   "Pay Distribution",
      declareVerb:   "Declare Distribution",
      color:         "purple",
      icon:          BarChart2,
      guaranteed:    false,
      concept: {
        title: "Fund (Mutual Fund / ETF) — Distribution",
        badge: "Pass-through income",
        badgeColor: "purple",
        body: "Funds pass through the income they receive from their underlying holdings to unit-holders. If the fund holds dividend-paying stocks, investors receive a fund dividend. If it holds bonds, they receive combined interest income. These distributions are often paid monthly or quarterly and vary with the portfolio.",
        schedule: "Monthly or quarterly, varies by portfolio performance",
        priority: "Proportional to units held; no creditor priority",
      },
    };
  }
  // Default: shares / equity
  return {
    label:         "Dividend",
    perUnitLabel:  "Dividend per Share (M)",
    paymentLabel:  "Payment Date",
    exDateLabel:   "Ex-Dividend Date",
    unitWord:      "share",
    paymentVerb:   "Pay Dividend",
    declareVerb:   "Declare Dividend",
    color:         "emerald",
    icon:          TrendingUp,
    guaranteed:    false,
    concept: {
      title: "Shares / Equity — Dividend",
      badge: "Discretionary — not guaranteed",
      badgeColor: "rose",
      body: "Dividends are a portion of a company's profits distributed to shareholders. They are NOT guaranteed — the board of directors can cut or skip them if profits are low or the company wants to reinvest in growth. Equity holders receive dividends only AFTER all debts (including bond interest) and taxes have been paid.",
      schedule: "Typically quarterly; subject to board approval",
      priority: "Equity holders are last in the priority queue",
    },
  };
}

const CONCEPT_BADGE_COLORS = {
  rose:    "bg-rose-500/10 text-rose-400 border-rose-500/20",
  amber:   "bg-amber-500/10 text-amber-400 border-amber-500/20",
  purple:  "bg-purple-500/10 text-purple-400 border-purple-500/20",
  emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

// ─── Dividend Manager ──────────────────────────────────────────────────────────
function DividendManager({ user, securities = [] }) {
  const today = new Date().toISOString().split("T")[0];

  const [dividends, setDividends]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [processing, setProcessing] = useState(null);
  const [error, setError]           = useState("");
  const [success, setSuccess]       = useState("");
  const [showForm, setShowForm]     = useState(false);
  const [showGuide, setShowGuide]   = useState(false);
  const [payImmediate, setPayImmediate] = useState(false);

  const [form, setForm] = useState({
    security_id:      "",
    amount_per_share: "",
    ex_dividend_date: "",
    record_date:      "",
    payment_date:     "",
    notes:            "",
  });

  // Derive the income profile from the currently selected security's type
  const selectedSec = securities.find((s) => s.id === parseInt(form.security_id));
  const profile     = incomeProfile(selectedSec?.security_type || selectedSec?.type);

  async function fetchDividends() {
    setLoading(true);
    try {
      const rows = await getDividends(user?.id, "issuer");
      setDividends(Array.isArray(rows) ? rows : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchDividends(); }, []);

  // Auto-set record_date and payment_date from ex-date
  function handleExDivChange(val) {
    const ex  = new Date(val);
    const rec = new Date(ex); rec.setDate(rec.getDate() + 1);
    const pay = new Date(rec); pay.setDate(pay.getDate() + 14);
    const fmt = (d) => d.toISOString().split("T")[0];
    setForm((f) => ({ ...f, ex_dividend_date: val, record_date: fmt(rec), payment_date: fmt(pay) }));
  }

  // When security changes, reset dates and amount
  function handleSecurityChange(val) {
    setForm((f) => ({
      ...f,
      security_id:      val,
      amount_per_share: "",
      ex_dividend_date: "",
      record_date:      "",
      payment_date:     "",
      notes:            "",
    }));
  }

  async function handleDeclare(e) {
    e.preventDefault();
    setError(""); setSuccess("");

    // ── Client-side validation ─────────────────────────────────────────────
    if (!form.security_id) { setError("Please select a security."); return; }

    const amtNum = parseFloat(form.amount_per_share);
    if (!form.amount_per_share || isNaN(amtNum) || amtNum <= 0) {
      setError(`${profile.perUnitLabel} must be a positive number greater than zero.`); return;
    }
    if (amtNum > 10_000) {
      setError(`${profile.perUnitLabel} cannot exceed M10,000 per unit. Verify the amount.`); return;
    }
    if (form.notes && form.notes.length > 500) {
      setError("Notes must be 500 characters or fewer."); return;
    }

    // Date validation only when NOT paying immediately
    if (!payImmediate) {
      if (profile.exDateLabel) {
        if (!form.ex_dividend_date) { setError(`${profile.exDateLabel} is required.`); return; }
        if (form.ex_dividend_date < today) { setError(`${profile.exDateLabel} cannot be in the past.`); return; }
      }
      if (!form.record_date) { setError("Record Date is required."); return; }
      if (profile.exDateLabel && form.ex_dividend_date && form.record_date < form.ex_dividend_date) {
        setError("Record Date must be on or after the Ex-Dividend Date."); return;
      }
      if (!profile.exDateLabel && form.record_date < today) {
        setError("Record Date cannot be in the past."); return;
      }
      if (!form.payment_date) { setError(`${profile.paymentLabel} is required.`); return; }
      if (form.payment_date < form.record_date) {
        setError(`${profile.paymentLabel} must be on or after the Record Date.`); return;
      }
    }
    // ── End validation ─────────────────────────────────────────────────────

    setSubmitting(true);
    try {
      const result = await declareDividend(user?.id, "issuer", {
        security_id:      parseInt(form.security_id),
        amount_per_share: parseFloat(form.amount_per_share),
        ex_dividend_date: form.ex_dividend_date || undefined,
        record_date:      form.record_date       || undefined,
        payment_date:     form.payment_date      || undefined,
        notes:            form.notes             || undefined,
        immediate:        payImmediate,
      });
      if (result?.error) { setError(result.error); return; }

      // If immediate, process right away without a separate confirm
      if (payImmediate && result.dividend?.id) {
        const payResult = await processDividend(result.dividend.id, user?.id);
        if (payResult?.error) {
          setSuccess(result.message); // declared OK
          setError(`Payment processing failed: ${payResult.error}`);
        } else {
          setSuccess(payResult.message || `${profile.label} paid immediately to all eligible holders.`);
        }
      } else {
        setSuccess(result.message);
      }

      setShowForm(false);
      setPayImmediate(false);
      setForm({ security_id: "", amount_per_share: "", ex_dividend_date: "", record_date: "", payment_date: "", notes: "" });
      fetchDividends();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleProcess(divId) {
    const confirmMsg = profile.guaranteed
      ? "Pay this scheduled interest to all eligible token-holders now?"
      : "Process this dividend and credit all eligible shareholders now?";
    if (!confirm(confirmMsg)) return;
    setProcessing(divId); setError(""); setSuccess("");
    try {
      const result = await processDividend(divId, user?.id);
      if (result?.error) { setError(result.error); return; }
      setSuccess(result.message);
      fetchDividends();
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(null);
    }
  }

  const fmtDate = (v) => {
    if (!v) return "—";
    try { return new Date(v).toISOString().slice(0, 10); } catch { return "—"; }
  };

  const statusColor = (s) => ({
    declared:   "bg-blue-500/15 text-blue-400 border-blue-500/30",
    processing: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    paid:       "bg-primary/15 text-primary border-primary/30",
    cancelled:  "bg-destructive/15 text-destructive border-destructive/30",
  }[s] || "bg-muted text-muted-foreground border-border");

  // Label in history table — derive from security type stored on each dividend row
  const rowLabel = (div) => {
    const p = incomeProfile(div.security_type);
    return p.label;
  };

  return (
    <div className="space-y-6">

      {/* ── Educational guide ──────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <button
          type="button"
          onClick={() => setShowGuide((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-secondary/20 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">Understanding Security Income Types</span>
          </div>
          {showGuide ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>

        {showGuide && (
          <div className="border-t border-border px-5 pb-5 pt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Shares */}
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-400" />
                <span className="text-sm font-semibold text-emerald-400">Shares / Equity</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Ownership stake in a company. Shareholders earn <strong className="text-foreground">dividends</strong> — a share of profits distributed by the board's discretion.
              </p>
              <span className="inline-block rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-400">
                ⚠ Not guaranteed — board can cut or skip
              </span>
              <p className="text-[11px] text-muted-foreground">
                Equity holders are <strong className="text-foreground">last</strong> in priority — paid only after all debts and taxes are settled.
              </p>
            </div>

            {/* Bond / Debt */}
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Landmark className="h-4 w-4 text-amber-400" />
                <span className="text-sm font-semibold text-amber-400">Bond / Debt</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                A loan you owe to investors. They earn <strong className="text-foreground">interest (coupon)</strong> — not dividends. Interest is a <strong className="text-foreground">contractual obligation</strong>.
              </p>
              <span className="inline-block rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                ✓ Fixed & mandatory — regardless of profit
              </span>
              <p className="text-[11px] text-muted-foreground">
                Typically paid <strong className="text-foreground">semi-annually</strong>. Failure to pay = default. Bondholders rank above shareholders.
              </p>
            </div>

            {/* Fund */}
            <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-purple-400" />
                <span className="text-sm font-semibold text-purple-400">Fund (ETF / Mutual)</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                A basket of investments. Funds pass income from holdings through to unit-holders as <strong className="text-foreground">distributions</strong>.
              </p>
              <span className="inline-block rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[10px] font-semibold text-purple-400">
                Pass-through — varies with portfolio
              </span>
              <p className="text-[11px] text-muted-foreground">
                If the fund holds dividend stocks → fund dividend. If it holds bonds → combined interest. Paid monthly or quarterly.
              </p>
            </div>

            {/* Date concepts */}
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-blue-400" />
                <span className="text-sm font-semibold text-blue-400">Key Dates</span>
              </div>
              <div className="space-y-1.5 text-[11px] text-muted-foreground">
                <p><strong className="text-foreground">Ex-Dividend Date:</strong> Investors who buy on or after this date do NOT receive the payment.</p>
                <p><strong className="text-foreground">Record Date:</strong> Cutoff — only investors on the books on this date qualify (auto-set to ex-date + 1 day).</p>
                <p><strong className="text-foreground">Payment Date:</strong> When income is credited to investor wallets.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Header + declare button ────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Income Payments</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Declare dividends, interest, or distributions for your securities.
          </p>
        </div>
        <Button onClick={() => { setShowForm((v) => !v); setError(""); setSuccess(""); if (showForm) setPayImmediate(false); }}>
          <DollarSign className="h-4 w-4 mr-2" />
          {showForm ? "Cancel" : "New Payment"}
        </Button>
      </div>

      {error   && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}
      {success && <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">{success}</div>}

      {/* ── Declaration form ───────────────────────────────────── */}
      {showForm && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-5">
          <h4 className="font-semibold flex items-center gap-2">
            <profile.icon className={`h-4 w-4 ${
              profile.color === "amber"  ? "text-amber-400"  :
              profile.color === "purple" ? "text-purple-400" : "text-primary"
            }`} />
            {profile.declareVerb}
          </h4>

          {/* Security selector first, so the concept banner can adapt */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Security *</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-secondary/40 px-3 py-2 text-sm mt-1"
                value={form.security_id}
                onChange={(e) => handleSecurityChange(e.target.value)}
                required
              >
                <option value="">Select security…</option>
                {securities
                  .filter((s) => s.approved || s.status === "listed")
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.symbol} — {s.name}{(s.security_type || s.type) ? ` (${s.security_type || s.type})` : ""}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <Label>{profile.perUnitLabel} *</Label>
              <Input
                type="number"
                step="0.000001"
                min="0.000001"
                placeholder="e.g. 0.50"
                value={form.amount_per_share}
                onChange={(e) => setForm((f) => ({ ...f, amount_per_share: e.target.value }))}
                required
                className="mt-1"
              />
            </div>
          </div>

          {/* Type-specific concept banner — only when a security is selected */}
          {selectedSec && (
            <div className={`rounded-lg border p-4 text-xs space-y-2
              ${profile.color === "amber"  ? "border-amber-500/20  bg-amber-500/5"  :
                profile.color === "purple" ? "border-purple-500/20 bg-purple-500/5" :
                                             "border-primary/20    bg-primary/5"}`}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className={`font-semibold ${
                  profile.color === "amber"  ? "text-amber-400"  :
                  profile.color === "purple" ? "text-purple-400" : "text-primary"
                }`}>{profile.concept.title}</span>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold
                  ${CONCEPT_BADGE_COLORS[profile.concept.badgeColor] || CONCEPT_BADGE_COLORS.emerald}`}>
                  {profile.concept.badge}
                </span>
              </div>
              <p className="text-muted-foreground leading-relaxed">{profile.concept.body}</p>
              <div className="flex flex-wrap gap-4 pt-1 text-muted-foreground">
                <span>📅 {profile.concept.schedule}</span>
                <span>⚖ {profile.concept.priority}</span>
              </div>
            </div>
          )}

          {/* Pay Immediately toggle */}
          <div className={`flex items-start gap-3 rounded-lg border p-4 transition-colors cursor-pointer
            ${payImmediate
              ? "border-primary/40 bg-primary/8"
              : "border-border hover:border-primary/20"}`}
            onClick={() => setPayImmediate((v) => !v)}
          >
            <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors
              ${payImmediate ? "border-primary bg-primary" : "border-muted-foreground"}`}>
              {payImmediate && (
                <svg viewBox="0 0 10 8" className="h-3 w-3 text-primary-foreground" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 4l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <div className="select-none">
              <p className="text-sm font-semibold text-foreground">Pay Immediately</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Skip scheduling — declare and pay all eligible holders right now. Dates are set to today automatically.
              </p>
              {payImmediate && (
                <p className="mt-2 text-xs font-medium text-primary">
                  ⚡ All dates will be set to today and payment will be processed immediately after declaring.
                </p>
              )}
            </div>
          </div>

          {/* Date fields — hidden when paying immediately */}
          {!payImmediate && (
          <div className={`grid gap-4 ${profile.exDateLabel ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
            {profile.exDateLabel && (
              <div>
                <Label>{profile.exDateLabel} *</Label>
                <Input
                  type="date"
                  min={today}
                  value={form.ex_dividend_date}
                  onChange={(e) => handleExDivChange(e.target.value)}
                  required={!!profile.exDateLabel}
                  className="mt-1"
                />
              </div>
            )}
            <div>
              <Label>Record Date *</Label>
              <Input
                type="date"
                value={form.record_date}
                onChange={(e) => setForm((f) => ({ ...f, record_date: e.target.value }))}
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label>{profile.paymentLabel} *</Label>
              <Input
                type="date"
                value={form.payment_date}
                onChange={(e) => setForm((f) => ({ ...f, payment_date: e.target.value }))}
                required
                className="mt-1"
              />
            </div>
          </div>
          )} {/* end !payImmediate date block */}

          <div>
            <div className="flex items-center justify-between">
              <Label>Notes (optional)</Label>
              <span className={`text-[10px] ${(form.notes?.length || 0) > 480 ? "text-destructive" : "text-muted-foreground"}`}>
                {form.notes?.length || 0}/500
              </span>
            </div>
            <Input
              placeholder={
                profile.color === "amber"  ? "e.g. Semi-annual coupon — H1 2026" :
                profile.color === "purple" ? "e.g. Q2 2026 quarterly distribution" :
                                             "e.g. Q2 2026 interim dividend"
              }
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              maxLength={500}
              className="mt-1"
            />
          </div>

          {/* Total payout preview */}
          {form.security_id && form.amount_per_share && (() => {
            const sec = securities.find((s) => s.id === parseInt(form.security_id));
            if (!sec) return null;
            const circ  = parseFloat(sec.total_supply || 0) - parseFloat(sec.available_tokens || 0);
            const total = (circ * parseFloat(form.amount_per_share || 0)).toFixed(2);
            return (
              <div className="rounded-lg bg-secondary/40 px-4 py-3 text-sm flex flex-wrap gap-4 items-center justify-between">
                <div>
                  <span className="text-muted-foreground">Estimated total {profile.label.toLowerCase()}: </span>
                  <span className="font-mono font-bold text-primary">M{total}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {circ.toLocaleString()} circulating {profile.unitWord}s × M{parseFloat(form.amount_per_share).toFixed(4)} each
                </div>
                {!profile.guaranteed && (
                  <span className="text-[11px] text-rose-400 border border-rose-500/20 bg-rose-500/5 rounded-full px-2 py-0.5">
                    ⚠ Board approval required before payment
                  </span>
                )}
                {profile.guaranteed && (
                  <span className="text-[11px] text-amber-400 border border-amber-500/20 bg-amber-500/5 rounded-full px-2 py-0.5">
                    ✓ Contractual — payment is obligatory
                  </span>
                )}
              </div>
            );
          })()}

          <Button
            type="submit"
            onClick={handleDeclare}
            disabled={submitting}
            className={`w-full ${payImmediate ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}`}
          >
            {submitting
              ? (payImmediate ? "Paying…" : "Declaring…")
              : (payImmediate ? `⚡ Declare & Pay Now` : profile.declareVerb)}
          </Button>
        </div>
      )}

      {/* ── History table ──────────────────────────────────────── */}
      {loading ? (
        <div className="py-12 text-center text-muted-foreground text-sm">Loading payment history…</div>
      ) : dividends.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <DollarSign className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <p className="font-medium">No payments declared yet</p>
          <p className="text-sm text-muted-foreground mt-1">Click "New Payment" to declare a dividend, interest payment, or distribution.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="grid grid-cols-8 gap-2 border-b border-border bg-secondary/30 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <span className="col-span-2">Security</span>
            <span>Type</span>
            <span className="text-right">Per Unit</span>
            <span className="text-right">Ex / Record</span>
            <span className="text-right">Pay Date</span>
            <span className="text-right">Total</span>
            <span className="text-right">Action</span>
          </div>
          <div className="divide-y divide-border/50">
            {dividends.map((div) => {
              const label = rowLabel(div);
              const labelColor =
                label === "Interest" ? "text-amber-400" :
                label === "Distribution" ? "text-purple-400" : "text-primary";
              return (
                <div key={div.id} className="grid grid-cols-8 gap-2 items-center px-4 py-3 hover:bg-secondary/20 transition-colors">
                  <div className="col-span-2">
                    <p className="font-mono text-sm font-bold">{div.security_symbol}</p>
                    <p className="text-xs text-muted-foreground truncate">{div.security_name}</p>
                  </div>
                  <span className={`text-xs font-semibold ${labelColor}`}>{label}</span>
                  <p className="text-right font-mono text-sm font-semibold text-primary">
                    M{parseFloat(div.amount_per_share).toFixed(4)}
                  </p>
                  <p className="text-right text-xs text-muted-foreground">
                    {fmtDate(div.ex_dividend_date) !== "—" ? fmtDate(div.ex_dividend_date) : fmtDate(div.record_date)}
                  </p>
                  <p className="text-right text-xs text-muted-foreground">{fmtDate(div.payment_date)}</p>
                  <div className="text-right">
                    <p className="font-mono text-sm font-semibold">M{parseFloat(div.total_payout || 0).toFixed(2)}</p>
                    <span className={`inline-block mt-0.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${statusColor(div.status)}`}>
                      {div.status}
                    </span>
                  </div>
                  <div className="flex justify-end">
                    {(div.status === "declared" || div.status === "processing") && (
                      <Button size="sm" variant="outline" disabled={processing === div.id}
                        onClick={() => handleProcess(div.id)} className="text-xs h-7">
                        {processing === div.id ? "Paying…" : incomeProfile(div.security_type).paymentVerb}
                      </Button>
                    )}
                    {div.status === "paid" && (
                      <CheckCircle2 className="h-5 w-5 text-primary" />
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