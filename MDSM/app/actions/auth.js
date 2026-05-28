"use server";

import bcrypt from "bcryptjs";
import { query } from "@/lib/db";
import { ethers } from "ethers";
import { pool } from '@/lib/db';
import { uploadKYCDocument } from "@/lib/storage/kyc-storage";
import { signToken } from "@/lib/auth";

async function getRoleId(roleName) {
  const res = await query("SELECT id FROM roles WHERE role_name = $1 LIMIT 1", [roleName]);
  if (res.rows.length === 0) throw new Error(`Unknown role: "${roleName}"`);
  return res.rows[0].id;
}

async function getRoleName(roleId) {
  const res = await query("SELECT role_name FROM roles WHERE id = $1 LIMIT 1", [roleId]);
  return res.rows[0]?.role_name ?? "investor";
}

export async function getCurrentUser() {
  try {
    const res = await fetch("/api/auth/me");
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error("Failed to get current user:", err);
    return null;
  }
}


/* ====================================================
   REGISTER USER - WITH AUTOMATIC WALLET
   ==================================================== */
export async function registerUser(formData) {
  try {
    if (!formData || typeof formData.get !== "function") {
      return { success: false, error: "Invalid FormData" };
    }

    const email      = (formData.get("email")      || "").toString().toLowerCase().trim();
    const name       = (formData.get("name")       || "").toString().trim();
    const password   = formData.get("password")    || "";
    const phone      = (formData.get("phone")      || "").toString().trim();
    const role       = (formData.get("role")       || "investor").toString().trim();
    const companyReg = (formData.get("companyReg") || "").toString().trim();
    const department = (formData.get("department") || "").toString().trim() || null;
    const adminCode  = (formData.get("adminCode")  || "").toString().trim() || null;

    if (!email)    return { success: false, error: "Email is required" };
    if (!password) return { success: false, error: "Password is required" };
    if (!name?.trim()) return { success: false, error: "Full name / Company name is required" };

    if (role === "admin" && adminCode !== process.env.ADMIN_REGISTRATION_CODE) {
      return { success: false, error: "Invalid admin access code" };
    }

    if (role === "issuer") {
      if (!companyReg) {
        return { success: false, error: "Company registration number is required for issuers" };
      }
    }

    // Check if email already exists
    const existing = await query(
      "SELECT id FROM users WHERE email = $1 LIMIT 1",
      [email]
    );

    if (existing.rows.length > 0) {
      return { success: false, error: "This email is already registered" };
    }

    // === Generate Wallet Address ===
    const wallet = ethers.Wallet.createRandom(0x6f8393f9e02725747668a0f7536db39edcfc0e2c);
    const walletAddress = wallet.address;        // e.g. 0x742d35Cc6634C0532925a3b844Bc454e4438f44e
    // const privateKey = wallet.privateKey;     // ← DO NOT store unencrypted!

    const passwordHash = await bcrypt.hash(password, 10);
    const role_id = await getRoleId(role);

    const userResult = await query(
      `INSERT INTO users (
        full_name,
        email,
        password_hash,
        phone,
        role_id,
        wallet_address,
        is_active,
        kyc_status,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, true, 'pending', NOW())
      RETURNING id, full_name AS name, email, role_id, wallet_address`,
      [name, email, passwordHash, phone || null, role_id, walletAddress]
    );

    if (userResult.rows.length === 0) {
      return { success: false, error: "Failed to create user account" };
    }

    const newUser = userResult.rows[0];
    let issuerId = null;

    // Create issuer profile (unchanged)
   // === Create issuer profile (FIXED) ===
if (role === "issuer") {
  // 1. First check if issuer profile already exists
  const existingIssuer = await query(
    "SELECT id FROM issuers WHERE user_id = $1 LIMIT 1",
    [newUser.id]
  );

  if (existingIssuer.rows.length > 0) {
    issuerId = existingIssuer.rows[0].id;
    console.log(`Issuer profile already exists for user ${newUser.id}`);
  } else {
    // 2. Safe insert with all required columns
    const issuerResult = await query(
      `INSERT INTO issuers (
          user_id,
          company_name,
          company_reg_number,
          status,
          approved,
          created_at
      ) VALUES ($1, $2, $3, 'pending', false, NOW())
      RETURNING id`,
      [newUser.id, name.trim(), companyReg]
    );

    if (issuerResult.rows.length > 0) {
      issuerId = issuerResult.rows[0].id;
      console.log(`✅ New issuer profile created (ID: ${issuerId})`);
    }
  }
}

    // Optional: Create empty wallet record (if you still use your wallets table)
    // await createWallet(newUser.id);   // uncomment if needed

    console.log(`✅ New ${role} registered → Wallet: ${walletAddress}`);

    return {
      success: true,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: await getRoleName(newUser.role_id),
        walletAddress: newUser.wallet_address,
        ...(issuerId && { issuer_profile_id: issuerId }),
      }
    };

  } catch (err) {
    console.error("[REGISTER ERROR]", err.message, err.stack?.substring(0, 400));
    return {
      success: false,
      error: err.message?.includes("duplicate key") || err.message?.includes("unique constraint")
        ? "This email or company registration number is already in use"
        : "Registration failed – please try again later"
    };
  }
}
/* ====================================================
   SUBMIT KYC – FIXED: no more overwriting issuer data
   ==================================================== */
