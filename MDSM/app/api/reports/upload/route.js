import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

const ALLOWED_TYPES = {
  "application/pdf": ".pdf",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
};

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(request) {
  try {
    // Auth check — requireAuth returns { user, response } (response is set on failure)
    const auth = await requireAuth(request);
    if (auth.response) return auth.response;          // 401 cors error response
    if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    }

    // Validate type
    const ext = ALLOWED_TYPES[file.type];
    if (!ext) {
      return NextResponse.json(
        { error: "Invalid file type. Only PDF (.pdf) and Excel (.xlsx, .xls) are accepted." },
        { status: 400 }
      );
    }

    // Validate size
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10 MB." },
        { status: 400 }
      );
    }

    // Build safe filename: timestamp + user id + extension
    const timestamp = Date.now();
    const safeName  = `report_${auth.user.id}_${timestamp}${ext}`;
    const uploadDir = join(process.cwd(), "public", "uploads", "reports");

    // Ensure directory exists
    await mkdir(uploadDir, { recursive: true });

    // Write file
    const bytes  = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(join(uploadDir, safeName), buffer);

    const fileUrl = `/uploads/reports/${safeName}`;
    return NextResponse.json({ success: true, url: fileUrl, name: file.name, size: file.size });
  } catch (err) {
    console.error("Report upload failed:", err);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
