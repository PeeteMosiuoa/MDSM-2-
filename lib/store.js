"use server";

// ==================================================================
// Maseru Digital Securities Market — In-Memory + localStorage Store
// ==================================================================
import { query, getRows, getRow, pool } from "@/lib/db";
import { withTransaction } from '@/lib/db';
import { pool as db } from "@/lib/db";
import {
  register  as authRegister,
  hashPassword,
  comparePassword,
} from "@/lib/auth";
const STORAGE_KEY = "mdsm_data";

function getDefaultData() {
  return {
    
    securities: [
      {
        id: "sec-1",
        name: "Lesotho Telecom Shares",
        symbol: "LTS",
        type: "equity",
        price: 26.75,
        change: 1.25,
        changePercent: 4.9,
        volume: 15420,
        marketCap: 267500000,
        issuerId: "issuer-1",
        status: "listed",
        totalTokens: 10000000,
        availableTokens: 9500000,
        description: "Lesotho Telecom is the leading telecommunications provider in Lesotho.",
        listedAt: "2025-03-01T00:00:00Z",
        priceHistory: [22.0, 23.5, 24.0, 25.5, 24.8, 26.0, 26.75],
      },
      {
        id: "sec-2",
        name: "Maseru City Bonds",
        symbol: "MCB",
        type: "bond",
        price: 125.0,
        change: -0.5,
        changePercent: -0.4,
        volume: 3200,
        marketCap: 125000000,
        issuerId: "issuer-1",
        status: "listed",
        totalTokens: 1000000,
        availableTokens: 800000,
        description: "Municipal bonds issued by the City of Maseru for infrastructure development.",
        listedAt: "2025-04-01T00:00:00Z",
        priceHistory: [120.0, 122.0, 124.5, 126.0, 125.5, 125.0, 125.0],
      },
      {
        id: "sec-3",
        name: "Maluti Mountain Fund",
        symbol: "MMF",
        type: "fund",
        price: 52.3,
        change: 2.1,
        changePercent: 4.2,
        volume: 8750,
        marketCap: 52300000,
        issuerId: "issuer-1",
        status: "listed",
        totalTokens: 5000000,
        availableTokens: 4200000,
        description: "A diversified fund investing across Lesotho's growing sectors.",
        listedAt: "2025-05-15T00:00:00Z",
        priceHistory: [48.0, 49.5, 50.2, 51.0, 50.8, 51.5, 52.3],
      },
      {
        id: "sec-4",
        name: "Katse Dam Energy",
        symbol: "KDE",
        type: "shares",
        price: 78.9,
        change: 3.4,
        changePercent: 4.5,
        volume: 12300,
        marketCap: 789000000,
        issuerId: "issuer-1",
        status: "listed",
        totalTokens: 10000000,
        availableTokens: 8000000,
        description: "Hydroelectric energy company operating from the Katse Dam.",
        listedAt: "2025-06-01T00:00:00Z",
        priceHistory: [70.0, 72.5, 74.0, 75.5, 76.8, 77.5, 78.9],
      },
      {
        id: "sec-5",
        name: "Basotho Textile Corp",
        symbol: "BTC",
        type: "shares",
        price: 15.2,
        change: -0.3,
        changePercent: -1.9,
        volume: 6500,
        marketCap: 15200000,
        issuerId: "issuer-1",
        status: "listed",
        totalTokens: 2000000,
        availableTokens: 1500000,
        description: "A leading textile manufacturer and exporter based in Maseru.",
        listedAt: "2025-06-15T00:00:00Z",
        priceHistory: [14.0, 14.5, 15.0, 15.5, 15.8, 15.5, 15.2],
      },
    ],
    orders: [
      {
        id: "ord-1",
        investorId: "inv-1",
        securityId: "sec-1",
        type: "buy",
        quantity: 100,
        price: 25.5,
        total: 2550,
        status: "filled",
        createdAt: "2025-03-15T10:00:00Z",
        filledAt: "2025-03-15T10:00:05Z",
      },
      {
        id: "ord-2",
        investorId: "inv-1",
        securityId: "sec-2",
        type: "buy",
        quantity: 50,
        price: 120.0,
        total: 6000,
        status: "filled",
        createdAt: "2025-04-10T14:30:00Z",
        filledAt: "2025-04-10T14:30:03Z",
      },
      {
        id: "ord-3",
        investorId: "inv-2",
        securityId: "sec-1",
        type: "buy",
        quantity: 200,
        price: 24.8,
        total: 4960,
        status: "filled",
        createdAt: "2025-03-20T09:15:00Z",
        filledAt: "2025-03-20T09:15:02Z",
      },
    ],
    trades: [
      {
        id: "trd-1",
        orderId: "ord-1",
        buyerId: "inv-1",
        securityId: "sec-1",
        quantity: 100,
        price: 25.5,
        total: 2550,
        timestamp: "2025-03-15T10:00:05Z",
        status: "settled",
      },
      {
        id: "trd-2",
        orderId: "ord-2",
        buyerId: "inv-1",
        securityId: "sec-2",
        quantity: 50,
        price: 120.0,
        total: 6000,
        timestamp: "2025-04-10T14:30:03Z",
        status: "settled",
      },
      {
        id: "trd-3",
        orderId: "ord-3",
        buyerId: "inv-2",
        securityId: "sec-1",
        quantity: 200,
        price: 24.8,
        total: 4960,
        timestamp: "2025-03-20T09:15:02Z",
        status: "settled",
      },
    ],
    listings: [],
    auditLog: [
      { id: "aud-1", action: "SYSTEM_INIT", actor: "system", timestamp: "2025-01-01T00:00:00Z", details: "Maseru Digital Securities Market initialized" },
      { id: "aud-2", action: "USER_REGISTER", actor: "inv-1", timestamp: "2025-02-15T00:00:00Z", details: "Investor Thabo Mokhesi registered" },
      { id: "aud-3", action: "TRADE_EXECUTED", actor: "inv-1", timestamp: "2025-03-15T10:00:05Z", details: "Buy 100 LTS @ M25.50" },
      { id: "aud-4", action: "TRADE_EXECUTED", actor: "inv-2", timestamp: "2025-03-20T09:15:02Z", details: "Buy 200 LTS @ M24.80" },
      { id: "aud-5", action: "TRADE_EXECUTED", actor: "inv-1", timestamp: "2025-04-10T14:30:03Z", details: "Buy 50 MCB @ M120.00" },
    ],
    alerts: [],
  };
}

// --- Persistence helpers ---
function loadData() {
  if (typeof window === "undefined") return getDefaultData();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  const d = getDefaultData();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
  return d;
}

function saveData(data) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

let _data = null;

function getData() {
  if (!_data) _data = loadData();
  return _data;
}

function persist() {
  saveData(getData());
}

function addAudit(action, actorId, details) {
  const data = getData();
  data.auditLog.push({
    id: "aud-" + Date.now(),
    action,
    actor: actorId,
    timestamp: new Date().toISOString(),
    details,
  });
  persist();
}

// ============= EXPORTED API =============

export async function resetStore() {
  _data = getDefaultData();
  persist();
}

// --- Auth ---
export async function login(email, password) {
  try {
    const res = await query(
      `SELECT u.id, u.email, u.full_name AS name, u.kyc_status,
              u.is_active, u.password_hash,
              r.role_name AS role
         FROM users u
         LEFT JOIN roles r ON r.id = u.role_id
        WHERE u.email = $1
        LIMIT 1`,
      [email]
    );
    if (!res.rows.length) return null;
    const u = res.rows[0];
    if (!u.is_active) return null;
    const ok = await comparePassword(password, u.password_hash);
    if (!ok) return null;
    const { password_hash: _, ...safeUser } = u;
    return safeUser;
  } catch {
    return null;
  }
}

// Delegates to the canonical auth.js register so password hashing and
// schema details stay in one place.
export async function register(userData) {
  return authRegister(userData);
}


export async function submitKYC(userId, kycData) {
  try {
    const userRes = await query(
      `SELECT id, full_name AS name FROM users WHERE id = $1`,
      [userId]
    );

    if (userRes.rows.length === 0) {
      return { error: "User not found" };
    }

    const { documentType, documentNumber, documentUrl } = kycData;

    const kycRes = await query(
      `INSERT INTO kyc_documents
        (user_id, document_type, document_number, document_url, status, created_at)
       VALUES ($1,$2,$3,$4,$5,NOW())
       RETURNING *`,
      [userId, documentType, documentNumber, documentUrl, 'submitted']
    );

    await query(
      `UPDATE users SET kyc_status = 'submitted' WHERE id = $1`,
      [userId]
    );

    return kycRes.rows[0];
  } catch (error) {
    console.error("submitKYC error:", error);
    return { error: "KYC submission failed" };
  }
}

// 4. KYC approvals - now real DB
/**
 * Approve KYC - updates users, kyc_records AND all related kyc_documents
 * @param {string|number} userId 
 */
