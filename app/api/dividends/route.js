import { z } from "zod";
import { query } from "@/lib/db";
import { requireRole, requireAuth } from "@/lib/auth";
import { corsResponse, corsError, handleOptions } from "@/lib/cors";
import { validateRequest } from "@/lib/validate";
import { logAudit, getClientIp } from "@/lib/audit";

// ── Auto-create tables on first use ──────────────────────────────────────────
async function ensureTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS dividends (
      id               SERIAL PRIMARY KEY,
      security_id      INTEGER NOT NULL REFERENCES securities(id),
      declared_by      INTEGER NOT NULL REFERENCES users(id),
      amount_per_share NUMERIC(18,6) NOT NULL CHECK (amount_per_share > 0),
      declaration_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ex_dividend_date DATE NOT NULL,
      record_date      DATE NOT NULL,
      payment_date     DATE NOT NULL,
      total_payout     NUMERIC(18,2),
      status           TEXT NOT NULL DEFAULT 'declared'
                         CHECK (status IN ('declared','processing','paid','cancelled')),
      notes            TEXT,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS dividend_payments (
      id                    SERIAL PRIMARY KEY,
      dividend_id           INTEGER NOT NULL REFERENCES dividends(id),
      investor_id           INTEGER NOT NULL REFERENCES users(id),
      security_id           INTEGER NOT NULL REFERENCES securities(id),
      shares_held           NUMERIC(18,6) NOT NULL,
      amount                NUMERIC(18,2) NOT NULL,
      status                TEXT NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','paid','failed')),
      wallet_transaction_id INTEGER,
      paid_at               TIMESTAMPTZ,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

// ── Schema ────────────────────────────────────────────────────────────────────
const declareSchema = z.object({
  security_id:      z.number().int().positive(),
  amount_per_share: z.number().positive(),
  ex_dividend_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  record_date:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  payment_date:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  notes:            z.string().optional(),
});

// ── GET /api/dividends ─────────────────────────────────────────────────────
// Issuers see their own; investors see dividends for securities they hold;
// admins/regulators see all.
export async function GET(request) {
  await ensureTables();
  const { user, response: authResponse } = await requireAuth(request);
  if (authResponse) return authResponse;

  try {
    const url    = new URL(request.url);
    const secId  = url.searchParams.get("security_id");
    const status = url.searchParams.get("status");

    let sql = `
      SELECT d.*,
             s.name        AS security_name,
             s.symbol      AS security_symbol,
             s.price_per_unit,
             u.full_name   AS declared_by_name
        FROM dividends d
        JOIN securities s ON s.id = d.security_id
        JOIN users      u ON u.id = d.declared_by
    `;
    const params = [];
    const where  = [];

    if (user.role === "issuer") {
      // Only dividends for this issuer's securities
      where.push(`s.issuer_id = (SELECT id FROM issuers WHERE user_id = $${params.length + 1} LIMIT 1)`);
      params.push(user.id);
    } else if (user.role === "investor") {
      // Dividends for securities the investor currently holds
      where.push(`d.security_id IN (SELECT security_id FROM holdings WHERE user_id = $${params.length + 1} AND quantity > 0)`);
      params.push(user.id);
    }

    if (secId) {
      where.push(`d.security_id = $${params.length + 1}`);
      params.push(parseInt(secId));
    }
    if (status) {
      where.push(`d.status = $${params.length + 1}`);
      params.push(status);
    }

    if (where.length) sql += " WHERE " + where.join(" AND ");
    sql += " ORDER BY d.declaration_date DESC";

    const result = await query(sql, params);
    return corsResponse({ dividends: result.rows });
  } catch (err) {
    console.error("[GET /api/dividends]", err);
    return corsError("Failed to fetch dividends", 500);
  }
}

// ── POST /api/dividends ─────────────────────────────────────────────────────
// Issuer declares a dividend for one of their securities.
export async function POST(request) {
  await ensureTables();
  const { user, response: authResponse } = await requireRole(request, ["issuer", "admin"]);
  if (authResponse) return authResponse;

  const { data, response: valErr } = await validateRequest(request, declareSchema);
  if (valErr) return valErr;

  try {
    // Verify the issuer owns this security
    const secRes = await query(
      `SELECT s.id, s.name, s.symbol, s.total_supply, s.available_supply, s.status,
              i.user_id AS issuer_user_id
         FROM securities s
         JOIN issuers i ON i.id = s.issuer_id
        WHERE s.id = $1`,
      [data.security_id]
    );

    if (secRes.rows.length === 0)
      return corsError("Security not found", 404);

    const sec = secRes.rows[0];

    if (user.role === "issuer" && sec.issuer_user_id !== user.id)
      return corsError("You can only declare dividends for your own securities", 403);

    if (sec.status !== "listed" && !sec.approved)
      return corsError("Dividends can only be declared for listed/approved securities", 400);

    // Validate date ordering: ex_div < record < payment
    const exDate  = new Date(data.ex_dividend_date);
    const recDate = new Date(data.record_date);
    const payDate = new Date(data.payment_date);

    if (exDate >= recDate)
      return corsError("Ex-dividend date must be before record date", 400);
    if (recDate >= payDate)
      return corsError("Record date must be before payment date", 400);

    // Circulating supply = total_supply - available_supply
    const circulatingSupply = parseFloat(sec.total_supply) - parseFloat(sec.available_supply || 0);
    const totalPayout = (circulatingSupply * data.amount_per_share).toFixed(2);

    const result = await query(
      `INSERT INTO dividends
         (security_id, declared_by, amount_per_share, ex_dividend_date,
          record_date, payment_date, total_payout, notes, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'declared')
       RETURNING *`,
      [
        data.security_id,
        user.id,
        data.amount_per_share,
        data.ex_dividend_date,
        data.record_date,
        data.payment_date,
        totalPayout,
        data.notes || null,
      ]
    );

    await logAudit({
      userId:     user.id,
      action:     "DIVIDEND_DECLARED",
      entityType: "dividend",
      entityId:   result.rows[0].id,
      details:    { security: sec.symbol, amount_per_share: data.amount_per_share, total_payout: totalPayout },
      ipAddress:  getClientIp(request),
    });

    return corsResponse({
      message: `Dividend declared for ${sec.symbol} — M${data.amount_per_share} per share`,
      dividend: { ...result.rows[0], security_name: sec.name, security_symbol: sec.symbol },
    }, 201);

  } catch (err) {
    console.error("[POST /api/dividends]", err);
    return corsError("Failed to declare dividend", 500);
  }
}

export async function OPTIONS() {
  return handleOptions();
}
