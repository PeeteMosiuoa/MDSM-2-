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
  document_url: z.string().url(), // URL or uploaded file path
  date_of_birth: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  occupation: z.string().optional(),
  source_of_funds: z.string().optional(),
  id_type: z.enum(["national_id", "passport", "drivers_license"]),
});

export async function POST(request) {
  const { user, response: authResponse } = await requireAuth(request);
  if (authResponse) return authResponse;

  // Validate incoming request
  const { data, response: validationResponse } = await validateRequest(request, kycSchema);
  if (validationResponse) return validationResponse;

  try {
    // Check for existing pending KYC
    const existing = await query(
      "SELECT id FROM kyc_documents WHERE user_id = $1 AND status = 'pending'",
      [user.id]
    );
    if (existing.rows.length > 0) {
      return corsError("You already have a pending KYC submission", 409);
    }

    // Insert into kyc_documents
    const docResult = await query(
      `INSERT INTO kyc_documents
       (user_id, document_type, document_number, document_url, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'pending', NOW(), NOW())
       RETURNING *`,
      [user.id, data.document_type, data.document_number, data.document_url]
    );

    const documentId = docResult.rows[0].id;

    // Insert into kyc_records
    const recordResult = await query(
      `INSERT INTO kyc_records
       (user_id, id_number, document_path, id_type, submitted_at, date_of_birth, address, city, occupation, source_of_funds)
       VALUES ($1, $2, $3, $4, NOW(), $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        user.id,
        data.document_number,
        data.document_url, // store path/url
        data.id_type,
        data.date_of_birth || null,
        data.address || null,
        data.city || null,
        data.occupation || null,
        data.source_of_funds || null,
      ]
    );

    // Audit log
    try {
      await logAudit({
        userId: user.id,
        action: "KYC_SUBMITTED",
        entityType: "kyc",
        entityId: documentId,
        details: { document_type: data.document_type },
        ipAddress: getClientIp(request),
      });
    } catch (auditErr) {
      console.warn("Audit log failed:", auditErr);
    }

    return corsResponse({
      message: "KYC submitted successfully",
      kyc_document: docResult.rows[0],
      kyc_record: recordResult.rows[0],
    }, 201);

  } catch (err) {
    console.error("Submit KYC error:", err);
    return corsError("Failed to submit KYC", 500);
  }
}

export async function OPTIONS() {
  return handleOptions();
}