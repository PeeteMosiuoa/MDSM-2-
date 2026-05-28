import { z } from "zod";
import { query } from "@/lib/db";
import { hashPassword, signToken } from "@/lib/auth";
import { corsResponse, corsError, handleOptions } from "@/lib/cors";
import { validateRequest } from "@/lib/validate";
import { logAudit, getClientIp } from "@/lib/audit";

const registerSchema = z.object({
  email:    z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name:     z.string().min(1, "Full name is required"),
  role:     z.enum(["investor", "broker", "issuer"]).default("investor"),
});

export async function POST(request) {
  const { data, response } = await validateRequest(request, registerSchema);
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
       RETURNING id, full_name, email, kyc_status, created_at,
                 (SELECT role_name FROM roles WHERE id = role_id) AS role`,
      [data.name, data.email, passwordHash, data.role]
    );

    const user = result.rows[0];
    const token = signToken({ id: user.id, email: user.email, role: user.role });

    await logAudit({
      userId:     user.id,
      action:     "USER_REGISTERED",
      entityType: "user",
      entityId:   user.id,
      details:    { email: user.email, role: user.role },
      ipAddress:  getClientIp(request),
    });

    return corsResponse({ message: "Registration successful", user, token }, 201);
  } catch (err) {
    console.error("Registration error:", err);
    return corsError("Registration failed", 500);
  }
}

export async function OPTIONS() {
  return handleOptions();
}
