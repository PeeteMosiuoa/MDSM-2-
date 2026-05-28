// app/api/wallet/route.js
import { NextResponse } from "next/server";
import { query } from "@/lib/db";  // ← make sure this import works (use absolute path)

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    // Use query directly instead of getRow
    const result = await query(
      "SELECT balance, currency FROM wallets WHERE user_id = $1 AND status = 'active' LIMIT 1",
      [userId]
    );

    let wallet = result.rows[0];

    if (!wallet) {
      // Auto-create wallet if missing
      const newWalletRes = await query(
        `INSERT INTO wallets (user_id, balance, currency, status, created_at, updated_at)
         VALUES ($1, 0, 'LSL', 'active', NOW(), NOW())
         RETURNING balance, currency`,
        [userId]
      );
      wallet = newWalletRes.rows[0];
    }

    // Return flat object (what frontend expects)
    return NextResponse.json({
      balance: Number(wallet.balance),
      currency: wallet.currency,
    });

  } catch (err) {
    console.error("Wallet GET error:", err);
    return NextResponse.json({ error: "Failed to fetch wallet" }, { status: 500 });
  }
}