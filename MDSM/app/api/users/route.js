import { z } from "zod";
import { query } from "@/lib/db";
import { requireRole, hashPassword } from "@/lib/auth";
import { corsResponse, corsError, handleOptions } from "@/lib/cors";
import { validateRequest } from "@/lib/validate";
import { logAudit, getClientIp } from "@/lib/audit";

export async function GET(request) {
  const { user, response } = await requireRole(request, ["admin", "regulator"]);
  if (response) return response;

  try {
    const url = new URL(request.url);
    const role = url.searchParams.get("role");
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    let sql = `SELECT u.id, u.email, u.full_name, u.is_active, u.kyc_status,
                      u.created_at, r.role_name AS role
                 FROM users u
                 LEFT JOIN roles r ON r.id = u.role_id`;
    let countSql = "SELECT COUNT(*) FROM users u LEFT JOIN roles r ON r.id = u.role_id";
    const params = [];
    const conditions = [];

    if (role) {
      conditions.push(`r.role_name = $${params.length + 1}`);
      params.push(role);
    }

    if (conditions.length > 0) {
      const where = " WHERE " + conditions.join(" AND ");
      sql += where;
      countSql += where;
    }

    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const [usersResult, countResult] = await Promise.all([
      query(sql, params),
      query(countSql, params.slice(0, params.length - 2)),
    ]);

    return corsResponse({
      users: usersResult.rows,
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].count),
        pages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
      },
    });
  } catch (err) {
    console.error("List users error:", err);
    return corsError("Failed to fetch users", 500);
  }
}

const createUserSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(6),
  name:     z.string().min(1),
  role:     z.enum(["investor", "broker", "issuer", "regulator", "admin"]),
});

export async function POST(request) {
  const { user, response: authResponse } = await requireRole(request, "admin");
  if (authResponse) return authResponse;

  const { data, response } = await validateRequest(request, createUserSchema);
  if (response) return response;

  try {
    const existing = await query("SELECT id FROM users WHERE email = $1", [data.email]);
    if (existing.rows.length > 0) {
      return corsError("Email already registered", 409);
    }

    const passwordHash = await hashPassword(data.password);
    const result = await query(
      `INSERT INTO users (full_name, email, password_hash, role_id, is_active, kyc_status, created_at)
       VALUES ($1, $2, $3, (SELECT id FROM roles WHERE role_name = $4 LIMIT 1), true, 'not_submitted', NOW())
       RETURNING id, full_name, email, is_active, kyc_status, created_at,
                 (SELECT role_name FROM roles WHERE id = role_id) AS role`,
      [data.name, data.email, passwordHash, data.role]
    );

    await logAudit({
      userId: user.id,
      action: "USER_CREATED_BY_ADMIN",
      entityType: "user",
      entityId: result.rows[0].id,
      details: { email: data.email, role: data.role, created_by: user.email },
      ipAddress: getClientIp(request),
    });

    return corsResponse({ message: "User created", user: result.rows[0] }, 201);
  } catch (err) {
    console.error("Create user error:", err);
    return corsError("Failed to create user", 500);
  }
}

export async function OPTIONS() {
  return handleOptions();
}