export async function approveKYC(userId, actorId = 5) {
  const numericUserId = Number(userId);
  const numericActorId = Number(actorId);

  if (isNaN(numericUserId) || numericUserId <= 0) {
    return { error: `Invalid user ID: ${userId}` };
  }
  if (isNaN(numericActorId) || numericActorId <= 0) {
    return { error: `Invalid actor/admin ID: ${actorId}` };
  }

  try {
    console.log(`[approveKYC] Starting for user ${numericUserId}`);

    await query("BEGIN");

    const userCheck = await query("SELECT id FROM users WHERE id = $1", [numericUserId]);
    if (userCheck.rowCount === 0) {
      await query("ROLLBACK");
      return { error: `User ${numericUserId} not found` };
    }

    await query(
      `UPDATE users 
       SET kyc_status = 'approved', 
           is_active = true 
       WHERE id = $1`,
      [numericUserId]
    );

    const kycUpdate = await query(
      `UPDATE kyc_records
       SET status = 'approved',
           verified = true,
           verified_by = $2
       WHERE user_id = $1
         AND status = 'pending'
       RETURNING id`,
      [numericUserId, numericActorId]
    );

    console.log(`[approveKYC] kyc_records updated: ${kycUpdate.rowCount} rows`);

    const docsUpdate = await query(
      `UPDATE kyc_documents
       SET status = 'approved',
           reviewed_by = $2
       WHERE user_id = $1
         AND status = 'pending'`,
      [numericUserId, numericActorId]
    );

    console.log(`[approveKYC] kyc_documents updated: ${docsUpdate.rowCount} rows`);

    await query(
      `INSERT INTO audit_logs (action, performed_by, target_table, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [
        "KYC_APPROVED",
        numericActorId,   // ← better than hardcoded 5
        `KYC approved for user ${numericUserId}- verified_by admin`
      ]
    );

    await query("COMMIT");

    return { success: true };
  } catch (err) {
    await query("ROLLBACK").catch(() => {});
    console.error(`[approveKYC] Failed for user ${numericUserId}:`, err.message);
    return { error: err.message || "Failed to approve KYC" };
  }
}
/**
 * Reject KYC - same logic, reversed values
 */
export async function rejectKYC(userId, actorId) {
  const numericId = Number(userId);
  const numericActorId = Number(actorId);
  if (isNaN(numericId) || numericId <= 0) {
    return { error: `Invalid user ID: ${userId}` };
  }

  try {
    console.log(`[rejectKYC] Starting for user ${numericId}`);

    await query("BEGIN");

    const userCheck = await query("SELECT id FROM users WHERE id = $1", [numericId]);
    if (userCheck.rowCount === 0) {
      await query("ROLLBACK");
      return { error: `User ${numericId} not found` };
    }

    await query(
      `UPDATE users 
       SET kyc_status = 'rejected' 
       WHERE id = $1`,
      [numericId]
    );

    const kycUpdate = await query(
      `UPDATE kyc_records
       SET status = 'rejected',
           verified = false,
           verified_by = $2
       WHERE user_id = $1
         AND status = 'pending'
       RETURNING id`,
      [numericId, numericActorId]
    );

    console.log(`[rejectKYC] kyc_records updated: ${kycUpdate.rowCount} rows`);

    const docsUpdate = await query(
      `UPDATE kyc_documents
       SET status = 'rejected',
           reviewed_by = $2
       WHERE user_id = $1
         AND status = 'pending'`,
      [numericId, numericActorId]
    );

    console.log(`[rejectKYC] kyc_documents updated: ${docsUpdate.rowCount} rows`);

    await query(
      `INSERT INTO audit_logs (action, performed_by, target_table, created_at)
       VALUES ($1, $2, $3, NOW())`,
      ["KYC_REJECTED", numericActorId, `KYC rejected for user ${numericId} - verified_by admin`]
    );

    await query("COMMIT");

    return { success: true };
  } catch (err) {
    await query("ROLLBACK").catch(() => {});
    console.error(`[rejectKYC] Failed for user ${numericId}:`, err.message);
    return { error: err.message || "Failed to reject KYC" };
  }
}

// --- Users ---


export async function getAllUsers() {
  try {
    const sql = `
      SELECT id, full_name, email, role_id, is_active, created_at, kyc_status, phone
      FROM users
      WHERE deleted_at IS NULL          -- ← Add this line
      ORDER BY created_at DESC
    `;
    const result = await query(sql);
    return result.rows || [];
  } catch (err) {
    console.error('[getAllUsers error]', err);
    return [];
  }
}
export async function getUserById(id) {
  try {
    const result = await query(
      `SELECT id, full_name AS name, email, role_id, is_active, created_at, kyc_status, phone
       FROM users WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  } catch (err) {
    console.error("getUserById error:", err);
    return null;
  }
}// ──────────────────────────────────────────────────────────────
// Helper to create consistent response shape
// ──────────────────────────────────────────────────────────────
function successResponse(data = {}) {
  return { success: true, ...data };
}

function errorResponse(message, code = 400) {
  return { success: false, error: message, code };
}

// ──────────────────────────────────────────────────────────────
export async function suspendUser(id, actorId = null) {
  try {
    if (!id || isNaN(Number(id))) {
      return errorResponse("Invalid user ID");
    }

    const numericId = Number(id);

    const result = await query(
      `UPDATE users 
         SET is_active = false, 
             updated_at = NOW() 
       WHERE id = $1 
   RETURNING id, full_name, email`,
      [numericId]
    );

    if (result.rowCount === 0) {
      return errorResponse("User not found or already suspended", 404);
    }

    const user = result.rows[0];

    // Audit log
    try {
      await query(
        `INSERT INTO audit_logs (action, performed_by, target_table, created_at)
         VALUES ($1, $2, $3, NOW())`,
        [
          "USER_SUSPENDED",
          actorId || "system",           // ← pass real actor_id when possible
          `User ${numericId} (${user.full_name || user.email || "unknown"}) suspended`
        ]
      );
    } catch (auditErr) {
      console.warn("[suspendUser] Audit log insert failed:", auditErr.message);
      // still continue - audit failure shouldn't block user action
    }

    return successResponse({ userId: numericId, message: "User suspended" });
  } catch (err) {
    console.error("[suspendUser] Failed:", err.message, err.stack);
    return errorResponse(`Failed to suspend user: ${err.message}`);
  }
}

// ──────────────────────────────────────────────────────────────
export async function activateUser(id, actorId = null) {
  try {
    if (!id || isNaN(Number(id))) {
      return errorResponse("Invalid user ID");
    }

    const numericId = Number(id);

    const result = await query(
      `UPDATE users 
         SET is_active = true, 
             updated_at = NOW() 
       WHERE id = $1 
   RETURNING id, full_name, email`,
      [numericId]
    );

    if (result.rowCount === 0) {
      return errorResponse("User not found or already active", 404);
    }

    const user = result.rows[0];

    try {
      await query(
        `INSERT INTO audit_logs (action, performed_by, target_table, created_at)
         VALUES ($1, $2, $3, NOW())`,
        [
          "USER_ACTIVATED",
          actorId || "system",
          `User ${numericId} (${user.full_name || user.email || "unknown"}) activated`
        ]
      );
    } catch (auditErr) {
      console.warn("[activateUser] Audit log failed:", auditErr.message);
    }

    return successResponse({ userId: numericId, message: "User activated" });
  } catch (err) {
    console.error("[activateUser] Failed:", err.message, err.stack);
    return errorResponse(`Failed to activate user: ${err.message}`);
  }
}

// ──────────────────────────────────────────────────────────────
// Fixed deleteUser - Better error handling + clearer flow
export async function deleteUser(id, actorId = 67) {
  try {
    const numericId = Number(id);
    if (!numericId || numericId < 1) {
      return { error: "Invalid user ID" };
    }

    // First, check if user exists (regardless of deleted status)
    const checkRes = await query(
      `SELECT id, full_name, email, deleted_at 
       FROM users 
       WHERE id = $1`,
      [numericId]
    );

    if (checkRes.rows.length === 0) {
      return { error: "User not found" };
    }

    const user = checkRes.rows[0];

    // If already deleted, return friendly message
    if (user.deleted_at) {
      return { error: "User has already been deleted" };
    }

    // Perform soft delete
    const result = await query(
      `UPDATE users 
       SET deleted_at = NOW(), 
           updated_at = NOW(),
           is_active = false 
       WHERE id = $1 
       RETURNING id, full_name, email`,
      [numericId]
    );

    if (result.rowCount === 0) {
      return { error: "Failed to delete user" };
    }

    // Audit log
    try {
      await query(
        `INSERT INTO audit_logs (action, performed_by, target_table, created_at)
         VALUES ($1, $2, $3, NOW())`,
        [
          "USER_DELETED",
          actorId,
          `User ${numericId} (${user.full_name || user.email}) was soft-deleted by admin`
        ]
      );
    } catch (auditErr) {
      console.warn("Audit log failed during delete:", auditErr.message);
    }

    console.log(`✅ User ${numericId} successfully soft-deleted`);
    return { 
      success: true, 
      message: `User ${user.full_name || user.email} has been deleted` 
    };

  } catch (err) {
    console.error("[deleteUser] Error:", err.message);
    return { error: err.message || "Database error while deleting user" };
  }
}

// trade history
export async function getUserTradeHistory(userId) {
  try {
    const res = await query(`
    SELECT 
  o.id AS order_id,
  o.created_at,
  o.type,
  o.quantity,
  o.price,
  o.total,
  o.status,
  s.symbol,
  s.name,
  t.id AS trade_id,
  t.created_at AS trade_timestamp
FROM orders o
LEFT JOIN trades t ON t.order_id = o.id   -- ✅ FIX HERE
JOIN securities s ON s.id = o.security_id
WHERE o.investor_id = $1
ORDER BY o.created_at DESC
LIMIT 50;
    `, [userId]);

    return res.rows;
  } catch (err) {
    console.error("Failed to fetch trade history:", err);
    return [];
  }
}

//pending listings
export async function getPendingListings() {
  try {
    const result = await query(`
      SELECT
        s.*,
        s.created_at                AS submitted_at,
        i.company_name              AS issuer_name,
        i.company_reg_number        AS registration_number,
        NULL::TEXT                  AS sector,
        u.email                     AS contact_email
      FROM securities s
      JOIN issuers i ON i.id = s.issuer_id
      JOIN users   u ON u.id = i.user_id
      WHERE s.approved = false OR s.approved = 'f'
      ORDER BY s.created_at DESC
    `);

    return result.rows;
  } catch (err) {
    console.error("getPendingListings failed:", err);
    return [];
  }
}

// Approve listing → set approved=true in DB → mint tokens on-chain
export async function approveListing(listingId, actorId = null) {
  try {
    // 1. Get the security/listing row
    const listingRes = await query(
      `SELECT s.*, u.wallet_address AS issuer_wallet
       FROM securities s
       LEFT JOIN issuers i ON i.id = s.issuer_id
       LEFT JOIN users   u ON u.id = i.user_id
       WHERE s.id = $1`,
      [listingId]
    );

    if (listingRes.rowCount === 0) throw new Error("Listing not found");
    const listing = listingRes.rows[0];

    // 2. Mark approved in DB and initialise the available-token counter.
    //    available_tokens may be NULL or 0 from the INSERT; set it to total_supply
    //    so that all subsequent buy/sell writes have a correct baseline.
    await query(
      `UPDATE securities
       SET approved          = true,
           available_tokens  = CASE
             WHEN available_tokens IS NULL OR available_tokens <= 0
             THEN total_supply
             ELSE available_tokens
           END
       WHERE id = $1`,
      [listingId]
    );

    // 3. Audit log
    if (actorId) {
      await query(
        `INSERT INTO audit_logs (action, performed_by, target_table, created_at)
         VALUES ('LISTING_APPROVED', $1, $2, NOW())`,
        [actorId, `Security ${listing.symbol} (id=${listingId}) approved`]
      ).catch(() => {});
    }

    // 4. Mint tokens on-chain (non-blocking — DB approval already committed)
    let mintTxHash   = null;
    let mintResult   = null;
    const issuerWallet = listing.issuer_wallet;
    const totalSupply  = Number(listing.total_supply) || 0;

    if (issuerWallet && totalSupply > 0) {
      mintResult = await mintSecurityTokens(
        listingId,
        issuerWallet,
        totalSupply,
        listing.symbol || `SEC-${listingId}`
      );

      if (mintResult) {
        mintTxHash = mintResult.hash;

        // ── Schema migrations (idempotent) ──────────────────────────────
        // Add tx_hash to securities if missing
        await query(`ALTER TABLE securities ADD COLUMN IF NOT EXISTS tx_hash TEXT`).catch(() => {});
        // Add extra columns to onchain_trade_records for mint events
        await query(`ALTER TABLE onchain_trade_records ADD COLUMN IF NOT EXISTS security_id INTEGER REFERENCES securities(id)`).catch(() => {});
        await query(`ALTER TABLE onchain_trade_records ADD COLUMN IF NOT EXISTS event_type  TEXT NOT NULL DEFAULT 'trade'`).catch(() => {});
        // Allow order_id to be NULL so mint events (which have no order) can be stored
        await query(`ALTER TABLE onchain_trade_records ALTER COLUMN order_id DROP NOT NULL`).catch(() => {});

        // Stamp tx_hash on the security row
        await query(
          `UPDATE securities SET tx_hash = $1 WHERE id = $2`,
          [mintTxHash, listingId]
        ).catch(() => {});

        // Record the mint event
        await query(
          `INSERT INTO onchain_trade_records
             (order_id, security_id, tx_hash, block_number, status, event_type, recorded_at)
           VALUES (NULL, $1, $2, $3, $4, 'mint', NOW())`,
          [
            listingId,
            mintTxHash,
            mintResult.blockNumber ?? 0,
            mintResult.status ?? "confirmed",
          ]
        ).catch((e) => console.error("[APPROVE] Failed to write onchain_trade_records:", e.message));
      }
    } else {
      console.warn(
        `[APPROVE] Security #${listingId}: no issuer wallet or zero supply — ` +
        "skipping on-chain mint"
      );
    }

    return {
      listing:     { ...listing, approved: true },
      mintTxHash,
      blockNumber: mintResult?.blockNumber ?? null,
      onChain:     !!mintTxHash,
    };
  } catch (err) {
    console.error("approveListing failed:", err);
    throw err;
  }
}
export async function rejectListing(listingId) {
  try {
    const result = await query(
      `UPDATE securities
       SET approved = false
       WHERE id = $1
       RETURNING *`,
      [listingId]
    );

    if (result.rowCount === 0) {
      throw new Error("Listing not found");
    }

    // Optional: audit log
    try {
      await query(
        `INSERT INTO audit_logs (action, performed_by, target_table, created_at)
         VALUES ($1, $2, $3, NOW())`,
        ["LISTING_REJECTED", "admin", `Listing ${listingId} rejected`]
      );
    } catch (e) {
      console.warn("Audit failed:", e.message);
    }

    return result.rows[0];
  } catch (err) {
    console.error("rejectListing failed:", err);
    throw err;
  }
}
export async function getAuditLog() {
  try {
    const result = await query(`
      SELECT
        id,
        action,
        performed_by,
        target_table,
        to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') AS timestamp
      FROM audit_logs
      ORDER BY created_at DESC
    `);
    return result.rows;
  } catch (err) {
    console.error("getAuditLog failed:", err);
    return [];
  }
}

// ── Token holder stats (DB-side, from holdings table) ──────────────────────
export async function getTokenHolders(securityId) {
  try {
    const rows = await getRows(
      `SELECT h.user_id, h.quantity, u.full_name, u.email, u.wallet_address
       FROM holdings h
       JOIN users u ON u.id = h.user_id
       WHERE h.security_id = $1 AND h.quantity > 0
       ORDER BY h.quantity DESC`,
      [securityId]
    );
    return rows;
  } catch (err) {
    console.error("getTokenHolders failed:", err);
    return [];
  }
}

/**
 * All secondary-market trades for securities issued by this issuer.
 * Returns buyer/seller names, security info, price, qty, total.
 */
export async function getIssuerTrades(issuerId) {
  try {
    const rows = await getRows(
      `SELECT
         t.id,
         t.created_at,
         t.quantity,
         t.price,
         t.total,
         COALESCE(t.broker_fee, 0) AS broker_fee,
         t.status,
         s.id             AS security_id,
         s.symbol,
         s.name           AS security_name,
         buyer.id         AS buyer_id,
         buyer.full_name  AS buyer_name,
         buyer.email      AS buyer_email,
         seller.id        AS seller_id,
         seller.full_name AS seller_name,
         seller.email     AS seller_email
       FROM trades t
       JOIN  securities s    ON s.id   = t.security_id
       LEFT JOIN users buyer  ON buyer.id  = t.buyer_id
       LEFT JOIN users seller ON seller.id = t.seller_id
       WHERE s.issuer_id = $1
       ORDER BY t.created_at DESC
       LIMIT 200`,
      [issuerId]
    );
    return rows;
  } catch (err) {
    console.error("getIssuerTrades failed:", err);
    return [];
  }
}

export async function getIssuerSecurityStats(issuerId) {
  try {
    const rows = await getRows(
      `SELECT
         s.id, s.name, s.symbol,
         s.price,
         s.total_supply,
         COALESCE(s.available_tokens, s.total_supply)       AS available_tokens,
         s.approved,
         NULL AS type,
         COUNT(DISTINCT t.id)                               AS trade_count,
         COALESCE(SUM(t.total), 0)                         AS total_volume,
         COUNT(DISTINCT h.user_id)                          AS holder_count
       FROM securities s
       LEFT JOIN trades   t ON t.security_id = s.id AND t.status = 'filled'
       LEFT JOIN holdings h ON h.security_id = s.id AND h.quantity > 0
       WHERE s.issuer_id = $1
       GROUP BY s.id
       ORDER BY s.created_at DESC`,
      [issuerId]
    );
    return rows;
  } catch (err) {
    console.error("getIssuerSecurityStats failed:", err);
    return [];
  }
}

/**
 * All on-chain trade records joined with order/security info.
 * Used by the regulator Token Registry tab.
 */
export async function getOnchainTradeRecords() {
  try {
    const rows = await getRows(
      `SELECT
         r.id, r.order_id, r.tx_hash, r.block_number, r.status,
         r.error_message, r.recorded_at,
         COALESCE(r.security_id, o.security_id) AS security_id,
         r.event_type,
         o.quantity, o.price, o.total, o.type AS order_type,
         s.symbol, COALESCE(s.name, s.symbol, 'Unknown') AS security_name
       FROM onchain_trade_records r
       LEFT JOIN orders     o ON o.id  = r.order_id
       LEFT JOIN securities s ON s.id  = COALESCE(r.security_id, o.security_id)
       ORDER BY r.recorded_at DESC
       LIMIT 200`
    );
    return rows;
  } catch (err) {
    console.error("getOnchainTradeRecords failed:", err);
    return [];
  }
}

/**
 * Unified blockchain ledger for the regulator:
 * – trade executions   (onchain_trade_records, event_type = 'trade')
 * – security mints     (onchain_trade_records, event_type = 'mint')
 * – dividend/interest/distribution settlements (dividends.onchain_tx_hash)
 */
export async function getBlockchainRecords() {
  try {
    // 1. Trade + mint records
    const tradeRows = await getRows(
      `SELECT
         r.id                                       AS id,
         COALESCE(r.event_type, 'trade')            AS event_type,
         r.tx_hash,
         r.block_number,
         r.status,
         r.recorded_at                              AS timestamp,
         COALESCE(r.security_id, o.security_id)    AS security_id,
         s.symbol                                   AS symbol,
         COALESCE(s.name, s.symbol, 'Unknown')     AS security_name,
         o.type                                     AS order_type,
         o.quantity,
         o.price,
         o.total,
         NULL::TEXT                                 AS notes
       FROM onchain_trade_records r
       LEFT JOIN orders     o ON o.id = r.order_id
       LEFT JOIN securities s ON s.id = COALESCE(r.security_id, o.security_id)
       ORDER BY r.recorded_at DESC
       LIMIT 500`
    );

    // 2. Dividend / interest / distribution settlements
    const divRows = await getRows(
      `SELECT
         d.id                                       AS id,
         'dividend'                                 AS event_type,
         d.onchain_tx_hash                          AS tx_hash,
         NULL::INTEGER                              AS block_number,
         'confirmed'                                AS status,
         d.payment_date::TIMESTAMPTZ                AS timestamp,
         d.security_id                              AS security_id,
         s.symbol                                   AS symbol,
         COALESCE(s.name, s.symbol, 'Unknown')     AS security_name,
         NULL::TEXT                                 AS order_type,
         NULL::NUMERIC                              AS quantity,
         d.amount_per_share                         AS price,
         d.total_payout                             AS total,
         d.notes                                    AS notes
       FROM dividends d
       JOIN securities s ON s.id = d.security_id
       WHERE d.onchain_tx_hash IS NOT NULL
       ORDER BY d.payment_date DESC
       LIMIT 200`
    ).catch(() => []);

    // Merge & sort newest first
    const all = [...tradeRows, ...divRows].sort(
      (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
    );
    return all;
  } catch (err) {
    console.error("getBlockchainRecords failed:", err);
    return [];
  }
}

/**
 * All token holders across every security — for regulator overview.
 */
export async function getAllTokenHolders() {
  try {
    const rows = await getRows(
      `SELECT
         h.security_id, h.user_id, h.quantity,
         s.symbol, s.name AS security_name, s.total_supply,
         u.full_name, u.email, u.wallet_address
       FROM holdings h
       JOIN securities s ON s.id = h.security_id
       JOIN users u ON u.id = h.user_id
       WHERE h.quantity > 0
       ORDER BY s.symbol, h.quantity DESC`
    );
    return rows;
  } catch (err) {
    console.error("getAllTokenHolders failed:", err);
    return [];
  }
}

// 2. Market Stats - real aggregation
export async function getMarketStats() {
  try {
    const statsRes = await query(`
      SELECT 
        COALESCE(SUM(price * total_supply), 0) AS total_market_cap,
        COUNT(*) AS listed_securities
      FROM securities
      WHERE approved = true OR approved = 't'
    `);

    const row = statsRes.rows[0] || {
      total_market_cap: 0,
      listed_securities: 0
    };

    return {
      totalMarketCap: Number(row.total_market_cap),
      totalVolume: 0,                // ← no volume column yet → hardcode 0 or remove field
      listedSecurities: Number(row.listed_securities),
      lastUpdated: new Date().toISOString(),
    };
  } catch (err) {
    console.error("getMarketStats failed:", err.message);
    return {
      totalMarketCap: 0,
      totalVolume: 0,
      listedSecurities: 0,
      lastUpdated: new Date().toISOString(),
    };
  }
}
//get portfolio 

export async function getPortfolio(userId) {
  if (!userId) {
    console.warn("[getPortfolio] No userId provided");
    return { portfolio: [], totalValue: 0, totalGain: 0 };
  }

  try {
    const res = await query(`
      SELECT 
        h.security_id,
        h.quantity          AS units,
        h.avg_price         AS avgPrice,
        s.price             AS current_price,
        s.symbol,
        s.name,
        ROUND(h.quantity * s.price, 2)                    AS current_value,
        ROUND(h.quantity * s.price - h.quantity * h.avg_price, 2) AS gain,
        CASE 
          WHEN h.quantity * h.avg_price = 0 THEN 0
          ELSE ROUND(
            ((h.quantity * s.price - h.quantity * h.avg_price) /
             (h.quantity * h.avg_price)) * 100,
            1
          )
        END AS gain_percent
      FROM holdings h
      INNER JOIN securities s ON h.security_id = s.id
      WHERE h.user_id = $1
        AND h.quantity > 0
      ORDER BY s.symbol ASC
    `, [userId]);

    // ── Dividend income ───────────────────────────────────────────────────
    // Total paid dividends for this investor across all securities
    const divTotalRes = await query(
      `SELECT COALESCE(SUM(dp.amount), 0) AS total_dividends
         FROM dividend_payments dp
        WHERE dp.investor_id = $1 AND dp.status = 'paid'`,
      [userId]
    );
    const totalDividends = Number(divTotalRes.rows[0]?.total_dividends || 0);

    // Per-security dividend breakdown so each holding row can show its income
    const divBySecRes = await query(
      `SELECT dp.security_id, COALESCE(SUM(dp.amount), 0) AS dividend_income
         FROM dividend_payments dp
        WHERE dp.investor_id = $1 AND dp.status = 'paid'
        GROUP BY dp.security_id`,
      [userId]
    );
    const divBySec = {};
    for (const row of divBySecRes.rows) {
      divBySec[row.security_id] = Number(row.dividend_income);
    }
    // ─────────────────────────────────────────────────────────────────────

    const portfolio = res.rows.map(row => {
      const capitalGain    = Number(row.gain);
      const dividendIncome = divBySec[row.security_id] || 0;
      const totalGainRow   = capitalGain + dividendIncome;
      const costBasis      = Number(row.units) * Number(row.avgPrice);
      const gainPercent    = costBasis > 0
        ? +((totalGainRow / costBasis) * 100).toFixed(1)
        : Number(row.gain_percent);
      return {
        securityId:      row.security_id,
        units:           Number(row.units),
        avgPrice:        Number(row.avgPrice),
        currentValue:    Number(row.current_value),
        capitalGain,
        dividendIncome,
        gain:            totalGainRow,   // capital gain + dividends received
        gainPercent,
        security: {
          symbol: row.symbol,
          name:   row.name,
          price:  Number(row.current_price),
        }
      };
    });

    const totalValue = portfolio.reduce((sum, item) => sum + item.currentValue, 0);
    const totalGain  = portfolio.reduce((sum, item) => sum + item.gain, 0);

    console.log(`[getPortfolio] User ${userId}: ${portfolio.length} holdings, total M${totalValue.toFixed(2)}, dividends M${totalDividends.toFixed(2)}`);

    return {
      portfolio,
      totalValue,
      totalGain,        // capital gains + dividend income
      totalDividends,   // dividend portion only (for breakdown display)
    };

  } catch (err) {
    console.error("[getPortfolio] Query failed:", err.message);
    return { portfolio: [], totalValue: 0, totalGain: 0 };
  }
}

// Extract unique issuer profiles from securities
export async function getIssuerProfilesForUser(userId) {
  try {
    // Build absolute URL — works in both browser and server contexts
    const base =
      typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    const url = base + "/api/issuers?user_id=" + userId;

    console.log("[getIssuerProfilesForUser] Fetching:", url);

    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
      credentials: "include", // keep session/cookies if needed
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      console.warn("Issuers fetch failed: " + res.status + " " + res.statusText);
      return [];
    }

    const data = await res.json();

    // Handle different possible response shapes (Supabase, custom API, etc.)
    let issuers = [];
    if (Array.isArray(data)) {
      issuers = data;
    } else if (data && data.rows) {
      issuers = data.rows;
    } else if (data && data.data) {
      issuers = data.data;
    } else if (data && data.issuers) {
      issuers = data.issuers;
    }

    console.log("[getIssuerProfilesForUser] Raw response length:", issuers.length);

    // Safety filter — make sure we only return issuers for this user
    return issuers.filter(function (i) {
      return Number(i.user_id) === Number(userId);
    });
  } catch (err) {
    console.error("getIssuerProfilesForUser crashed:", err);
    return [];
  }
}
// ────────────────────────────────────────────────
// Place Order - transactional version
// ────────────────────────────────────────────────
export async function placeOrder(investorId, securityId, type, quantity, price) {
  // Early validation
  if (!['buy', 'sell'].includes(type)) {
    return { success: false, error: 'Invalid order type' };
  }

  const qty = Number(quantity);
  const prc = Number(price);

  if (isNaN(qty) || qty <= 0 || !Number.isInteger(qty)) {
    return { success: false, error: 'Quantity must be a positive integer' };
  }

  if (isNaN(prc) || prc <= 0) {
    return { success: false, error: 'Price must be a positive number' };
  }

  const total = qty * prc;

  try {
    return await withTransaction(async (client) => {
      // 1. Verify investor exists
      const investorRes = await client.query(
        `SELECT id FROM users WHERE id = $1`,
        [investorId]
      );
      if (investorRes.rowCount === 0) {
        throw new Error("Investor not found");
      }

      // 2. Check latest KYC is approved
      const kycRes = await client.query(
        `SELECT status FROM kyc_records 
         WHERE user_id = $1 
         ORDER BY submitted_at DESC LIMIT 1`,
        [investorId]
      );
      if (kycRes.rowCount === 0 || kycRes.rows[0].status !== "approved") {
        throw new Error("KYC not approved or not found");
      }

      // 3. Get active wallet
      const walletRes = await client.query(
        `SELECT id, balance FROM wallets 
         WHERE user_id = $1 AND status = 'active' LIMIT 1`,
        [investorId]
      );
      if (walletRes.rowCount === 0) {
        throw new Error("Active wallet not found");
      }
      const wallet = walletRes.rows[0];
      const currentBalance = Number(wallet.balance);

      // Debug log - remove later if desired
      console.log(`[placeOrder] Wallet balance for user ${investorId}: ${currentBalance}`);

      // 4. Get security details
      const securityRes = await client.query(
        `SELECT id, symbol, name, price, total_supply
         FROM securities WHERE id = $1`,
        [securityId]
      );
      if (securityRes.rowCount === 0) {
        throw new Error("Security not found");
      }
      const security = securityRes.rows[0];

      // Compute TRUE available supply from the holdings table (immune to counter drift)
      const availRes = await client.query(
        `SELECT s.total_supply - COALESCE(SUM(h.quantity)::bigint, 0) AS available
         FROM securities s
         LEFT JOIN holdings h ON h.security_id = s.id
         WHERE s.id = $1
         GROUP BY s.total_supply`,
        [securityId]
      );
      const availableTokens = availRes.rowCount
        ? Math.max(Number(availRes.rows[0].available), 0)
        : Math.max(Number(security.total_supply), 0);

      console.log(`[placeOrder] Security ${securityId} (${security.symbol}): available = ${availableTokens}`);

      let orderId;

      if (type === "buy") {
        if (currentBalance < total) {
          throw new Error(
            `Insufficient funds (balance: ${currentBalance.toFixed(2)}, required: ${total.toFixed(2)})`
          );
        }

        if (availableTokens < qty) {
          throw new Error(
            `Not enough tokens available (${availableTokens} remaining, requested ${qty})`
          );
        }

        // Deduct from wallet
        await client.query(
          `UPDATE wallets
           SET balance = balance - $1, updated_at = NOW()
           WHERE id = $2`,
          [total, wallet.id]
        );

        // Reduce available tokens — NULL-safe: COALESCE to total_supply so 0-qty never goes negative
        await client.query(
          `UPDATE securities
           SET available_tokens = GREATEST(COALESCE(available_tokens, total_supply) - $1, 0)
           WHERE id = $2`,
          [qty, securityId]
        );

        // Update or insert holding
        const holdingRes = await client.query(
          `SELECT id, quantity, avg_price 
           FROM holdings 
           WHERE user_id = $1 AND security_id = $2`,
          [investorId, securityId]
        );

        if (holdingRes.rowCount > 0) {
          const existing = holdingRes.rows[0];
          const newQuantity = existing.quantity + qty;
          const newAvgPrice = (
            (Number(existing.avg_price) * existing.quantity) + total
          ) / newQuantity;

          await client.query(
            `UPDATE holdings 
             SET quantity = $1, avg_price = $2, updated_at = NOW() 
             WHERE id = $3`,
            [newQuantity, newAvgPrice, existing.id]
          );
        } else {
          await client.query(
            `INSERT INTO holdings 
              (user_id, security_id, quantity, avg_price, created_at, updated_at)
             VALUES ($1, $2, $3, $4, NOW(), NOW())`,
            [investorId, securityId, qty, prc]
          );
        }
      } 
      else if (type === "sell") {
        const holdingRes = await client.query(
          `SELECT id, quantity 
           FROM holdings 
           WHERE user_id = $1 AND security_id = $2`,
          [investorId, securityId]
        );

        if (holdingRes.rowCount === 0 || holdingRes.rows[0].quantity < qty) {
          throw new Error("Insufficient holdings");
        }

        const existing = holdingRes.rows[0];
        const remaining = existing.quantity - qty;

        if (remaining > 0) {
          await client.query(
            `UPDATE holdings SET quantity = $1, updated_at = NOW() WHERE id = $2`,
            [remaining, existing.id]
          );
        } else {
          await client.query(
            `DELETE FROM holdings WHERE id = $1`,
            [existing.id]
          );
        }

        // Credit wallet
        await client.query(
          `UPDATE wallets 
           SET balance = balance + $1, updated_at = NOW() 
           WHERE id = $2`,
          [total, wallet.id]
        );

        // Return tokens to pool — NULL-safe: cap at total_supply
        await client.query(
          `UPDATE securities
           SET available_tokens = LEAST(COALESCE(available_tokens, 0) + $1, total_supply)
           WHERE id = $2`,
          [qty, securityId]
        );
      }

      // ────────────────────────────────────────────────
      // Create order record
      // ────────────────────────────────────────────────
      const orderRes = await client.query(
        `INSERT INTO orders 
          (investor_id, security_id, quantity, price, total, type, status, created_at, payment_method)
         VALUES ($1, $2, $3, $4, $5, $6, 'filled', NOW(), 'virtual wallet')
         RETURNING id`,
        [investorId, securityId, qty, prc, total, type]
      );

      orderId = orderRes.rows[0].id;

      // ────────────────────────────────────────────────
      // Log wallet transaction
      // ────────────────────────────────────────────────
      const txType = type === "buy" ? "debit" : "credit";
      const description = `${type.toUpperCase()} ${qty} ${security.symbol}`;

      await client.query(
        `INSERT INTO wallet_transactions 
          (wallet_id, transaction_type, amount, reference_id, description, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [wallet.id, txType, total, orderId, description]
      );

      // ────────────────────────────────────────────────
      // Record trade
      // ────────────────────────────────────────────────
        
      await client.query(
        `INSERT INTO trades 
          (buyer_id, seller_id, security_id, quantity, price, total, created_at, status)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), 'settled')`,
        [
          type === "buy" ? investorId : null,
          type === "sell" ? investorId : null,
          securityId,
          qty,
          prc,
          total
        ]
      );

      // ────────────────────────────────────────────────
      // Optional alert
      // ────────────────────────────────────────────────
      await client.query(
        `INSERT INTO alerts (user_id, title, message, alert_type, created_at)
         VALUES ($1, $2, $3, 'success', NOW())`,
        [
          investorId,
          `Order Executed: ${security.symbol}`,
          `Your ${type.toUpperCase()} order for ${qty} ${security.symbol} at M${prc} has been executed.`
        ]
      );

      return {
        success: true,
        orderId,
        message: "Order successfully executed"
      };
    });
  } catch (err) {
    console.error("placeOrder failed:", {
      investorId,
      securityId,
      type,
      quantity: qty,
      price: prc,
      total,
      message: err.message,
      code: err.code,
      detail: err.detail,
      stack: err.stack?.split('\n').slice(0, 6).join('\n')
    });

    return {
      success: false,
      error: "Order execution failed",
      message: err.message || "Unknown server error",
      code: err.code || null
    };
  }
}

// ────────────────────────────────────────────────
// Existing helper functions (unchanged)
// ────────────────────────────────────────────────
export async function getInvestorAlerts(userId) {
  return getRows(
    `SELECT * FROM alerts WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
}

export async function getOrders(investorId) {
  const base = `
    SELECT o.*, s.symbol, s.name AS security_name
    FROM orders o
    LEFT JOIN securities s ON s.id = o.security_id
  `;
  if (investorId) {
    return getRows(`${base} WHERE o.investor_id = $1 ORDER BY o.created_at DESC`, [investorId]);
  }
  return getRows(`${base} ORDER BY o.created_at DESC`);
}

export async function getTrades(filter = {}) {
  const conditions = [];
  const values = [];

  if (filter.securityId) {
    conditions.push(`security_id = $${values.length + 1}`);
    values.push(filter.securityId);
  }

  if (filter.investorId) {
    conditions.push(
      `(buyer_id = $${values.length + 1} OR seller_id = $${values.length + 2})`
    );
    values.push(filter.investorId, filter.investorId);
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  return getRows(
    `SELECT * FROM trades ${whereClause} ORDER BY created_at DESC`,
    values
  );
}
/* ---------------------------------- */
/* SUBMIT LISTING */
/* ---------------------------------- */
export async function submitListing(data, user) {
  if (!user || !user.id) {
    throw new Error("User not logged in");
  }

  const { name, symbol, totalTokens, initialPrice, type, description, sector } = data;

  // Ensure optional columns exist (safe no-ops if already present)
  await query(`ALTER TABLE securities ADD COLUMN IF NOT EXISTS security_type TEXT DEFAULT 'shares'`).catch(() => {});
  await query(`ALTER TABLE securities ADD COLUMN IF NOT EXISTS description TEXT`).catch(() => {});

  // Get issuer ID from the logged-in user
  const issuerResult = await query(
    `SELECT id FROM issuers WHERE user_id = $1`,
    [user.id]
  );

  if (issuerResult.rows.length === 0) {
    throw new Error("Issuer profile not found");
  }

  const issuerId = issuerResult.rows[0].id;

  // Insert new security listing
  const result = await query(
    `INSERT INTO securities
     (issuer_id, name, symbol, total_supply, price, approved, description, security_type, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
     RETURNING *`,
    [issuerId, name, symbol, totalTokens, initialPrice, false, description || null, type || "shares"]
  );

  return result.rows[0];
}


/* ---------------------------------- */
/* GET ALL SECURITIES */
/* ---------------------------------- */
export async function getAllSecurities() {
  const result = await query(
    `SELECT s.*, u.company_name AS issuer_name
     FROM securities s
     JOIN issuers u ON s.issuer_id = u.id
     ORDER BY s.created_at DESC`
  );

  return result.rows;
}


/* ---------------------------------- */
/* GET LISTINGS BY ISSUER */
/* ---------------------------------- */
export async function getListings(user) {
  if (!user || !user.id) return []; // defensive check

  // Get issuer ID from user
  const issuerResult = await query(
    `SELECT id FROM issuers WHERE user_id = $1`,
    [user.id]
  );

  if (issuerResult.rows.length === 0) return [];

  const issuerId = issuerResult.rows[0].id;

  const result = await query(
    `SELECT * FROM securities
     WHERE issuer_id = $1
     ORDER BY created_at DESC`,
    [issuerId]
  );

  return result.rows;
}


// Bonus: function to update balance (used in buy/sell/deposit)
export async function updateWalletBalance(userId, amount, type = 'adjustment', description = '') {
  const client = await pool.connect(); // Use transaction for safety
  try {
    await client.query('BEGIN');

    // Lock row to prevent race conditions
    const walletRes = await client.query(
      'SELECT balance FROM wallets WHERE user_id = $1 FOR UPDATE',
      [userId]
    );

    if (walletRes.rows.length === 0) {
      throw new Error('Wallet not found');
    }

    const current = parseFloat(walletRes.rows[0].balance);
    const newBalance = current + amount;

    if (newBalance < 0) {
      throw new Error('Insufficient funds');
    }

    await client.query(
      'UPDATE wallets SET balance = $1 WHERE user_id = $2',
      [newBalance, userId]
    );

    // Log transaction
    await client.query(
      `INSERT INTO wallet_transactions (wallet_id, type, amount, description)
       VALUES ((SELECT id FROM wallets WHERE user_id = $1), $2, $3, $4)`,
      [userId, type, amount, description]
    );

    await client.query('COMMIT');
    return newBalance;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

  /*
  ========================================
  Tokenize security after approval
  ========================================
  */
/*
  const security = {
    id: "sec-" + Date.now(),
    issuerId: listing.issuerId,
    name: listing.name,
    symbol: listing.symbol,
    price: listing.initialPrice,
    totalTokens: listing.totalTokens,
    sector: listing.sector,
    marketCap: listing.initialPrice * listing.totalTokens,
    volume: 0,
    change: 0,
    changePercent: 0,
  };

  securities.push(security);
*/
  /*
  ========================================
  Update company profile data
  ========================================
  */
/*

  const user = users.find((u) => u.id === listing.issuerId);

  if (user) {
    user.companyData = {
      companyName: listing.name,
      sector: listing.sector,
      listingSymbol: listing.symbol,
      listingStatus: "listed",
      listingApprovedAt: listing.approvedAt,
    };
  }

  return { listing, security };
*/

// ================================================

// Helper to make all fetch URLs absolute (fixes "Invalid URL" error in SSR)
function getApiUrl(path) {
  const base = typeof window === "undefined" ? "http://localhost:3000" : window.location.origin;
  return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
}

/* ================================================ */
/* REUSABLE AUTHENTICATED FETCH                     */
/* ================================================ */
async function authFetch(input, init = {}) {
  const finalInit = {
    ...init,
    credentials: "include",                     // ← sends httpOnly cookies → fixes 401
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  };

  const url = typeof input === "string" ? getApiUrl(input) : input;

  try {
    const res = await fetch(url, finalInit);
if (!res.ok) {
  const text = await res.text(); // read once
  let errorBody;
  try {
    errorBody = JSON.parse(text); // try parse
  } catch {
    errorBody = { message: text };
  }
  console.error(`authFetch error ${res.status}:`, errorBody);
  throw new Error(errorBody.message || `HTTP ${res.status}`);
}

    return res;
  } catch (err) {
    console.error("authFetch network error:", err);
    throw err;
  }
}

/* ---------------------------------- */
/* GET WALLET                         */
/* ---------------------------------- */
export async function getWallet(userId) {
  if (!userId) return { balance: 0, currency: "LSL" };

  try {
    const res = await authFetch(`/api/wallet?userId=${userId}`);
    const data = await res.json();

    return {
      balance: Number(data.balance ?? 0),
      currency: data.currency || "LSL",
    };
  } catch (error) {
    console.error("getWallet failed:", error);
    return { balance: 0, currency: "LSL" }; // graceful fallback
  }
}

/* ---------------------------------- */
/* DEPOSIT FUNDS                      */
/* ---------------------------------- */
const DEPOSIT_MIN = 1_000;
const DEPOSIT_MAX = 100_000_000;

export async function depositFunds(userId, amount, description = "") {
  if (!userId || amount <= 0) return { error: "Invalid parameters" };

  const amt = Number(amount);
  if (amt < DEPOSIT_MIN)
    return { error: `Minimum deposit is M${DEPOSIT_MIN.toLocaleString()}.` };
  if (amt > DEPOSIT_MAX)
    return { error: `Maximum deposit is M${DEPOSIT_MAX.toLocaleString()}.` };

  console.log(`[depositFunds] →`, { userId, amount });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // increased to 8s

    const res = await authFetch("/api/wallet/deposit", {
      method: "POST",
      body: JSON.stringify({ userId, amount, description }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await res.json();

    if (data.error) {
      console.warn("[depositFunds] Server error:", data.error);
      return { error: data.error };
    }

    console.log("[depositFunds] Success:", data);
    return data; // expect { success: true, message: "...", newBalance: number }
  } catch (err) {
    console.error("[depositFunds] Failed:", err);
    if (err.name === "AbortError") {
      return { error: "Request timed out – server slow" };
    }
    return { error: err.message || "Network failure" };
  }
}

/* ---------------------------------- */
/* WITHDRAW FUNDS                     */
/* ---------------------------------- */
export async function withdrawFunds(userId, amount, description = "Manual withdrawal") {
  if (!userId || amount <= 0) return { error: "Invalid parameters" };

  console.log(`[withdrawFunds] →`, { userId, amount });

  try {
    const res = await authFetch("/api/wallet/withdraw", {
      method: "POST",
      body: JSON.stringify({ userId, amount, description }),
    });

    const data = await res.json();

    if (data.error) {
      console.warn("[withdrawFunds] Server error:", data.error);
      return { error: data.error };
    }

    console.log("[withdrawFunds] Success:", data);
    return data;
  } catch (err) {
    console.error("[withdrawFunds] Failed:", err);
    return { error: err.message || "Network failure" };
  }
}

/* ---------------------------------- */
/* GET ALERTS                         */
/* ---------------------------------- */
export async function getAlerts(userId) {
  if (!userId) throw new Error("User ID required");

  try {
    const res = await authFetch(`/api/alerts?userId=${encodeURIComponent(userId)}`);
    return await res.json();
  } catch (err) {
    console.error("getAlerts failed:", err);
    throw err; // let caller handle
  }
}


// declareDividend is defined at the bottom of this file


// clients orders  by broker 
/*export async function getPendingOrders() {
  try {
    const result = await pool.query(`
      SELECT 
        id,
        investor_id,
        security_id,
        quantity,
        price,
        payment_method,
        status,
        created_at,
        type,
        total
      FROM orders
      WHERE status = 'pending'
         OR status IS NULL          -- in case some orders have no status yet
      ORDER BY created_at DESC
    `);

    // pg returns rows as plain objects → ready to use
    return result.rows;
  } catch (error) {
    console.error('Error fetching pending orders:', error);
    return []; // fail-safe: never let the frontend crash
  }
}*/

// place order — filtered to broker's assigned clients when brokerUserId supplied
export async function getPendingOrders(brokerUserId = null) {
  try {
    const params = [];
    let brokerFilter = '';
    if (brokerUserId) {
      params.push(brokerUserId);
      brokerFilter = `AND o.investor_id IN (
        SELECT investor_id FROM broker_assignments
        WHERE broker_id = $${params.length} AND status = 'active'
      )`;
    }

    const result = await pool.query(`
      SELECT
        o.id,
        o.investor_id,
        o.security_id,
        o.type,
        o.quantity,
        o.price,
        o.total,
        o.status,
        o.created_at,
        o.payment_method,
        u.full_name  AS investor_name,
        u.email      AS investor_email,
        s.symbol     AS security_symbol,
        s.name       AS security_name
      FROM orders o
      LEFT JOIN users      u ON u.id = o.investor_id
      LEFT JOIN securities s ON s.id = o.security_id
      WHERE (o.status = 'pending' OR o.status IS NULL)
      ${brokerFilter}
      ORDER BY o.created_at DESC
      LIMIT 100
    `, params);

    return result.rows;
  } catch (error) {
    console.error('Error fetching pending orders:', error);
    return [];
  }
}


// broker
//const { recordTradeOnChain } = require('../blockchain/recordTrade');
import { recordTradeOnChain, mintSecurityTokens } from './blockchain/recordTrade';

/** Broker charges 5% of the trade total as a trading fee per transaction */
const BROKER_FEE_RATE = 0.05;

/** Migrate orders and trades tables to support broker_fee column */
async function ensureBrokerFeeColumns() {
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS broker_fee  NUMERIC(18,2) DEFAULT 0`).catch(() => {});
  await query(`ALTER TABLE trades ADD COLUMN IF NOT EXISTS broker_fee  NUMERIC(18,2) DEFAULT 0`).catch(() => {});
  // Securities needs prev_price + updated_at for price-discovery updates inside executeOrder
  await query(`ALTER TABLE securities ADD COLUMN IF NOT EXISTS prev_price  NUMERIC(18,4)`).catch(() => {});
  await query(`ALTER TABLE securities ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ`).catch(() => {});

  // ── One-time repair: recompute available_tokens for approved securities ──
  // available_tokens may be NULL or negative due to the old write bug
  // (0 - qty = -1, NULL - qty = NULL).  Recompute from ground truth: total_supply
  // minus what investors currently hold.
  await query(`
    UPDATE securities s
    SET available_tokens = GREATEST(
          s.total_supply - COALESCE(
            (SELECT SUM(h.quantity) FROM holdings h WHERE h.security_id = s.id),
            0
          ),
          0
        )
    WHERE s.approved = true
      AND (s.available_tokens IS NULL OR s.available_tokens < 0
           OR s.available_tokens > s.total_supply)
  `).catch((e) => console.warn('[STARTUP] available_tokens repair skipped:', e.message));
}

// Broker approves & executes pending order
export async function executeOrder(orderId, brokerId) {
  await ensureBrokerFeeColumns();
  // 60s timeout — includes blockchain call which can be slow
  return withTransaction(async (client) => {
    // ── 1. Lock the order row ───────────────────────────────────────
    const orderRes = await client.query(
      `SELECT
         id, investor_id, security_id, type, quantity, price, total, status,
         executed_by, executed_at
       FROM orders
       WHERE id = $1
         AND status = 'pending'
       FOR UPDATE`,
      [orderId]
    );

    if (orderRes.rowCount === 0) {
      // Either doesn't exist or already filled/processed
      const check = await client.query(
        `SELECT status FROM orders WHERE id = $1`, [orderId]
      );
      if (check.rowCount === 0) throw new Error("Order not found");
      const st = check.rows[0].status;
      throw new Error(`Order is already ${st}`);
    }

    let order = orderRes.rows[0];
    const qty   = Number(order.quantity);
    const prc   = Number(order.price);
    const total = Number(order.total);
    // 5% broker trading fee on every transaction
    const fee   = +(total * BROKER_FEE_RATE).toFixed(2);

    // ── 2. Get investor + latest KYC check ──────────────────────────
    const investorRes = await client.query(
      `SELECT id FROM users WHERE id = $1`,
      [order.investor_id]
    );
    if (investorRes.rowCount === 0) {
      throw new Error("Investor not found");
    }

    const kycRes = await client.query(
      `SELECT status FROM kyc_records 
       WHERE user_id = $1 
       ORDER BY submitted_at DESC LIMIT 1`,
      [order.investor_id]
    );
    if (kycRes.rowCount === 0 || kycRes.rows[0].status !== "approved") {
      throw new Error("KYC not approved");
    }

    // ── 3. Get active wallet ────────────────────────────────────────
    const walletRes = await client.query(
      `SELECT id, balance FROM wallets 
       WHERE user_id = $1 AND status = 'active' LIMIT 1`,
      [order.investor_id]
    );
    if (walletRes.rowCount === 0) {
      throw new Error("No active wallet found");
    }
    const wallet = walletRes.rows[0];
    const currentBalance = Number(wallet.balance);

    // ── 4. Get security + lock it ───────────────────────────────────
    const securityRes = await client.query(
      `SELECT id, symbol, price, total_supply
       FROM securities
       WHERE id = $1
       FOR UPDATE`,
      [order.security_id]
    );
    if (securityRes.rowCount === 0) {
      throw new Error("Security not found");
    }
    const security = securityRes.rows[0];

    // ── 5. Business rules validation (re-check everything) ──────────
    if (order.type === "buy") {
      if (currentBalance < total + fee) {
        throw new Error(
          `Insufficient funds (balance: M${currentBalance.toFixed(2)}, needed: M${(total + fee).toFixed(2)} incl. 5% broker fee of M${fee.toFixed(2)})`
        );
      }
      // Compute TRUE available supply from holdings (immune to counter drift)
      const availRes = await client.query(
        `SELECT s.total_supply - COALESCE(SUM(h.quantity)::bigint, 0) AS available
         FROM securities s
         LEFT JOIN holdings h ON h.security_id = s.id
         WHERE s.id = $1
         GROUP BY s.total_supply`,
        [order.security_id]
      );
      const availableTokens = availRes.rowCount
        ? Math.max(Number(availRes.rows[0].available), 0)
        : Math.max(Number(security.total_supply), 0);
      if (availableTokens < qty) {
        throw new Error(
          `Not enough tokens available (${availableTokens} remaining, requested ${qty})`
        );
      }
    } else if (order.type === "sell") {
      const holdingRes = await client.query(
        `SELECT quantity FROM holdings 
         WHERE user_id = $1 AND security_id = $2`,
        [order.investor_id, order.security_id]
      );
      if (holdingRes.rowCount === 0 || Number(holdingRes.rows[0].quantity) < qty) {
        throw new Error("Insufficient holdings to sell");
      }
    }

    // ── 6. Execute financial movements ──────────────────────────────
    if (order.type === "buy") {
      // Deduct cash + 5% broker fee from investor
      await client.query(
        `UPDATE wallets SET balance = balance - $1, updated_at = NOW() WHERE id = $2`,
        [total + fee, wallet.id]
      );

      // Reserve tokens — NULL-safe
      await client.query(
        `UPDATE securities SET available_tokens = GREATEST(COALESCE(available_tokens, total_supply) - $1, 0) WHERE id = $2`,
        [qty, order.security_id]
      );

      // Update or create holding
      const holdingRes = await client.query(
        `SELECT id, quantity, avg_price FROM holdings
         WHERE user_id = $1 AND security_id = $2`,
        [order.investor_id, order.security_id]
      );
      if (holdingRes.rowCount > 0) {
        const h = holdingRes.rows[0];
        const newQty = Number(h.quantity) + qty;
        const newAvg = ((Number(h.avg_price) * Number(h.quantity)) + total) / newQty;
        await client.query(
          `UPDATE holdings SET quantity = $1, avg_price = $2, updated_at = NOW() WHERE id = $3`,
          [newQty, newAvg, h.id]
        );
      } else {
        await client.query(
          `INSERT INTO holdings (user_id, security_id, quantity, avg_price, created_at, updated_at)
           VALUES ($1, $2, $3, $4, NOW(), NOW())`,
          [order.investor_id, order.security_id, qty, prc]
        );
      }
    }
    else if (order.type === "sell") {
      // Reduce holding
      const holdingRes = await client.query(
        `SELECT id, quantity FROM holdings WHERE user_id = $1 AND security_id = $2`,
        [order.investor_id, order.security_id]
      );
      const holding = holdingRes.rows[0];
      const remaining = Number(holding.quantity) - qty;
      if (remaining > 0) {
        await client.query(
          `UPDATE holdings SET quantity = $1, updated_at = NOW() WHERE id = $2`,
          [remaining, holding.id]
        );
      } else {
        await client.query(`DELETE FROM holdings WHERE id = $1`, [holding.id]);
      }

      // Return tokens to pool — NULL-safe
      await client.query(
        `UPDATE securities SET available_tokens = LEAST(COALESCE(available_tokens, 0) + $1, total_supply) WHERE id = $2`,
        [qty, order.security_id]
      );

      // Credit proceeds minus 5% broker fee to investor
      await client.query(
        `UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE id = $2`,
        [total - fee, wallet.id]
      );
    }

    // ── 6c. Price discovery — supply & demand ───────────────────────
    // Each trade moves the price proportionally to the size of the trade
    // relative to circulating supply.  Buys push price up; sells push it down.
    // Sensitivity: 1 % of circulating supply traded → ~0.5 % price move (capped ±5 %).
    try {
      const totalSupply = Number(security.total_supply) || 1;
      const circulatingRes = await client.query(
        `SELECT COALESCE(SUM(quantity), 0) AS circulating FROM holdings WHERE security_id = $1`,
        [order.security_id]
      );
      const circulating = Math.max(Number(circulatingRes.rows[0]?.circulating) || totalSupply * 0.1, 1);
      const currentPrice = Number(security.price) || prc;
      // impact fraction: (qty traded / circulating supply) * 0.5, capped at 5 %
      const rawImpact = (qty / circulating) * 0.5;
      const impact    = Math.min(rawImpact, 0.05);
      const direction = order.type === 'buy' ? 1 : -1;
      const newPrice  = +(currentPrice * (1 + direction * impact)).toFixed(4);
      if (newPrice > 0) {
        // Use SAVEPOINT so a column-missing error doesn't abort the outer transaction
        await client.query(`SAVEPOINT price_update`);
        try {
          await client.query(
            `UPDATE securities SET prev_price = price, price = $1, updated_at = NOW() WHERE id = $2`,
            [newPrice, order.security_id]
          );
          await client.query(`RELEASE SAVEPOINT price_update`);
        } catch (priceErr) {
          await client.query(`ROLLBACK TO SAVEPOINT price_update`);
          console.warn('[PRICE] Price discovery update failed (non-fatal):', priceErr.message);
        }
      }
    } catch (priceErr) {
      console.warn('[PRICE] Price discovery update failed (non-fatal):', priceErr.message);
    }

    // ── 6b. Credit broker fee to broker's wallet (best-effort) ──────
    try {
      const brokerWalletRes = await client.query(
        `SELECT id FROM wallets WHERE user_id = $1 AND status = 'active' LIMIT 1`,
        [brokerId]
      );
      if (brokerWalletRes.rowCount > 0) {
        await client.query(
          `UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE id = $2`,
          [fee, brokerWalletRes.rows[0].id]
        );
        await client.query(
          `INSERT INTO wallet_transactions (wallet_id, transaction_type, amount, reference_id, description, created_at)
           VALUES ($1, 'credit', $2, $3, $4, NOW())`,
          [brokerWalletRes.rows[0].id, fee, orderId,
           `Commission (5%): ${order.type.toUpperCase()} ${qty} ${security.symbol} for investor #${order.investor_id}`]
        );
      }
    } catch (_) { /* broker has no wallet — fee is still recorded on the order */ }

    // ── 7. Finalize order ───────────────────────────────────────────
    await client.query(
      `UPDATE orders
       SET status = 'filled', executed_by = $1, executed_at = NOW(),
           updated_at = NOW(), broker_fee = $2
       WHERE id = $3`,
      [brokerId, fee, orderId]
    );

    // Refresh orderRow with latest data
    const refreshedOrderRes = await client.query(
      `SELECT * FROM orders WHERE id = $1`,
      [orderId]
    );
    const orderRow = refreshedOrderRes.rows[0];

    // ── 8. Create trade record ──────────────────────────────────────
    await client.query(
      `INSERT INTO trades (
         buyer_id, seller_id, security_id, quantity, price, total,
         broker_fee, created_at, status, order_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), 'settled', $8)`,
      [
        order.type === 'buy' ? order.investor_id : null,
        order.type === 'sell' ? order.investor_id : null,
        order.security_id, qty, prc, total, fee, orderId,
      ]
    );

    // ── 9. Wallet transaction log ───────────────────────────────────
    const txType = order.type === 'buy' ? 'debit' : 'credit';
    const netAmount = order.type === 'buy' ? total + fee : total - fee;
    await client.query(
      `INSERT INTO wallet_transactions (
         wallet_id, transaction_type, amount, reference_id, description, created_at
       ) VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        wallet.id, txType, netAmount, orderId,
        `${order.type.toUpperCase()} ${qty} ${security.symbol} @ M${prc.toFixed(2)} + M${fee.toFixed(2)} broker fee`
      ]
    );

    // ── 10. Investor notification ───────────────────────────────────
    await client.query(
      `INSERT INTO alerts (user_id, title, message, alert_type, created_at)
       VALUES ($1, $2, $3, 'success', NOW())`,
      [
        order.investor_id,
        `Order Filled: ${security.symbol}`,
        `Your ${order.type.toUpperCase()} of ${qty} ${security.symbol} @ M${prc.toFixed(2)} was executed.\nTrade total: M${total.toFixed(2)} | Broker fee (5%): M${fee.toFixed(2)} | Net: M${(order.type === 'buy' ? total + fee : total - fee).toFixed(2)}`
      ]
    );

    // ── 11. SAVE TO BLOCKCHAIN (the missing piece) ──────────────────
    let txHash = null;
    try {
      txHash = await recordTradeOnChain(orderRow);
      console.log(`[EXECUTE] On-chain tx for order #${orderId}: ${txHash || 'skipped'}`);

      // Optional: save hash directly to orders table
      if (txHash) {
        await client.query(
          `UPDATE orders SET onchain_tx_hash = $1 WHERE id = $2`,
          [txHash, orderId]
        );
      }
    } catch (blockchainErr) {
      console.error(`[EXECUTE] Blockchain recording failed for #${orderId}:`, blockchainErr.message);
      // Do NOT rollback DB - trade is still valid off-chain
      // You can add alert or retry logic here if needed
    }

    return {
      success: true,
      orderId,
      investorId: order.investor_id,
      type: order.type,
      symbol: security.symbol,
      quantity: qty,
      price: prc,
      total,
      txHash,
    };
  });
}
// ── Migration guard: ensure alerts table has all expected columns ─────────────
let _alertsColsEnsured = false;
async function ensureAlertsColumns() {
  if (_alertsColsEnsured) return;
  // Create the table from scratch if it doesn't exist at all
  await query(`
    CREATE TABLE IF NOT EXISTS alerts (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER NOT NULL,
      title      TEXT,
      message    TEXT,
      alert_type VARCHAR(50) NOT NULL DEFAULT 'info',
      is_read    BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `).catch(() => {});
  // Then patch any missing columns on an existing table
  await query(`ALTER TABLE alerts ADD COLUMN IF NOT EXISTS title      TEXT`).catch(() => {});
  await query(`ALTER TABLE alerts ADD COLUMN IF NOT EXISTS message    TEXT`).catch(() => {});
  await query(`ALTER TABLE alerts ADD COLUMN IF NOT EXISTS alert_type VARCHAR(50) NOT NULL DEFAULT 'info'`).catch(() => {});
  await query(`ALTER TABLE alerts ADD COLUMN IF NOT EXISTS is_read    BOOLEAN NOT NULL DEFAULT FALSE`).catch(() => {});
  await query(`ALTER TABLE alerts ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()`).catch(() => {});
  _alertsColsEnsured = true;
}

export async function submitPendingOrder(clientId, securityId, side, quantity, price) {
  await ensureAlertsColumns();
  // Input normalization & basic validation
  if (!['buy', 'sell'].includes(side)) {
    return { success: false, error: "Invalid order type (must be 'buy' or 'sell')" };
  }

  const qty = Number(quantity);
  const prc = Number(price);

  if (isNaN(qty) || qty <= 0 || !Number.isInteger(qty)) {
    return { success: false, error: "Quantity must be a positive integer" };
  }

  if (isNaN(prc) || prc <= 0) {
    return { success: false, error: "Price must be a positive number" };
  }

  const total = qty * prc;

  // Check broker assignment before opening the transaction
  await ensureBrokerAssignmentsTable();
  const brokerAssignment = await getRow(
    `SELECT broker_id FROM broker_assignments WHERE investor_id = $1 AND status = 'active'`,
    [clientId]
  );
  if (!brokerAssignment) {
    return { success: false, error: "You must select a dedicated broker before placing orders." };
  }

  try {
    return await withTransaction(async (client) => {
      // 1. Verify investor exists
      const investorRes = await client.query(
        `SELECT id FROM users WHERE id = $1`,
        [clientId]
      );
      if (investorRes.rowCount === 0) {
        throw new Error("Investor not found");
      }

      // 2. Check latest KYC is approved
      const kycRes = await client.query(
        `SELECT status FROM kyc_records
         WHERE user_id = $1
         ORDER BY submitted_at DESC LIMIT 1`,
        [clientId]
      );
      if (kycRes.rowCount === 0 || kycRes.rows[0].status !== "approved") {
        throw new Error("KYC not approved or not submitted");
      }

      // 3. Verify security exists (we don't lock or check availability yet — that's for execution)
      const securityRes = await client.query(
        `SELECT id, symbol, name, price 
         FROM securities WHERE id = $1`,
        [securityId]
      );
      if (securityRes.rowCount === 0) {
        throw new Error("Security not found");
      }
      const security = securityRes.rows[0];

      // Optional: warn if submitted price differs significantly from current market price
      const currentPrice = Number(security.price);
      if (Math.abs(prc - currentPrice) / currentPrice > 0.10) {
        console.warn(
          `[submitPendingOrder] Price deviation detected for ${security.symbol}: ` +
          `submitted ${prc.toFixed(2)}, current ${currentPrice.toFixed(2)}`
        );
        // You could also return a warning in the response if desired
      }

      // 4. Create the pending order
      const orderRes = await client.query(
        `INSERT INTO orders (
           investor_id, security_id, type, quantity, price, total,
           status, created_at, updated_at, payment_method
         ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', NOW(), NOW(), 'wallet')
         RETURNING id`,
        [clientId, securityId, side, qty, prc, total]
      );

      const orderId = orderRes.rows[0].id;

      // 5. Create broker/system alert (optional but very useful)
      await client.query(
        `INSERT INTO alerts (user_id, title, message, alert_type, created_at)
         VALUES ($1, $2, $3, 'info', NOW())`,
        [
          clientId,
          `Order Pending: ${security.symbol}`,
          `Your ${side.toUpperCase()} order for ${qty} ${security.symbol} @ M${prc.toFixed(2)} is pending broker review.`,
        ]
      );

      return {
        success: true,
        orderId,
        message: `Order #${orderId} submitted successfully – pending broker review`,
      };
    });
  } catch (err) {
    console.error("submitPendingOrder failed:", {
      clientId,
      securityId,
      side,
      quantity: qty,
      price: prc,
      error: err.message,
      code: err.code,
      detail: err.detail,
    });

    return {
      success: false,
      error: "Failed to submit order",
      message: err.message || "Internal server error",
    };
  }
}
// Broker places & executes order immediately (no pending)
// ──────────────────────────────────────────────────────────────
// Broker places & executes order immediately (direct fill)
// ──────────────────────────────────────────────────────────────
export async function placeAndExecuteOrder(brokerId, investorId, securityId, type, quantity, price) {
  await ensureBrokerFeeColumns();
  let finalOrderRow = null;   // ← This will hold the order after the transaction

  // Step 1: All database work inside transaction
  let result;
  try {
  result = await withTransaction(async (client) => {
    const total = Number(quantity) * Number(price);
    const qty = Number(quantity);
    const prc = Number(price);
    // 5% broker trading fee
    const fee = +(total * BROKER_FEE_RATE).toFixed(2);

    // 1. Create the filled order
   const insertRes = await client.query(`
  INSERT INTO orders (
    investor_id,
    security_id,
    quantity,
    price,
    payment_method,
    status,
    created_at,
    type,
    total,
    updated_at,
    executed_by,
    executed_at,
    onchain_tx_hash
  ) VALUES (
    $1, $2, $3, $4, $5,
    'filled',
    NOW(),
    $6,
    $7,
    NOW(),
    $8,
    NOW(),
    $9
  )
  RETURNING *
`, [
  investorId,
  securityId,
  qty,
  prc,
  null,   // payment_method — not supplied at this stage
  type,
  total,
  brokerId,
  null    // onchain_tx_hash — updated after blockchain call below
]);
    const orderRow = insertRes.rows[0];

    // 2. Get security details
    const securityRes = await client.query(
      `SELECT id, symbol FROM securities WHERE id = $1`,
      [securityId]
    );

    if (securityRes.rowCount === 0) throw new Error("Security not found");

    const security = securityRes.rows[0];

    // 3. Get active wallet
    const walletRes = await client.query(
      `SELECT id, balance FROM wallets 
       WHERE user_id = $1 AND status = 'active' LIMIT 1`,
      [investorId]
    );

    if (walletRes.rowCount === 0) throw new Error("No active wallet found for investor");

    const wallet = walletRes.rows[0];
    const currentBalance = Number(wallet.balance);

    // 4. Execute business logic (Buy or Sell)
    if (type === "buy") {
      if (currentBalance < total + fee) {
        throw new Error(`Insufficient funds. Balance: M${currentBalance.toFixed(2)}, Needed: M${(total + fee).toFixed(2)} (incl. 5% broker fee of M${fee.toFixed(2)})`);
      }

      // Compute TRUE available supply from the holdings table (immune to counter drift)
      const availRes = await client.query(
        `SELECT s.total_supply - COALESCE(SUM(h.quantity)::bigint, 0) AS available
         FROM securities s
         LEFT JOIN holdings h ON h.security_id = s.id
         WHERE s.id = $1
         GROUP BY s.total_supply`,
        [securityId]
      );
      const availableForBuy = availRes.rowCount
        ? Math.max(Number(availRes.rows[0].available), 0)
        : qty; // assume available if query fails
      if (availableForBuy < qty) {
        throw new Error(`Not enough tokens available (${availableForBuy} remaining, requested ${qty})`);
      }

      // Deduct trade total + broker fee from investor
      await client.query(
        `UPDATE wallets SET balance = balance - $1, updated_at = NOW() WHERE id = $2`,
        [total + fee, wallet.id]
      );

      // Reduce available tokens — NULL-safe
      await client.query(
        `UPDATE securities SET available_tokens = GREATEST(COALESCE(available_tokens, total_supply) - $1, 0) WHERE id = $2`,
        [qty, securityId]
      );

      // Update or insert holding
      const holdingRes = await client.query(
        `SELECT id, quantity, avg_price FROM holdings
         WHERE user_id = $1 AND security_id = $2`,
        [investorId, securityId]
      );
      if (holdingRes.rowCount > 0) {
        const h = holdingRes.rows[0];
        const newQty = Number(h.quantity) + qty;
        const newAvg = ((Number(h.avg_price) * Number(h.quantity)) + total) / newQty;
        await client.query(
          `UPDATE holdings SET quantity = $1, avg_price = $2, updated_at = NOW() WHERE id = $3`,
          [newQty, newAvg, h.id]
        );
      } else {
        await client.query(
          `INSERT INTO holdings (user_id, security_id, quantity, avg_price, created_at, updated_at)
           VALUES ($1, $2, $3, $4, NOW(), NOW())`,
          [investorId, securityId, qty, prc]
        );
      }
    }
    else if (type === "sell") {
      const holdingRes = await client.query(
        `SELECT id, quantity FROM holdings WHERE user_id = $1 AND security_id = $2`,
        [investorId, securityId]
      );
      if (holdingRes.rowCount === 0 || Number(holdingRes.rows[0].quantity) < qty) {
        throw new Error("Insufficient holdings to sell");
      }
      const holding = holdingRes.rows[0];
      const remaining = Number(holding.quantity) - qty;
      if (remaining > 0) {
        await client.query(
          `UPDATE holdings SET quantity = $1, updated_at = NOW() WHERE id = $2`,
          [remaining, holding.id]
        );
      } else {
        await client.query(`DELETE FROM holdings WHERE id = $1`, [holding.id]);
      }

      // Return tokens to pool — NULL-safe
      await client.query(
        `UPDATE securities SET available_tokens = LEAST(COALESCE(available_tokens, 0) + $1, total_supply) WHERE id = $2`,
        [qty, securityId]
      );

      // Credit proceeds minus broker fee to investor
      await client.query(
        `UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE id = $2`,
        [total - fee, wallet.id]
      );
    }
    else {
      throw new Error("Invalid order type");
    }

    // 4b. Credit broker fee to broker's wallet (best-effort)
    try {
      const brokerWalletRes = await client.query(
        `SELECT id FROM wallets WHERE user_id = $1 AND status = 'active' LIMIT 1`,
        [brokerId]
      );
      if (brokerWalletRes.rowCount > 0) {
        await client.query(
          `UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE id = $2`,
          [fee, brokerWalletRes.rows[0].id]
        );
        await client.query(
          `INSERT INTO wallet_transactions (wallet_id, transaction_type, amount, reference_id, description, created_at)
           VALUES ($1, 'credit', $2, $3, $4, NOW())`,
          [brokerWalletRes.rows[0].id, fee, orderRow.id,
           `Commission (5%): ${type.toUpperCase()} ${qty} ${security.symbol} for investor #${investorId}`]
        );
      }
    } catch (_) { /* broker has no wallet — fee recorded on order only */ }

    // Update order with broker_fee
    await client.query(
      `UPDATE orders SET broker_fee = $1 WHERE id = $2`,
      [fee, orderRow.id]
    );

    // 5. Create trade record (with broker_fee)
    await client.query(
      `INSERT INTO trades (
         buyer_id, seller_id, security_id, quantity, price, total,
         broker_fee, created_at, status, order_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), 'settled', $8)`,
      [
        type === 'buy' ? investorId : null,
        type === 'sell' ? investorId : null,
        securityId, qty, prc, total, fee, orderRow.id,
      ]
    );

    // 6. Wallet transaction log for investor
    const txType = type === 'buy' ? 'debit' : 'credit';
    const netAmount = type === 'buy' ? total + fee : total - fee;
    await client.query(
      `INSERT INTO wallet_transactions (wallet_id, transaction_type, amount, reference_id, description, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        wallet.id, txType, netAmount, orderRow.id,
        `${type.toUpperCase()} ${qty} ${security.symbol} @ M${prc.toFixed(2)} + M${fee.toFixed(2)} broker fee`
      ]
    );

    // 7. Alert to investor (with fee breakdown)
    await client.query(
      `INSERT INTO alerts (user_id, title, message, alert_type, created_at)
       VALUES ($1, $2, $3, 'success', NOW())`,
      [
        investorId,
        `Order Filled: ${security.symbol}`,
        `Your ${type.toUpperCase()} of ${qty} ${security.symbol} @ M${prc.toFixed(2)} was executed.\nTrade total: M${total.toFixed(2)} | Broker fee (5%): M${fee.toFixed(2)} | Net: M${netAmount.toFixed(2)}`
      ]
    );

    // 8. Fetch final order row for blockchain recording
    const finalRes = await client.query(`SELECT * FROM orders WHERE id = $1`, [orderRow.id]);
    finalOrderRow = finalRes.rows[0];

    return {
      success: true,
      orderId: orderRow.id,
      message: `Order #${orderRow.id} executed successfully`,
    };
  });

  } catch (txErr) {
    console.error('[placeAndExecuteOrder] Transaction failed:', txErr.message);
    return { success: false, error: txErr.message };
  }

  // Step 2: Blockchain recording — OUTSIDE the main transaction
  if (result?.success && finalOrderRow) {
    try {
      const txHash = await safelyRecordOnChain(finalOrderRow);
      result.txHash = txHash;

      if (txHash) {
        result.message += ` (On-chain: ${txHash})`;
      } else {
        result.message += ` (Off-chain only)`;
      }
    } catch (blockchainErr) {
      console.error(`[PLACE&EXECUTE] Blockchain failed for #${finalOrderRow.id}:`, blockchainErr.message);
      result.message += ` (Blockchain recording failed)`;
      // Do NOT throw — trade is already successful off-chain
    }
  }

  return result;
}// ──────────────────────────────────────────────────────────────
// SAFE BLOCKCHAIN RECORDING - ALWAYS AFTER MAIN DB TRANSACTION
// ──────────────────────────────────────────────────────────────
// recordTradeOnChain() already handles the full onchain_trade_records
// upsert internally (saveChainRecord).  This wrapper only needs to:
//   1. Call recordTradeOnChain
//   2. Stamp orders.onchain_tx_hash for quick lookup
async function safelyRecordOnChain(orderRow) {
  if (!orderRow?.id) {
    console.warn("[BLOCKCHAIN] Skipping: missing orderRow.id");
    return null;
  }

  const orderId = orderRow.id;

  try {
    console.log(`[BLOCKCHAIN] Attempting to record order #${orderId}`);

    const txHash = await recordTradeOnChain(orderRow);

    if (!txHash) {
      console.log(`[BLOCKCHAIN] Skipped for #${orderId} (no txHash returned)`);
      return null;
    }

    console.log(`[BLOCKCHAIN] Success for #${orderId} → ${txHash}`);

    // Stamp the orders row so dashboards can show the tx hash directly
    try {
      await pool.query(
        `UPDATE orders SET onchain_tx_hash = $1 WHERE id = $2`,
        [txHash, orderId]
      );
    } catch (updateErr) {
      // Non-fatal — the onchain_trade_records row is the canonical record
      console.warn(`[BLOCKCHAIN] Could not stamp orders.onchain_tx_hash for #${orderId}:`, updateErr.message);
    }

    return txHash;

  } catch (err) {
    console.error(`[BLOCKCHAIN] Failed for order #${orderId}:`, err.message);
    return null;
  }
}

///new


// Add these functions
// Get all KYC documents for a user
// @/lib/store.js  (or wherever your store functions are)
/*export async function getKycDocuments(userId) {
  try {
    if (!userId) throw new Error("User ID is required");

    const query = `
      SELECT 
        id,
        document_type,
        document_number,
        document_url AS url,
        status,
        created_at AS uploaded_at,
        kyc_record_id
      FROM kyc_documents 
      WHERE user_id = $1
      ORDER BY created_at DESC
    `;

    const result = await db.query(query, [userId]);

    console.log(`✅ Fetched ${result.rows?.length || 0} KYC documents for user ${userId}`);

    return result.rows || [];
  } catch (error) {
    console.error("❌ Database Error in getKycDocuments:", error);
    throw new Error(`Failed to load documents: ${error.message}`);
  }
}*/

// Get KYC documents - FIXED VERSION
export async function getKycDocuments(userId) {
  try {
    if (!userId) throw new Error("User ID is required");

    const sql = `
      SELECT 
        id,
        document_type,
        document_number,
        document_url,
        status,
        created_at AS uploaded_at,
        kyc_record_id
      FROM kyc_documents 
      WHERE user_id = $1 
      ORDER BY created_at DESC
    `;

    const result = await db.query(sql, [Number(userId)]);

    console.log(`[getKycDocuments] User ${userId} → ${result.rows.length} documents found`);

    // Optional: log first few for debugging
    if (result.rows.length > 0) {
      console.log("First document sample:", result.rows[0]);
    }

    return result.rows || [];
  } catch (error) {
    console.error(`[getKycDocuments] Failed for user ${userId}:`, error);
    throw error;
  }
}

// getListingDocuments - Shows listing details when no real documents exist
export async function getListingDocuments(listingId) {
  try {
    const result = await db.query(
      `SELECT 
         id, 
         name, 
         symbol, 
         type, 
         sector,
         total_supply,
         price,
         description,
         created_at
       FROM securities 
       WHERE id = $1`,
      [listingId]
    );

    if (result.rows.length === 0) return [];

    const listing = result.rows[0];

    return [{
      document_type: "listing_details",
      listing_name: listing.name,
      symbol: listing.symbol,
      type: listing.type || "Equity",
      sector: listing.sector || "N/A",
      total_supply: listing.total_supply,
      price: listing.price,
      description: listing.description || "No description provided.",
      submitted_at: listing.created_at
    }];

  } catch (err) {
    console.error("getListingDocuments error:", err);
    return [];
  }
}

export async function getIssuerWallet(issuerId) {
  const wallet = issuerWallets[issuerId];

  if (!wallet) {
    return { error: `No wallet found for issuer ${issuerId}` };
  }

  return {
    success: true,
    walletAddress: wallet,
  };
}


// ─────────────────────────────────────────────────────────────
// BROKER ↔ INVESTOR ASSIGNMENTS
// ─────────────────────────────────────────────────────────────

async function ensureBrokerAssignmentsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS broker_assignments (
      id          SERIAL PRIMARY KEY,
      investor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      broker_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status      TEXT NOT NULL DEFAULT 'active',
      assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT one_broker_per_investor UNIQUE (investor_id)
    )
  `);
}

/** List all brokers (for investor to pick from) */
export async function getBrokers() {
  await ensureBrokerAssignmentsTable();
  return getRows(
    `SELECT u.id, u.full_name, u.email
       FROM users u
       JOIN roles r ON r.id = u.role_id
      WHERE r.role_name = 'broker'
        AND u.is_active = true
      ORDER BY u.full_name`
  );
}

/** Get the broker currently assigned to an investor */
export async function getMyBroker(investorId) {
  await ensureBrokerAssignmentsTable();
  return getRow(
    `SELECT ba.*, u.full_name AS broker_name, u.email AS broker_email
       FROM broker_assignments ba
       JOIN users u ON u.id = ba.broker_id
      WHERE ba.investor_id = $1 AND ba.status = 'active'`,
    [investorId]
  );
}

/** Assign (or re-assign) a broker to an investor */
export async function assignBroker(investorId, brokerId) {
  await ensureBrokerAssignmentsTable();
  const broker = await getRow(
    `SELECT u.id, u.full_name
       FROM users u
       JOIN roles r ON r.id = u.role_id
      WHERE u.id = $1 AND r.role_name = 'broker'`,
    [brokerId]
  );
  if (!broker) return { error: 'Broker not found or invalid role' };

  await query(
    `INSERT INTO broker_assignments (investor_id, broker_id)
     VALUES ($1, $2)
     ON CONFLICT (investor_id) DO UPDATE
       SET broker_id   = EXCLUDED.broker_id,
           assigned_at = NOW(),
           status      = 'active'`,
    [investorId, brokerId]
  );
  return { success: true, broker_name: broker.full_name };
}

/** Get all investors assigned to a given broker (by broker's user id) */
export async function getBrokerClients(brokerUserId) {
  await ensureBrokerAssignmentsTable();
  return getRows(
    `SELECT u.id, u.full_name, u.email, u.created_at, u.kyc_status, u.phone, u.is_active,
            ba.assigned_at, ba.status AS assignment_status
       FROM broker_assignments ba
       JOIN users u ON u.id = ba.investor_id
      WHERE ba.broker_id = $1 AND ba.status = 'active'
      ORDER BY ba.assigned_at DESC`,
    [brokerUserId]
  );
}

/** Aggregate fee earnings for a broker across all orders they executed */
export async function getBrokerEarnings(brokerUserId) {
  await ensureBrokerFeeColumns();
  try {
    const rows = await getRows(
      `SELECT
         o.id            AS order_id,
         o.created_at,
         o.type,
         o.quantity,
         o.price,
         o.total,
         o.broker_fee,
         s.symbol        AS security_symbol,
         s.name          AS security_name,
         u.full_name     AS investor_name
       FROM orders o
       JOIN securities s ON s.id = o.security_id
       LEFT JOIN users u   ON u.id = o.investor_id
       WHERE o.executed_by = $1
         AND o.status = 'filled'
         AND o.broker_fee > 0
       ORDER BY o.created_at DESC`,
      [brokerUserId]
    );
    const totalEarned = rows.reduce((sum, r) => sum + Number(r.broker_fee ?? 0), 0);
    return { earnings: rows, totalEarned: +totalEarned.toFixed(2) };
  } catch (err) {
    console.error('[getBrokerEarnings] failed:', err.message);
    return { earnings: [], totalEarned: 0 };
  }
}

// ─────────────────────────────────────────────────────────────
//  SAFE FETCH HELPER
// ─────────────────────────────────────────────────────────────
async function safeFetchJson(url, options = {}) {
  try {
    const res = await fetch(url, options);

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`API Error ${res.status} [${url}]:`, errorText.slice(0, 300));
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      console.error("Invalid JSON from", url);
      console.error("Raw:", text.slice(0, 400));
      throw new Error("Server returned invalid JSON response");
    }
  } catch (err) {
    console.error(`safeFetchJson failed for ${url}:`, err);
    throw err;
  }
}

// ────────────────────────────────────────────────
// Export authFetch for future use (buy/sell/etc.)
// ────────────────────────────────────────────────
export { authFetch };

// ─────────────────────────────────────────────────────────────────────────────
// DIVIDENDS
// ─────────────────────────────────────────────────────────────────────────────

async function ensureDividendTables() {
  // Create tables if they don't exist yet
  await query(`
    CREATE TABLE IF NOT EXISTS dividends (
      id               SERIAL PRIMARY KEY,
      security_id      INTEGER NOT NULL REFERENCES securities(id),
      amount_per_share NUMERIC(18,6) NOT NULL,
      record_date      DATE NOT NULL,
      payment_date     DATE NOT NULL,
      status           TEXT NOT NULL DEFAULT 'declared',
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS dividend_payments (
      id          SERIAL PRIMARY KEY,
      dividend_id INTEGER NOT NULL REFERENCES dividends(id),
      investor_id INTEGER NOT NULL REFERENCES users(id),
      security_id INTEGER NOT NULL REFERENCES securities(id),
      shares_held NUMERIC(18,6) NOT NULL,
      amount      NUMERIC(18,2) NOT NULL,
      status      TEXT NOT NULL DEFAULT 'pending',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Migrate: add columns that may be missing from an older schema
  const migrations = [
    `ALTER TABLE dividends ADD COLUMN IF NOT EXISTS declared_by      INTEGER REFERENCES users(id)`,
    `ALTER TABLE dividends ADD COLUMN IF NOT EXISTS declaration_date TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
    `ALTER TABLE dividends ADD COLUMN IF NOT EXISTS ex_dividend_date DATE`,
    `ALTER TABLE dividends ADD COLUMN IF NOT EXISTS total_payout     NUMERIC(18,2)`,
    `ALTER TABLE dividends ADD COLUMN IF NOT EXISTS notes            TEXT`,
    `ALTER TABLE dividends ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
    `ALTER TABLE dividends ADD COLUMN IF NOT EXISTS onchain_tx_hash  TEXT`,
    // dividend_payments — columns added in later schema versions (nullable so existing rows are unaffected)
    `ALTER TABLE dividend_payments ADD COLUMN IF NOT EXISTS investor_id INTEGER REFERENCES users(id)`,
    `ALTER TABLE dividend_payments ADD COLUMN IF NOT EXISTS security_id INTEGER REFERENCES securities(id)`,
    `ALTER TABLE dividend_payments ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'`,
    `ALTER TABLE dividend_payments ADD COLUMN IF NOT EXISTS shares_held NUMERIC(18,6)`,
    `ALTER TABLE dividend_payments ADD COLUMN IF NOT EXISTS amount NUMERIC(18,2)`,
    `ALTER TABLE dividend_payments ADD COLUMN IF NOT EXISTS wallet_transaction_id INTEGER`,
    `ALTER TABLE dividend_payments ADD COLUMN IF NOT EXISTS paid_at  TIMESTAMPTZ`,
  ];
  for (const sql of migrations) {
    try { await query(sql); } catch (_) { /* column already exists or other non-fatal issue */ }
  }
}

// ── Helper: income-type terminology for a given security type ─────────────────
function dividendTerms(securityType) {
  const t = (securityType || '').toLowerCase();
  if (t === 'bond' || t === 'debt') return { label: 'Interest',     unitWord: 'token',  verb: 'Pay Interest' };
  if (t === 'fund')                 return { label: 'Distribution', unitWord: 'unit',   verb: 'Pay Distribution' };
  return                                   { label: 'Dividend',     unitWord: 'share',  verb: 'Pay Dividend' };
}

// ── Blockchain recording for dividend settlements ─────────────────────────────
async function recordDividendOnChain(dividendId, div, totalPaid) {
  try {
    const { ethers }        = await import('ethers');
    const { SECURITY_TOKEN_REGISTRY_ABI } = await import('@/blockchain/contracts/SecurityTokenRegistry');

    const rpcUrl          = process.env.BLOCKCHAIN_RPC_URL  || 'http://127.0.0.1:8545';
    const privateKey      = process.env.BACKEND_PRIVATE_KEY;
    const contractAddress = process.env.TRADE_REGISTRY_ADDRESS;
    const chainId         = BigInt(process.env.BLOCKCHAIN_CHAIN_ID || '1337');

    if (!privateKey || !contractAddress) {
      console.warn('[DIVIDEND CHAIN] Env vars missing — skipping blockchain record');
      return null;
    }

    const network  = new ethers.Network('besu-qbft', chainId);
    const provider = new ethers.JsonRpcProvider(rpcUrl, network, { staticNetwork: network });
    const signer   = new ethers.Wallet(privateKey, provider);
    const contract = new ethers.Contract(contractAddress, SECURITY_TOKEN_REGISTRY_ABI, signer);

    // Unique tradeId derived from dividendId so retries are idempotent
    const tradeId  = ethers.keccak256(ethers.toUtf8Bytes(`dividend-${dividendId}`));
    const qty      = BigInt(Math.round(totalPaid * 1e6));
    const price    = BigInt(Math.round(parseFloat(div.amount_per_share) * 1e6));
    const symbol   = (div.security_symbol || `SEC-${div.security_id}`).slice(0, 12);
    const dataHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify({
      dividendId, securityId: div.security_id,
      amountPerShare: div.amount_per_share, totalPaid,
    })));

    const nonce  = await provider.getTransactionCount(await signer.getAddress(), 'latest').catch(() => undefined);
    const txOpts = { gasLimit: 300_000, gasPrice: 0n, ...(nonce !== undefined && { nonce }) };

    const tx = await contract.recordTrade(
      tradeId,
      ethers.ZeroAddress, // no single buyer — batch distribution
      ethers.ZeroAddress,
      qty, price, symbol, dataHash,
      txOpts,
    );

    // Wait up to 35 s for one confirmation; on timeout keep the submitted hash
    let txHash = tx.hash;
    try {
      await Promise.race([
        tx.wait(1),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 35_000)),
      ]);
    } catch { /* timeout or revert — hash already captured above */ }

    await provider.destroy();
    console.log(`[DIVIDEND CHAIN] Dividend #${dividendId} recorded — tx: ${txHash}`);
    return txHash;
  } catch (err) {
    console.error(`[DIVIDEND CHAIN] Failed for dividend #${dividendId}:`, err.message);
    return null;
  }
}

