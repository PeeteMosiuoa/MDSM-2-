// app/api/wallet/withdraw/route.js
import { NextResponse } from "next/server";
import { query } from "@/lib/db";  // ← Use absolute import (fix path if needed)

export async function POST(request) {
  try {
    const body = await request.json();
    const { userId, amount, description = "Manual withdrawal" } = body;

    if (!userId || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
    }

    // Start transaction using query
    await query("BEGIN");

    try {
      // Lock row for update
      const walletRes = await query(
        "SELECT id, balance FROM wallets WHERE user_id = $1 FOR UPDATE",
        [userId]
      );

      const wallet = walletRes.rows[0];

      if (!wallet) {
        await query("ROLLBACK");
        return NextResponse.json({ error: "Wallet not found" }, { status: 400 });
      }

      const currentBalance = Number(wallet.balance);
      if (currentBalance < amount) {
        await query("ROLLBACK");
        return NextResponse.json({ error: "Insufficient balance" }, { status: 400 });
      }

      const newBalance = currentBalance - amount;

      await query(
        "UPDATE wallets SET balance = $1, updated_at = NOW() WHERE id = $2",
        [newBalance, wallet.id]
      );

      await query(
        `INSERT INTO wallet_transactions 
         (wallet_id, transaction_type, amount, description, created_at)
         VALUES ($1, 'withdraw', $2, $3, NOW())`,
        [wallet.id, amount, description]
      );

      await query("COMMIT");

      return NextResponse.json({
        success: true,
        message: "Withdrawal successful",
        newBalance,
      });
    } catch (innerErr) {
      await query("ROLLBACK");
      console.error("Withdraw transaction failed:", innerErr);
      throw innerErr;
    }
  } catch (error) {
    console.error("Withdraw route error:", error);
    return NextResponse.json({ error: "Withdrawal failed" }, { status: 500 });
  }
}