import { query } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { corsResponse, corsError, handleOptions } from "@/lib/cors";

export async function GET(request) {
  const { user, response } = await requireAuth(request);
  if (response) return response;

  try {
    const url = new URL(request.url);
    const securityId = url.searchParams.get("security_id");
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    let sql = `SELECT t.*,
               s.name as security_name, s.symbol as security_symbol,
               b.first_name as buyer_first_name, b.last_name as buyer_last_name,
               sl.first_name as seller_first_name, sl.last_name as seller_last_name
               FROM trades t
               JOIN securities s ON t.security_id = s.id
               JOIN users b ON t.buyer_id = b.id
               LEFT JOIN users sl ON t.seller_id = sl.id`;
    let countSql = `SELECT COUNT(*) FROM trades t`;
    const params = [];
    const conditions = [];

    if (!["admin", "regulator"].includes(user.role)) {
      conditions.push(`(t.buyer_id = $${params.length + 1} OR t.seller_id = $${params.length + 1})`);
      params.push(user.id);
    }

    if (securityId) {
      conditions.push(`t.security_id = $${params.length + 1}`);
      params.push(securityId);
    }

    if (conditions.length > 0) {
      const where = " WHERE " + conditions.join(" AND ");
      sql += where;
      countSql += where;
    }

    const countParams = [...params];
    sql += ` ORDER BY t.executed_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const [tradesResult, countResult] = await Promise.all([
      query(sql, params),
      query(countSql, countParams),
    ]);

    return corsResponse({
      trades: tradesResult.rows,
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].count),
        pages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
      },
    });
  } catch (err) {
    console.error("List trades error:", err);
    return corsError("Failed to fetch trades", 500);
  }
}

export async function OPTIONS() {
  return handleOptions();
}