/**
 * Fetch dividends visible to the calling user.
 * role: 'issuer' | 'investor' | 'admin' | 'regulator'
 */
// ══════════════════════════════════════════════════════════════════════════════
// REGULATORY REPORTING SYSTEM
// ══════════════════════════════════════════════════════════════════════════════

async function ensureReportTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS issuer_reports (
      id            SERIAL PRIMARY KEY,
      issuer_id     INTEGER NOT NULL REFERENCES issuers(id) ON DELETE CASCADE,
      user_id       INTEGER NOT NULL REFERENCES users(id),
      security_id   INTEGER REFERENCES securities(id),
      report_type   TEXT    NOT NULL CHECK (report_type IN ('quarterly','annual','current')),
      title         TEXT    NOT NULL,
      description   TEXT,
      period_start  DATE,
      period_end    DATE,
      due_date      DATE,
      filed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      status        TEXT    NOT NULL DEFAULT 'submitted'
                            CHECK (status IN ('submitted','accepted','rejected')),
      notes         TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `).catch(() => {});
  // idempotent column guards
  for (const col of [
    `ALTER TABLE issuer_reports ADD COLUMN IF NOT EXISTS security_id INTEGER REFERENCES securities(id)`,
    `ALTER TABLE issuer_reports ADD COLUMN IF NOT EXISTS notes TEXT`,
    `ALTER TABLE issuer_reports ADD COLUMN IF NOT EXISTS document_url TEXT`,
    `ALTER TABLE issuer_reports ADD COLUMN IF NOT EXISTS document_name TEXT`,
  ]) await query(col).catch(() => {});
}

/** Compute upcoming/due/overdue deadlines for a given issuer based on their listed securities. */
function computeDeadlines(listedSinceDate) {
  const now   = new Date();
  const year  = now.getFullYear();
  const deadlines = [];

  // Annual report: due 90 days after December 31 of previous year
  const annualPeriodEnd = new Date(year - 1, 11, 31);
  const annualDue       = new Date(year - 1, 11, 31);
  annualDue.setDate(annualDue.getDate() + 90);
  if (new Date(listedSinceDate) <= annualPeriodEnd) {
    deadlines.push({
      id:           `annual-${year - 1}`,
      report_type:  'annual',
      label:        `Annual Report ${year - 1}`,
      period_start: new Date(year - 1, 0, 1),
      period_end:   annualPeriodEnd,
      due_date:     annualDue,
    });
  }

  // Quarterly reports Q1–Q3 (Q4 is covered by Annual)
  const quarters = [
    { q: 1, periodEnd: new Date(year, 2, 31),  daysAfter: 45 },
    { q: 2, periodEnd: new Date(year, 5, 30),  daysAfter: 45 },
    { q: 3, periodEnd: new Date(year, 8, 30),  daysAfter: 45 },
  ];
  for (const { q, periodEnd, daysAfter } of quarters) {
    if (new Date(listedSinceDate) > periodEnd) continue; // not yet listed during this period
    const due = new Date(periodEnd);
    due.setDate(due.getDate() + daysAfter);
    deadlines.push({
      id:           `q${q}-${year}`,
      report_type:  'quarterly',
      label:        `Q${q} ${year} Quarterly Report`,
      period_start: q === 1 ? new Date(year, 0, 1) : new Date(year, (q - 1) * 3, 1),
      period_end:   periodEnd,
      due_date:     due,
    });
  }

  return deadlines.map(d => {
    const daysLeft = Math.ceil((d.due_date - now) / 86400000);
    return {
      ...d,
      days_left:  daysLeft,
      urgency:    daysLeft < 0 ? 'overdue' : daysLeft <= 7 ? 'critical' : daysLeft <= 30 ? 'warning' : 'ok',
    };
  }).sort((a, b) => a.due_date - b.due_date);
}

/** Get report deadlines for an issuer (pass the earliest listing date). */
export async function getReportDeadlines(issuerId) {
  try {
    await ensureReportTables();
    // Find earliest approved security listing date for this issuer
    const secRes = await getRow(
      `SELECT MIN(created_at)::date AS listed_since FROM securities WHERE issuer_id = $1 AND approved = TRUE`,
      [issuerId]
    );
    const listedSince = secRes?.listed_since || new Date().toISOString();
    const deadlines   = computeDeadlines(listedSince);

    // Fetch already-filed reports to mark deadlines as filed
    const filed = await getRows(
      `SELECT report_type, period_end FROM issuer_reports WHERE issuer_id = $1`,
      [issuerId]
    );

    return deadlines.map(d => {
      const match = filed.find(f =>
        f.report_type === d.report_type &&
        Math.abs(new Date(f.period_end) - d.period_end) < 86400000 * 5
      );
      return { ...d, filed: !!match, filed_at: match ? match.filed_at : null };
    });
  } catch (err) {
    console.error('getReportDeadlines failed:', err);
    return [];
  }
}

/** Submit a new report from an issuer. */
export async function submitReport(userId, issuerId, data) {
  await ensureReportTables();
  const { report_type, title, description, period_start, period_end, due_date, security_id, notes, document_url, document_name } = data;

  if (!['quarterly','annual','current'].includes(report_type))
    return { error: 'Invalid report type' };
  if (!title?.trim()) return { error: 'Title is required' };
  if (!document_url) return { error: 'A supporting document (PDF or Excel) is required.' };

  const row = await getRow(
    `INSERT INTO issuer_reports
       (issuer_id, user_id, security_id, report_type, title, description,
        period_start, period_end, due_date, notes, document_url, document_name, filed_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
     RETURNING *`,
    [issuerId, userId, security_id || null, report_type, title.trim(),
     description || null, period_start || null, period_end || null,
     due_date || null, notes || null, document_url || null, document_name || null]
  );

  // Notify regulator(s) via alert
  try {
    await ensureAlertsColumns();
    const regulators = await getRows(`SELECT id FROM users WHERE role_id = 4`);
    for (const reg of regulators) {
      await query(
        `INSERT INTO alerts (user_id, title, message, alert_type, created_at)
         VALUES ($1,$2,$3,'info',NOW())`,
        [reg.id,
         `New ${report_type.charAt(0).toUpperCase() + report_type.slice(1)} Report Filed`,
         `Issuer #${issuerId} has submitted: "${title.trim()}"`]
      );
    }
  } catch (_) { /* non-fatal */ }

  return { success: true, report: row };
}

