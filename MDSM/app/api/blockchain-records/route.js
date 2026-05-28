// app/api/blockchain-records/route.js
//
// Returns on-chain trade records from onchain_trade_records joined with
// orders → securities → issuers → users so the admin Blockchain Records
// view gets every field it needs without a schema change.

import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const result = await query(`
      SELECT
        r.id,
        r.order_id,
        r.tx_hash,
        r.block_number,
        r.status,
        r.error_message,
        r.recorded_at                   AS created_at,

        -- order / security info
        o.security_id,
        o.quantity,
        o.price,
        o.type                          AS order_type,

        -- security details
        s.name                          AS security_name,
        s.symbol                        AS security_symbol,
        s.total_supply,
        s.price                         AS security_price,

        -- issuer wallet (best-effort)
        u.wallet_address                AS issuer_wallet

      FROM onchain_trade_records r
      LEFT JOIN orders     o  ON o.id  = r.order_id
      LEFT JOIN securities s  ON s.id  = o.security_id
      LEFT JOIN issuers    i  ON i.id  = s.issuer_id
      LEFT JOIN users      u  ON u.id  = i.user_id
      ORDER BY r.recorded_at DESC
      LIMIT 200
    `);

    // The contract address lives in env; expose it once so the UI can show it
    const contractAddress = process.env.TRADE_REGISTRY_ADDRESS || null;

    const records = (result.rows || []).map((r) => ({
      ...r,
      // Fields the component expects that don't exist in the DB table
      token_id:         r.security_id,           // treated as a token identifier
      contract_address: contractAddress,          // single registry contract
      gas_used:         null,                     // not stored — Besu gasPrice=0
    }));

    return NextResponse.json({
      success: true,
      records,
      count: records.length,
    });

  } catch (error) {
    console.error("Blockchain records API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch blockchain records", records: [] },
      { status: 500 }
    );
  }
}
