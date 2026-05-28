import { query } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { corsResponse, corsError, handleOptions } from "@/lib/cors";

// ── GET /api/dividends/[id] ───────────────────────────────────────────────────
// Returns the dividend record plus a summary of per-investor payment records.
export async function GET(request, { params }) {
  const { id } = await params;
  const { user, response: authResponse } = await requireAuth(request);
  if (authResponse) return authResponse;

  try {
    const divRes = await query(
      `SELECT d.*,
              s.name       AS security_name,
              s.symbol     AS security_symbol,
              s.price_per_unit,
              u.full_name  AS declared_by_name
         FROM dividends d
         JOIN securities s ON s.id = d.security_id
         JOIN users      u ON u.id = d.declared_by
        WHERE d.id = $1`,
      [id]
    );

    if (divRes.rows.length === 0)
      return corsError("Dividend not found", 404);

    const dividend = divRes.rows[0];

    // Payment breakdown (admin/regulator see all; investor sees only their own row)
    let paymentsQuery = `
      SELECT dp.*,
             u.full_name AS investor_name,
             u.email     AS investor_email
        FROM dividend_payments dp
        JOIN users u ON u.id = dp.investor_id
       WHERE dp.dividend_id = $1
    `;
    const paymentsParams = [id];

    if (user.role === "investor") {
      paymentsQuery += ` AND dp.investor_id = $2`;
      paymentsParams.push(user.id);
    }
    paymentsQuery += " ORDER BY dp.amount DESC";

    const paymentsRes = await query(paymentsQuery, paymentsParams);

    return corsResponse({ dividend, payments: paymentsRes.rows });
  } catch (err) {
    console.error("[GET /api/dividends/[id]]", err);
    return corsError("Failed to fetch dividend", 500);
  }
}

export async function OPTIONS() {
  return handleOptions();
}