/** Fetch all reports for an issuer. */
export async function getIssuerReports(issuerId) {
  await ensureReportTables();
  return getRows(
    `SELECT r.*, s.symbol AS security_symbol, s.name AS security_name
       FROM issuer_reports r
       LEFT JOIN securities s ON s.id = r.security_id
      WHERE r.issuer_id = $1
      ORDER BY r.filed_at DESC`,
    [issuerId]
  );
}

/** Fetch ALL reports across all issuers — for regulators. */
export async function getAllReports() {
  await ensureReportTables();
  return getRows(
    `SELECT r.*,
            i.company_name AS issuer_name,
            s.symbol       AS security_symbol,
            s.name         AS security_name
       FROM issuer_reports r
       JOIN issuers   i ON i.id = r.issuer_id
       LEFT JOIN securities s ON s.id = r.security_id
      ORDER BY r.filed_at DESC`
  ).catch(() => []);
}

/** Get all issuer deadlines overview — for regulators. */
export async function getAllIssuerDeadlines() {
  try {
    await ensureReportTables();
    const issuers = await getRows(
      `SELECT i.id, i.company_name, MIN(s.created_at)::date AS listed_since
         FROM issuers i
         LEFT JOIN securities s ON s.issuer_id = i.id AND s.approved = TRUE
        GROUP BY i.id, i.company_name`
    );

    const result = [];
    for (const issuer of issuers) {
      if (!issuer.listed_since) continue;
      const deadlines = computeDeadlines(issuer.listed_since);
      const filed = await getRows(
        `SELECT report_type, period_end FROM issuer_reports WHERE issuer_id = $1`,
        [issuer.id]
      );
      const enriched = deadlines.map(d => {
        const match = filed.find(f =>
          f.report_type === d.report_type &&
          Math.abs(new Date(f.period_end) - d.period_end) < 86400000 * 5
        );
        return { ...d, filed: !!match };
      });
      result.push({ issuer_id: issuer.id, company_name: issuer.company_name, deadlines: enriched });
    }
    return result;
  } catch (err) {
    console.error('getAllIssuerDeadlines failed:', err);
    return [];
  }
}

