// lib/db.js
// Shared server-only database utilities.  Do NOT import in client components.
//
// Key design decisions
// ────────────────────
// • pool.query() instead of pool.connect()/client.release() for simple queries.
//   Acquiring a dedicated client per query wastes a slot and risks leaking the
//   connection if the calling code throws between connect() and release().
//
// • Pool tuned for Supabase Supavisor (transaction-mode pooler, port 6543).
//   Transaction-mode: the physical PG connection is returned to Supavisor after
//   each statement. Therefore:
//     – keepAlive is OFF  (there is no persistent connection to keep alive)
//     – idleTimeoutMillis is LOW (connections returned quickly)
//     – max is conservative (each Next.js serverless instance has its own pool;
//       Supavisor's own pool sits behind ours)
//
// • testConnection() is NOT called at module-import time.  In a serverless /
//   Edge environment every cold start would hit the DB just to say hello.
//   Call healthCheck() explicitly from an admin API route if needed.

import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const dbUrl    = process.env.DATABASE_URL;
const isSupabase = dbUrl.includes('supabase.co') || dbUrl.includes('pooler.supabase');

// ── Pool configuration ────────────────────────────────────────────────────────
//
// Supabase transaction-mode pooler (port 6543 — recommended for serverless):
//   • max 5  — keep total connections per instance low; Supavisor multiplexes
//   • idleTimeoutMillis 10 s  — release idle connections quickly
//   • keepAlive false — transaction-mode severs the physical conn between txns
//   • statement_timeout — prevent runaway queries from blocking the pool
//
// Direct Postgres (local dev, port 5432):
//   • max 10, keepAlive true — normal persistent pool

export const pool = new Pool({
  connectionString: dbUrl,

  ssl: isSupabase ? { rejectUnauthorized: false } : false,

  max:                    isSupabase ? 5  : 10,
  min:                    0,
  idleTimeoutMillis:      isSupabase ? 10_000 : 30_000,
  connectionTimeoutMillis: 15_000,
  keepAlive:              !isSupabase,  // OFF for Supavisor transaction mode
  allowExitOnIdle:        true,

  // Hard cap on individual query duration to prevent pool starvation
  ...(isSupabase && {
    statement_timeout: 30_000,  // 30 s
  }),
});

pool.on('error', (err) => {
  // Log but do not crash — the next acquire will reconnect
  console.error('[DB] Pool error:', err.message);
});

// ── Core query helpers ────────────────────────────────────────────────────────

/**
 * Execute a parameterised SQL query.
 * Uses pool.query() — no manual connect/release required.
 */
export async function query(sql, params = []) {
  try {
    return await pool.query(sql, params);
  } catch (err) {
    console.error('[DB] Query error:', {
      sql:    sql.substring(0, 200),
      params: params.length,
      error:  err.message,
    });
    throw new Error(`Database operation failed: ${err.message}`);
  }
}

/** Returns all rows as an array. */
export async function getRows(sql, params = []) {
  const res = await query(sql, params);
  return res.rows;
}

/** Returns the first row or null. */
export async function getRow(sql, params = []) {
  const res = await query(sql, params);
  return res.rows[0] ?? null;
}

/**
 * Execute a callback inside a BEGIN / COMMIT / ROLLBACK transaction.
 * The callback receives the pg Client and must use it for all queries
 * that need to participate in the transaction.
 */
export async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[DB] Transaction rolled back:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Quick liveness probe — call this from a dedicated health-check API route.
 * Do NOT call at module-import time (fires on every cold start).
 */
export async function healthCheck() {
  try {
    const row = await getRow('SELECT NOW() AS time, current_database() AS db');
    return { status: 'healthy', database: row?.db, time: row?.time, pooler: isSupabase };
  } catch (err) {
    return { status: 'unhealthy', error: err.message, pooler: isSupabase };
  }
}

// ── User registration ─────────────────────────────────────────────────────────

export async function register(userData) {
  return withTransaction(async (client) => {
    const role = (userData.role || 'investor').trim().toLowerCase();

    const existing = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [userData.email]
    );
    if (existing.rowCount > 0) return { error: 'Email already registered' };

    const passwordHash = await bcrypt.hash(userData.password, 12);

    const userRes = await client.query(
      `INSERT INTO users (email, password_hash, role, name, status, created_at)
       VALUES ($1,$2,$3,$4,'pending',NOW())
       RETURNING id, email, role, name, status, created_at`,
      [userData.email, passwordHash, role, userData.name ?? null]
    );

    const newUser = userRes.rows[0];
    let extraData = null;

    if (role === 'issuer') {
      const issuerRes = await client.query(
        `INSERT INTO issuers (user_id, company_name, company_reg_number, status, approved, created_at)
         VALUES ($1,$2,$3,'pending',false,NOW())
         RETURNING id, company_name, company_reg_number`,
        [newUser.id, userData.companyName ?? null, userData.registrationNumber ?? null]
      );
      const row = issuerRes.rows[0];
      extraData = { issuerId: row.id, companyName: row.company_name, companyRegNumber: row.company_reg_number };
    }

    return {
      id:        newUser.id,
      email:     newUser.email,
      role:      newUser.role,
      name:      newUser.name,
      status:    newUser.status,
      createdAt: newUser.created_at,
      ...extraData,
    };
  });
}

// ── Convenience helpers ───────────────────────────────────────────────────────

export async function getPendingOrders() {
  try {
    return await getRows(
      `SELECT id, investor_id, security_id, quantity, price, payment_method,
              status, created_at, type, total
         FROM orders
        WHERE status = 'pending' OR status IS NULL
        ORDER BY created_at DESC`
    );
  } catch (err) {
    console.error('[DB] getPendingOrders failed:', err.message);
    return [];
  }
}

/** Graceful shutdown — call during process SIGTERM, not on every request. */
export async function closePool() {
  await pool.end();
  console.log('[DB] Pool closed');
}
