// app/api/kyc/route.js
import { z } from "zod";
import { query } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { corsResponse, corsError, handleOptions } from "@/lib/cors";
import { validateRequest } from "@/lib/validate";
import { logAudit, getClientIp } from "@/lib/audit";

// Zod schema for KYC submission
const kycSchema = z.object({
  document_type: z.enum(["national_id", "passport", "drivers_license"]),
  document_number: z.string().min(1, "Document number is required"),
  document_url: z.string().url().optional(),
  date_of_birth: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  occupation: z.string().optional(),
  source_of_funds: z.string().optional(),
  id_type: z.string().optional(),
});

export async function POST(request) {
  const { user, response: authResponse } = await requireAuth(request);
  if (authResponse) return authResponse;

  const { data, response: validationResponse } = await validateRequest(request, kycSchema);
  if (validationResponse) return validationResponse;

  try {
    // Check for pending KYC in documents table
    const existing = await query(
      "SELECT id FROM kyc_documents WHERE user_id = $1 AND status = 'pending'",
      [user.id]
    );

    if (existing.rows.length > 0) {
      return corsError("You already have a pending KYC submission", 409);
    }

    // Insert into kyc_documents (main table)
    const docResult = await query(
      `INSERT INTO kyc_documents 
        (user_id, document_type, document_number, document_url, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'pending', NOW(), NOW())
       RETURNING *`,
      [user.id, data.document_type, data.document_number, data.document_url || null]
    );

    // Insert into kyc_records (detailed info)
    const recResult = await query(
      `INSERT INTO kyc_records 
        (user_id, id_number, document_path, date_of_birth, address, city, occupation, source_of_funds, id_type, submitted_at, verified)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),false)
       RETURNING *`,
      [
        user.id,
        data.document_number,
        data.document_url || null,
        data.date_of_birth || null,
        data.address || null,
        data.city || null,
        data.occupation || null,
        data.source_of_funds || null,
        data.id_type || data.document_type,
      ]
    );

    // Audit log
    try {
      await logAudit({
        userId: user.id,
        action: "KYC_SUBMITTED",
        entityType: "kyc",
        entityId: docResult.rows[0].id,
        details: { document_type: data.document_type },
        ipAddress: getClientIp(request),
      });
    } catch (auditErr) {
      console.warn("Audit log failed:", auditErr);
    }

    // Determine dashboard URL based on role
    let dashboardUrl = "/dashboards/user";
    if (user.role === "admin") dashboardUrl = "/dashboards/admin";
    else if (user.role === "regulator") dashboardUrl = "/dashboards/regulator";

    return corsResponse({
      message: "KYC submitted successfully",
      kycDocument: docResult.rows[0],
      kycRecord: recResult.rows[0],
      dashboardUrl,
    }, 201);

  } catch (err) {
    console.error("Submit KYC error:", err);
    return corsError("Failed to submit KYC", 500);
  }
}

export async function OPTIONS() {
  return handleOptions();
}