import { query } from "@/lib/db";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const body = await req.json();
    console.log("Incoming body:", body);

    const { name, email, password, role, phone } = body;

    // Validate required fields
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const roleRes = await query("SELECT id FROM roles WHERE role_name = $1 LIMIT 1", [role || "investor"]);
    if (roleRes.rows.length === 0) {
      return NextResponse.json({ error: `Unknown role: ${role}` }, { status: 400 });
    }
    const roleId = roleRes.rows[0].id;

    // Check if email exists
    const existing = await query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );

    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await query(
      `INSERT INTO users
      (full_name, email, password_hash, role_id, is_active, created_at, phone)
      VALUES ($1,$2,$3,$4,true,NOW(),$5)
      RETURNING id, full_name, email, role_id, is_active, created_at, phone`,
      [name, email, passwordHash, roleId, phone || null]
    );

    return NextResponse.json(
      { user: result.rows[0] },
      { status: 201 }
    );

  } catch (err) {
    console.error("Register error:", err);

    return NextResponse.json(
      { error: err.message || "User registration failed" },
      { status: 500 }
    );
  }
}