// app/api/documents/[filename]/route.js
// Serves KYC documents from Supabase Storage

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const BUCKET_NAME = "kyc-documents";

export async function GET(request, { params }) {
  try {
    const { filename } = await params;

    if (!filename) {
      return NextResponse.json(
        { error: "Filename is required" },
        { status: 400 }
      );
    }

    // Extract userId and kycId from query params (optional for validation)
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const kycId = searchParams.get("kycId");

    // Build the storage path from filename
    // Expected format: kyc/{userId}/{kycId}/{documentType}/{filename}
    const storagePath = `kyc/${userId}/${kycId}/${filename}`;

    console.log(`[Documents API] Retrieving: ${storagePath}`);

    // Download file from Supabase Storage
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .download(storagePath);

    if (error) {
      console.error(`[Documents API] Download error: ${storagePath}`, error);
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Determine content type based on filename
    const ext = filename.split(".").pop()?.toLowerCase() || "";
    const contentTypes = {
      pdf: "application/pdf",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xls: "application/vnd.ms-excel",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };

    const contentType = contentTypes[ext] || "application/octet-stream";

    return new NextResponse(data, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("[Documents API] Error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve document" },
      { status: 500 }
    );
  }
}

