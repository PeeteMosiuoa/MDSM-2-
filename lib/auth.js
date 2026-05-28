// auth.js
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { query } from "./db.js";
import { corsError } from "./cors.js";

const JWT_SECRET = process.env.JWT_SECRET || "mdsm-secret-key-change-in-production-2024";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "24h";

// ──────────────────────────────────────────────────────────────
// JWT Helpers
// ──────────────────────────────────────────────────────────────
export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    console.error("JWT verification failed:", err.message);
    return null;
  }
}

// ──────────────────────────────────────────────────────────────
// Password Helpers
// ──────────────────────────────────────────────────────────────
export async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

// ──────────────────────────────────────────────────────────────
// Token Extraction
// ──────────────────────────────────────────────────────────────
export function getTokenFromRequest(request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.split(" ")[1];
}

// ──────────────────────────────────────────────────────────────
// Authentication Core
// ──────────────────────────────────────────────────────────────
export async function authenticate(request) {
  const token = getTokenFromRequest(request);
  if (!token) {
    return { user: null, error: "No authentication token provided" };
  }

  const decoded = verifyToken(token);
  if (!decoded || !decoded.id) {
    return { user: null, error: "Invalid or expired token" };
  }

  try {
    const result = await query(
      `SELECT u.id, u.email, u.full_name, u.is_active, u.kyc_status, u.created_at,
              r.role_name AS role
         FROM users u
         LEFT JOIN roles r ON r.id = u.role_id
        WHERE u.id = $1 AND u.is_active = true`,
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return { user: null, error: "User not found or deactivated" };
    }

    return { user: result.rows[0], error: null };
  } catch (err) {
    console.error("Authentication database error:", err);
    return { user: null, error: "Authentication failed" };
  }
}

export async function requireAuth(request) {
  const { user, error } = await authenticate(request);
  if (!user) {
    return { user: null, response: corsError(error, 401) };
  }
  return { user, response: null };
}

export async function requireRole(request, roles) {
  const { user, response } = await requireAuth(request);
  if (response) return { user: null, response };

  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  if (!allowedRoles.includes(user.role)) {
    return {
      user: null,
      response: corsError(`Access denied. Required role: ${allowedRoles.join(" or ")}`, 403),
    };
  }

  return { user, response: null };
}

// ──────────────────────────────────────────────────────────────
// REGISTER USER
// ──────────────────────────────────────────────────────────────
export async function register(userData) {
  const { name, email, password, role = "investor" } = userData;

  if (!name || !email || !password) {
    return { error: "Missing required fields: name, email, password" };
  }

  try {
    // Check for existing user
    const existing = await query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      return { error: "User with this email already exists" };
    }

    const passwordHash = await hashPassword(password);

    const result = await query(
      `INSERT INTO users
         (full_name, email, password_hash, role_id,
          is_active, kyc_status, created_at)
       VALUES (
         $1, $2, $3,
         (SELECT id FROM roles WHERE role_name = $4 LIMIT 1),
         true, 'not_submitted', NOW()
       )
       RETURNING
         id, full_name, email, kyc_status, created_at,
         (SELECT role_name FROM roles WHERE id = role_id) AS role`,
      [name, email, passwordHash, role]
    );

    const newUser = result.rows[0];

    return {
      success: true,
      user: {
        id:        newUser.id,
        name:      newUser.full_name,
        email:     newUser.email,
        role:      newUser.role,
        kycStatus: newUser.kyc_status,
        createdAt: newUser.created_at,
      },
    };

  } catch (err) {
    console.error("Register error:", err);
    return { error: err.message || "User registration failed" };
  }
}

// ──────────────────────────────────────────────────────────────
// SUBMIT KYC (Fully Fixed & Production Ready)
// ──────────────────────────────────────────────────────────────
export async function submitKYC(formData) {
  try {
    const userIdStr = formData.get("userId");
    const role = formData.get("role") || "investor";

    if (!userIdStr) {
      return { success: false, error: "User ID is missing" };
    }

    const userId = parseInt(userIdStr, 10);
    if (isNaN(userId)) {
      return { success: false, error: "Invalid User ID" };
    }

    // Verify user exists
    const userRes = await query("SELECT id, email FROM users WHERE id = $1", [userId]);
    if (userRes.rows.length === 0) {
      return { success: false, error: "User not found" };
    }

    const address = (formData.get("address") || "").trim();
    const city = (formData.get("city") || "").trim();

    // Update user's KYC status and basic info
    await query(
      `UPDATE users 
       SET kyc_status = 'submitted',
           kyc_submitted_at = NOW(),
           address = COALESCE($2, address),
           city = COALESCE($3, city)
       WHERE id = $1`,
      [userId, address || null, city || null]
    );

    // Document types mapping
    const docTypes = [
      { key: "idProof", type: "id_proof" },
      { key: "proofOfAddress", type: "proof_of_address" },
      { key: "licenseProof", type: "license_proof" },
      { key: "companyRegProof", type: "company_reg_proof" },
      { key: "financialsProof", type: "financials_proof" },
      { key: "appointmentLetter", type: "appointment_letter" },
    ];

    // Insert each uploaded document
    for (const doc of docTypes) {
      if (formData.has(doc.key)) {
        const docNumber =
          formData.get("idNumber") ||
          formData.get("licenseNumber") ||
          "";

        await query(
          `INSERT INTO kyc_documents 
             (user_id, document_type, document_number, document_url, status, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [userId, doc.type, docNumber, "pending-upload", "submitted"]
        );
      }
    }

    console.log(`✅ KYC submitted successfully for user ${userId} (role: ${role})`);

    return { success: true };

  } catch (error) {
    console.error("submitKYC error:", error);
    return { success: false, error: "KYC submission failed. Please try again." };
  }
}

// ──────────────────────────────────────────────────────────────
// Get Current Logged-in User (Client-side friendly)
// ──────────────────────────────────────────────────────────────
export async function getCurrentUser() {
  try {
    const res = await fetch("/api/current-user", {
      method: "GET",
      credentials: "include", // Important when using cookies/sessions
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    return data.user || null;
  } catch (err) {
    console.error("Error fetching current user:", err);
    return null;
  }
}