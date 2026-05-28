"use client";

import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Shield,
  FileText,
  BarChart3,
  AlertTriangle,
  Search,
  Download,
  TrendingUp,
  Users,
  Clock,
  Coins,
  CheckCircle2,
  XCircle,
  Link as LinkIcon,
  Cpu,
  Hash,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Package,
  Banknote,
  ExternalLink,
  Copy,
  RefreshCw,
  Send,
  Calendar,
  FileCheck,
  Layers,
  CheckCheck,
  AlertOctagon,
  HelpCircle,
} from "lucide-react";
import DashboardShell from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  getAllUsers,
  getAllSecurities,
  getTrades,
  getAuditLog,
  getMarketStats,
  getAlerts,
  getOrders,
  getOnchainTradeRecords,
  getAllTokenHolders,
  getBlockchainRecords,
  getAllReports,
  getAllIssuerDeadlines,
  getAllClearings,
  getClearingStats,
} from "@/lib/store";

const NAV_ITEMS = [
  { id: "overview",    label: "Overview",        icon: LayoutDashboard },
  { id: "compliance",  label: "Compliance",      icon: Shield },
  { id: "filings",     label: "Filings",         icon: FileText },
  { id: "clearing",    label: "Clearing House",  icon: Layers },
  { id: "audit",       label: "Audit Trail",     icon: FileText },
  { id: "market",      label: "Market Monitor",  icon: BarChart3 },
  { id: "tokens",      label: "Token Registry",  icon: Coins },
  { id: "blockchain",  label: "Blockchain",      icon: Cpu },
  { id: "reports",     label: "Reports",         icon: Download },
];

export default function RegulatorDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [users, setUsers] = useState([]);
  const [securities, setSecurities] = useState([]);
  const [trades, setTrades] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [onchainRecords, setOnchainRecords] = useState([]);
  const [allHolders, setAllHolders] = useState([]);
  const [blockchainRecords, setBlockchainRecords] = useState([]);
  const [allReports, setAllReports]               = useState([]);
  const [allDeadlines, setAllDeadlines]           = useState([]);
  const [clearings, setClearings]                 = useState([]);
  const [clearingStats, setClearingStats]         = useState(null);

  async function refreshData() {
    try {
      const [
        rawUsers,
        securitiesData,
        tradesData,
        auditData,
        statsData,
        ordersData,
        alertsData,
        onchainData,
        holdersData,
        blockchainData,
        reportsData,
        deadlinesData,
        clearingsData,
        clearingStatsData,
      ] = await Promise.all([
        getAllUsers(),
        getAllSecurities(),
        getTrades(),
        getAuditLog(),
        getMarketStats(),
        getOrders(),
        getAlerts(user?.id),
        getOnchainTradeRecords(),
        getAllTokenHolders(),
        getBlockchainRecords(),
        getAllReports(),
        getAllIssuerDeadlines(),
        getAllClearings(),
        getClearingStats(),
      ]);

      // Normalize user data to match what components expect
      const normalizedUsers = (rawUsers ?? []).map((u) => ({
        ...u,
        name: u.full_name || u.email?.split("@")[0] || "Unknown User",
        role:
          u.role_id === 1 ? "investor" :
          u.role_id === 2 ? "broker" :
          u.role_id === 3 ? "issuer" :
          u.role_id === 4 ? "regulator" :
          u.role_id === 5 ? "admin" : "other",
        status: u.is_active ? "active" : "inactive",
        createdAt: u.created_at,
        kyc: {
          status: u.kyc_status || "none",
          idNumber: null, // can be filled later if needed
        },
      }));

      setUsers(normalizedUsers);
      setSecurities(securitiesData ?? []);
      setTrades(tradesData ?? []);
      setAuditLog(auditData ?? []);
      setStats(statsData);
      setOrders(ordersData ?? []);
      setAlerts(alertsData ?? []);
      setOnchainRecords(onchainData ?? []);
      setAllHolders(holdersData ?? []);
      setBlockchainRecords(blockchainData ?? []);
      setAllReports(reportsData ?? []);
      setAllDeadlines(deadlinesData ?? []);
      setClearings(clearingsData ?? []);
      setClearingStats(clearingStatsData ?? null);
    } catch (err) {
      console.error("[REGULATOR DASHBOARD] refreshData failed:", err);
    }
  }

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 20000);
    return () => clearInterval(interval);
  }, [user?.id]);

  function renderContent() {
    switch (activeTab) {
      case "overview":
        return (
          <RegulatorOverview
            users={users}
            securities={securities}
            trades={trades}
            stats={stats}
            auditLog={auditLog}
          />
        );
      case "compliance":
        return <ComplianceView users={users} trades={trades} securities={securities} />;
      case "audit":
        return <AuditTrail auditLog={auditLog} users={users} />;
      case "market":
        return <MarketMonitor securities={securities} trades={trades} stats={stats} />;
      case "tokens":
        return (
          <TokenRegistry
            securities={securities}
            onchainRecords={onchainRecords}
            allHolders={allHolders}
          />
        );
      case "filings":
        return (
          <FilingsView
            reports={allReports}
            deadlines={allDeadlines}
            onRefresh={refreshData}
          />
        );
      case "clearing":
        return (
          <ClearingHouseView
            clearings={clearings}
            stats={clearingStats}
            onRefresh={refreshData}
          />
        );
      case "blockchain":
        return (
          <BlockchainView
            records={blockchainRecords}
            onRefresh={refreshData}
          />
        );
      case "reports":
        return (
          <ReportsView
            users={users}
            securities={securities}
            trades={trades}
            auditLog={auditLog}
            stats={stats}
          />
        );
      default:
        return null;
    }
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
      {renderContent()}
    </DashboardShell>
  );
}

// ────────────────────────────────────────────────
//  RegulatorOverview – minor safety improvements
// ────────────────────────────────────────────────

