import { z } from "zod";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { corsResponse, corsError, handleOptions } from "@/lib/cors";
import { validateRequest } from "@/lib/validate";
import { logAudit, getClientIp } from "@/lib/audit";

const USER_SELECT = `
  SELECT u.id, u.email, u.full_name, u.is_active, u.kyc_status,
         u.created_at, r.role_name AS role
    FROM users u
    LEFT JOIN roles r ON r.id = u.role_id`;

export async function GET(request, { params }) {
  const { id } = await params;
  const { response } = await requireRole(request, ["admin", "regulator"]);
  if (response) return response;

  try {
    const result = await query(`${USER_SELECT} WHERE u.id = $1`, [id]);

    if (result.rows.length === 0) {
      return corsError("User not found", 404);
    }

    return corsResponse({ user: result.rows[0] });
  } catch (err) {
    console.error("Get user error:", err);
    return corsError("Failed to fetch user", 500);
  }
}

const updateUserSchema = z.object({
  full_name: z.string().min(1).optional(),
  is_active: z.boolean().optional(),
});

export async function PUT(request, { params }) {
  const { id } = await params;
  const { user, response: authResponse } = await requireRole(request, "admin");
  if (authResponse) return authResponse;

  const { data, response } = await validateRequest(request, updateUserSchema);
  if (response) return response;

  try {
    const updates = [];
    const values = [];
    let idx = 1;

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        updates.push(`${key} = $${idx}`);
        values.push(value);
        idx++;
      }
    }

    if (updates.length === 0) {
      return corsError("No fields to update", 400);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await query(
      `UPDATE users SET ${updates.join(", ")} WHERE id = $${idx}
       RETURNING id, email, full_name, is_active, kyc_status, created_at`,
      values
    );

    if (result.rows.length === 0) {
      return corsError("User not found", 404);
    }

    await logAudit({
      userId:     user.id,
      action:     "USER_UPDATED",
      entityType: "user",
      entityId:   parseInt(id),
      details:    { updated_fields: Object.keys(data), updated_by: user.email },
      ipAddress:  getClientIp(request),
    });

    return corsResponse({ message: "User updated", user: result.rows[0] });
  } catch (err) {
    console.error("Update user error:", err);
    return corsError("Failed to update user", 500);
  }
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  const { user, response } = await requireRole(request, "admin");
  if (response) return response;

  try {
    if (parseInt(id) === user.id) {
      return corsError("Cannot deactivate your own account", 400);
    }

    const result = await query(
      "UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id, email",
      [id]
    );

    if (result.rows.length === 0) {
      return corsError("User not found", 404);
    }

    await logAudit({
      userId:     user.id,
      action:     "USER_DEACTIVATED",
      entityType: "user",
      entityId:   parseInt(id),
      details:    { deactivated_email: result.rows[0].email, deactivated_by: user.email },
      ipAddress:  getClientIp(request),
    });

    return corsResponse({ message: "User deactivated" });
  } catch (err) {
    console.error("Delete user error:", err);
    return corsError("Failed to deactivate user", 500);
  }
}

export async function OPTIONS() {
  return handleOptions();
}