/*export async function submitKYC(formData) {
  try {
    if (!formData || typeof formData.get !== "function") {
      return { success: false, error: "Invalid submission format – expected FormData" };
    }

    const userIdRaw = formData.get("userId");
    const userId = Number(userIdRaw);

    if (!userId || isNaN(userId)) {
      return { success: false, error: "User ID is missing or invalid" };
    }

    const role = formData.get("role")?.toString().trim() || "investor";

    // Investor fields
    const idNumber     = role === "investor" ? formData.get("idNumber")?.toString().trim() : null;
    const idType       = role === "investor" ? (formData.get("idType") || "national_id") : null;
    const dateOfBirth  = role === "investor" ? formData.get("dateOfBirth") : null;
    const occupation   = role === "investor" ? formData.get("occupation")?.toString().trim() : null;
    const sourceOfFunds = role === "investor" ? formData.get("sourceOfFunds") : null;

    const address = formData.get("address")?.toString().trim() || null;
    const city    = formData.get("city")?.toString().trim() || null;

    if (role === "investor" && !idNumber) {
      return { success: false, error: "ID number is required for investors" };
    }

    const dob = dateOfBirth ? new Date(dateOfBirth).toISOString().split("T")[0] : null;

    //const mainDocumentPath = `/uploads/kyc/${userId}/${Date.now()}/submission_${Date.now()}`;
    const mainDocumentPath = `C:\\Users\\PC\\Documents\\kyc\\${userId}`;
    
    // 1. Create KYC record
    const kycResult = await query(
      `INSERT INTO kyc_records (
        user_id, id_number, id_type, date_of_birth,
        address, city, occupation, source_of_funds,
        document_path, submitted_at, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), 'pending')
      RETURNING id`,
      [userId, idNumber, idType, dob, address, city, occupation, sourceOfFunds, mainDocumentPath]
    );

    if (kycResult.rows.length === 0) {
      return { success: false, error: "Failed to create KYC record" };
    }

    const kycId = kycResult.rows[0].id;

    // 2. Update user status
    await query("UPDATE users SET kyc_status = 'submitted' WHERE id = $1", [userId]);

    // 3. Safe issuer update – only if fields are provided, never wipe existing data
    const companyName        = formData.get("companyName")?.toString().trim() || "";
    const registrationNumber = formData.get("registrationNumber")?.toString().trim() || "";

    if (role === "issuer") {
      // Optional: enforce that issuer already has profile (from registration)
      const issuerCheck = await query(
        "SELECT 1 FROM issuers WHERE user_id = $1 LIMIT 1",
        [userId]
      );

      if (issuerCheck.rows.length === 0) {
        return { success: false, error: "Issuer profile not found. Please complete registration first." };
      }

      // Only update if at least one field is filled
      if (companyName || registrationNumber) {
        await query(
          `UPDATE issuers
           SET
             company_name       = COALESCE(NULLIF($1, ''), company_name),
             company_reg_number = COALESCE(NULLIF($2, ''), company_reg_number),
             updated_at         = NOW()
           WHERE user_id = $3`,
          [companyName, registrationNumber, userId]
        );

        console.log(`[KYC] Issuer profile safely updated for user ${userId}`);
      }
    }

    // 4. Save uploaded documents
    const documentMappings = [
     // { field: "idProof",           type: "id_proof" },
      //{ field: "proofOfAddress",    type: "proof_of_address" },
      { field: "licenseProof",      type: "license_proof" },
      { field: "companyRegProof",   type: "company_registration_proof" },
      { field: "financialsProof",   type: "audited_financials" },
      { field: "appointmentLetter", type: "appointment_letter" },
    ];

    for (const { field, type } of documentMappings) {
      const file = formData.get(field);

      if (file && file instanceof Blob && file.size > 0) {
        const originalName = file.name || "unnamed_document";
        const documentNumber = `DOC-${userId}-${kycId}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

        const fullDiskPath = `C:\\Users\\PC\\Documents\\${userId}\\${kycId}\\${type}\\${timestamp}_${safeName}`;
        //const documentUrl = `/uploads/kyc/${userId}/${kycId}/${type}/${Date.now()}_${originalName.replace(/\s+/g, '_')}`;
        const documentUrl = `C:\\Users\\PC\\Documents\\${userId}\\${kycId}\\${type}\\${Date.now()}_${originalName.replace(/\s+/g, '_')}`;
        
        await query(
          `INSERT INTO kyc_documents (
            user_id, kyc_record_id, document_type, document_number,
            document_url, status, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, 'pending', NOW(), NOW())`,
          [userId, kycId, type, documentNumber, documentUrl]
        );

        console.log(`[KYC] Document saved: ${type} → ${documentUrl}`);
      }
    }

    return { success: true, message: "KYC and documents submitted successfully", kycId };

  } catch (err) {
    console.error("[KYC SUBMIT ERROR]", err.message, err.stack?.substring(0, 400));
    return {
      success: false,
      error: "KYC submission failed: " + (err.message || "unknown database error"),
    };
  }
}*/
export async function submitKYC(formData) {
  try {
    const userId = Number(formData.get("userId"));
    if (!userId || isNaN(userId)) {
      return { success: false, error: "User ID is missing or invalid" };
    }

    const role = (formData.get("role") || "investor").toString().trim().toLowerCase();

    // =========================
    // Extract fields
    // =========================
    const idNumber = formData.get("idNumber")?.toString().trim() || null;
    const idType = formData.get("idType")?.toString().trim() || "national_id";

    const dob = formData.get("dateOfBirth")
      ? new Date(formData.get("dateOfBirth")).toISOString().split("T")[0]
      : null;

    const address = formData.get("address")?.toString().trim() || null;
    const city = formData.get("city")?.toString().trim() || null;
    const occupation = formData.get("occupation")?.toString().trim() || null;
    const sourceOfFunds = formData.get("sourceOfFunds")?.toString().trim() || null;

    const licenseNumber = formData.get("licenseNumber")?.toString().trim() || null;
    const appointmentLetter = formData.get("appointmentLetter");

    // =========================
    // ✅ ROLE-BASED VALIDATION
    // =========================

    // Always required
    if (!address) {
      return { success: false, error: "Address is required" };
    }

    if (role === "investor") {
      if (!idNumber || !dob) {
        return {
          success: false,
          error: "ID number and date of birth are required for investors",
        };
      }
    }

    if (role === "issuer" || role === "broker") {
      if (!licenseNumber) {
        return {
          success: false,
          error: "License number is required for issuer/broker",
        };
      }
    }

    if (role === "admin" || role === "regulator") {
      if (!appointmentLetter) {
        return {
          success: false,
          error: "Appointment letter is required",
        };
      }
    }

    // =========================
    // Insert KYC Record
    // =========================
    const kycResult = await pool.query(
      `
      INSERT INTO kyc_records 
        (user_id, id_number, id_type, date_of_birth, address, city, 
         occupation, source_of_funds, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
      RETURNING id
    `,
      [userId, idNumber, idType, dob, address, city, occupation, sourceOfFunds]
    );

    const kycId = kycResult.rows[0].id;

    await query("UPDATE users SET kyc_status = 'submitted' WHERE id = $1", [userId]);

    // =========================
    // Process uploaded documents
    // =========================
    const mappings = [
      { field: "idProof", type: "id_proof" },
      { field: "proofOfAddress", type: "proof_of_address" },
      { field: "licenseProof", type: "license_proof" },
      { field: "companyRegProof", type: "company_registration_proof" },
      { field: "financialsProof", type: "audited_financials" },
      { field: "appointmentLetter", type: "appointment_letter" },
    ];

    let mainDocumentUrl = null;
    let savedCount = 0;

    for (const { field, type } of mappings) {
      const file = formData.get(field);
      if (!file || !(file instanceof Blob) || file.size === 0) continue;

      let documentNumber = (file.name || `${type}.pdf`).replace(/[^a-zA-Z0-9._-]/g, "_");
      let documentUrl = null;

      // Attempt upload to Supabase Storage
      try {
        const uploadResult = await uploadKYCDocument(userId, kycId, type, file);
        if (uploadResult.success) {
          documentUrl = uploadResult.publicUrl;
          if (!mainDocumentUrl) mainDocumentUrl = documentUrl;
          console.log(`[KYC] Document uploaded: ${type} → ${documentUrl}`);
        } else {
          console.warn(`[KYC] Storage upload failed for ${type}: ${uploadResult.error}. Recording metadata only.`);
        }
      } catch (uploadErr) {
        console.warn(`[KYC] Storage upload exception for ${type}:`, uploadErr.message);
      }

      // Always record in kyc_documents — even if storage upload failed.
      // The admin can still see what documents were submitted; URL will be null if upload failed.
      await query(
        `INSERT INTO kyc_documents
           (user_id, kyc_record_id, document_type, document_number, document_url, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'pending', NOW(), NOW())`,
        [userId, kycId, type, documentNumber, documentUrl]
      );

      savedCount++;
    }

    // =========================
    // Update main document path
    // =========================
    if (mainDocumentUrl) {
      await pool.query(
        `UPDATE kyc_records SET document_path = $1 WHERE id = $2`,
        [mainDocumentUrl, kycId]
      );
    }

    return {
      success: true,
      message: `KYC submitted successfully with ${savedCount} document(s)`,
      kycId,
    };
  } catch (err) {
    console.error("[KYC ERROR]", err);
    return { success: false, error: err.message || "KYC submission failed" };
  }
}

