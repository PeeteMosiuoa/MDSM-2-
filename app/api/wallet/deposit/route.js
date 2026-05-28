import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(request) {
  try {
    const body = await request.json();
    const { userId, amount } = body;

    const MIN_DEPOSIT = 1_000;
    const MAX_DEPOSIT = 100_000_000;

    if (!userId || !amount) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }

    const amountNum = Number(amount);

    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json({ error: "Deposit amount must be a positive number." }, { status: 400 });
    }

    if (amountNum < MIN_DEPOSIT) {
      return NextResponse.json(
        { error: `Minimum deposit is M${MIN_DEPOSIT.toLocaleString()}.` },
        { status: 400 }
      );
    }

    if (amountNum > MAX_DEPOSIT) {
      return NextResponse.json(
        { error: `Maximum deposit is M${MAX_DEPOSIT.toLocaleString()}.` },
        { status: 400 }
      );
    }

    const walletRes = await query(
      "SELECT id, balance FROM wallets WHERE user_id=$1",
      [userId]
    );

    let walletId;
    let balance = 0;

    if (walletRes.rows.length === 0) {
      const newWallet = await query(
        "INSERT INTO wallets(user_id,balance,currency) VALUES($1,0,'LSL') RETURNING id,balance",
        [userId]
      );

      walletId = newWallet.rows[0].id;
      balance = 0;

    } else {

      walletId = walletRes.rows[0].id;
      balance = Number(walletRes.rows[0].balance);

    }

    const newBalance = balance + Number(amount);

    const update = await query(
      "UPDATE wallets SET balance=$1 WHERE id=$2 RETURNING *",
      [newBalance, walletId]
    );

    await query(
      `INSERT INTO wallet_transactions
       (wallet_id,transaction_type,amount,description)
       VALUES($1,'deposit',$2,'Virtual deposit')`,
      [walletId, amount]
    );

    return NextResponse.json({
      success: true,
      wallet: update.rows[0],
    });

  } catch (error) {

    console.error("Deposit error:", error);

    return NextResponse.json(
      { error: "Deposit failed" },
      { status: 500 }
    );

  }
}