export async function getDividends(userId, role, securityId = null) {
  await ensureDividendTables();
  // Ensure security_type column exists on securities (added when type-aware dividends introduced)
  await query(`ALTER TABLE securities ADD COLUMN IF NOT EXISTS security_type TEXT DEFAULT 'shares'`).catch(() => {});
  try {
    let sql = `
      SELECT d.*,
             s.name          AS security_name,
             s.symbol        AS security_symbol,
             s.price         AS price_per_unit,
             s.security_type AS security_type,
             u.full_name     AS declared_by_name
        FROM dividends d
        JOIN securities s ON s.id = d.security_id
        LEFT JOIN users u ON u.id = d.declared_by
    `;
    const params = [];
    const where  = [];

    if (role === 'issuer') {
      where.push(`s.issuer_id = (SELECT id FROM issuers WHERE user_id = $${params.length + 1} LIMIT 1)`);
      params.push(userId);
    } else if (role === 'investor') {
      where.push(`d.security_id IN (SELECT security_id FROM holdings WHERE user_id = $${params.length + 1} AND quantity > 0)`);
      params.push(userId);
    }

    if (securityId) {
      where.push(`d.security_id = $${params.length + 1}`);
      params.push(securityId);
    }

    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY d.created_at DESC';

    return await getRows(sql, params);
  } catch (err) {
    console.error('getDividends failed:', err);
    return [];
  }
}

