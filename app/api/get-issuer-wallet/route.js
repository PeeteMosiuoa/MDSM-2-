// app/api/get-issuer-wallet/route.js
// Fetches the wallet address for an issuer
// app/api/get-issuer-wallet/route.js
// Fetches the wallet address for an issuer

import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { ethers } from "ethers";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const issuerId = searchParams.get("issuerId");

    if (!issuerId) {
      return NextResponse.json(
        { success: false, error: "issuerId is required" },
        { status: 400 }
      );
    }

    const numericId = Number(issuerId);
    if (isNaN(numericId) || numericId < 1) {
      return NextResponse.json(
        { success: false, error: "Invalid issuerId" },
        { status: 400 }
      );
    }

    // wallet_address lives on users, joined via issuers.user_id
    const result = await query(
      `SELECT u.wallet_address 
       FROM users u 
       INNER JOIN issuers i ON i.user_id = u.id 
       WHERE i.id = $1`,
      [numericId]
    );

    if (result?.rows?.length > 0 && result.rows[0].wallet_address) {
      const wallet = result.rows[0].wallet_address;
      // Validate and return checksummed address
      if (!ethers.isAddress(wallet)) {
        return NextResponse.json(
          { success: false, error: `Invalid wallet address format for issuer ${numericId}` },
          { status: 400 }
        );
      }
      return NextResponse.json({
        success: true,
        issuerId: numericId,
        walletAddress: ethers.getAddress(wallet) // Returns checksummed address
      });
    }

    return NextResponse.json(
      { success: false, error: `No wallet found for issuer ${numericId}` },
      { status: 404 }
    );

  } catch (error) {
    console.error("Error fetching issuer wallet:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch wallet" },
      { status: 500 }
    );
  }
}
