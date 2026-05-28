import { query } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { corsResponse, corsError, handleOptions } from "@/lib/cors";

export async function GET(request, { params }) {
  const { id } = await params;
  const { user, response } = await requireAuth(request);
  if (response) return response;

  try {
    let sql = `SELECT o.*, s.name as security_name, s.symbol as security_symbol
               FROM orders o
               JOIN securities s ON o.security_id = s.id
               WHERE o.id = $1`;
    const sqlParams = [id];

    if (!["admin", "regulator"].includes(user.role)) {
      sql += " AND o.user_id = $2";
      sqlParams.push(user.id);
    }

    const result = await query(sql, sqlParams);
    if (result.rows.length === 0) {
      return corsError("Order not found", 404);
    }

    // Get related trades
    const trades = await query(
      "SELECT * FROM trades WHERE buy_order_id = $1 OR sell_order_id = $1 ORDER BY executed_at DESC",
      [id]
    );

    return corsResponse({ order: result.rows[0], trades: trades.rows });
  } catch (err) {
    console.error("Get order error:", err);
    return corsError("Failed to fetch order", 500);
  }
}

export async function OPTIONS() {
  return handleOptions();
}