function RegulatorOverview({ users, securities, trades, stats, auditLog }) {
  const userList = Array.isArray(users) ? users : [];
  const auditList = Array.isArray(auditLog) ? auditLog : [];

  const kycApproved = userList.filter((u) => u.kyc?.status === "approved").length;
  const kycPending = userList.filter(
    (u) => u.kyc?.status === "submitted" || u.kyc?.status === "pending"
  ).length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Users" value={userList.length} icon={Users} />
        <StatCard title="KYC Verified" value={kycApproved} icon={Shield} />
        <StatCard title="KYC Pending" value={kycPending} icon={Clock} />
        <StatCard title="Total Trades" value={trades?.length ?? 0} icon={BarChart3} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Securities"
          value={stats?.activeSecurities ?? 0}
          icon={TrendingUp}
        />
        <StatCard
          title="Market Cap"
          value={`M${((stats?.totalMarketCap ?? 0) / 1e6).toFixed(1)}M`}
          icon={BarChart3}
        />
        <StatCard
          title="Trade Volume"
          value={(stats?.totalVolume ?? 0).toLocaleString()}
          icon={BarChart3}
        />
        <StatCard title="Audit Entries" value={auditList.length} icon={FileText} />
      </div>

      {/* Compliance Summary */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold text-foreground">
            KYC/AML Compliance Status
          </h3>
          <div className="space-y-3">
            {["approved", "submitted", "pending", "rejected"].map((status) => {
              const count = userList.filter(
                (u) => u.kyc?.status === status
              ).length;
              const total = userList.length || 1;
              const pct = ((count / total) * 100).toFixed(0);
              return (
                <div key={status} className="flex items-center gap-3">
                  <span className="w-20 text-xs capitalize text-muted-foreground">
                    {status}
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-secondary">
                    <div
                      className={`h-full rounded-full ${
                        status === "approved"
                          ? "bg-primary"
                          : status === "rejected"
                          ? "bg-destructive"
                          : "bg-accent"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-12 text-right text-xs font-medium text-foreground">
                    {count} ({pct}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Audit Activity */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold text-foreground">
            Recent Audit Activity
          </h3>
          <div className="space-y-2">
            {auditList.slice(-8).reverse().map((entry) => (
              <div
                key={entry.id}
                className="flex items-start gap-3 rounded-lg bg-secondary p-2.5"
              >
                <div className="mt-0.5 h-2 w-2 rounded-full bg-primary" />
                <div className="flex-1">
                  <p className="text-xs font-medium text-foreground">
                    {entry.details}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(entry.timestamp).toLocaleString()}
                  </p>
                </div>
                <Badge variant="secondary" className="text-xs font-mono">
                  {entry.action}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ComplianceView({ users, trades, securities }) {
  const [selectedRole, setSelectedRole] = useState("all");

  const userList = Array.isArray(users) ? users : [];
  const tradeList = Array.isArray(trades) ? trades : [];
  const securityList = Array.isArray(securities) ? securities : [];

  const filtered = userList.filter(
    (u) => selectedRole === "all" || u.role === selectedRole
  );

  const issues = [];

  userList.forEach((u) => {
    if (
      u.status === "active" &&
      u.kyc?.status !== "approved" &&
      u.role !== "admin" &&
      u.role !== "regulator"
    ) {
      const displayName = u.name || u.full_name || u.email?.split("@")[0] || `User ${u.id}`;
      issues.push({
        id: u.id,
        type: "KYC_MISSING",
        severity: "high",
        user: displayName,
        message: `Active user ${displayName} does not have approved KYC`,
      });
    }
  });
  // Check for large trades
  const largeTrades = tradeList.filter((t) => t.total > 5000);
  largeTrades.forEach((t) => {
    const sec = securityList.find((s) => s.id === t.securityId);
    issues.push({
      id: t.id,
      type: "LARGE_TRADE",
      severity: "medium",
      user: t.buyerId || t.sellerId,
      message: `Large trade: ${t.quantity} ${sec?.symbol || "N/A"} for M${t.total.toFixed(2)}`,
    });
  });

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-foreground">
        Compliance Monitoring
      </h3>

      {/* Compliance Alerts */}
      {issues.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Compliance Alerts ({issues.length})
          </h4>
          <div className="space-y-2">
            {issues.map((issue, idx) => (
              <div
                key={`${issue.id}-${idx}`}
                className={`flex items-start gap-3 rounded-lg p-3 ${
                  issue.severity === "high" ? "bg-destructive/10" : "bg-accent/10"
                }`}
              >
                <AlertTriangle
                  className={`mt-0.5 h-4 w-4 flex-shrink-0 ${
                    issue.severity === "high" ? "text-destructive" : "text-foreground"
                  }`}
                />
                <div className="flex-1">
                  <p className="text-xs font-medium text-foreground">
                    {issue.message}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Type: {issue.type} | Severity: <span className="capitalize">{issue.severity}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* User Compliance Table */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <select
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
          >
            <option value="all">All Roles</option>
            <option value="investor">Investor</option>
            <option value="broker">Broker</option>
            <option value="issuer">Issuer</option>
          </select>
        </div>

        <div className="rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary text-left">
                  <th className="px-4 py-3 font-medium text-muted-foreground">Name</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Role</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Account Status</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">KYC Status</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">ID Number</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Registered</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium text-foreground">{u.name}</td>
                    <td className="px-4 py-3 capitalize text-foreground">{u.role}</td>
                    <td className="px-4 py-3"><StatusBadge status={u.status} /></td>
                    <td className="px-4 py-3"><StatusBadge status={u.kyc?.status || "none"} /></td>
                    <td className="px-4 py-3 font-mono text-xs text-foreground">{u.kyc?.idNumber || "N/A"}</td>
                    <td className="px-4 py-3 text-xs text-foreground">{new Date(u.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
// ─── Audit Trail ───────────────────────────────────────────────────────────

function AuditTrail({ auditLog, users }) {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");

  // ✅ Ensure auditLog and users are always arrays
  const auditList = Array.isArray(auditLog) ? auditLog : [];
  const userList = Array.isArray(users) ? users : [];

  const uniqueActions = [...new Set(auditList.map((a) => a.action))];

  const filtered = auditList
    .slice()
    .reverse()
    .filter((a) => {
      const details = (a.details ?? "").toString().toLowerCase();
      const action  = (a.action  ?? "").toString().toLowerCase();
      const q       = search.toLowerCase();
      const matchSearch = details.includes(q) || action.includes(q);
      const matchAction = actionFilter === "all" || a.action === actionFilter;
      return matchSearch && matchAction;
    });

function exportAuditLog() {
  const csvRows = [
    "Timestamp,Action,Actor,Details",
    ...filtered.map((a) => {
      // Safe & readable local date/time formatting
      let timestampStr = "—"; // fallback for invalid/missing

      if (a.timestamp) {
        try {
          const date = new Date(a.timestamp);
          if (!isNaN(date.getTime())) {
            // Format: DD/MM/YYYY HH:mm:ss (24-hour, SAST local time)
            timestampStr = date.toLocaleString("en-ZA", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: false,
            });
          }
        } catch (err) {
          // keep fallback if parsing fails
        }
      }

      const actorName = userList.find((u) => u.id === a.actor)?.name || a.actor || "";

      // Escape quotes properly for CSV safety
      const escape = (val) => `"${String(val).replace(/"/g, '""')}"`;

      return [
        escape(timestampStr),
        escape(a.action || ""),
        escape(actorName),
        escape(a.details || ""),
      ].join(",");
    }),
  ].join("\n");

  const blob = new Blob([csvRows], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `mdsm-audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-semibold text-foreground">Audit Trail</h3>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search audit..."
              className="w-48 pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
          >
            <option value="all">All Actions</option>
            {uniqueActions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={exportAuditLog}>
            <Download className="mr-1 h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary text-left">
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Timestamp
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Action
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Actor
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Details
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map((entry) => {
                const actor = userList.find((u) => u.id === entry.actor);
                return (
                  <tr
                    key={entry.id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-4 py-3 text-xs text-foreground">
                      {new Date(entry.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="font-mono text-xs">
                        {entry.action}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {actor?.name || entry.actor}
                    </td>
                    <td className="px-4 py-3 text-foreground">{entry.details}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No audit entries found
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Showing {Math.min(filtered.length, 100)} of {filtered.length} entries
      </p>
    </div>
  );
}

// ─── Shared Component ────────────────────────────────────────────────
function StatCard({ title, value, icon: Icon, valueClass = "text-foreground" }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </div>
      <p className={`text-xl font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}

// ─── StatusBadge Component ─────────────────────────────────────────────
function StatusBadge({ status }) {
  const styles = {
    active: "bg-primary/10 text-primary",
    approved: "bg-primary/10 text-primary",
    listed: "bg-primary/10 text-primary",
    pending: "bg-accent/20 text-foreground",
    submitted: "bg-accent/20 text-foreground",
    suspended: "bg-destructive/10 text-destructive",
    rejected: "bg-destructive/10 text-destructive",
    none: "bg-secondary text-muted-foreground",
  };
  return (
    <Badge className={`capitalize ${styles[status] || styles.none}`}>
      {status || "none"}
    </Badge>
  );
}

// ─── Market Monitor ────────────────────────────────────────────────────────
function MarketMonitor({ securities, trades, stats }) {
  const tradeList = Array.isArray(trades) ? trades : [];
  const securityList = Array.isArray(securities) ? securities : [];

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-foreground">
        Market Monitoring
      </h3>

      {/* Market Stats - already good, minor safety */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Market Cap"
          value={`M${((stats?.totalMarketCap || 0) / 1e6).toFixed(1)}`}
          icon={BarChart3}
        />
        <StatCard
          title="24h Volume"
          value={(stats?.totalVolume || 0).toLocaleString()}
          icon={TrendingUp}
        />
        <StatCard
          title="Active Securities"
          value={stats?.activeSecurities || 0}
          icon={BarChart3}
        />
        <StatCard
          title="Total Settled Trades"
          value={tradeList.filter((t) => t.status === "settled").length}
          icon={Shield}
        />
      </div>

      {/* Securities Table - add fallback for missing price/volume */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h4 className="mb-4 text-sm font-semibold text-foreground">
          Listed Securities
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary text-left">
                <th className="px-4 py-3 font-medium text-muted-foreground">Symbol</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Type</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Price</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Change</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Volume</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Market Cap</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {securityList.map((sec) => (
                <tr key={sec.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-mono font-bold text-foreground">{sec.symbol || "—"}</td>
                  <td className="px-4 py-3 text-foreground">{sec.name || "Unnamed"}</td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary" className="capitalize text-xs">
                      {sec.type || "equity"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-foreground">
                    {sec.price != null ? `M${Number(sec.price).toFixed(2)}` : "—"}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-mono ${
                      (sec.change ?? 0) >= 0 ? "text-primary" : "text-destructive"
                    }`}
                  >
                    {(sec.change ?? 0) >= 0 ? "+" : ""}
                    {(sec.changePercent ?? sec.change ?? 0).toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-foreground">
                    {(sec.available_tokens ?? sec.volume ?? 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-foreground">
                    {sec.marketCap != null && !isNaN(sec.marketCap)
                      ? `M${(Number(sec.marketCap) / 1e6).toFixed(1)}`
                      : Number(sec.price ?? 0) * (sec.total_supply ?? 0) > 0
                        ? `M${((Number(sec.price) * sec.total_supply) / 1e6).toFixed(1)}`
                        : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={sec.status || sec.approved === 't' ? 'listed' : 'approved'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Trade Activity – improved fallbacks + fix field names */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h4 className="mb-4 text-sm font-semibold text-foreground">
          Recent Trade Activity
        </h4>
        {tradeList.length === 0 ? (
          <p className="text-sm text-muted-foreground">No trade activity</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary text-left">
                  <th className="px-4 py-3 font-medium text-muted-foreground">Time</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Security</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Qty</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Price</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Total</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Party</th> 
                  <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {tradeList
                  .slice()
                  .reverse()
                  .slice(0, 20)
                  .map((t) => {
                    const sec = securityList.find((s) => s.id === t.security_id); // ← fix: security_id not securityId
                    const timeStr = t.created_at
                      ? new Date(t.created_at).toLocaleString("en-ZA", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })
                      : "—";

                    const party = t.buyer_id && t.seller_id
                      ? `${t.buyer_id} → ${t.seller_id}`
                      : t.buyer_id
                        ? `Buy by ${t.buyer_id}`
                        : t.seller_id
                          ? `Sell by ${t.seller_id}`
                          : "—";

                    return (
                      <tr key={t.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3 text-xs text-foreground">{timeStr}</td>
                        <td className="px-4 py-3 font-mono font-bold text-foreground">
                          {sec?.symbol || `ID:${t.security_id}` || "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-foreground">
                          {t.quantity ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-foreground">
                          {t.price != null ? `M${Number(t.price).toFixed(2)}` : "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-foreground">
                          {t.total != null ? `M${Number(t.total).toFixed(2)}` : "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-foreground">
                          {party}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            className={
                              t.status === "settled"
                                ? "bg-green-100 text-green-800"
                                : "bg-amber-100 text-amber-800"
                            }
                          >
                            {t.status || "unknown"}
                          </Badge>
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
  );
}
// ─── Token Registry ────────────────────────────────────────────────────────
function TokenRegistry({ securities, onchainRecords, allHolders }) {
  const [secFilter, setSecFilter] = useState("all");
  const [search, setSearch]       = useState("");
  const [activeSection, setActiveSection] = useState("records"); // "records" | "holders"

  const secList     = Array.isArray(securities)     ? securities     : [];
  const recordList  = Array.isArray(onchainRecords) ? onchainRecords : [];
  const holderList  = Array.isArray(allHolders)     ? allHolders     : [];

  // ── Summary stats per security ──────────────────────────────────────────
  const secStats = secList.map((s) => {
    const holders = holderList.filter((h) => h.security_id === s.id);
    const onchain = recordList.filter((r) => r.security_id === s.id && r.status === "confirmed");
    return {
      ...s,
      holderCount: holders.length,
      confirmedTrades: onchain.length,
    };
  });

  // ── Filtered on-chain records ────────────────────────────────────────────
  const filteredRecords = recordList.filter((r) => {
    const matchSec = secFilter === "all" || String(r.security_id) === secFilter;
    const matchSearch =
      !search ||
      (r.tx_hash || "").toLowerCase().includes(search.toLowerCase()) ||
      (r.symbol  || "").toLowerCase().includes(search.toLowerCase());
    return matchSec && matchSearch;
  });

  // ── Filtered holders ─────────────────────────────────────────────────────
  const filteredHolders = holderList.filter((h) => {
    const matchSec = secFilter === "all" || String(h.security_id) === secFilter;
    const matchSearch =
      !search ||
      (h.full_name     || "").toLowerCase().includes(search.toLowerCase()) ||
      (h.email         || "").toLowerCase().includes(search.toLowerCase()) ||
      (h.wallet_address|| "").toLowerCase().includes(search.toLowerCase()) ||
      (h.symbol        || "").toLowerCase().includes(search.toLowerCase());
    return matchSec && matchSearch;
  });

  // ── Total confirmed / failed ─────────────────────────────────────────────
  const confirmed = recordList.filter((r) => r.status === "confirmed").length;
  const failed    = recordList.filter((r) => r.status === "failed").length;
  const pending   = recordList.filter((r) => !r.status || r.status === "pending").length;
  const uniqueHolderCount = new Set(holderList.map((h) => h.user_id)).size;

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-foreground">Token Registry</h3>
      <p className="text-sm text-muted-foreground">
        On-chain token distribution and blockchain trade records for all MDSM securities.
      </p>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="On-Chain Trades"   value={confirmed}          icon={CheckCircle2} />
        <StatCard title="Failed Records"    value={failed}             icon={XCircle} />
        <StatCard title="Token Holders"     value={uniqueHolderCount}  icon={Users} />
        <StatCard title="Listed Securities" value={secList.length}     icon={Coins} />
      </div>

      {/* Per-security token overview */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h4 className="mb-4 text-sm font-semibold text-foreground">Securities Token Overview</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary text-left">
                <th className="px-4 py-3 font-medium text-muted-foreground">Symbol</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Total Supply</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Available</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Holders</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">On-Chain Trades</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Mint Tx</th>
              </tr>
            </thead>
            <tbody>
              {secStats.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-sm text-muted-foreground">
                    No securities found
                  </td>
                </tr>
              ) : (
                secStats.map((s) => (
                  <tr key={s.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-mono font-bold text-foreground">{s.symbol || "—"}</td>
                    <td className="px-4 py-3 text-foreground">{s.name}</td>
                    <td className="px-4 py-3 text-right font-mono text-foreground">
                      {Number(s.total_supply ?? 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-foreground">
                      {Number(s.available_tokens ?? 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-foreground">{s.holderCount}</td>
                    <td className="px-4 py-3 text-right font-mono text-foreground">{s.confirmedTrades}</td>
                    <td className="px-4 py-3">
                      {s.tx_hash ? (
                        <span
                          className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 font-mono text-xs text-primary"
                          title={s.tx_hash}
                        >
                          <LinkIcon className="h-3 w-3" />
                          {s.tx_hash.slice(0, 10)}…
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">not minted</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section switcher + filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeSection === "records"
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveSection("records")}
          >
            On-Chain Records ({filteredRecords.length})
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeSection === "holders"
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveSection("holders")}
          >
            Token Holders ({filteredHolders.length})
          </button>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
            value={secFilter}
            onChange={(e) => setSecFilter(e.target.value)}
          >
            <option value="all">All Securities</option>
            {secList.map((s) => (
              <option key={s.id} value={String(s.id)}>{s.symbol} — {s.name}</option>
            ))}
          </select>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search…"
              className="w-48 pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* On-Chain Records table */}
      {activeSection === "records" && (
        <div className="rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary text-left">
                  <th className="px-4 py-3 font-medium text-muted-foreground">Time</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Security</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Order #</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Qty</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Price</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Block</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Tx Hash</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-center text-sm text-muted-foreground">
                      No on-chain records found
                    </td>
                  </tr>
                ) : (
                  filteredRecords.slice(0, 100).map((r) => (
                    <tr key={r.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 text-xs text-foreground">
                        {r.recorded_at
                          ? new Date(r.recorded_at).toLocaleString("en-ZA", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })
                          : "—"}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-foreground">
                        {r.symbol || `ID:${r.security_id}` || "—"}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-foreground">
                        #{r.order_id ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-foreground">
                        {r.quantity != null ? Number(r.quantity).toLocaleString() : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-foreground">
                        {r.price != null ? `M${Number(r.price).toFixed(2)}` : "—"}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-foreground">
                        {r.block_number > 0 ? `#${r.block_number}` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {r.tx_hash ? (
                          <span
                            className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 font-mono text-xs text-primary"
                            title={r.tx_hash}
                          >
                            <LinkIcon className="h-3 w-3" />
                            {r.tx_hash.slice(0, 12)}…
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {r.error_message
                              ? r.error_message.slice(0, 40)
                              : "—"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          className={
                            r.status === "confirmed"
                              ? "bg-green-100 text-green-800"
                              : r.status === "failed"
                              ? "bg-red-100 text-red-800"
                              : "bg-amber-100 text-amber-800"
                          }
                        >
                          {r.status || "pending"}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="px-4 py-2 text-xs text-muted-foreground">
            Showing {Math.min(filteredRecords.length, 100)} of {filteredRecords.length} records
          </p>
        </div>
      )}

      {/* Token Holders table */}
      {activeSection === "holders" && (
        <div className="rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary text-left">
                  <th className="px-4 py-3 font-medium text-muted-foreground">Security</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Holder</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Email</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Tokens</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">% of Supply</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Wallet</th>
                </tr>
              </thead>
              <tbody>
                {filteredHolders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-sm text-muted-foreground">
                      No token holders found
                    </td>
                  </tr>
                ) : (
                  filteredHolders.slice(0, 200).map((h, idx) => {
                    const pct =
                      h.total_supply && h.total_supply > 0
                        ? ((h.quantity / h.total_supply) * 100).toFixed(2)
                        : "—";
                    return (
                      <tr key={`${h.security_id}-${h.user_id}-${idx}`} className="border-b border-border last:border-0">
                        <td className="px-4 py-3 font-mono font-bold text-foreground">{h.symbol}</td>
                        <td className="px-4 py-3 text-foreground">{h.full_name || "—"}</td>
                        <td className="px-4 py-3 text-xs text-foreground">{h.email}</td>
                        <td className="px-4 py-3 text-right font-mono text-foreground">
                          {Number(h.quantity).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-foreground">{pct}%</td>
                        <td className="px-4 py-3">
                          {h.wallet_address ? (
                            <span
                              className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-0.5 font-mono text-xs text-foreground"
                              title={h.wallet_address}
                            >
                              {h.wallet_address.slice(0, 8)}…{h.wallet_address.slice(-6)}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">no wallet</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <p className="px-4 py-2 text-xs text-muted-foreground">
            Showing {Math.min(filteredHolders.length, 200)} of {filteredHolders.length} holders
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Filings & Deadline Tracker ────────────────────────────────────────────
function FilingsView({ reports = [], deadlines = [], onRefresh }) {
  const [tab, setTab]         = useState("deadlines"); // deadlines | filings
  const [search, setSearch]   = useState("");
  const [typeFilter, setType] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => { setRefreshing(true); await onRefresh?.(); setRefreshing(false); };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-ZA", { day:"numeric", month:"short", year:"numeric" }) : "—";

  // ── Deadline summary ──────────────────────────────────────────────
  const flatDeadlines = deadlines.flatMap(({ issuer_id, company_name, deadlines: dl }) =>
    dl.map(d => ({ ...d, issuer_id, company_name }))
  );
  const overdue   = flatDeadlines.filter(d => !d.filed && d.urgency === "overdue");
  const critical  = flatDeadlines.filter(d => !d.filed && d.urgency === "critical");
  const upcoming  = flatDeadlines.filter(d => !d.filed && d.urgency === "warning");
  const filed     = flatDeadlines.filter(d => d.filed);

  const urgencyStyle = (u, isFiled) => {
    if (isFiled) return { bar:"bg-emerald-500", badge:"bg-emerald-500/10 text-emerald-400 border-emerald-500/20", label:"Filed" };
    return ({
      overdue:  { bar:"bg-red-500",    badge:"bg-red-500/10 text-red-400 border-red-500/20",          label:"Overdue"  },
      critical: { bar:"bg-orange-500", badge:"bg-orange-500/10 text-orange-400 border-orange-500/20", label:"Due Soon" },
      warning:  { bar:"bg-yellow-500", badge:"bg-yellow-500/10 text-yellow-400 border-yellow-500/20", label:"Upcoming" },
      ok:       { bar:"bg-emerald-500",badge:"bg-emerald-500/10 text-emerald-400 border-emerald-500/20",label:"On Track"},
    }[u] || { bar:"bg-gray-500", badge:"bg-gray-500/10 text-gray-400 border-gray-500/20", label:"—" });
  };

  // ── Filings filter ────────────────────────────────────────────────
  const filteredReports = reports.filter(r => {
    if (typeFilter !== "all" && r.report_type !== typeFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (r.issuer_name    || "").toLowerCase().includes(q) ||
      (r.title          || "").toLowerCase().includes(q) ||
      (r.security_symbol|| "").toLowerCase().includes(q)
    );
  });

  const statusBadge = (s) => ({
    submitted: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    accepted:  "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    rejected:  "bg-red-500/10 text-red-400 border-red-500/20",
  }[s] || "bg-gray-500/10 text-gray-400 border-gray-500/20");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Issuer Filings & Deadlines
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Monitor all issuer report submissions and compliance deadlines
          </p>
        </div>
        <button onClick={handleRefresh}
          className="flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label:"Overdue",    value: overdue.length,  color:"text-red-400" },
          { label:"Due Soon",   value: critical.length, color:"text-orange-400" },
          { label:"Upcoming",   value: upcoming.length, color:"text-yellow-400" },
          { label:"Filed",      value: filed.length,    color:"text-emerald-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
            <p className={`mt-1 text-2xl font-bold font-mono ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 rounded-lg border border-border bg-secondary/20 p-1 w-fit">
        {[["deadlines","Deadline Tracker"],["filings","Submitted Filings"]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`rounded px-4 py-1.5 text-xs font-medium transition-colors
              ${tab === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Deadline Tracker ── */}
      {tab === "deadlines" && (
        <div className="space-y-4">
          {deadlines.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              No issuers with listed securities found.
            </div>
          ) : deadlines.map(({ issuer_id, company_name, deadlines: dl }) => (
            <div key={issuer_id} className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="border-b border-border bg-secondary/30 px-5 py-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">{company_name}</p>
                <div className="flex gap-1.5">
                  {dl.filter(d => !d.filed && d.urgency === "overdue").length > 0 && (
                    <span className="rounded-full bg-red-500/10 border border-red-500/20 text-red-400 px-2 py-0.5 text-[10px] font-semibold">
                      {dl.filter(d => !d.filed && d.urgency === "overdue").length} Overdue
                    </span>
                  )}
                  {dl.filter(d => d.filed).length > 0 && (
                    <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 text-[10px] font-semibold">
                      {dl.filter(d => d.filed).length} Filed
                    </span>
                  )}
                </div>
              </div>
              <div className="divide-y divide-border">
                {dl.map(d => {
                  const sty = urgencyStyle(d.urgency, d.filed);
                  return (
                    <div key={d.id} className="flex items-center gap-4 px-5 py-3">
                      <div className={`h-8 w-1 rounded-full shrink-0 ${sty.bar}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground">{d.label}</p>
                        <p className="text-[10px] text-muted-foreground">
                          Period: {fmtDate(d.period_start)} – {fmtDate(d.period_end)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-muted-foreground">Due</p>
                        <p className="text-xs font-medium text-foreground">{fmtDate(d.due_date)}</p>
                      </div>
                      {!d.filed && (
                        <div className="text-right w-14">
                          <p className="text-[10px] text-muted-foreground">{d.days_left < 0 ? "Late" : "Left"}</p>
                          <p className={`text-sm font-bold ${d.days_left < 0 ? "text-red-400" : d.days_left <= 7 ? "text-orange-400" : "text-foreground"}`}>
                            {Math.abs(d.days_left)}d
                          </p>
                        </div>
                      )}
                      <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold shrink-0 ${sty.badge}`}>
                        {sty.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Submitted Filings ── */}
      {tab === "filings" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {["all","quarterly","annual","current"].map(f => (
              <button key={f} onClick={() => setType(f)}
                className={`rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors
                  ${typeFilter === f ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
                {f === "all" ? "All Types" : f}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search issuer, title…"
                className="bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none w-40" />
            </div>
          </div>

          {filteredReports.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              No filings found{search ? " matching your search" : ""}.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    {["Issuer","Type","Title","Period","Filed On","Document","Status"].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredReports.map(r => (
                    <tr key={r.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-xs font-semibold text-foreground">{r.issuer_name}</p>
                        {r.security_symbol && <p className="text-[10px] text-muted-foreground">{r.security_symbol}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize border-primary/20 bg-primary/10 text-primary">
                          {r.report_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-[220px]">
                        <p className="text-xs font-medium text-foreground truncate">{r.title}</p>
                        {r.description && <p className="text-[10px] text-muted-foreground truncate">{r.description.slice(0, 80)}{r.description.length > 80 ? "…" : ""}</p>}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {r.period_start && r.period_end
                          ? `${fmtDate(r.period_start)} – ${fmtDate(r.period_end)}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(r.filed_at)}</td>
                      <td className="px-4 py-3">
                        {r.document_url ? (
                          <a
                            href={r.document_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={r.document_name || "View document"}
                            className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary hover:bg-primary/20 transition-colors whitespace-nowrap"
                          >
                            <Download className="h-3 w-3 shrink-0" />
                            {r.document_name
                              ? r.document_name.length > 22
                                ? r.document_name.slice(0, 20) + "…"
                                : r.document_name
                              : "View File"}
                          </a>
                        ) : (
                          <span className="text-[11px] text-muted-foreground italic">No document</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${statusBadge(r.status)}`}>
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="border-t border-border bg-secondary/20 px-4 py-2 text-[11px] text-muted-foreground">
                {filteredReports.length} filing{filteredReports.length !== 1 ? "s" : ""}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Clearing House ────────────────────────────────────────────────────────
function ClearingHouseView({ clearings = [], stats, onRefresh }) {
  const [search, setSearch]     = useState("");
  const [filter, setFilter]     = useState("all"); // all | settled | pending | failed

  const filtered = clearings.filter((c) => {
    const matchStatus = filter === "all" || c.status === filter;
    const q = search.toLowerCase();
    const matchSearch = !q
      || (c.symbol || "").toLowerCase().includes(q)
      || (c.buyer_name || "").toLowerCase().includes(q)
      || (c.seller_name || "").toLowerCase().includes(q)
      || String(c.id).includes(q);
    return matchStatus && matchSearch;
  });

  const totalVolume = (stats?.total_volume || 0);

  const statusColor = (s) =>
    s === "settled" ? "text-primary"
    : s === "pending" ? "text-amber-400"
    : s === "failed"  ? "text-destructive"
    : "text-muted-foreground";

  const statusVariant = (s) =>
    s === "settled" ? "default"
    : s === "pending" ? "outline"
    : s === "failed"  ? "destructive"
    : "secondary";

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Clearings"
          value={clearings.length}
          icon={Layers}
        />
        <StatCard
          title="Settled"
          value={stats?.settled ?? 0}
          icon={CheckCheck}
          valueClass="text-primary"
        />
        <StatCard
          title="Pending"
          value={stats?.pending ?? 0}
          icon={Clock}
          valueClass="text-amber-400"
        />
        <StatCard
          title="Failed"
          value={stats?.failed ?? 0}
          icon={AlertOctagon}
          valueClass="text-destructive"
        />
      </div>

      {/* Volume card */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-3 mb-1">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Total Settled Volume</h3>
        </div>
        <p className="text-3xl font-bold text-primary mt-2">
          M{totalVolume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          Sum of all investor-to-investor trades matched through the order book and cleared by the clearing house.
          Each trade deducts a 0.5% clearing fee from both buyer and seller.
        </p>
      </div>

      {/* Filter + search */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
          <h3 className="font-semibold flex items-center gap-2 flex-1">
            <Layers className="h-4 w-4 text-primary" />
            Clearing Records
            <Badge variant="outline" className="ml-1">{filtered.length}</Badge>
          </h3>
          <div className="flex gap-2 flex-wrap">
            {["all","settled","pending","failed"].map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors capitalize ${
                  filter === s
                    ? "bg-primary/15 border-primary/40 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9 w-56"
              placeholder="Search symbol, buyer, seller…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <Layers className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p>No clearing records match this filter.</p>
            <p className="text-sm mt-1">Clearing records appear when investors place limit orders that match in the order book.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left py-3 px-3 font-medium">#</th>
                  <th className="text-left py-3 px-3 font-medium">Security</th>
                  <th className="text-left py-3 px-3 font-medium">Buyer</th>
                  <th className="text-left py-3 px-3 font-medium">Seller</th>
                  <th className="text-right py-3 px-3 font-medium">Qty</th>
                  <th className="text-right py-3 px-3 font-medium">Price</th>
                  <th className="text-right py-3 px-3 font-medium">Total</th>
                  <th className="text-right py-3 px-3 font-medium text-cyan-400">Buyer Fee</th>
                  <th className="text-right py-3 px-3 font-medium text-cyan-400">Seller Fee</th>
                  <th className="text-center py-3 px-3 font-medium">Status</th>
                  <th className="text-left py-3 px-3 font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30 text-xs">
                    <td className="py-2.5 px-3 text-muted-foreground font-mono-nums">{c.id}</td>
                    <td className="py-2.5 px-3 font-semibold">{c.symbol}</td>
                    <td className="py-2.5 px-3">
                      <div className="font-medium">{c.buyer_name || "—"}</div>
                      <div className="text-muted-foreground text-[10px]">{c.buyer_email}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-medium">{c.seller_name || "—"}</div>
                      <div className="text-muted-foreground text-[10px]">{c.seller_email}</div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-nums">{c.quantity}</td>
                    <td className="py-2.5 px-3 text-right font-mono-nums">M{Number(c.price).toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-right font-semibold font-mono-nums">
                      M{Number(c.total).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-cyan-400 font-mono-nums">
                      M{Number(c.buyer_fee).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-cyan-400 font-mono-nums">
                      M{Number(c.seller_fee).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <Badge variant={statusVariant(c.status)} className="capitalize text-[10px]">
                        {c.status}
                      </Badge>
                      {c.failure_reason && (
                        <div className="mt-0.5 text-[10px] text-destructive max-w-[140px] truncate" title={c.failure_reason}>
                          {c.failure_reason}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground">
                      {new Date(c.settled_at || c.created_at).toLocaleString([], {
                        month: "short", day: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* How it works */}
      <div className="rounded-xl border bg-card p-5 text-sm text-muted-foreground space-y-2">
        <h4 className="font-semibold text-foreground flex items-center gap-2">
          <HelpCircle className="h-4 w-4" /> How the Clearing House Works
        </h4>
        <ul className="list-disc list-inside space-y-1">
          <li>Investors place <strong className="text-foreground">limit orders</strong> into the order book at a specified price.</li>
          <li>The <strong className="text-foreground">matching engine</strong> finds counterparty orders using price-time priority (best price first, then earliest placed).</li>
          <li>Each match creates a <strong className="text-foreground">clearing record</strong> (initially <em>pending</em>).</li>
          <li>The clearing house <strong className="text-foreground">verifies</strong> the buyer has sufficient funds and the seller has sufficient holdings.</li>
          <li>On success, funds and tokens are <strong className="text-foreground">settled atomically</strong> within a single database transaction.</li>
          <li>Clearing fee: <strong className="text-foreground">0.5% on each side</strong> (1% total round-trip). Buyer pays 0.5% on top; seller receives 0.5% less.</li>
          <li>Failed clearings are recorded with a reason; the bad resting order is cancelled.</li>
        </ul>
      </div>
    </div>
  );
}

// ─── Blockchain Ledger ─────────────────────────────────────────────────────
function BlockchainView({ records = [], onRefresh }) {
  const [search, setSearch]     = useState("");
  const [filter, setFilter]     = useState("all"); // all | trade | mint | dividend
  const [copied, setCopied]     = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefresh?.();
    setRefreshing(false);
  };

  const copyHash = (hash) => {
    navigator.clipboard?.writeText(hash).catch(() => {});
    setCopied(hash);
    setTimeout(() => setCopied(null), 1500);
  };

  const filtered = records.filter((r) => {
    if (filter !== "all" && r.event_type !== filter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (r.tx_hash     || "").toLowerCase().includes(q) ||
      (r.symbol      || "").toLowerCase().includes(q) ||
      (r.security_name || "").toLowerCase().includes(q) ||
      (r.event_type  || "").toLowerCase().includes(q)
    );
  });

  const eventMeta = (type) => {
    if (type === "mint")     return { label: "Mint",         color: "text-violet-400 bg-violet-500/10 border-violet-500/20", Icon: Package };
    if (type === "dividend") return { label: "Settlement",   color: "text-amber-400  bg-amber-500/10  border-amber-500/20",  Icon: Banknote };
    return                          { label: "Trade",        color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", Icon: Zap };
  };

  const fmtHash = (h) => h ? `${h.slice(0, 8)}…${h.slice(-6)}` : "—";
  const fmtDate = (d) => d ? new Date(d).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" }) : "—";
  const fmtM    = (v) => v != null ? `M${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—";

  const totalTrades   = records.filter(r => r.event_type === "trade"   || !r.event_type).length;
  const totalMints    = records.filter(r => r.event_type === "mint").length;
  const totalDivs     = records.filter(r => r.event_type === "dividend").length;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Cpu className="h-5 w-5 text-primary" /> Blockchain Ledger
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Immutable on-chain record of all trades, token mints, and dividend settlements
          </p>
        </div>
        <button onClick={handleRefresh}
          className="flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors">
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Summary KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Records",       value: records.length,  color: "text-primary" },
          { label: "Trade Executions",    value: totalTrades,     color: "text-emerald-400" },
          { label: "Token Mints",         value: totalMints,      color: "text-violet-400" },
          { label: "Dividend Settlements",value: totalDivs,       color: "text-amber-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
            <p className={`mt-1 text-2xl font-bold font-mono ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {["all","trade","mint","dividend"].map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors capitalize
              ${filter === f
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"}`}>
            {f === "all" ? "All Events" : f === "dividend" ? "Settlements" : f.charAt(0).toUpperCase() + f.slice(1) + "s"}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search hash, symbol…"
            className="bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none w-44"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
            <Cpu className="h-10 w-10 opacity-20" />
            <p className="text-sm">No blockchain records{search ? " matching your search" : " yet"}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Type</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Tx Hash</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Security</th>
                  <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Qty / Amount</th>
                  <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Value</th>
                  <th className="px-4 py-3 text-center text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((r, i) => {
                  const { label, color, Icon } = eventMeta(r.event_type);
                  const isConfirmed = !r.status || r.status === "confirmed" || r.status === "settled";
                  return (
                    <tr key={`${r.event_type ?? "evt"}-${r.id ?? i}`} className="hover:bg-secondary/20 transition-colors">
                      {/* Type */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${color}`}>
                          <Icon className="h-3 w-3" />
                          {label}
                        </span>
                      </td>
                      {/* Tx Hash */}
                      <td className="px-4 py-3">
                        {r.tx_hash ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs text-primary">{fmtHash(r.tx_hash)}</span>
                            <button onClick={() => copyHash(r.tx_hash)}
                              title="Copy full hash"
                              className="text-muted-foreground hover:text-foreground transition-colors">
                              {copied === r.tx_hash
                                ? <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                                : <Copy className="h-3 w-3" />}
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Pending</span>
                        )}
                        {r.block_number ? (
                          <p className="text-[10px] text-muted-foreground mt-0.5">Block #{r.block_number}</p>
                        ) : null}
                      </td>
                      {/* Security */}
                      <td className="px-4 py-3">
                        <p className="font-mono text-xs font-semibold text-foreground">{r.symbol || "—"}</p>
                        <p className="text-[10px] text-muted-foreground truncate max-w-[140px]">{r.security_name || ""}</p>
                      </td>
                      {/* Qty / Amount */}
                      <td className="px-4 py-3 text-right">
                        {r.quantity != null
                          ? <span className="font-mono text-xs text-foreground">{Number(r.quantity).toLocaleString()}</span>
                          : r.price != null
                          ? <span className="font-mono text-xs text-foreground">{fmtM(r.price)}<span className="text-muted-foreground">/unit</span></span>
                          : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                      {/* Value */}
                      <td className="px-4 py-3 text-right">
                        <span className="font-mono text-xs font-semibold text-foreground">{fmtM(r.total)}</span>
                      </td>
                      {/* Status */}
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize
                          ${isConfirmed
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"}`}>
                          {isConfirmed ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                          {r.status || "confirmed"}
                        </span>
                      </td>
                      {/* Timestamp */}
                      <td className="px-4 py-3 text-right">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{fmtDate(r.timestamp)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {filtered.length > 0 && (
          <div className="border-t border-border bg-secondary/20 px-4 py-2 text-[11px] text-muted-foreground">
            Showing {filtered.length} of {records.length} records
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Reports ───────────────────────────────────────────────────────────────
function ReportsView({ users, securities, trades, auditLog, stats }) {
  const [generating, setGenerating] = useState(null);

  // ✅ Ensure all inputs are arrays
  const userList = Array.isArray(users) ? users : [];
  const tradeList = Array.isArray(trades) ? trades : [];
  const securityList = Array.isArray(securities) ? securities : [];
  const auditList = Array.isArray(auditLog) ? auditLog : [];

  function generateReport(type) {
    setGenerating(type);

    setTimeout(() => {
      let csv = "";
      let filename = "";

      switch (type) {
        case "users":
          csv = [
            "Name,Email,Role,Status,KYC Status,ID Number,Registered",
            ...userList.map(
              (u) =>
                `"${u.name}","${u.email}","${u.role}","${u.status}","${
                  u.kyc?.status || "N/A"
                }","${u.kyc?.idNumber || "N/A"}","${u.createdAt}"`
            ),
          ].join("\n");
          filename = "mdsm-users-report";
          break;

        case "trades":
          csv = [
            "Timestamp,Security,Buyer,Quantity,Price,Total,Status",
            ...tradeList.map((t) => {
              const sec = securityList.find((s) => s.id === t.securityId);
              return `"${t.timestamp}","${sec?.symbol || "N/A"}","${
                t.buyerId
              }","${t.quantity}","${t.price}","${t.total}","${t.status}"`;
            }),
          ].join("\n");
          filename = "mdsm-trades-report";
          break;

        case "securities":
          csv = [
            "Symbol,Name,Type,Price,Change%,Volume,MarketCap,Status",
            ...securityList.map(
              (s) =>
                `"${s.symbol}","${s.name}","${s.type}","${s.price}","${s.changePercent}","${s.volume}","${s.marketCap}","${s.status}"`
            ),
          ].join("\n");
          filename = "mdsm-securities-report";
          break;

        case "compliance":
          csv = [
            "Timestamp,Action,Actor,Details",
            ...auditList.map(
              (a) =>
                `"${a.timestamp}","${a.action}","${
                  userList.find((u) => u.id === a.actor)?.name || a.actor
                }","${a.details}"`
            ),
          ].join("\n");
          filename = "mdsm-compliance-report";
          break;

        default:
          break;
      }

      if (csv) {
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${filename}-${new Date()
          .toISOString()
          .slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
      }

      setGenerating(null);
    }, 1000);
  }

  const reports = [
    {
      id: "users",
      title: "User Registry Report",
      desc: "Complete list of all registered users with KYC status, roles, and account details.",
      icon: Users,
    },
    {
      id: "trades",
      title: "Trade Activity Report",
      desc: "All settled and pending trades with security details, volumes, and counterparties.",
      icon: BarChart3,
    },
    {
      id: "securities",
      title: "Securities Listing Report",
      desc: "All listed securities with current pricing, market cap, and trading volume.",
      icon: TrendingUp,
    },
    {
      id: "compliance",
      title: "Compliance Audit Report",
      desc: "Full audit trail of all system activities for regulatory compliance review.",
      icon: Shield,
    },
  ];

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-foreground">
        Generate Compliance Reports
      </h3>
      <p className="text-sm text-muted-foreground">
        Export regulatory reports for CBL (Central Bank of Lesotho) compliance
        requirements. All reports are generated as CSV files.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {reports.map((report) => {
          const Icon = report.icon;
          return (
            <div
              key={report.id}
              className="rounded-xl border border-border bg-card p-5"
            >
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h4 className="text-sm font-semibold text-foreground">
                  {report.title}
                </h4>
              </div>
              <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
                {report.desc}
              </p>
              <Button
                size="sm"
                className="w-full"
                disabled={generating === report.id}
                onClick={() => generateReport(report.id)}
              >
                <Download className="mr-2 h-4 w-4" />
                {generating === report.id
                  ? "Generating..."
                  : "Export CSV Report"}
              </Button>
            </div>
          );
        })}
      </div>

      {/* Quick Stats */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h4 className="mb-3 text-sm font-semibold text-foreground">
          Report Summary
        </h4>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-lg bg-secondary p-3 text-center">
            <p className="text-lg font-bold text-foreground">{userList.length}</p>
            <p className="text-xs text-muted-foreground">Total Users</p>
          </div>
          <div className="rounded-lg bg-secondary p-3 text-center">
            <p className="text-lg font-bold text-foreground">{tradeList.length}</p>
            <p className="text-xs text-muted-foreground">Total Trades</p>
          </div>
          <div className="rounded-lg bg-secondary p-3 text-center">
            <p className="text-lg font-bold text-foreground">{securityList.length}</p>
            <p className="text-xs text-muted-foreground">Securities</p>
          </div>
          <div className="rounded-lg bg-secondary p-3 text-center">
            <p className="text-lg font-bold text-foreground">{auditList.length}</p>
            <p className="text-xs text-muted-foreground">Audit Entries</p>
          </div>
        </div>
      </div>
    </div>
  );
}