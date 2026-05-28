import { z } from "zod";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { corsResponse, corsError, handleOptions } from "@/lib/cors";
import { validateRequest } from "@/lib/validate";
import { logAudit, getClientIp } from "@/lib/audit";

const approveSchema = z.object({
  status: z.enum(["approved", "rejected", "listed", "delisted"]),
  reason: z.string().optional(),
});

export async function PUT(request, { params }) {
  const { id } = await params;
  const { user, response: authResponse } = await requireRole(request, "admin");
  if (authResponse) return authResponse;

  const { data, response } = await validateRequest(request, approveSchema);
  if (response) return response;

  try {
    const existing = await query("SELECT * FROM securities WHERE id = $1", [id]);
    if (existing.rows.length === 0) {
      return corsError("Security not found", 404);
    }

    const result = await query(
      "UPDATE securities SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
      [data.status, id]
    );

    await logAudit({
      userId: user.id,
      action: `SECURITY_${data.status.toUpperCase()}`,
      entityType: "security",
      entityId: parseInt(id),
      details: {
        symbol: existing.rows[0].symbol,
        previous_status: existing.rows[0].status,
        new_status: data.status,
        reason: data.reason,
      },
      ipAddress: getClientIp(request),
    });

    // Alert the issuer
    await query(
      "INSERT INTO alerts (user_id, title, message, alert_type) VALUES ($1, $2, $3, $4)",
      [
        existing.rows[0].issuer_id,
        `Security ${data.status}: ${existing.rows[0].symbol}`,
        `Your security listing ${existing.rows[0].symbol} (${existing.rows[0].name}) has been ${data.status}. ${data.reason || ""}`,
        data.status === "listed" || data.status === "approved" ? "success" : "warning",
      ]
    );

    return corsResponse({ message: `Security ${data.status}`, security: result.rows[0] });
  } catch (err) {
    console.error("Approve security error:", err);
    return corsError("Failed to update security status", 500);
  }
}

export async function OPTIONS() {
  return handleOptions();
}