/**
 * Declare a new dividend. Only issuers/admins.
 */
export async function declareDividend(userId, role, data) {
  await ensureDividendTables();
  const { security_id, amount_per_share, notes, immediate = false } = data;
  let { ex_dividend_date, record_date, payment_date } = data;

  // Ownership check for issuers
  if (role === 'issuer') {
    const secRes = await query(
      `SELECT i.user_id FROM securities s JOIN issuers i ON i.id = s.issuer_id WHERE s.id = $1`,
      [security_id]
    );
    if (!secRes.rows.length || secRes.rows[0].user_id !== userId)
      return { error: 'You can only declare dividends for your own securities' };
  }

  const secRes = await query(
    `SELECT total_supply, available_tokens, symbol, name, approved, security_type FROM securities WHERE id = $1`,
    [security_id]
  );
  if (!secRes.rows.length) return { error: 'Security not found' };
  const sec = secRes.rows[0];
  if (!sec.approved) return { error: 'Security must be approved before declaring payments' };

  const terms = dividendTerms(sec.security_type);
  const isBondLike = ['bond','debt'].includes((sec.security_type || '').toLowerCase());

  // Immediate payment: override all dates to today, skip ordering validation
  if (immediate) {
    const todayStr = new Date().toISOString().split('T')[0];
    ex_dividend_date = isBondLike ? null : todayStr;
    record_date      = todayStr;
    payment_date     = todayStr;
  } else {
    // Bonds/debt don't use ex-dividend dates
    if (!isBondLike) {
      if (!ex_dividend_date) return { error: `${terms.label} declarations require an ex-dividend date` };
      if (new Date(ex_dividend_date) > new Date(record_date))
        return { error: 'Ex-dividend date must be on or before the record date' };
    }
    if (new Date(record_date) > new Date(payment_date))
      return { error: 'Record date must be on or before the payment date' };
  }

  const circulating = parseFloat(sec.total_supply) - parseFloat(sec.available_tokens || 0);
  const totalPayout = (circulating * parseFloat(amount_per_share)).toFixed(2);

  const result = await query(
    `INSERT INTO dividends
       (security_id, declared_by, amount_per_share, ex_dividend_date, record_date, payment_date, total_payout, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [security_id, userId, amount_per_share,
     isBondLike ? null : (ex_dividend_date || null),
     record_date, payment_date, totalPayout, notes || null]
  );

  return {
    success: true,
    immediate,
    message: immediate
      ? `${terms.label} declared for ${sec.symbol} — processing immediately`
      : `${terms.label} declared for ${sec.symbol} — M${amount_per_share} per ${terms.unitWord}`,
    dividend: { ...result.rows[0], security_symbol: sec.symbol, security_name: sec.name },
  };
}

/**
 * Process (pay out) a dividend — credits every eligible holder's wallet.
 */
export async function processDividend(dividendId, actorId) {
  await ensureDividendTables();
  await ensureAlertsColumns();

  const divRes = await query(
    `SELECT d.*, s.symbol AS security_symbol, s.name AS security_name,
            s.security_type AS security_type, i.user_id AS issuer_user_id
       FROM dividends d
       JOIN securities s ON s.id = d.security_id
       JOIN issuers    i ON i.id = s.issuer_id
      WHERE d.id = $1`,
    [dividendId]
  );
  if (!divRes.rows.length) return { error: 'Dividend not found' };
  const div = divRes.rows[0];

  if (div.status === 'paid')      return { error: 'Already paid' };
  if (div.status === 'cancelled') return { error: 'Dividend cancelled' };

  const holdersRes = await query(
    `SELECT h.user_id,
            h.quantity                AS shares_held,
            ROUND(h.quantity * $2, 2) AS amount,
            w.id                      AS wallet_id
       FROM holdings h
       JOIN wallets  w ON w.user_id = h.user_id AND w.status = 'active'
      WHERE h.security_id = $1 AND h.quantity > 0
        AND h.updated_at <= ($3::date + INTERVAL '1 day')`,
    [div.security_id, div.amount_per_share, div.record_date]
  );

  if (!holdersRes.rows.length) {
    await query(`UPDATE dividends SET status='paid', total_payout=0, updated_at=NOW() WHERE id=$1`, [dividendId]);
    return { success: true, message: 'No eligible shareholders. Dividend marked paid.', paid: 0 };
  }

  let paidCount = 0;
  let totalPaid = 0;

  const terms = dividendTerms(div.security_type);

  await withTransaction(async (client) => {
    await client.query(`UPDATE dividends SET status='processing', updated_at=NOW() WHERE id=$1`, [dividendId]);

    for (const { user_id, shares_held, amount, wallet_id } of holdersRes.rows) {
      if (!wallet_id || parseFloat(amount) <= 0) continue;
      // SAVEPOINT per investor so one failure doesn't abort the whole transaction
      const sp = `sp_div_${user_id}`;
      await client.query(`SAVEPOINT ${sp}`);
      try {
        await client.query(
          `UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE id = $2`,
          [amount, wallet_id]
        );
        const txRes = await client.query(
          `INSERT INTO wallet_transactions (wallet_id, transaction_type, amount, reference_id, description, created_at)
           VALUES ($1,'credit',$2,$3,$4,NOW()) RETURNING id`,
          // reference_id is an integer column — pass the dividend's numeric id
          [wallet_id, amount, dividendId,
           `${terms.label} DIV-${dividendId}: ${div.security_symbol} @ M${div.amount_per_share}/${terms.unitWord} × ${shares_held} ${terms.unitWord}s`]
        );
        await client.query(
          `INSERT INTO dividend_payments (dividend_id, investor_id, security_id, shares_held, amount, status, wallet_transaction_id, paid_at)
           VALUES ($1,$2,$3,$4,$5,'paid',$6,NOW())`,
          [dividendId, user_id, div.security_id, shares_held, amount, txRes.rows[0]?.id ?? null]
        );
        await client.query(
          `INSERT INTO alerts (user_id, title, message, alert_type, created_at) VALUES ($1,$2,$3,'success',NOW())`,
          [user_id, `${terms.label} Payment: ${div.security_symbol}`,
           `You received M${amount} — ${shares_held} ${terms.unitWord}s × M${div.amount_per_share} per ${terms.unitWord}.`]
        );
        await client.query(`RELEASE SAVEPOINT ${sp}`);
        paidCount++;
        totalPaid += parseFloat(amount);
      } catch (e) {
        console.error(`[DIVIDEND] Failed for investor ${user_id}:`, e.message);
        // Roll back only this investor's work, keeping the transaction alive
        await client.query(`ROLLBACK TO SAVEPOINT ${sp}`);
        await client.query(`RELEASE SAVEPOINT ${sp}`);
        // Record the failure row (transaction is clean again after rollback-to-savepoint)
        // Wrap failure-record INSERT in its own savepoint so a second failure
        // doesn't put the connection back into aborted state
        const failSp = `sp_div_fail_${user_id}`;
        await client.query(`SAVEPOINT ${failSp}`);
        try {
          await client.query(
            `INSERT INTO dividend_payments (dividend_id, investor_id, security_id, shares_held, amount, status, paid_at)
             VALUES ($1,$2,$3,$4,$5,'failed',NOW())`,
            [dividendId, user_id, div.security_id, shares_held, amount]
          );
          await client.query(`RELEASE SAVEPOINT ${failSp}`);
        } catch (e2) {
          await client.query(`ROLLBACK TO SAVEPOINT ${failSp}`);
          await client.query(`RELEASE SAVEPOINT ${failSp}`);
          console.error(`[DIVIDEND] Could not record failure for investor ${user_id}:`, e2.message);
        }
      }
    }

    // Final status update — also savepointed in case a per-investor failure
    // somehow left the connection dirty despite savepoint cleanup above
    await client.query(`SAVEPOINT sp_div_final`);
    try {
      await client.query(
        `UPDATE dividends SET status='paid', total_payout=$2, updated_at=NOW() WHERE id=$1`,
        [dividendId, totalPaid.toFixed(2)]
      );
      await client.query(`RELEASE SAVEPOINT sp_div_final`);
    } catch (e) {
      await client.query(`ROLLBACK TO SAVEPOINT sp_div_final`);
      await client.query(`RELEASE SAVEPOINT sp_div_final`);
      console.error('[DIVIDEND] Failed to mark dividend as paid:', e.message);
      throw e; // re-throw so withTransaction rolls back fully
    }
  });

  // Record settlement on-chain (non-blocking — DB is already committed)
  let chainTxHash = null;
  if (paidCount > 0) {
    chainTxHash = await recordDividendOnChain(dividendId, div, totalPaid);
    if (chainTxHash) {
      await query(
        `UPDATE dividends SET onchain_tx_hash=$2, updated_at=NOW() WHERE id=$1`,
        [dividendId, chainTxHash]
      ).catch((e) => console.error('[DIVIDEND CHAIN] Failed to stamp tx hash:', e.message));
    }
  }

  return {
    success: true,
    message: `${terms.label} processed — M${totalPaid.toFixed(2)} paid to ${paidCount} holder(s)${chainTxHash ? ` · TX: ${chainTxHash.slice(0, 10)}…` : ''}`,
    paid_count: paidCount,
    total_paid: totalPaid.toFixed(2),
    onchain_tx_hash: chainTxHash,
  };
}

/**
 * Fetch per-investor payment amounts for a specific dividend.
 */
export async function getDividendPayments(dividendId, investorId = null) {
  await ensureDividendTables();
  try {
    const params = [dividendId];
    let sql = `
      SELECT dp.*, u.full_name AS investor_name
        FROM dividend_payments dp
        JOIN users u ON u.id = dp.investor_id
       WHERE dp.dividend_id = $1
    `;
    if (investorId) { sql += ` AND dp.investor_id = $2`; params.push(investorId); }
    sql += ' ORDER BY dp.amount DESC';
    return await getRows(sql, params);
  } catch (err) {
    console.error('getDividendPayments failed:', err);
    return [];
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PRIMARY MARKET — OFFERINGS (IPO / FPO / Private Placement)
// ══════════════════════════════════════════════════════════════════════════════

async function ensureOfferingTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS offerings (
      id                  SERIAL PRIMARY KEY,
      security_id         INTEGER NOT NULL REFERENCES securities(id),
      issuer_id           INTEGER NOT NULL REFERENCES issuers(id),
      offering_type       TEXT NOT NULL DEFAULT 'ipo' CHECK (offering_type IN ('ipo','fpo','private_placement')),
      shares_offered      NUMERIC(18,0) NOT NULL,
      price_per_share     NUMERIC(18,4) NOT NULL,
      min_investment      NUMERIC(18,0) NOT NULL DEFAULT 1,
      max_investment      NUMERIC(18,0),
      subscription_start  DATE NOT NULL,
      subscription_end    DATE NOT NULL,
      status              TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','settled','cancelled')),
      total_raised        NUMERIC(18,2) DEFAULT 0,
      shares_allocated    NUMERIC(18,0) DEFAULT 0,
      description         TEXT,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `).catch(() => {});
  await query(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id            SERIAL PRIMARY KEY,
      offering_id   INTEGER NOT NULL REFERENCES offerings(id) ON DELETE CASCADE,
      investor_id   INTEGER NOT NULL REFERENCES users(id),
      quantity      NUMERIC(18,0) NOT NULL,
      amount        NUMERIC(18,2) NOT NULL,
      status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','allocated','refunded','cancelled')),
      allocated_at  TIMESTAMPTZ,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `).catch(() => {});
}

export async function createOffering(userId, issuerId, data) {
  await ensureOfferingTables();
  const {
    security_id, offering_type = 'ipo', shares_offered, price_per_share,
    min_investment = 1, max_investment, subscription_start, subscription_end, description,
  } = data;

  // Validate security belongs to this issuer and is approved
  const sec = await getRow(
    `SELECT s.id, s.available_tokens, s.total_supply, s.approved
       FROM securities s
       JOIN issuers i ON i.id = $2
      WHERE s.id = $1 AND s.issuer_id = i.id`,
    [security_id, issuerId]
  );
  if (!sec) return { error: 'Security not found or does not belong to your issuer profile.' };
  if (!sec.approved) return { error: 'Security must be approved before creating an offering.' };
  // Use COALESCE so a NULL counter falls back to total_supply
  const effectiveAvailable = Math.max(Number(sec.available_tokens ?? sec.total_supply ?? 0), 0);
  if (Number(shares_offered) > effectiveAvailable) {
    return { error: `Cannot offer more than available tokens (${effectiveAvailable}).` };
  }

  const offering = await getRow(
    `INSERT INTO offerings
       (security_id, issuer_id, offering_type, shares_offered, price_per_share,
        min_investment, max_investment, subscription_start, subscription_end, description)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [security_id, issuerId, offering_type, shares_offered, price_per_share,
     min_investment, max_investment || null, subscription_start, subscription_end, description || null]
  );

  // Reserve shares — NULL-safe
  await query(
    `UPDATE securities SET available_tokens = GREATEST(COALESCE(available_tokens, total_supply) - $1, 0), updated_at = NOW() WHERE id = $2`,
    [shares_offered, security_id]
  );

  return { success: true, offering };
}

