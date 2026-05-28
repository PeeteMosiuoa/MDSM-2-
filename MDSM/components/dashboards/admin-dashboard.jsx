"use client";

import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Users,
  Shield,
  FileText,
  Settings,
  BarChart3,
  UserPlus,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Search,
  Trash2,
  Ban,
  CheckCircle,
  User,
  Link2,
  ExternalLink,
  Copy,
} from "lucide-react";
import DashboardShell from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
//import { approveAndTokenizeListing } from "@/lib/actions/tokenizeListing"; // ← NEW

import {
  getAllUsers,
  getAllSecurities,
  getPendingListings,
  approveListing,
  rejectListing,
  approveKYC,
  rejectKYC,
  deleteUser,
  suspendUser,
  activateUser,
  getAuditLog,
  getMarketStats,
  getTrades,
  getAlerts,
  register,
  getKycDocuments,
  getListingDocuments,
  getAllBlockchainRecords,
} from "@/lib/store";

// ─── Role Mapping ───────────────────────────────────────────────────────────
const ROLE_MAP = {
  1: "investor",
  2: "broker",
  3: "issuer",
  4: "regulator",
  5: "admin",
};

// ─── User Normalization ────────────────────────────────────────────────────
function normalizeUser(dbUser) {
  const id = Number(dbUser.id);

  if (!Number.isInteger(id) || id < 1) {
    console.warn("Invalid user ID from database:", dbUser);
  }

  return {
    id,
    name: dbUser.full_name || "Unnamed User",
    email: dbUser.email || "",
    phone: dbUser.phone || "",
    role: ROLE_MAP[dbUser.role_id] || "unknown",
    roleId: Number(dbUser.role_id),
    isActive: dbUser.is_active === true || dbUser.is_active === "t" || dbUser.is_active === 1,
    status: (dbUser.is_active === true || dbUser.is_active === "t" || dbUser.is_active === 1) ? "active" : "suspended",
    createdAt: dbUser.created_at,
    kycStatus: dbUser.kyc_status || "none",
  };
}

const NAV_ITEMS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "users", label: "Manage Users", icon: Users },
  { id: "kyc", label: "KYC Review", icon: Shield },
  { id: "listings", label: "Listing Review", icon: FileText },
  { id: "blockchain", label: "Blockchain Records", icon: Link2 },
  { id: "audit", label: "Audit Log", icon: Settings },
  { id: "add-user", label: "Add User", icon: UserPlus },
];

