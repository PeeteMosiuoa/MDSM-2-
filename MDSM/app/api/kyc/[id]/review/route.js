import { z } from "zod";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { corsResponse, corsError, handleOptions } from "@/lib/cors";
import { validateRequest } from "@/lib/validate";
import { logAudit, getClientIp } from "@/lib/audit";

const reviewSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  rejection_reason: z.string().optional(),
});

export async function PUT(request, { params }) {
  const { id } = await params;
  const { user, response: authResponse } = await requireRole(request, ["admin", "regulator"]);
  if (authResponse) return authResponse;

  const { data, response } = await validateRequest(request, reviewSchema);
  if (response) return response;

  try {
    const existing = await query("SELECT * FROM kyc_documents WHERE id = $1", [id]);
    if (existing.rows.length === 0) {
      return corsError("KYC document not found", 404);
    }

    if (existing.rows[0].status !== "pending") {
      return corsError("KYC document already reviewed", 400);
    }

    const result = await query(
      `UPDATE kyc_documents SET status = $1, rejection_reason = $2, reviewed_by = $3, reviewed_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [data.status, data.rejection_reason || null, user.id, id]
    );

    if (data.status === "approved") {
      await query(
        "UPDATE users SET kyc_status = 'approved', updated_at = NOW() WHERE id = $1",
        [existing.rows[0].user_id]
      );
    }

    await logAudit({
      userId: user.id,
      action: data.status === "approved" ? "KYC_APPROVED" : "KYC_REJECTED",
      entityType: "kyc",
      entityId: parseInt(id),
      details: {
        user_id: existing.rows[0].user_id,
        status: data.status,
        rejection_reason: data.rejection_reason,
        reviewer: user.email,
      },
      ipAddress: getClientIp(request),
    });

    // Create alert for the user
    const alertTitle = data.status === "approved" ? "KYC Approved" : "KYC Rejected";
    const alertMessage =
      data.status === "approved"
        ? "Your KYC documents have been approved. You can now trade on the platform."
        : `Your KYC documents have been rejected. Reason: ${data.rejection_reason || "Not specified"}`;

    await query(
      "INSERT INTO alerts (user_id, title, message, alert_type) VALUES ($1, $2, $3, $4)",
      [existing.rows[0].user_id, alertTitle, alertMessage, data.status === "approved" ? "success" : "error"]
    );

    return corsResponse({ message: `KYC ${data.status}`, kyc: result.rows[0] });
  } catch (err) {
    console.error("Review KYC error:", err);
    return corsError("Failed to review KYC", 500);
  }
}

export async function OPTIONS() {
  return handleOptions();
}