export async function getOfferings(status = null) {
  await ensureOfferingTables();
  try {
    const params = [];
    let where = '';
    if (status) { params.push(status); where = `WHERE o.status = $1`; }
    return await getRows(
      `SELECT o.id, o.offering_type, o.status, o.shares_offered, o.price_per_share,
              o.min_investment, o.max_investment, o.subscription_start, o.subscription_end,
              o.total_raised, o.shares_allocated, o.description, o.created_at,
              s.id AS security_id, s.symbol, s.name AS security_name,
              i.company_name AS issuer_name,
              (SELECT COALESCE(SUM(sub.quantity),0) FROM subscriptions sub WHERE sub.offering_id = o.id AND sub.status != 'cancelled') AS subscribed_quantity
         FROM offerings o
         JOIN securities s ON s.id = o.security_id
         JOIN issuers i ON i.id = o.issuer_id
         ${where}
        ORDER BY o.created_at DESC`,
      params
    );
  } catch (err) {
    console.error('getOfferings failed:', err);
    return [];
  }
}

export async function getIssuerOfferings(issuerId) {
  await ensureOfferingTables();
  try {
    return await getRows(
      `SELECT o.id, o.offering_type, o.status, o.shares_offered, o.price_per_share,
              o.min_investment, o.max_investment, o.subscription_start, o.subscription_end,
              o.total_raised, o.shares_allocated, o.description, o.created_at,
              s.id AS security_id, s.symbol, s.name AS security_name,
              i.company_name AS issuer_name,
              (SELECT COUNT(*) FROM subscriptions sub WHERE sub.offering_id = o.id) AS subscription_count,
              (SELECT COALESCE(SUM(sub.quantity),0) FROM subscriptions sub WHERE sub.offering_id = o.id AND sub.status != 'cancelled') AS subscribed_quantity
         FROM offerings o
         JOIN securities s ON s.id = o.security_id
         JOIN issuers i ON i.id = o.issuer_id
        WHERE o.issuer_id = $1
        ORDER BY o.created_at DESC`,
      [issuerId]
    );
  } catch (err) {
    console.error('getIssuerOfferings failed:', err);
    return [];
  }
}

export async function subscribeToOffering(userId, offeringId, quantity) {
  await ensureOfferingTables();
  await ensureAlertsColumns();

  const offering = await getRow(
    `SELECT o.*, s.symbol FROM offerings o JOIN securities s ON s.id = o.security_id WHERE o.id = $1`,
    [offeringId]
  );
  if (!offering) return { error: 'Offering not found.' };
  if (offering.status !== 'open') return { error: 'This offering is not open for subscriptions.' };

  const now = new Date();
  const start = new Date(offering.subscription_start);
  const end = new Date(offering.subscription_end);
  end.setHours(23, 59, 59, 999);
  if (now < start) return { error: 'Subscription window has not started yet.' };
  if (now > end)   return { error: 'Subscription window has closed.' };

  const qty = Number(quantity);
  const price = Number(offering.price_per_share);
  const amount = qty * price;
  const minInv = Number(offering.min_investment || 1);
  const maxInv = offering.max_investment ? Number(offering.max_investment) : null;

  if (qty < minInv) return { error: `Minimum investment is ${minInv} shares.` };
  if (maxInv && qty > maxInv) return { error: `Maximum investment is ${maxInv} shares.` };

  // Check existing user subscriptions for max cap
  if (maxInv) {
    const existing = await getRow(
      `SELECT COALESCE(SUM(quantity),0) AS already FROM subscriptions WHERE offering_id=$1 AND investor_id=$2 AND status!='cancelled'`,
      [offeringId, userId]
    );
    const already = Number(existing?.already || 0);
    if (already + qty > maxInv) return { error: `Total subscription would exceed max of ${maxInv} shares (you have ${already} already).` };
  }

  // Check wallet
  const wallet = await getRow(
    `SELECT id, balance FROM wallets WHERE user_id=$1 AND status='active' LIMIT 1`,
    [userId]
  );
  if (!wallet) return { error: 'No active wallet found.' };
  if (Number(wallet.balance) < amount) return { error: `Insufficient funds. Need M${amount.toFixed(2)}, have M${Number(wallet.balance).toFixed(2)}.` };

  let subscription;
  await withTransaction(async (client) => {
    const subRes = await client.query(
      `INSERT INTO subscriptions (offering_id, investor_id, quantity, amount, status)
       VALUES ($1,$2,$3,$4,'pending') RETURNING *`,
      [offeringId, userId, qty, amount.toFixed(2)]
    );
    subscription = subRes.rows[0];

    await client.query(
      `UPDATE wallets SET balance = balance - $1, updated_at = NOW() WHERE id = $2`,
      [amount.toFixed(2), wallet.id]
    );

    await client.query(
      `INSERT INTO wallet_transactions (wallet_id, transaction_type, amount, reference_id, description, created_at)
       VALUES ($1,'debit',$2,$3,$4,NOW())`,
      [wallet.id, amount.toFixed(2), `SUB-${offeringId}`,
       `Primary Market Subscription: ${offering.symbol} × ${qty} @ M${price.toFixed(4)}`]
    );

    await client.query(
      `INSERT INTO alerts (user_id, title, message, alert_type, created_at)
       VALUES ($1,$2,$3,'success',NOW())`,
      [userId,
       `Subscription Confirmed: ${offering.symbol}`,
       `You subscribed to ${qty} shares at M${price.toFixed(4)} each. Total: M${amount.toFixed(2)}. Funds held pending allocation.`]
    ).catch(() => {});
  });

  return { success: true, subscription };
}

export async function settleOffering(offeringId, actorId) {
  await ensureOfferingTables();
  await ensureAlertsColumns();

  const offering = await getRow(
    `SELECT o.*, s.symbol FROM offerings o JOIN securities s ON s.id = o.security_id WHERE o.id = $1`,
    [offeringId]
  );
  if (!offering) return { error: 'Offering not found.' };
  if (offering.status !== 'open' && offering.status !== 'closed') {
    return { error: `Offering is already ${offering.status}.` };
  }

  // Get issuer wallet
  const issuerWallet = await getRow(
    `SELECT w.id FROM wallets w JOIN issuers i ON i.user_id = w.user_id WHERE i.id = $1 AND w.status = 'active' LIMIT 1`,
    [offering.issuer_id]
  );

  const subscriptions = await getRows(
    `SELECT sub.*, u.id AS uid FROM subscriptions sub JOIN users u ON u.id = sub.investor_id WHERE sub.offering_id = $1 AND sub.status = 'pending'`,
    [offeringId]
  );

  let totalRaised = 0;
  let allocatedCount = 0;
  let sharesAllocated = 0;

  await withTransaction(async (client) => {
    await client.query(`UPDATE offerings SET status='settled', updated_at=NOW() WHERE id=$1`, [offeringId]);

    for (const sub of subscriptions) {
      try {
        const qty = Number(sub.quantity);
        const amount = Number(sub.amount);

        // Insert or update holdings
        const existing = await client.query(
          `SELECT id, quantity, avg_price FROM holdings WHERE user_id=$1 AND security_id=$2`,
          [sub.investor_id, offering.security_id]
        );
        if (existing.rows.length > 0) {
          const h = existing.rows[0];
          const existQty = Number(h.quantity);
          const newQty = existQty + qty;
          const newAvg = ((existQty * Number(h.avg_price)) + (qty * Number(offering.price_per_share))) / newQty;
          await client.query(
            `UPDATE holdings SET quantity=$1, avg_price=$2, updated_at=NOW() WHERE id=$3`,
            [newQty, newAvg.toFixed(4), h.id]
          );
        } else {
          await client.query(
            `INSERT INTO holdings (user_id, security_id, quantity, avg_price, created_at, updated_at)
             VALUES ($1,$2,$3,$4,NOW(),NOW())`,
            [sub.investor_id, offering.security_id, qty, Number(offering.price_per_share).toFixed(4)]
          );
        }

        await client.query(
          `UPDATE subscriptions SET status='allocated', allocated_at=NOW() WHERE id=$1`,
          [sub.id]
        );

        await client.query(
          `INSERT INTO alerts (user_id, title, message, alert_type, created_at)
           VALUES ($1,$2,$3,'success',NOW())`,
          [sub.investor_id,
           `Shares Allocated: ${offering.symbol}`,
           `${qty} shares allocated to your portfolio at M${Number(offering.price_per_share).toFixed(4)} each.`]
        ).catch(() => {});

        totalRaised += amount;
        sharesAllocated += qty;
        allocatedCount++;
      } catch (e) {
        console.error(`[SETTLE] Failed for subscription ${sub.id}:`, e.message);
      }
    }

    // Credit issuer wallet if available
    if (issuerWallet && totalRaised > 0) {
      await client.query(
        `UPDATE wallets SET balance = balance + $1, updated_at=NOW() WHERE id=$2`,
        [totalRaised.toFixed(2), issuerWallet.id]
      );
      await client.query(
        `INSERT INTO wallet_transactions (wallet_id, transaction_type, amount, reference_id, description, created_at)
         VALUES ($1,'credit',$2,$3,$4,NOW())`,
        [issuerWallet.id, totalRaised.toFixed(2), `IPO-${offeringId}`,
         `IPO Proceeds: ${offering.symbol} — M${totalRaised.toFixed(2)}`]
      );
    }

    const sharesUnsubscribed = Number(offering.shares_offered) - sharesAllocated;
    await client.query(
      `UPDATE offerings SET total_raised=$1, shares_allocated=$2, status='settled', updated_at=NOW() WHERE id=$3`,
      [totalRaised.toFixed(2), sharesAllocated, offeringId]
    );

    // Return unsubscribed shares to available pool — NULL-safe
    if (sharesUnsubscribed > 0) {
      await client.query(
        `UPDATE securities SET available_tokens = LEAST(COALESCE(available_tokens, 0) + $1, total_supply), updated_at=NOW() WHERE id=$2`,
        [sharesUnsubscribed, offering.security_id]
      );
    }
  });

  return { success: true, total_raised: totalRaised.toFixed(2), allocated_count: allocatedCount };
}

export async function cancelOffering(offeringId, actorId) {
  await ensureOfferingTables();
  await ensureAlertsColumns();

  const offering = await getRow(
    `SELECT o.*, s.symbol FROM offerings o JOIN securities s ON s.id = o.security_id WHERE o.id = $1`,
    [offeringId]
  );
  if (!offering) return { error: 'Offering not found.' };
  if (offering.status === 'settled' || offering.status === 'cancelled') {
    return { error: `Offering is already ${offering.status}.` };
  }

  const subscriptions = await getRows(
    `SELECT sub.* FROM subscriptions sub WHERE sub.offering_id=$1 AND sub.status='pending'`,
    [offeringId]
  );

  await withTransaction(async (client) => {
    for (const sub of subscriptions) {
      // Get investor wallet
      const wallet = await client.query(
        `SELECT id FROM wallets WHERE user_id=$1 AND status='active' LIMIT 1`,
        [sub.investor_id]
      );
      const walletId = wallet.rows[0]?.id;
      if (walletId) {
        await client.query(
          `UPDATE wallets SET balance = balance + $1, updated_at=NOW() WHERE id=$2`,
          [sub.amount, walletId]
        );
        await client.query(
          `INSERT INTO wallet_transactions (wallet_id, transaction_type, amount, reference_id, description, created_at)
           VALUES ($1,'credit',$2,$3,$4,NOW())`,
          [walletId, sub.amount, `REFUND-${offeringId}`,
           `Offering Cancelled — Refund: ${offering.symbol}`]
        );
      }
      await client.query(
        `UPDATE subscriptions SET status='refunded' WHERE id=$1`,
        [sub.id]
      );
      await client.query(
        `INSERT INTO alerts (user_id, title, message, alert_type, created_at)
         VALUES ($1,$2,$3,'warning',NOW())`,
        [sub.investor_id,
         `Offering Cancelled: ${offering.symbol}`,
         `The offering was cancelled. M${Number(sub.amount).toFixed(2)} has been refunded to your wallet.`]
      ).catch(() => {});
    }

    await client.query(`UPDATE offerings SET status='cancelled', updated_at=NOW() WHERE id=$1`, [offeringId]);
    await client.query(
      `UPDATE securities SET available_tokens = LEAST(COALESCE(available_tokens, 0) + $1, total_supply), updated_at=NOW() WHERE id=$2`,
      [offering.shares_offered, offering.security_id]
    );
  });

  return { success: true };
}

export async function getInvestorSubscriptions(userId) {
  await ensureOfferingTables();
  try {
    return await getRows(
      `SELECT sub.id, sub.offering_id, sub.quantity, sub.amount, sub.status,
              sub.allocated_at, sub.created_at,
              o.offering_type, o.price_per_share, o.subscription_end,
              s.symbol, s.name AS security_name
         FROM subscriptions sub
         JOIN offerings o ON o.id = sub.offering_id
         JOIN securities s ON s.id = o.security_id
        WHERE sub.investor_id = $1
        ORDER BY sub.created_at DESC`,
      [userId]
    );
  } catch (err) {
    console.error('getInvestorSubscriptions failed:', err);
    return [];
  }
}