/* ====================================================
   LOGIN USER
   ==================================================== */
export async function loginUser({ email, password }) {
  try {
    if (!email || !password) {
      return { success: false, error: "Email and password are required" };
    }

    const cleanEmail = email.toLowerCase().trim();

    const result = await query(
      `SELECT id, full_name AS name, email, role_id, password_hash, is_active
       FROM users
       WHERE email = $1`,
      [cleanEmail]
    );

    if (result.rows.length === 0) {
      return { success: false, error: "No account found with that email" };
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return { success: false, error: "Account is deactivated. Contact support." };
    }

    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      return { success: false, error: "Incorrect password" };
    }

    const role = await getRoleName(user.role_id);
    const token = signToken({ id: user.id, email: user.email, role });

    return {
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role,
      },
    };
  } catch (err) {
    console.error("[LOGIN ERROR]", err.message);
    return { success: false, error: "Login failed – please try again" };
  }
}

/* ====================================================
   WALLET & DEPOSIT
   ==================================================== */
export async function createWallet(userId) {
  try {
    await query(
      "INSERT INTO wallets (user_id, balance) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING",
      [userId, 0]
    );
    return { success: true };
  } catch (err) {
    console.error("[CREATE WALLET ERROR]", err);
    return { success: false, error: "Failed to create wallet" };
  }
}

export async function depositFunds(userId, amount, method, details = {}) {
  try {
    if (amount <= 0) {
      return { success: false, error: "Amount must be positive" };
    }

    const walletRes = await query(
      "SELECT id FROM wallets WHERE user_id = $1",
      [userId]
    );

    if (!walletRes.rows.length) {
      return { success: false, error: "Wallet not found" };
    }

    const walletId = walletRes.rows[0].id;

    await query(
      "UPDATE wallets SET balance = balance + $1 WHERE id = $2",
      [amount, walletId]
    );

    await query(
      `INSERT INTO wallet_transactions
      (wallet_id, type, amount, method, metadata)
      VALUES ($1, $2, $3, $4, $5)`,
      [walletId, "deposit", amount, method, JSON.stringify(details)]
    );

    return { success: true };
  } catch (error) {
    console.error("Deposit error:", error);
    return { success: false, error: "Deposit failed" };
  }
}