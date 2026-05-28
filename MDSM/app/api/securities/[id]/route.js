import { z } from "zod";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { corsResponse, corsError, handleOptions } from "@/lib/cors";
import { validateRequest } from "@/lib/validate";
import { logAudit, getClientIp } from "@/lib/audit";

export async function GET(request, { params }) {
  const { id } = await params;

  try {
    const result = await query(
      `SELECT s.*, u.full_name AS issuer_name, u.email AS issuer_email
       FROM securities s
       JOIN users u ON s.issuer_id = u.id
       WHERE s.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return corsError("Security not found", 404);
    }

    // Get recent trades for this security
    const trades = await query(
      `SELECT t.quantity, t.price_per_unit, t.total_amount, t.executed_at
       FROM trades t WHERE t.security_id = $1
       ORDER BY t.executed_at DESC LIMIT 10`,
      [id]
    );

    return corsResponse({
      security: result.rows[0],
      recent_trades: trades.rows,
    });
  } catch (err) {
    console.error("Get security error:", err);
    return corsError("Failed to fetch security", 500);
  }
}

const updateSecuritySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  price_per_unit: z.number().positive().optional(),
  listing_documents_url: z.string().url().optional(),
});

export async function PUT(request, { params }) {
  const { id } = await params;
  const { user, response: authResponse } = await requireRole(request, ["issuer", "admin"]);
  if (authResponse) return authResponse;

  const { data, response } = await validateRequest(request, updateSecuritySchema);
  if (response) return response;

  try {
    const existing = await query("SELECT * FROM securities WHERE id = $1", [id]);
    if (existing.rows.length === 0) {
      return corsError("Security not found", 404);
    }

    if (user.role === "issuer" && existing.rows[0].issuer_id !== user.id) {
      return corsError("You can only update your own securities", 403);
    }

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

    updates.push("updated_at = NOW()");
    values.push(id);

    const result = await query(
      `UPDATE securities SET ${updates.join(", ")} WHERE id = $${idx} RETURNING *`,
      values
    );

    await logAudit({
      userId: user.id,
      action: "SECURITY_UPDATED",
      entityType: "security",
      entityId: parseInt(id),
      details: { updated_fields: Object.keys(data) },
      ipAddress: getClientIp(request),
    });

    return corsResponse({ message: "Security updated", security: result.rows[0] });
  } catch (err) {
    console.error("Update security error:", err);
    return corsError("Failed to update security", 500);
  }
}

export async function OPTIONS() {
  return handleOptions();
}
