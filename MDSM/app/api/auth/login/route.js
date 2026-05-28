import { z } from "zod";
import { query } from "@/lib/db";
import { comparePassword, signToken } from "@/lib/auth";
import { corsResponse, corsError, handleOptions } from "@/lib/cors";
import { validateRequest } from "@/lib/validate";
import { logAudit, getClientIp } from "@/lib/audit";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export async function POST(request) {
  const { data, response } = await validateRequest(request, loginSchema);
  if (response) return response;

  try {
    const result = await query(
      `SELECT u.id, u.email, u.password_hash, u.full_name, u.is_active,
              u.kyc_status, u.created_at, r.role_name AS role
         FROM users u
         LEFT JOIN roles r ON r.id = u.role_id
        WHERE u.email = $1`,
      [data.email]
    );

    if (result.rows.length === 0) {
      return corsError("Invalid email or password", 401);
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return corsError("Account is deactivated. Contact support.", 403);
    }

    const valid = await comparePassword(data.password, user.password_hash);
    if (!valid) {
      return corsError("Invalid email or password", 401);
    }

    const token = signToken({ id: user.id, email: user.email, role: user.role });

    const { password_hash, ...safeUser } = user;

    await logAudit({
      userId: user.id,
      action: "USER_LOGIN",
      entityType: "user",
      entityId: user.id,
      details: { email: user.email },
      ipAddress: getClientIp(request),
    });

    return corsResponse({
      message: "Login successful",
      user: safeUser,
      token,
    });
  } catch (err) {
    console.error("Login error:", err);
    return corsError("Login failed", 500);
  }
}

export async function OPTIONS() {
  return handleOptions();
}
