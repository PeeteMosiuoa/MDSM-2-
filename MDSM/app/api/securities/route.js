import { z } from "zod";
import { query } from "@/lib/db";
import { requireAuth, requireRole } from "@/lib/auth";
import { corsResponse, corsError, handleOptions } from "@/lib/cors";
import { validateRequest } from "@/lib/validate";
import { logAudit, getClientIp } from "@/lib/audit";

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const securityType = url.searchParams.get("type");
    const search = url.searchParams.get("search");
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    let sql = `SELECT s.*, i.company_name AS issuer_name
               FROM securities s
               JOIN issuers i ON s.issuer_id = i.id`;
    let countSql = "SELECT COUNT(*) FROM securities s";
    const params = [];
    const conditions = [];

    // Public users only see approved/listed securities; authenticated admin/regulator see all
    let authUser = null;
    try {
      const authResult = await requireAuth(request);
      if (!authResult.response) authUser = authResult.user;
    } catch { /* public access */ }

    if (!authUser || !["admin", "regulator", "issuer"].includes(authUser?.role)) {
      conditions.push("s.approved = true");
    } else if (authUser.role === "issuer") {
      conditions.push(`(s.approved = true OR s.issuer_id = (SELECT id FROM issuers WHERE user_id = ${parseInt(authUser.id)}))`);
    }

    if (status && authUser && ["admin", "regulator"].includes(authUser.role)) {
      // map status param to approved boolean
      if (status === "listed" || status === "approved") conditions.push("s.approved = true");
      else if (status === "pending")                    conditions.push("s.approved = false");
    }

    if (securityType) {
      conditions.push(`s.security_type = $${params.length + 1}`);
      params.push(securityType);
    }

    if (search) {
      conditions.push(`(s.name ILIKE $${params.length + 1} OR s.symbol ILIKE $${params.length + 1})`);
      params.push(`%${search}%`);
    }

    if (conditions.length > 0) {
      const where = " WHERE " + conditions.join(" AND ");
      sql += where;
      countSql += where.replace(/s\./g, "");
    }

    const countParams = [...params];
    sql += ` ORDER BY s.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const [securitiesResult, countResult] = await Promise.all([
      query(sql, params),
      query(countSql, countParams),
    ]);

    return corsResponse({
      securities: securitiesResult.rows,
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].count),
        pages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
      },
    });
  } catch (err) {
    console.error("List securities error:", err);
    return corsError("Failed to fetch securities", 500);
  }
}

const securitySchema = z.object({
  name: z.string().min(1, "Name is required"),
  symbol: z.string().min(1).max(20, "Symbol must be 1-20 characters"),
  description: z.string().optional(),
  security_type: z.enum(["equity", "bond", "fund", "token"]).default("equity"),
  total_supply: z.number().positive("Total supply must be positive"),
  price_per_unit: z.number().positive("Price must be positive"),
  currency: z.string().default("LSL"),
  listing_documents_url: z.string().url().optional(),
});

export async function POST(request) {
  const { user, response: authResponse } = await requireRole(request, ["issuer", "admin"]);
  if (authResponse) return authResponse;

  const { data, response } = await validateRequest(request, securitySchema);
  if (response) return response;

  try {
    const existing = await query("SELECT id FROM securities WHERE symbol = $1", [data.symbol.toUpperCase()]);
    if (existing.rows.length > 0) {
      return corsError("Symbol already exists", 409);
    }

    const result = await query(
      `INSERT INTO securities (issuer_id, name, symbol, description, security_type, total_supply, available_supply, price_per_unit, currency, listing_documents_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        user.id,
        data.name,
        data.symbol.toUpperCase(),
        data.description || null,
        data.security_type,
        data.total_supply,
        data.total_supply,
        data.price_per_unit,
        data.currency,
        data.listing_documents_url || null,
      ]
    );

    await logAudit({
      userId: user.id,
      action: "SECURITY_SUBMITTED",
      entityType: "security",
      entityId: result.rows[0].id,
      details: { symbol: data.symbol.toUpperCase(), name: data.name, type: data.security_type },
      ipAddress: getClientIp(request),
    });

    return corsResponse({ message: "Security listing submitted for approval", security: result.rows[0] }, 201);
  } catch (err) {
    console.error("Create security error:", err);
    return corsError("Failed to create security", 500);
  }
}

export async function OPTIONS() {
  return handleOptions();
}
