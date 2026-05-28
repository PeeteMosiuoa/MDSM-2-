import { z } from "zod";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { corsResponse, corsError, handleOptions } from "@/lib/cors";
import { validateRequest } from "@/lib/validate";
import { logAudit, getClientIp } from "@/lib/audit";

const roleSchema = z.object({
  role: z.enum(["investor", "broker", "issuer", "regulator", "admin"]),
});

export async function PUT(request, { params }) {
  const { id } = await params;
  const { user, response: authResponse } = await requireRole(request, "admin");
  if (authResponse) return authResponse;

  const { data, response } = await validateRequest(request, roleSchema);
  if (response) return response;

  try {
    if (parseInt(id) === user.id) {
      return corsError("Cannot change your own role", 400);
    }

    const result = await query(
      `UPDATE users
          SET role_id = (SELECT id FROM roles WHERE role_name = $1 LIMIT 1),
              updated_at = NOW()
        WHERE id = $2
       RETURNING id, email, full_name,
                 (SELECT role_name FROM roles WHERE id = role_id) AS role`,
      [data.role, id]
    );

    if (result.rows.length === 0) {
      return corsError("User not found", 404);
    }

    await logAudit({
      userId: user.id,
      action: "ROLE_CHANGED",
      entityType: "user",
      entityId: parseInt(id),
      details: { new_role: data.role, changed_by: user.email, user_email: result.rows[0].email },
      ipAddress: getClientIp(request),
    });

    return corsResponse({ message: "Role updated", user: result.rows[0] });
  } catch (err) {
    console.error("Role update error:", err);
    return corsError("Failed to update role", 500);
  }
}

export async function OPTIONS() {
  return handleOptions();
}