// ================================================================
//  ORDER BOOK  •  MATCHING ENGINE  •  CLEARING HOUSE
// ================================================================

const CLEARING_FEE_RATE = 0.005; // 0.5% each side = 1% total round-trip

let _orderBookTablesEnsured = false;

async function ensureOrderBookTables() {
  if (_orderBookTablesEnsured) return;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS order_book (
        id           SERIAL PRIMARY KEY,
        investor_id  INTEGER NOT NULL REFERENCES users(id),
        security_id  INTEGER NOT NULL REFERENCES securities(id),
        side         VARCHAR(4)    NOT NULL CHECK (side IN ('buy','sell')),
        price        NUMERIC(18,6) NOT NULL,
        quantity     INTEGER       NOT NULL CHECK (quantity > 0),
        filled_qty   INTEGER       NOT NULL DEFAULT 0,
        status       VARCHAR(20)   NOT NULL DEFAULT 'open'
                       CHECK (status IN ('open','partial','filled','cancelled')),
        created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      )
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS trade_clearings (
        id            SERIAL PRIMARY KEY,
        buy_order_id  INTEGER       NOT NULL REFERENCES order_book(id),
        sell_order_id INTEGER       NOT NULL REFERENCES order_book(id),
        security_id   INTEGER       NOT NULL REFERENCES securities(id),
        buyer_id      INTEGER       NOT NULL REFERENCES users(id),
        seller_id     INTEGER       NOT NULL REFERENCES users(id),
        quantity      INTEGER       NOT NULL,
        price         NUMERIC(18,6) NOT NULL,
        total         NUMERIC(18,2) NOT NULL,
        buyer_fee     NUMERIC(18,2) NOT NULL DEFAULT 0,
        seller_fee    NUMERIC(18,2) NOT NULL DEFAULT 0,
        status        VARCHAR(20)   NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','verified','settled','failed')),
        failure_reason TEXT,
        settled_at    TIMESTAMPTZ,
        created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      )
    `);
    await query(`CREATE INDEX IF NOT EXISTS idx_ob_sec_side_status
                 ON order_book(security_id, side, status)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_ob_investor
                 ON order_book(investor_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_tc_status
                 ON trade_clearings(status)`);
    // Ensure securities has prev_price column (used when updating last trade price)
    await query(`ALTER TABLE securities ADD COLUMN IF NOT EXISTS prev_price NUMERIC(18,4)`);
    _orderBookTablesEnsured = true;
  } catch (err) {
    console.error('ensureOrderBookTables failed:', err);
    throw err;
  }
}

/**
 * Place a limit order into the order book, then immediately run the
 * matching engine inside the same transaction (price-time priority).
 * Each match goes through the clearing house step before settlement.
 */
export async function placeOrderBookEntry(investorId, securityId, side, price, quantity) {
  await ensureOrderBookTables();

  const qty = Number(quantity);
  const prc = Number(price);

  if (!['buy', 'sell'].includes(side))
    return { success: false, error: "Invalid side (must be 'buy' or 'sell')" };
  if (isNaN(qty) || qty < 1 || !Number.isInteger(qty))
    return { success: false, error: 'Quantity must be a positive integer' };
  if (isNaN(prc) || prc <= 0)
    return { success: false, error: 'Price must be a positive number' };

  try {
    return await withTransaction(async (client) => {
      // 1. KYC check
      const kyc = await client.query(
        `SELECT status FROM kyc_records
          WHERE user_id = $1 ORDER BY submitted_at DESC LIMIT 1`,
        [investorId]
      );
      if (!kyc.rowCount || kyc.rows[0].status !== 'approved')
        throw new Error('KYC not approved — please complete identity verification first');

      // 2. Verify security exists
      const secRow = await client.query(
        `SELECT id, symbol FROM securities WHERE id = $1`, [securityId]
      );
      if (!secRow.rowCount) throw new Error('Security not found');

      // 3. Pre-flight: check balance (buy) or holdings (sell)
      if (side === 'buy') {
        const walRow = await client.query(
          `SELECT balance FROM wallets WHERE user_id = $1 AND status = 'active' LIMIT 1`,
          [investorId]
        );
        if (!walRow.rowCount) throw new Error('No active wallet found');
        const bal = Number(walRow.rows[0].balance);
        const needed = +(prc * qty * (1 + CLEARING_FEE_RATE)).toFixed(2);
        if (bal < needed)
          throw new Error(
            `Insufficient balance (need M${needed.toFixed(2)} incl. 0.5% clearing fee, have M${bal.toFixed(2)})`
          );
      } else {
        const holdRow = await client.query(
          `SELECT quantity FROM holdings WHERE user_id = $1 AND security_id = $2`,
          [investorId, securityId]
        );
        const held = holdRow.rowCount ? Number(holdRow.rows[0].quantity) : 0;
        if (held < qty)
          throw new Error(`Insufficient holdings (have ${held}, need ${qty} to sell)`);
      }

      // 4. Insert the new order
      const obRes = await client.query(
        `INSERT INTO order_book
           (investor_id, security_id, side, price, quantity, filled_qty, status, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,0,'open',NOW(),NOW())
         RETURNING id`,
        [investorId, securityId, side, prc, qty]
      );
      const newOrderId = obRes.rows[0].id;
      let remainingQty = qty;

      // 5. Matching loop — price-time priority
      while (remainingQty > 0) {
        const matchSide  = side === 'buy' ? 'sell' : 'buy';
        const priceClause = side === 'buy' ? `ob.price <= $3` : `ob.price >= $3`;
        const priceOrder  = side === 'buy' ? 'ASC'            : 'DESC';

        const matchRes = await client.query(
          `SELECT ob.id, ob.investor_id, ob.price, ob.quantity, ob.filled_qty
             FROM order_book ob
            WHERE ob.security_id = $1
              AND ob.side        = $2
              AND ${priceClause}
              AND ob.status     IN ('open','partial')
              AND ob.investor_id != $4
            ORDER BY ob.price ${priceOrder}, ob.created_at ASC
            LIMIT 1
            FOR UPDATE SKIP LOCKED`,
          [securityId, matchSide, prc, investorId]
        );

        if (!matchRes.rowCount) break; // no eligible resting order

        const resting        = matchRes.rows[0];
        const restingRemain  = resting.quantity - resting.filled_qty;
        const fillQty        = Math.min(remainingQty, restingRemain);
        const execPrice      = Number(resting.price); // maker's price wins
        const tradeTotal     = +(fillQty * execPrice).toFixed(2);
        const buyerFee       = +(tradeTotal * CLEARING_FEE_RATE).toFixed(2);
        const sellerFee      = +(tradeTotal * CLEARING_FEE_RATE).toFixed(2);
        const buyerId        = side === 'buy'  ? investorId        : resting.investor_id;
        const sellerId       = side === 'sell' ? investorId        : resting.investor_id;
        const buyObId        = side === 'buy'  ? newOrderId        : resting.id;
        const sellObId       = side === 'sell' ? newOrderId        : resting.id;

        // 5a. Create clearing record
        const clrRes = await client.query(
          `INSERT INTO trade_clearings
             (buy_order_id, sell_order_id, security_id, buyer_id, seller_id,
              quantity, price, total, buyer_fee, seller_fee, status, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending',NOW())
           RETURNING id`,
          [buyObId, sellObId, securityId, buyerId, sellerId,
           fillQty, execPrice, tradeTotal, buyerFee, sellerFee]
        );
        const clearingId = clrRes.rows[0].id;

        // 5b. Clearing house verification
        const buyerWalRow = await client.query(
          `SELECT id, balance FROM wallets WHERE user_id = $1 AND status = 'active' LIMIT 1`,
          [buyerId]
        );
        const sellerHldRow = await client.query(
          `SELECT quantity FROM holdings WHERE user_id = $1 AND security_id = $2`,
          [sellerId, securityId]
        );

        const buyerBal  = buyerWalRow.rowCount ? Number(buyerWalRow.rows[0].balance) : 0;
        const sellerHld = sellerHldRow.rowCount ? Number(sellerHldRow.rows[0].quantity) : 0;
        const buyerNeed = tradeTotal + buyerFee;

        const failReason = buyerBal < buyerNeed
          ? `Buyer insufficient funds (need M${buyerNeed.toFixed(2)}, have M${buyerBal.toFixed(2)})`
          : sellerHld < fillQty
          ? `Seller insufficient holdings (need ${fillQty}, have ${sellerHld})`
          : null;

        if (failReason) {
          // Mark clearing failed, cancel the bad resting order, keep trying
          await client.query(
            `UPDATE trade_clearings SET status='failed', failure_reason=$1 WHERE id=$2`,
            [failReason, clearingId]
          );
          await client.query(
            `UPDATE order_book SET status='cancelled', updated_at=NOW() WHERE id=$1`,
            [resting.id]
          );
          continue;
        }

        // 5c. Verified — settle funds
        await client.query(
          `UPDATE wallets SET balance = balance - $1, updated_at = NOW()
            WHERE id = $2`,
          [buyerNeed, buyerWalRow.rows[0].id]
        );
        const sellerReceive = +(tradeTotal - sellerFee).toFixed(2);
        await client.query(
          `UPDATE wallets SET balance = balance + $1, updated_at = NOW()
            WHERE user_id = $2 AND status = 'active'`,
          [sellerReceive, sellerId]
        );

        // 5d. Settle holdings — buyer receives tokens
        const buyHldRow = await client.query(
          `SELECT id, quantity, avg_price FROM holdings
            WHERE user_id = $1 AND security_id = $2`,
          [buyerId, securityId]
        );
        if (buyHldRow.rowCount) {
          const exQty = Number(buyHldRow.rows[0].quantity);
          const exAvg = Number(buyHldRow.rows[0].avg_price);
          const newAvg = +((exQty * exAvg + fillQty * execPrice) / (exQty + fillQty)).toFixed(6);
          await client.query(
            `UPDATE holdings SET quantity = quantity + $1, avg_price = $2, updated_at = NOW()
              WHERE user_id = $3 AND security_id = $4`,
            [fillQty, newAvg, buyerId, securityId]
          );
        } else {
          await client.query(
            `INSERT INTO holdings (user_id, security_id, quantity, avg_price, updated_at)
             VALUES ($1,$2,$3,$4,NOW())`,
            [buyerId, securityId, fillQty, execPrice]
          );
        }

        // Seller loses tokens
        await client.query(
          `UPDATE holdings SET quantity = quantity - $1, updated_at = NOW()
            WHERE user_id = $2 AND security_id = $3`,
          [fillQty, sellerId, securityId]
        );
        await client.query(
          `DELETE FROM holdings WHERE user_id = $1 AND security_id = $2 AND quantity <= 0`,
          [sellerId, securityId]
        );

        // 5e. Mark clearing settled
        await client.query(
          `UPDATE trade_clearings
              SET status = 'settled', settled_at = NOW()
            WHERE id = $1`,
          [clearingId]
        );

        // 5e2. Fire-and-forget blockchain record for this fill
        const obSyntheticRow = {
          id:          clearingId,
          type:        'buy',
          investor_id: buyerId,
          executed_by: sellerId,
          security_id: securityId,
          quantity:    fillQty,
          price:       execPrice,
        };
        recordTradeOnChain(obSyntheticRow, secRow.rows[0].symbol).catch((e) =>
          console.warn('[OB CHAIN] record failed for clearing', clearingId, ':', e.message)
        );

        // 5f. Update order_book rows
        const restFilledTotal = resting.filled_qty + fillQty;
        const restNewStatus   = restFilledTotal >= resting.quantity ? 'filled' : 'partial';
        await client.query(
          `UPDATE order_book SET filled_qty=$1, status=$2, updated_at=NOW() WHERE id=$3`,
          [restFilledTotal, restNewStatus, resting.id]
        );

        remainingQty -= fillQty;
      }

      // 6. Finalise incoming order status
      const filledSoFar   = qty - remainingQty;
      const incomingStatus = remainingQty === 0 ? 'filled'
                           : filledSoFar  >  0  ? 'partial'
                           :                      'open';
      await client.query(
        `UPDATE order_book SET filled_qty=$1, status=$2, updated_at=NOW() WHERE id=$3`,
        [filledSoFar, incomingStatus, newOrderId]
      );

      // 7. Update security last-trade price if any fills happened
      if (filledSoFar > 0) {
        const lastPriceRes = await client.query(
          `SELECT price FROM trade_clearings
            WHERE security_id = $1 AND status = 'settled'
            ORDER BY settled_at DESC LIMIT 1`,
          [securityId]
        );
        if (lastPriceRes.rowCount) {
          const lp = Number(lastPriceRes.rows[0].price);
          await client.query(`SAVEPOINT ob_price_update`);
          try {
            await client.query(
              `UPDATE securities
                  SET prev_price = price, price = $1, updated_at = NOW()
                WHERE id = $2`,
              [lp, securityId]
            );
            await client.query(`RELEASE SAVEPOINT ob_price_update`);
          } catch (priceErr) {
            await client.query(`ROLLBACK TO SAVEPOINT ob_price_update`);
            console.warn('[OB PRICE] Security price update failed (non-fatal):', priceErr.message);
          }
        }
      }

      return {
        success:      true,
        orderId:      newOrderId,
        status:       incomingStatus,
        filledQty:    filledSoFar,
        remainingQty,
        message:
          incomingStatus === 'filled'
            ? `Order fully matched & settled — ${qty} unit${qty !== 1 ? 's' : ''} traded at M${prc.toFixed(2)}.`
            : incomingStatus === 'partial'
            ? `Partially filled: ${filledSoFar}/${qty} units matched. ${remainingQty} unit${remainingQty !== 1 ? 's' : ''} resting in order book.`
            : `Limit order placed in order book. Waiting for a matching ${side === 'buy' ? 'sell' : 'buy'} order at M${prc.toFixed(2)}.`,
      };
    });
  } catch (err) {
    console.error('placeOrderBookEntry error:', err);
    return { success: false, error: err.message };
  }
}

/** Aggregated bids and asks for a security (for order book display). */
export async function getOrderBook(securityId) {
  await ensureOrderBookTables();
  try {
    const [bids, asks] = await Promise.all([
      getRows(
        `SELECT price, SUM(quantity - filled_qty)::int AS total_qty, COUNT(*)::int AS orders
           FROM order_book
          WHERE security_id = $1 AND side = 'buy' AND status IN ('open','partial')
          GROUP BY price ORDER BY price DESC LIMIT 20`,
        [securityId]
      ),
      getRows(
        `SELECT price, SUM(quantity - filled_qty)::int AS total_qty, COUNT(*)::int AS orders
           FROM order_book
          WHERE security_id = $1 AND side = 'sell' AND status IN ('open','partial')
          GROUP BY price ORDER BY price ASC LIMIT 20`,
        [securityId]
      ),
    ]);
    return { bids, asks };
  } catch (err) {
    console.error('getOrderBook error:', err);
    return { bids: [], asks: [] };
  }
}

/** Investor's own open/partial limit orders. */
export async function getInvestorOpenOrders(investorId) {
  await ensureOrderBookTables();
  try {
    return await getRows(
      `SELECT ob.id, ob.side, ob.price, ob.quantity, ob.filled_qty,
              (ob.quantity - ob.filled_qty) AS remaining_qty,
              ob.status, ob.created_at, ob.updated_at,
              s.symbol, s.name AS security_name
         FROM order_book ob
         JOIN securities s ON s.id = ob.security_id
        WHERE ob.investor_id = $1
          AND ob.status IN ('open','partial')
        ORDER BY ob.created_at DESC`,
      [investorId]
    );
  } catch (err) {
    console.error('getInvestorOpenOrders error:', err);
    return [];
  }
}

/** Cancel an open/partial limit order placed by this investor. */
export async function cancelOrderBookEntry(orderId, investorId) {
  await ensureOrderBookTables();
  try {
    const result = await query(
      `UPDATE order_book SET status='cancelled', updated_at=NOW()
        WHERE id=$1 AND investor_id=$2 AND status IN ('open','partial')
       RETURNING id`,
      [orderId, investorId]
    );
    if (!result.rowCount)
      return { success: false, error: 'Order not found or already filled/cancelled' };
    return { success: true };
  } catch (err) {
    console.error('cancelOrderBookEntry error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Filled limit-order trades visible to any broker.
 * Returns settled trade_clearings joined with security and user info.
 * Excludes resting (open/partial) orders — only completed fills.
 */
export async function getFilledLimitOrders() {
  await ensureOrderBookTables();
  try {
    return await getRows(
      `SELECT tc.id, tc.quantity, tc.price, tc.total,
              tc.buyer_fee, tc.seller_fee, tc.settled_at, tc.created_at,
              s.id   AS security_id, s.symbol, s.name AS security_name,
              bu.id  AS buyer_id,    bu.full_name AS buyer_name,
              su.id  AS seller_id,   su.full_name AS seller_name,
              bo.id  AS buy_ob_id,   so.id AS sell_ob_id
         FROM trade_clearings tc
         JOIN securities  s  ON s.id  = tc.security_id
         JOIN users       bu ON bu.id = tc.buyer_id
         JOIN users       su ON su.id = tc.seller_id
         LEFT JOIN order_book bo ON bo.id = tc.buy_order_id
         LEFT JOIN order_book so ON so.id = tc.sell_order_id
        WHERE tc.status = 'settled'
        ORDER BY tc.settled_at DESC
        LIMIT 500`,
      []
    );
  } catch (err) {
    console.error('getFilledLimitOrders error:', err);
    return [];
  }
}

/** All clearing records for the regulator view. */
export async function getAllClearings() {
  await ensureOrderBookTables();
  try {
    return await getRows(
      `SELECT tc.id, tc.status, tc.quantity, tc.price, tc.total,
              tc.buyer_fee, tc.seller_fee, tc.failure_reason,
              tc.settled_at, tc.created_at,
              s.symbol, s.name  AS security_name,
              bu.full_name      AS buyer_name,
              bu.email          AS buyer_email,
              su.full_name      AS seller_name,
              su.email          AS seller_email
         FROM trade_clearings tc
         JOIN securities  s  ON s.id  = tc.security_id
         JOIN users       bu ON bu.id = tc.buyer_id
         JOIN users       su ON su.id = tc.seller_id
        ORDER BY tc.created_at DESC
        LIMIT 1000`,
      []
    );
  } catch (err) {
    console.error('getAllClearings error:', err);
    return [];
  }
}

/** Summary stats for the clearing house (regulator). */
export async function getClearingStats() {
  await ensureOrderBookTables();
  try {
    const rows = await getRows(
      `SELECT status, COUNT(*)::int AS count, COALESCE(SUM(total),0)::numeric AS volume
         FROM trade_clearings
        GROUP BY status`,
      []
    );
    const stats = { settled: 0, pending: 0, failed: 0, total_volume: 0 };
    for (const r of rows) {
      stats[r.status] = r.count;
      if (r.status === 'settled') stats.total_volume = Number(r.volume);
    }
    return stats;
  } catch (err) {
    console.error('getClearingStats error:', err);
    return { settled: 0, pending: 0, failed: 0, total_volume: 0 };
  }
}

