// lib/storage/kyc-storage.js
// Supabase Storage utility for KYC document uploads (server-side only)

import { createClient } from "@supabase/supabase-js";

const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Prefer service role key for server-side uploads — it bypasses RLS so the
// bucket doesn't need a special anon-upload policy. Falls back to anon key.
const supabaseKey     = process.env.SUPABASE_SERVICE_ROLE_KEY
                     || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const BUCKET_NAME = process.env.SUPABASE_KYC_BUCKET || "kyc-documents";

function getClient() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and " +
      "SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) in .env.local"
    );
  }
  return createClient(supabaseUrl, supabaseKey);
}

/**
 * Ensure the KYC bucket exists. Creates it as a private bucket if missing.
 */
async function ensureBucket(supabase) {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) {
    console.warn("[KYC Storage] Could not list buckets:", error.message);
    return; // proceed anyway — bucket may still exist
  }
  const exists = buckets.some((b) => b.name === BUCKET_NAME);
  if (!exists) {
    const { error: createErr } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: false,
    });
    if (createErr) {
      console.warn("[KYC Storage] Could not create bucket:", createErr.message);
    } else {
      console.log(`[KYC Storage] Bucket "${BUCKET_NAME}" created.`);
    }
  }
}

/**
 * Upload a KYC document to Supabase Storage.
 * Returns { success, publicUrl?, path?, error? }
 */
export async function uploadKYCDocument(userId, kycId, documentType, file) {
  try {
    if (!userId || !kycId || !documentType || !file) {
      return { success: false, error: "Missing required parameters" };
    }

    const supabase = getClient();
    await ensureBucket(supabase);

    // Unique filename
    const timestamp    = Date.now();
    const randomId     = Math.random().toString(36).substring(2, 10);
    const originalName = (file.name || "document").replace(/[^a-zA-Z0-9._-]/g, "_").toLowerCase();
    const filename     = `${timestamp}-${randomId}-${originalName}`;
    const storagePath  = `kyc/${userId}/${kycId}/${documentType}/${filename}`;

    const buffer = file instanceof Blob
      ? Buffer.from(await file.arrayBuffer())
      : Buffer.from(file);

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (error) {
      console.error("[KYC Storage] Upload error:", error.message);
      return { success: false, error: error.message };
    }

    // For private buckets, create a signed URL (1 year expiry); for public use getPublicUrl.
    let publicUrl = null;
    try {
      const { data: signed, error: signErr } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(data.path, 60 * 60 * 24 * 365); // 1 year
      if (!signErr && signed?.signedUrl) {
        publicUrl = signed.signedUrl;
      } else {
        // Fallback: public URL (works if bucket is set to public)
        const { data: pub } = supabase.storage.from(BUCKET_NAME).getPublicUrl(data.path);
        publicUrl = pub.publicUrl;
      }
    } catch {
      const { data: pub } = supabase.storage.from(BUCKET_NAME).getPublicUrl(data.path);
      publicUrl = pub.publicUrl;
    }

    console.log(`[KYC Storage] Uploaded: ${storagePath}`);
    return { success: true, publicUrl, path: data.path };

  } catch (err) {
    console.error("[KYC Storage] Unexpected error:", err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Delete a KYC document from Supabase Storage.
 */
export async function deleteKYCDocument(storagePath) {
  try {
    const supabase = getClient();
    const { error } = await supabase.storage.from(BUCKET_NAME).remove([storagePath]);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Get a signed URL for a stored document (1-hour expiry).
 */
export async function getKYCDocumentUrl(storagePath) {
  try {
    const supabase = getClient();
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(storagePath, 3600);
    if (error) throw error;
    return data.signedUrl;
  } catch {
    // Fall back to public URL
    const supabase = getClient();
    const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(storagePath);
    return data.publicUrl;
  }
}