export default function AdminDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [users, setUsers] = useState([]);
  const [securities, setSecurities] = useState([]);
  const [listings, setListings] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [stats, setStats] = useState(null);
  const [trades, setTrades] = useState([]);
  const [alerts, setAlerts] = useState([]);

  async function refreshData() {
    try {
      const [
        usersRaw,
        securitiesRaw,
        listingsRaw,
        auditRaw,
        statsRaw,
        tradesRaw,
        alertsRaw,
      ] = await Promise.all([
        getAllUsers(),
        getAllSecurities(),
        getPendingListings(),
        getAuditLog(),
        getMarketStats(),
        getTrades(),
        getAlerts(user.id),
      ]);

      const usersData   = Array.isArray(usersRaw)   ? usersRaw   : usersRaw?.rows   || [];
      const securitiesData = Array.isArray(securitiesRaw) ? securitiesRaw : securitiesRaw?.rows || [];
      const listingsData   = Array.isArray(listingsRaw)   ? listingsRaw   : listingsRaw?.rows   || [];
      const auditData      = Array.isArray(auditRaw)      ? auditRaw      : auditRaw?.rows      || [];
      const tradesData     = Array.isArray(tradesRaw)     ? tradesRaw     : tradesRaw?.rows     || [];
      const alertsData     = Array.isArray(alertsRaw)     ? alertsRaw     : alertsRaw?.rows     || [];

      setUsers(usersData.map(normalizeUser));
      setSecurities(securitiesData);
      setListings(listingsData);
      setAuditLog(auditData);
      setStats(statsRaw);
      setTrades(tradesData);
      setAlerts(alertsData);
    } catch (err) {
      console.error("Dashboard refresh failed:", err);
    }
  }

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 20000);
    return () => clearInterval(interval);
  }, [user.id]);

  function renderContent() {
    switch (activeTab) {
      case "overview":
        return <AdminOverview users={users} securities={securities} listings={listings} stats={stats} trades={trades} />;
      case "users":
        return <ManageUsers users={users} onRefresh={refreshData} />;
      case "kyc":
        return <KycReview users={users} onRefresh={refreshData} actorId={user?.id} />;
      case "listings":
        return <ListingReview listings={listings} onRefresh={refreshData} actorId={user?.id} />;
      case "blockchain":
        return <BlockchainRecordsView securities={securities} />;
      case "audit":
        return <AuditLogView auditLog={auditLog} users={users} />;
      case "add-user":
        return <AddUser onUserAdded={() => { refreshData(); setActiveTab("users"); }} />;
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
// ─── Admin Overview ────────────────────────────────────────────────────────
function AdminOverview({ users, securities, listings, stats, trades }) {
  const pendingKyc = users.filter((u) => u.kycStatus === "submitted").length;
  const pendingListings = listings.filter((l) => !l.approved).length;
  const activeUsers = users.filter((u) => u.isActive).length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Users" value={users.length} icon={Users} />
        <StatCard title="Active Users" value={activeUsers} icon={CheckCircle} />
        <StatCard title="Pending KYC" value={pendingKyc} icon={Shield} />
        <StatCard title="Pending Listings" value={pendingListings} icon={FileText} />
      </div>

      {/* Recent Trades */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-4 text-sm font-semibold text-foreground">Recent Trades</h3>
        
        {trades.length === 0 ? (
          <p className="text-sm text-muted-foreground">No trades yet</p>
        ) : (
          <div className="space-y-3">
            {trades
              .slice(-5)           // Get last 5 trades
              .reverse()           // Show newest first
              .map((t) => {
                // Find security by ID (support both securityId and security_id)
                const sec = securities.find((s) => 
                  s.id === Number(t.securityId) || 
                  s.id === Number(t.security_id)
                );

                // Safe date formatting
                let tradeDate = "Invalid date";
                try {
                  const timestamp = t.timestamp || t.created_at || t.trade_date;
                  if (timestamp) {
                    tradeDate = new Date(timestamp).toLocaleString("en-ZA", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    });
                  }
                } catch (e) {
                  console.warn("Invalid trade timestamp:", t.timestamp);
                }

                return (
                  <div 
                    key={t.id} 
                    className="flex items-center justify-between rounded-lg bg-secondary p-4 hover:bg-secondary/80 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {sec?.name || sec?.symbol || "Unknown Security"} 
                        <span className="text-muted-foreground ml-1">
                          ({sec?.symbol || "N/A"})
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t.quantity} units @ M{t.price != null ? Number(t.price).toFixed(2) : "—"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {tradeDate}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <Badge 
                        className={`${
                          t.status?.toLowerCase() === "completed" 
                            ? "bg-green-100 text-green-700" 
                            : "bg-primary/10 text-primary"
                        }`}
                      >
                        {t.status || "Completed"}
                      </Badge>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
// ─── Manage Users (fixed version – no setUsers here) ───────────────────────
function ManageUsers({ users, onRefresh }) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [selectedUser, setSelectedUser] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [actionLoading, setActionLoading] = useState({});

  const filtered = users.filter((u) => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) ||
                        u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  async function handleAction(userId, action) {
  const numericId = Number(userId);
  if (!Number.isInteger(numericId) || numericId < 1) {
    alert("Invalid user ID");
    return;
  }

  setActionLoading(prev => ({ ...prev, [numericId]: true }));

  try {
    let result;

    if (action === "delete") {
      result = await deleteUser(numericId);
    } else if (action === "suspend") {
      result = await suspendUser(numericId);
    } else if (action === "activate") {
      result = await activateUser(numericId);
    }

    if (result?.error) {
      throw new Error(result.error);
    }

    setConfirmAction(null);
    setSelectedUser(null);

    // Success feedback
    alert(result?.message || `${action.charAt(0).toUpperCase() + action.slice(1)} successful!`);

    // Refresh the list so deleted user disappears
    onRefresh();

  } catch (err) {
    console.error(`Failed to ${action} user #${numericId}:`, err);
    alert(`Failed to ${action} user: ${err.message || "Unknown server error"}`);
  } finally {
    setActionLoading(prev => ({ ...prev, [numericId]: false }));
  }
}

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-semibold text-foreground">User Management</h3>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              className="w-60 pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="all">All Roles</option>
            <option value="investor">Investor</option>
            <option value="broker">Broker</option>
            <option value="issuer">Issuer</option>
            <option value="regulator">Regulator</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary text-left">
                <th className="px-4 py-3 font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Email</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Role</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">KYC</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Registered</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const isLoading = !!actionLoading[u.id];
                return (
                  <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="px-4 py-3 font-medium text-foreground">{u.name}</td>
                    <td className="px-4 py-3 text-foreground">{u.email}</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="capitalize text-xs">{u.role}</Badge>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={u.status} /></td>
                    <td className="px-4 py-3"><StatusBadge status={u.kycStatus || "none"} /></td>
                    <td className="px-4 py-3 text-xs text-foreground">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {u.status === "active" ? (
                          <button
                            onClick={() => { setSelectedUser(u); setConfirmAction("suspend"); }}
                            disabled={isLoading}
                            className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                            title="Suspend user"
                          >
                            <Ban className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => { setSelectedUser(u); setConfirmAction("activate"); }}
                            disabled={isLoading}
                            className="rounded p-1 text-muted-foreground hover:bg-primary/10 hover:text-primary disabled:opacity-50"
                            title="Activate user"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => { setSelectedUser(u); setConfirmAction("delete"); }}
                          disabled={isLoading}
                          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                          title="Delete user"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No users found
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmAction && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-2xl">
            <h4 className="mb-3 text-lg font-semibold text-foreground">
              Confirm {confirmAction.charAt(0).toUpperCase() + confirmAction.slice(1)}
            </h4>
            <p className="mb-6 text-sm text-muted-foreground">
              Are you sure you want to <strong>{confirmAction}</strong> user{" "}
              <strong className="text-foreground">{selectedUser.name}</strong> ({selectedUser.email})?
              {confirmAction === "delete" && " This cannot be undone."}
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setConfirmAction(null); setSelectedUser(null); }}
              >
                Cancel
              </Button>
              <Button
                variant={confirmAction === "delete" || confirmAction === "suspend" ? "destructive" : "default"}
                className="flex-1"
                onClick={() => handleAction(selectedUser.id, confirmAction)}
              >
                {confirmAction === "delete" ? "Delete" : confirmAction === "suspend" ? "Suspend" : "Activate"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── KYC Review ────────────────────────────────────────────────────────────
function KycReview({ users = [], onRefresh, actorId }) {
  const [loadingId, setLoadingId] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [selectedUserDocs, setSelectedUserDocs] = useState(null);

  // Filter pending users
  const pendingUsers = users.filter(
    (u) => u.kycStatus === "submitted" || u.kycStatus === "pending"
  );

  // Filter recently reviewed users
  const recentlyReviewed = users.filter(
    (u) => u.kycStatus === "approved" || u.kycStatus === "rejected"
  );

  // ✅ Expected Documents by Role
  const getExpectedDocuments = (role) => {
    switch (role?.toLowerCase()) {
      case "investor":
        return ["id_proof", "proof_of_address"];
      case "broker":
        return ["id_proof", "proof_of_address", "license_proof"];
      case "issuer":
        return [
          "id_proof",
          "proof_of_address",
          "license_proof",
          "company_registration_proof",
          "audited_financials",
        ];
      default:
        return ["id_proof", "proof_of_address"];
    }
  };

async function openDocuments(user) {
  if (!user?.id) {
    alert("Invalid user ID");
    return;
  }

  try {
    console.log(`Fetching KYC documents for user ${user.id} (${user.role})`); // ← Debug

    const docsRaw = await getKycDocuments(user.id);
    
    console.log("Raw response from getKycDocuments:", docsRaw); // ← Very important for debugging

    // Handle all possible response formats from your backend
    let documents = [];
    if (Array.isArray(docsRaw)) {
      documents = docsRaw;
    } else if (docsRaw?.rows) {
      documents = docsRaw.rows;
    } else if (docsRaw?.data) {
      documents = Array.isArray(docsRaw.data) ? docsRaw.data : [];
    } else if (docsRaw && typeof docsRaw === 'object') {
      documents = Object.values(docsRaw).flat(); // fallback
    }

    console.log(`Final documents array length: ${documents.length}`);

    setSelectedUserDocs({
      user,
      documents,
      expected: getExpectedDocuments(user.role),
    });

    if (documents.length === 0) {
      alert(`No documents found for ${user.name} (${user.role}).\n\nCheck console for details.`);
    }
  } catch (err) {
    console.error("Failed to load KYC documents:", err);
    setSelectedUserDocs({
      user,
      documents: [],
      expected: getExpectedDocuments(user.role),
    });
    alert(`Error loading documents for ${user.name}:\n${err.message}`);
  }
}

  async function handleApprove(userId) {
    setLoadingId(userId);
    try {
      const res = await approveKYC(userId, actorId);
      if (res?.error) throw new Error(res.error);

      setFeedback({ type: "success", message: `✅ KYC Approved for user #${userId}` });
      setSelectedUserDocs(null);
      await onRefresh();
    } catch (err) {
      setFeedback({ type: "error", message: err.message || "Failed to approve KYC" });
    } finally {
      setLoadingId(null);
    }
  }

  async function handleReject(userId) {
    setLoadingId(userId);
    try {
      const res = await rejectKYC(userId, actorId);
      if (res?.error) throw new Error(res.error);

      setFeedback({ type: "success", message: `❌ KYC Rejected for user #${userId}` });
      setSelectedUserDocs(null);
      await onRefresh();
    } catch (err) {
      setFeedback({ type: "error", message: err.message || "Failed to reject KYC" });
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-foreground">KYC Verification Review</h3>

      {feedback && (
        <div className={`p-4 rounded-lg text-sm ${feedback.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
          {feedback.message}
        </div>
      )}

      {/* Pending Review */}
      <div>
        <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Clock className="h-4 w-4 text-primary" />
          Pending Review ({pendingUsers.length})
        </h4>

        {pendingUsers.length === 0 ? (
          <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground">
            No pending KYC submissions
          </div>
        ) : (
          <div className="space-y-4">
            {pendingUsers.map((u) => {
              const isLoading = loadingId === u.id;
              return (
                <div
                  key={u.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl border bg-card hover:bg-muted/50"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary">
                      {u.name?.charAt(0) || "?"}
                    </div>
                    <div>
                      <p className="font-semibold">{u.name}</p>
                      <p className="text-sm text-muted-foreground">{u.email}</p>
                      <p className="text-xs text-muted-foreground capitalize">Role: {u.role}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => openDocuments(u)}>
                      📄 View Documents
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-destructive text-destructive"
                      disabled={isLoading}
                      onClick={() => handleReject(u.id)}
                    >
                      Reject
                    </Button>
                    <Button size="sm" disabled={isLoading} onClick={() => handleApprove(u.id)}>
                      Approve KYC
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Documents Modal */}
      {selectedUserDocs && (
        <DocumentViewerModal
          data={selectedUserDocs}
          onClose={() => setSelectedUserDocs(null)}
          onApprove={() => handleApprove(selectedUserDocs.user.id)}
          onReject={() => handleReject(selectedUserDocs.user.id)}
        />
      )}

      {/* Recently Reviewed */}
      <div>
        <h4 className="mb-3 text-sm font-semibold text-foreground">
          Recently Reviewed ({recentlyReviewed.length})
        </h4>

        {recentlyReviewed.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
            No KYC reviews completed yet
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary text-left">
                    <th className="px-4 py-3 font-medium text-muted-foreground">Name</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Email</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Role</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">ID Number</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {recentlyReviewed.slice(0, 10).map((u) => (
                    <tr
                      key={u.id}
                      className="border-b border-border last:border-0 hover:bg-muted/50"
                    >
                      <td className="px-4 py-3 font-medium text-foreground truncate max-w-xs">
                        {u.name || "Unnamed"}
                      </td>
                      <td className="px-4 py-3 text-foreground truncate max-w-xs">
                        {u.email}
                      </td>
                      <td className="px-4 py-3 capitalize text-foreground">
                        {u.role || "unknown"}
                      </td>
                      <td className="px-4 py-3 font-mono text-foreground">
                        {u.id_number || "N/A"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={u.kycStatus} />
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {u.createdAt
                          ? new Date(u.createdAt).toLocaleDateString()
                          : "N/A"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
// ─── Listing Review ────────────────────────────────────────────────────────
function ListingReview({ listings, onRefresh, actorId }) {
  const [loadingId, setLoadingId] = useState(null);
  const [selectedListingDocs, setSelectedListingDocs] = useState(null);
  const [selectedListingForm, setSelectedListingForm] = useState(null);

  // Pending listings filter
  const pending = listings.filter((l) => 
    !l.approved || l.status?.toLowerCase() === 'pending'
  );

  // Approved/Tokenized listings
  const approved = listings.filter((l) => 
    l.approved || l.status?.toLowerCase() === 'approved'
  );

  async function openListingDocuments(listing) {
    if (!listing?.id) return;
    try {
      const docs = await getListingDocuments(listing.id);
      const documents = Array.isArray(docs) 
        ? docs 
        : (docs?.rows || docs?.data || []);
      setSelectedListingDocs({ listing, documents });
    } catch (err) {
      console.error("Failed to load documents:", err);
      setSelectedListingDocs({ listing, documents: [] });
    }
  }

  // Open the full listing form view for review
  function openListingForm(listing) {
    setSelectedListingForm(listing);
  }

  // Approve listing → DB update + on-chain mint (integrated in approveListing)
  async function handleApprove(listing) {
    if (!listing?.id) {
      alert("Error: Missing listing id.");
      return;
    }

    setLoadingId(listing.id);

    try {
      const result = await approveListing(Number(listing.id), actorId ?? null);

      if (result?.error) throw new Error(result.error);

      const onChainMsg = result.mintTxHash
        ? `\n\n🔗 Tx Hash:\n${result.mintTxHash}` +
          (result.blockNumber ? `\n📦 Block: #${result.blockNumber}` : "")
        : "\n\n⚠️  No wallet address on file — tokens not minted on-chain yet.";

      alert(
        `✅ Approved!\n\n` +
        `Security: ${listing.name} (${listing.symbol})\n` +
        `Tokens issued: ${Number(listing.total_supply || 0).toLocaleString()}` +
        onChainMsg
      );

      setSelectedListingDocs(null);
      await onRefresh?.();

    } catch (err) {
      console.error(`Approve failed for listing ${listing.id}:`, err);
      alert(`❌ Approval failed:\n${err.message}`);
    } finally {
      setLoadingId(null);
    }
  }

  async function handleReject(listingId) {
    if (!listingId) return;
    setLoadingId(listingId);

    try {
      await rejectListing(listingId);
      alert("Listing rejected successfully");
      setSelectedListingDocs(null);
      await onRefresh?.();
    } catch (err) {
      console.error("Reject error:", err);
      alert("Failed to reject listing");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-foreground">Security Listing Review</h3>

      {/* Pending Listings */}
      <div>
        <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Clock className="h-4 w-4 text-primary" />
          Pending Approval ({pending.length})
        </h4>

        {pending.length === 0 ? (
          <div className="text-center py-12 border rounded-xl bg-card text-muted-foreground">
            No pending listings to review
          </div>
        ) : (
          <div className="space-y-4">
            {pending.map((listing) => {
              const isLoading = loadingId === listing.id;

              return (
                <div
                  key={listing.id}
                  className="bg-card border border-border rounded-xl p-6 hover:border-primary/50 transition-all"
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-lg">{listing.name}</h4>
                          <Badge variant="outline" className="text-xs">{listing.symbol}</Badge>
                        </div>
                      </div>
                      
                      {/* Listing Details Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-sm">
                        <div className="bg-secondary/50 rounded-lg p-3">
                          <p className="text-xs text-muted-foreground">Issuer ID</p>
                          <p className="font-medium">{listing.issuer_id || 'N/A'}</p>
                        </div>
                        <div className="bg-secondary/50 rounded-lg p-3">
                          <p className="text-xs text-muted-foreground">Total Tokens</p>
                          <p className="font-medium">{Number(listing.total_tokens || listing.total_supply || 0).toLocaleString()}</p>
                        </div>
                        <div className="bg-secondary/50 rounded-lg p-3">
                          <p className="text-xs text-muted-foreground">Initial Price</p>
                          <p className="font-medium">M{Number(listing.initial_price || listing.price || 0).toFixed(2)}</p>
                        </div>
                        <div className="bg-secondary/50 rounded-lg p-3">
                          <p className="text-xs text-muted-foreground">Submitted</p>
                          <p className="font-medium">{listing.submitted_at ? new Date(listing.submitted_at).toLocaleDateString() : 'N/A'}</p>
                        </div>
                      </div>

                      {listing.description && (
                        <p className="text-sm text-muted-foreground mt-3 line-clamp-2">{listing.description}</p>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 min-w-[160px]">
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="w-full"
                        onClick={() => openListingForm(listing)}
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        Review Form
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-destructive border-destructive/50"
                        disabled={isLoading}
                        onClick={() => handleReject(listing.id)}
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        className="w-full"
                        disabled={isLoading}
                        onClick={() => handleApprove(listing)} 
                      >
                        {isLoading ? "Tokenizing..." : "Approve & Tokenize"}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Approved/Tokenized Listings */}
      {approved.length > 0 && (
        <div>
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            Approved & Tokenized ({approved.length})
          </h4>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary text-left">
                  <th className="px-4 py-3 font-medium text-muted-foreground">Security</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Symbol</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Tokens</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Price</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Tx Hash</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Approved</th>
                </tr>
              </thead>
              <tbody>
                {approved.slice(0, 10).map((listing) => (
                  <tr key={listing.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="px-4 py-3 font-medium">{listing.name}</td>
                    <td className="px-4 py-3"><Badge variant="secondary">{listing.symbol}</Badge></td>
                    <td className="px-4 py-3">{Number(listing.total_tokens || 0).toLocaleString()}</td>
                    <td className="px-4 py-3">M{Number(listing.initial_price || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {listing.tx_hash ? `${listing.tx_hash.slice(0, 10)}...` : 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {listing.approved_at ? new Date(listing.approved_at).toLocaleDateString() : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Document Viewer Modal */}
      {selectedListingDocs && (
        <DocumentViewerModal
          data={selectedListingDocs}
          onClose={() => setSelectedListingDocs(null)}
          onApprove={() => handleApprove(selectedListingDocs.listing)} 
          onReject={() => handleReject(selectedListingDocs.listing.id)}
        />
      )}

      {/* Listing Form Review Modal */}
      {selectedListingForm && (
        <ListingFormModal
          listing={selectedListingForm}
          onClose={() => setSelectedListingForm(null)}
          onApprove={() => {
            handleApprove(selectedListingForm);
            setSelectedListingForm(null);
          }}
          onReject={() => {
            handleReject(selectedListingForm.id);
            setSelectedListingForm(null);
          }}
          isLoading={loadingId === selectedListingForm.id}
        />
      )}
    </div>
  );
}

// ─── Listing Form Review Modal ─────────────────────────────────────────────
function ListingFormModal({ listing, onClose, onApprove, onReject, isLoading }) {
  if (!listing) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-3xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden shadow-2xl">
        
        {/* Header */}
        <div className="px-8 py-6 border-b border-border flex items-start justify-between bg-muted/30">
          <div>
            <h3 className="text-2xl font-semibold">Security Listing Application</h3>
            <p className="text-muted-foreground mt-1">
              Review the submitted listing form details
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>✕</Button>
        </div>

        <div className="flex-1 overflow-auto p-8 space-y-8">
          
          {/* Basic Information */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Basic Information
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground">Security Name</Label>
                <div className="p-3 bg-secondary/50 rounded-lg font-medium">{listing.name || 'N/A'}</div>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Trading Symbol</Label>
                <div className="p-3 bg-secondary/50 rounded-lg font-medium">{listing.symbol || 'N/A'}</div>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Security Type</Label>
                <div className="p-3 bg-secondary/50 rounded-lg font-medium">{listing.type || listing.security_type || 'Equity'}</div>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Sector/Industry</Label>
                <div className="p-3 bg-secondary/50 rounded-lg font-medium">{listing.sector || listing.industry || 'N/A'}</div>
              </div>
            </div>
          </div>

          {/* Token Details */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold flex items-center gap-2">
              <Link2 className="h-5 w-5 text-primary" />
              Token Details
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground">Total Token Supply</Label>
                <div className="p-3 bg-secondary/50 rounded-lg font-medium">
                  {Number(listing.total_tokens || listing.total_supply || 0).toLocaleString()} tokens
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Initial Price per Token</Label>
                <div className="p-3 bg-secondary/50 rounded-lg font-medium">
                  M{Number(listing.initial_price || listing.price || 0).toFixed(2)}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Total Valuation</Label>
                <div className="p-3 bg-secondary/50 rounded-lg font-medium">
                  M{(Number(listing.total_tokens || listing.total_supply || 0) * Number(listing.initial_price || listing.price || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </div>

          {/* Issuer Information */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Issuer Information
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground">Issuer ID</Label>
                <div className="p-3 bg-secondary/50 rounded-lg font-medium">{listing.issuer_id || 'N/A'}</div>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Issuer Name</Label>
                <div className="p-3 bg-secondary/50 rounded-lg font-medium">{listing.issuer_name || listing.company_name || 'N/A'}</div>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Registration Number</Label>
                <div className="p-3 bg-secondary/50 rounded-lg font-medium">{listing.registration_number || listing.company_reg || 'N/A'}</div>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Contact Email</Label>
                <div className="p-3 bg-secondary/50 rounded-lg font-medium">{listing.contact_email || listing.email || 'N/A'}</div>
              </div>
            </div>
          </div>

          {/* Description */}
          {listing.description && (
            <div className="space-y-4">
              <h4 className="text-lg font-semibold">Description</h4>
              <div className="p-4 bg-secondary/50 rounded-lg text-sm leading-relaxed">
                {listing.description}
              </div>
            </div>
          )}

          {/* Submission Info */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Submission Details
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground">Listing ID</Label>
                <div className="p-3 bg-secondary/50 rounded-lg font-mono">{listing.id}</div>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Submitted At</Label>
                <div className="p-3 bg-secondary/50 rounded-lg font-medium">
                  {listing.submitted_at || listing.created_at
                    ? new Date(listing.submitted_at || listing.created_at).toLocaleString()
                    : 'N/A'}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Current Status</Label>
                <div className="p-3 bg-secondary/50 rounded-lg">
                  <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                    {listing.approved ? 'Approved' : (listing.status || 'Pending Review')}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t p-6 flex flex-wrap gap-4 bg-muted/30">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <div className="flex-1" />
          <Button variant="destructive" onClick={onReject} disabled={isLoading}>
            <XCircle className="mr-2 h-4 w-4" />
            Reject Listing
          </Button>
          <Button onClick={onApprove} disabled={isLoading}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            {isLoading ? "Tokenizing..." : "Approve & Tokenize"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Audit Log ─────────────────────────────────────────────────────────────
function AuditLogView({ auditLog, users }) {
  const [search, setSearch] = useState("");

  const filtered = auditLog
    .slice()
    .reverse()
    .filter(
      (a) =>
        a.action?.toLowerCase().includes(search.toLowerCase()) ||
        a.details?.toLowerCase().includes(search.toLowerCase())
    );

  // Helper for safe timestamp display
  const formatTimestamp = (ts) => {
    if (!ts) return "—";
    try {
      // Backend format: "YYYY-MM-DD HH24:MI:SS" → make it parsable
      const dateStr = ts.replace(" ", "T") + "+02:00"; // SAST offset
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return ts;
      return date.toLocaleString("en-ZA", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        timeZone: "Africa/Johannesburg",
      });
    } catch {
      return ts || "—";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-semibold text-foreground">
          System Audit Log
        </h3>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search audit log..."
            className="w-60 pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary text-left">
                <th className="px-4 py-3 font-medium text-muted-foreground">Timestamp</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Action</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Actor</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 50).map((entry) => {
                // FIX: use entry.actor_id instead of entry.actor
                const actor = users.find((u) => u.id === Number(entry.actor_id));
                
                return (
                  <tr
                    key={entry.id}
                    className="border-b border-border last:border-0 hover:bg-muted/50"
                  >
                    <td className="px-4 py-3 text-xs text-foreground font-mono">
                      {formatTimestamp(entry.timestamp)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="font-mono text-xs">
                        {entry.action || "—"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {actor?.name || entry.actor_id || "System / Unknown"}
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {entry.details || "No details recorded"}
                    </td>
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
    </div>
  );
}
// ─── Add User ──────────────────────────────────────────────────────────────
function AddUser({ onUserAdded }) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "investor",
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  function update(field, value) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const res = await register(formData);
      if (res.error) {
        setResult({ success: false, message: res.error });
      } else {
        setResult({
          success: true,
          message: `User ${formData.name} (${formData.role}) created successfully`,
        });
        setFormData({ name: "", email: "", password: "", role: "investor" });
        setTimeout(() => onUserAdded(), 1500);
      }
    } catch (err) {
      setResult({ success: false, message: "Failed to create user" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="mb-2 text-lg font-semibold text-foreground">
          Add New User
        </h3>
        <p className="mb-6 text-sm text-muted-foreground">
          Create a new user account and assign a role
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="text-foreground">Full Name</Label>
            <Input
              placeholder="Enter full name"
              value={formData.name}
              onChange={(e) => update("name", e.target.value)}
              required
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-foreground">Email</Label>
            <Input
              type="email"
              placeholder="user@example.co.ls"
              value={formData.email}
              onChange={(e) => update("email", e.target.value)}
              required
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-foreground">Password</Label>
            <Input
              type="password"
              placeholder="Min 6 characters"
              value={formData.password}
              onChange={(e) => update("password", e.target.value)}
              required
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-foreground">Role</Label>
            <select
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
              value={formData.role}
              onChange={(e) => update("role", e.target.value)}
            >
              <option value="investor">Investor</option>
              <option value="broker">Broker</option>
              <option value="issuer">Issuer</option>
              <option value="regulator">Regulator</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating..." : "Create User"}
          </Button>
        </form>

        {result && (
          <div
            className={`mt-4 flex items-start gap-2 rounded-lg p-3 text-sm ${
              result.success ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
            }`}
          >
            {result.success ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            )}
            <p>{result.message}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Shared Components ─────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const styles = {
    active: "bg-primary/10 text-primary",
    approved: "bg-primary/10 text-primary",
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

function StatCard({ title, value, icon: Icon }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </div>
      <p className="text-xl font-bold text-foreground">{value}</p>
    </div>
  );
}

// new 
// ─── Improved Document Viewer Modal - Handles C:\Users\PC\Documents ─────
/// ─── Improved Document Viewer Modal – Form-like Style ─────────────────────
function DocumentViewerModal({ 
  data, 
  onClose, 
  onApprove, 
  onReject 
}) {
  const { user, listing, documents: rawDocs = [], expected = [] } = data || {};

  const documents = Array.isArray(rawDocs) 
    ? rawDocs 
    : (rawDocs?.rows || rawDocs?.data || []);

  const isListingMode = !!listing;

  const getDisplayUrl = (doc) => {
    let url = doc?.document_url || doc?.url || doc?.file_path || doc?.path || "";
    if (!url) return null;

    // Normalize path separators
    url = url.replace(/\\/g, '/');

    // Handle Windows local paths (C:/Users/... or any drive letter)
    const windowsPathMatch = url.match(/^[A-Za-z]:\//);
    if (windowsPathMatch || url.includes('/Users/') || url.includes('/Documents/')) {
      const filename = url.split(/[\\/]/).pop();
      if (filename) {
        return `/api/documents/${encodeURIComponent(filename)}`;
      }
    }

    // Handle relative paths that might be local files
    if (!url.startsWith('http') && !url.startsWith('/') && !url.startsWith('blob:')) {
      const filename = url.split(/[\\/]/).pop();
      if (filename) {
        return `/api/documents/${encodeURIComponent(filename)}`;
      }
    }

    return url.startsWith('http') || url.startsWith('/') || url.startsWith('blob:') ? url : null;
  };

  // Check if URL is an image (including placehold.co URLs)
  const isImageFile = (url) => {
    if (!url) return false;
    // Direct image extensions
    if (/\.(jpg|jpeg|png|gif|webp)$/i.test(url)) return true;
    // Placehold.co URLs with png/jpg format
    if (url.includes('placehold.co') && /\/(png|jpg|jpeg|gif|webp)/i.test(url)) return true;
    return false;
  };
  const isPdfFile = (url) => url && /\.pdf$/i.test(url);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-3xl w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden shadow-2xl">
        
        {/* Header */}
        <div className="px-8 py-6 border-b border-border flex items-start justify-between bg-muted/30">
          <div>
            <h3 className="text-2xl font-semibold">
              {isListingMode ? "Listing Documents Review" : "KYC Documents Review"}
            </h3>
            <p className="text-muted-foreground mt-1">
              {isListingMode && listing 
                ? `${listing.name} (${listing.symbol})` 
                : user 
                ? `${user.name} • ${user.role?.toUpperCase() || ''} • User ID: ${user.id}`
                : ""}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>✕</Button>
        </div>

        <div className="flex-1 overflow-auto p-8 space-y-10">
          
          {/* Listing Info */}
          {isListingMode && listing && (
            <div className="p-6 bg-muted/50 rounded-2xl border">
              <h4 className="font-semibold mb-4">Listing Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 text-sm">
                <div><strong>Name:</strong> {listing.name}</div>
                <div><strong>Symbol:</strong> {listing.symbol}</div>
                <div><strong>Type:</strong> {listing.type || "Equity"}</div>
                <div><strong>Sector:</strong> {listing.sector || "N/A"}</div>
                <div><strong>Total Supply:</strong> {(listing.total_supply || 0).toLocaleString()} tokens</div>
                <div><strong>Price:</strong> M{(Number(listing.price) || 0).toFixed(2)}</div>
              </div>
              {listing.description && (
                <div className="mt-5 pt-5 border-t">
                  <strong>Description:</strong>
                  <p className="mt-2 text-muted-foreground">{listing.description}</p>
                </div>
              )}
            </div>
          )}

          {/* Documents – One by One (Form Style) */}
          <div className="space-y-8">
            {documents.length === 0 ? (
              <div className="text-center py-16 border border-dashed rounded-2xl">
                <FileText className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-lg text-muted-foreground">No documents found</p>
              </div>
            ) : (
              documents.map((doc, index) => {
                const url = getDisplayUrl(doc);
                const docType = (doc.document_type || "Document").replace(/_/g, " ");
                const isImage = url && isImageFile(url);
                const isPdf = url && isPdfFile(url);

                return (
                  <div key={doc.id || index} className="border border-border rounded-2xl overflow-hidden bg-card">
                    
                    {/* Document Header (like form label) */}
                    <div className="px-6 py-4 bg-muted/60 border-b">
                      <div className="flex items-center justify-between">
                        <Label className="text-base font-medium capitalize">
                          {docType}
                        </Label>
                        {doc.uploaded_at && (
                          <span className="text-xs text-muted-foreground">
                            Uploaded: {new Date(doc.uploaded_at).toLocaleDateString('en-ZA')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Preview Area */}
                    <div className="p-6 bg-zinc-950 min-h-[380px] flex flex-col items-center justify-center">
                      {url ? (
                        isImage ? (
                          <div className="relative w-full max-h-[520px] flex items-center justify-center overflow-hidden rounded-lg border border-zinc-800">
                            <img 
                              src={url} 
                              alt={docType}
                              className="max-h-full max-w-full object-contain"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.parentElement.innerHTML = `
                                  <div class="text-red-400 text-center p-8">
                                    <p>Failed to load image preview</p>
                                  </div>`;
                              }}
                            />
                          </div>
                        ) : isPdf ? (
                          <div className="text-center">
                            <FileText className="h-20 w-20 mx-auto mb-6 text-white/70" />
                            <a 
                              href={url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-3 px-8 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all"
                            >
                              📄 Open PDF Document
                            </a>
                            <p className="text-xs text-white/50 mt-4">PDF files cannot be previewed directly</p>
                          </div>
                        ) : (
                          <div className="text-center">
                            <FileText className="h-20 w-20 mx-auto mb-6 text-white/70" />
                            <a 
                              href={url} 
                              target="_blank" 
                              className="text-blue-400 hover:underline"
                            >
                              Open Document
                            </a>
                          </div>
                        )
                      ) : (
                        <div className="text-center text-white/50 space-y-2">
                          <FileText className="h-16 w-16 mx-auto mb-4 text-amber-400/60" />
                          <p className="text-amber-300/80 font-medium">File not stored in cloud storage</p>
                          {doc.document_number && (
                            <p className="text-xs text-white/40">Filename: {doc.document_number}</p>
                          )}
                          <p className="text-xs text-white/30 max-w-xs mx-auto">
                            Document was submitted but could not be uploaded. Configure{" "}
                            <code className="text-white/50">SUPABASE_SERVICE_ROLE_KEY</code>{" "}
                            in .env.local to enable file storage.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t p-6 flex gap-4 bg-muted/30">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Close
          </Button>
          
          {onReject && (
            <Button variant="destructive" className="flex-1" onClick={onReject}>
              <XCircle className="mr-2 h-4 w-4" />
              {isListingMode ? "Reject Listing" : "Reject KYC"}
            </Button>
          )}

          {onApprove && (
            <Button className="flex-1" onClick={onApprove}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              {isListingMode ? "Approve & Tokenize" : "Approve KYC"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Blockchain Records View ──────────────────────────────────────────────────
function BlockchainRecordsView({ securities }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedHash, setCopiedHash] = useState(null);

  useEffect(() => {
    fetchRecords();
  }, []);

  async function fetchRecords() {
    try {
      const res = await fetch("/api/blockchain-records");
      const data = await res.json();
      if (data.success) {
        setRecords(data.records || []);
      }
    } catch (err) {
      console.error("Failed to fetch blockchain records:", err);
    } finally {
      setLoading(false);
    }
  }

  function copyToClipboard(text, id) {
    navigator.clipboard.writeText(text);
    setCopiedHash(id);
    setTimeout(() => setCopiedHash(null), 2000);
  }

  function truncateHash(hash) {
    if (!hash || hash.length < 20) return hash;
    return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
  }

  function formatDate(dateStr) {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleString("en-ZA", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Link2 className="h-5 w-5 text-primary" />
          Blockchain Records
        </h3>
        <Badge variant="outline" className="text-xs">
          {records.length} On-Chain Records
        </Badge>
      </div>

      {records.length === 0 ? (
        <div className="text-center py-12 border rounded-xl bg-card">
          <Link2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">No securities have been tokenized yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Approve listings to mint them on the blockchain
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {records.map((record) => {
            const security = securities.find(s => s.id === record.security_id);
            
            return (
              <div
                key={record.id}
                className="bg-card border border-border rounded-xl p-6 hover:border-primary/50 transition-all"
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  {/* Left: Security Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Link2 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-foreground">
                          {security?.name || `Security #${record.security_id}`}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          Security #{record.security_id} · Order #{record.order_id}
                        </p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Block Number:</span>
                        <span className="ml-2 font-mono text-foreground">{record.block_number?.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Qty / Price:</span>
                        <span className="ml-2 font-mono text-foreground">
                          {record.quantity != null ? Number(record.quantity).toLocaleString() : "—"}
                          {record.price != null ? ` @ M${Number(record.price).toFixed(2)}` : ""}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Status:</span>
                        <Badge className={`ml-2 ${
                          record.status === "confirmed"
                            ? "bg-green-500/10 text-green-600 border-green-500/20"
                            : record.status === "submitted"
                            ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                            : "bg-red-500/10 text-red-600 border-red-500/20"
                        }`}>
                          {record.status || "unknown"}
                        </Badge>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Created:</span>
                        <span className="ml-2 text-foreground">{formatDate(record.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Blockchain Hashes */}
                  <div className="lg:w-96 space-y-3">
                    {/* Transaction Hash */}
                    <div className="bg-secondary/50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">Transaction Hash</span>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => copyToClipboard(record.tx_hash, `tx-${record.id}`)}
                          >
                            {copiedHash === `tx-${record.id}` ? (
                              <CheckCircle className="h-3 w-3 text-green-500" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                          <a
                            href={`https://etherscan.io/tx/${record.tx_hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:text-primary/80"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>
                      <p className="font-mono text-xs text-foreground break-all">
                        {truncateHash(record.tx_hash)}
                      </p>
                    </div>

                    {/* Contract Address */}
                    {record.contract_address && (
                      <div className="bg-secondary/50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">Registry Contract</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => copyToClipboard(record.contract_address, `ca-${record.id}`)}
                          >
                            {copiedHash === `ca-${record.id}` ? (
                              <CheckCircle className="h-3 w-3 text-green-500" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                        <p className="font-mono text-xs text-foreground break-all">
                          {truncateHash(record.contract_address)}
                        </p>
                      </div>
                    )}

                    {/* Issuer Wallet */}
                    {record.issuer_wallet && (
                      <div className="bg-secondary/50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">Issuer Wallet</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => copyToClipboard(record.issuer_wallet, `iw-${record.id}`)}
                          >
                            {copiedHash === `iw-${record.id}` ? (
                              <CheckCircle className="h-3 w-3 text-green-500" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                        <p className="font-mono text-xs text-foreground break-all">
                          {truncateHash(record.issuer_wallet)}
                        </p>
                      </div>
                    )}

                    {/* Error message for failed/submitted records */}
                    {record.error_message && record.status !== "confirmed" && (
                      <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground mb-1">Note</p>
                        <p className="font-mono text-xs text-red-400 break-all">
                          {record.error_message}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

