// app/api/tokenize/route.js
/*import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { query, withTransaction } from "@/lib/db";

const RPC_URL = process.env.BLOCKCHAIN_RPC_URL;
const ADMIN_PRIVATE_KEY = process.env.ADMIN_WALLET_PRIVATE_KEY || process.env.BACKEND_PRIVATE_KEY;
const TOKEN_CONTRACT_ADDRESS = process.env.SECURITY_TOKEN_CONTRACT_ADDRESS || "0x2f150C5Ba6e9D429F8856A7F79F65E37e13a28cF";

const TOKEN_ABI = ["function mint(address to, uint256 amount) returns (bool)"];

export async function POST(request) {
  let listingIdForRollback = null;

  try {
    const body = await request.json();
    
    // ── STRICT: Only accept issuerId (as per your request) ─────────────────
    const issuerId = Number(body.issuerId);
    const walletFromUI = body.walletAddress ?? null;

    if (!issuerId || isNaN(issuerId)) {
      return NextResponse.json(
        { success: false, error: "Missing or invalid issuerId. listingId is no longer accepted." },
        { status: 400 }
      );
    }

    if (!RPC_URL || !ADMIN_PRIVATE_KEY) {
      return NextResponse.json(
        { success: false, error: "Server misconfiguration — missing BLOCKCHAIN_RPC_URL or ADMIN_WALLET_PRIVATE_KEY" },
        { status: 500 }
      );
    }

    const formattedPrivateKey = ADMIN_PRIVATE_KEY.startsWith("0x") 
      ? ADMIN_PRIVATE_KEY 
      : `0x${ADMIN_PRIVATE_KEY}`;

    // ── Database Operations (issuer-first) ────────────────────────────────
    const txData = await withTransaction(async (client) => {
      // Find the pending listing using issuer_id only
      const listingRes = await client.query(
        `
        SELECT * FROM listings 
        WHERE issuer_id = $1 
          AND status IN ('pending', 'minting')
        ORDER BY submitted_at DESC 
        LIMIT 1
        `,
        [issuerId]
      );

      if (listingRes.rows.length === 0) {
        throw new Error(`No pending or minting listing found for issuer ${issuerId}`);
      }

      const listing = listingRes.rows[0];
      listingIdForRollback = listing.id;

      if (listing.status === "approved") {
        throw new Error(`Listing ${listing.id} is already approved`);
      }

      const supply = Number(listing.total_tokens);
      if (!supply || supply <= 0) {
        throw new Error(`Invalid total_tokens for listing ${listing.id}`);
      }

      // Get wallet from issuers table (primary source)
      const walletRes = await client.query(
        `SELECT wallet_address FROM issuers WHERE id = $1`,
        [issuerId]
      );

      let wallet = walletFromUI ?? walletRes.rows[0]?.wallet_address;

      if (!wallet || !ethers.isAddress(wallet)) {
        throw new Error(`Issuer ${issuerId} has no valid wallet_address`);
      }

      // Mark as minting (using listing.id internally)
      await client.query(
        `UPDATE listings SET status = 'minting' WHERE id = $1`,
        [listing.id]
      );

      return { listing, supply, wallet };
    });

    // ── Blockchain Mint Operation ─────────────────────────────────────────
    const { listing, supply, wallet } = txData;

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const admin = new ethers.Wallet(formattedPrivateKey, provider);
    const contract = new ethers.Contract(TOKEN_CONTRACT_ADDRESS, TOKEN_ABI, admin);

    const amount = ethers.parseUnits(String(supply), 18);

    const tx = await contract.mint(wallet, amount);
    const receipt = await tx.wait();

    // ── Final Database Update ─────────────────────────────────────────────
    await withTransaction(async (client) => {
      // Update listing
      await client.query(
        `UPDATE listings 
         SET status = 'approved', 
             approved_at = NOW(),
             tx_hash = $2,
             token_contract_address = $3
         WHERE id = $1`,
        [listing.id, receipt.hash, TOKEN_CONTRACT_ADDRESS]
      );

      // Insert into securities table (adjust columns as per your actual schema)
      await client.query(
        `
        INSERT INTO securities (
          issuer_id, name, symbol, total_supply, price, 
          approved, tx_hash, token_contract_address, created_at
        ) VALUES ($1, $2, $3, $4, $5, true, $6, $7, NOW())
        ON CONFLICT (symbol) DO UPDATE 
        SET approved = true, 
            tx_hash = EXCLUDED.tx_hash,
            token_contract_address = EXCLUDED.token_contract_address
        `,
        [
          listing.issuer_id,
          listing.name,
          listing.symbol,
          supply,
          Number(listing.initial_price) || 0,
          receipt.hash,
          TOKEN_CONTRACT_ADDRESS
        ]
      );

      // Audit log
      await client.query(
        `INSERT INTO audit_logs (action, performed_by, target_table, created_at) 
         VALUES ($1, $2, $3, NOW())`,
        [
          "LISTING_TOKENIZED", 
          1, 
          `Listing ${listing.id} (Issuer ${issuerId}) tokenized successfully. Tx: ${receipt.hash}`
        ]
      );
    });

    return NextResponse.json({
      success: true,
      txHash: receipt.hash,
      issuerId: listing.issuer_id,
      listingId: listing.id,        // returned for UI only
      explorerUrl: `https://explorer.example.com/tx/${receipt.hash}` // replace with your explorer
    });

  } catch (err) {
    console.error("❌ Tokenize error:", err);

    // Rollback status if possible
    if (listingIdForRollback) {
      try {
        await query(`UPDATE listings SET status = 'pending' WHERE id = $1`, [listingIdForRollback]);
      } catch (rollbackErr) {
        console.error("Rollback failed:", rollbackErr);
      }
    }

    return NextResponse.json(
      { success: false, error: err.message || "Tokenization failed" },
      { status: 500 }
    );
  }
}


*/

// app/api/tokenize/route.js
// app/api/tokenize/route.js
import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { query, withTransaction } from "@/lib/db";

const RPC_URL = process.env.BLOCKCHAIN_RPC_URL;
const ADMIN_PRIVATE_KEY = process.env.ADMIN_WALLET_PRIVATE_KEY || process.env.BACKEND_PRIVATE_KEY;
const TOKEN_CONTRACT_ADDRESS = process.env.SECURITY_TOKEN_CONTRACT_ADDRESS || "0x2f150C5Ba6e9D429F8856A7F79F65E37e13a28cF";

const TOKEN_ABI = ["function mint(address to, uint256 amount) returns (bool)"];

export async function POST(request) {
  let listingIdForRollback = null;

  try {
    const body = await request.json();
    
    // ── STRICT: Only accept issuerId (as per your request) ─────────────────
    const issuerId = Number(body.issuerId);
    const walletFromUI = body.walletAddress ?? null;

    if (!issuerId || isNaN(issuerId)) {
      return NextResponse.json(
        { success: false, error: "Missing or invalid issuerId. listingId is no longer accepted." },
        { status: 400 }
      );
    }

    if (!RPC_URL || !ADMIN_PRIVATE_KEY) {
      return NextResponse.json(
        { success: false, error: "Server misconfiguration — missing BLOCKCHAIN_RPC_URL or ADMIN_WALLET_PRIVATE_KEY" },
        { status: 500 }
      );
    }

    const formattedPrivateKey = ADMIN_PRIVATE_KEY.startsWith("0x") 
      ? ADMIN_PRIVATE_KEY 
      : `0x${ADMIN_PRIVATE_KEY}`;

    // ── Database Operations (issuer-first) ────────────────────────────────
    const txData = await withTransaction(async (client) => {
      // Find the pending listing using issuer_id only
      const listingRes = await client.query(
        `
        SELECT * FROM listings 
        WHERE issuer_id = $1 
          AND status IN ('pending', 'minting')
        ORDER BY submitted_at DESC 
        LIMIT 1
        `,
        [issuerId]
      );

      if (listingRes.rows.length === 0) {
        throw new Error(`No pending or minting listing found for issuer ${issuerId}`);
      }

      const listing = listingRes.rows[0];
      listingIdForRollback = listing.id;

      if (listing.status === "approved") {
        throw new Error(`Listing ${listing.id} is already approved`);
      }

      const supply = Number(listing.total_tokens);
      if (!supply || supply <= 0) {
        throw new Error(`Invalid total_tokens for listing ${listing.id}`);
      }

      // Get wallet from issuers table (primary source)
      const walletRes = await client.query(
        `SELECT wallet_address FROM issuers WHERE id = $1`,
        [issuerId]
      );

      let wallet = walletFromUI ?? walletRes.rows[0]?.wallet_address;

      if (!wallet || !ethers.isAddress(wallet)) {
        throw new Error(`Issuer ${issuerId} has no valid wallet_address`);
      }

      // Mark as minting (using listing.id internally)
      await client.query(
        `UPDATE listings SET status = 'minting' WHERE id = $1`,
        [listing.id]
      );

      return { listing, supply, wallet };
    });

    // ── Blockchain Mint Operation ─────────────────────────────────────────
    const { listing, supply, wallet } = txData;

    // Create provider with ENS disabled for local networks
    const provider = new ethers.JsonRpcProvider(RPC_URL, undefined, {
      staticNetwork: true  // Prevents ENS lookups on local networks
    });
    
    const admin = new ethers.Wallet(formattedPrivateKey, provider);
    const contract = new ethers.Contract(TOKEN_CONTRACT_ADDRESS, TOKEN_ABI, admin);

    const amount = ethers.parseUnits(String(supply), 18);

    // Ensure wallet is a valid checksum address (not ENS name)
    const checksumWallet = ethers.getAddress(wallet);
    
    const tx = await contract.mint(checksumWallet, amount);
    const receipt = await tx.wait();

    // ── Final Database Update ─────────────────────────────────────────────
    await withTransaction(async (client) => {
      // Update listing
      await client.query(
        `UPDATE listings 
         SET status = 'approved', 
             approved_at = NOW(),
             tx_hash = $2,
             token_contract_address = $3
         WHERE id = $1`,
        [listing.id, receipt.hash, TOKEN_CONTRACT_ADDRESS]
      );

      // Insert into securities table (adjust columns as per your actual schema)
      await client.query(
        `
        INSERT INTO securities (
          issuer_id, name, symbol, total_supply, price, 
          approved, tx_hash, token_contract_address, created_at
        ) VALUES ($1, $2, $3, $4, $5, true, $6, $7, NOW())
        ON CONFLICT (symbol) DO UPDATE 
        SET approved = true, 
            tx_hash = EXCLUDED.tx_hash,
            token_contract_address = EXCLUDED.token_contract_address
        `,
        [
          listing.issuer_id,
          listing.name,
          listing.symbol,
          supply,
          Number(listing.initial_price) || 0,
          receipt.hash,
          TOKEN_CONTRACT_ADDRESS
        ]
      );

      // Insert blockchain record for tracking
      await client.query(
        `
        INSERT INTO blockchain_records (
          security_id, listing_id, token_id, tx_hash, contract_address, 
          issuer_wallet, block_number, gas_used, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'confirmed', NOW())
        ON CONFLICT (tx_hash) DO UPDATE 
        SET status = 'confirmed',
            block_number = EXCLUDED.block_number,
            gas_used = EXCLUDED.gas_used
        `,
        [
          listing.id,
          listing.id,
          `TOKEN-${listing.symbol}-${listing.id}`,
          receipt.hash,
          TOKEN_CONTRACT_ADDRESS,
          wallet,
          receipt.blockNumber,
          receipt.gasUsed?.toString() || "0"
        ]
      );

      // Audit log
      await client.query(
        `INSERT INTO audit_logs (action, performed_by, target_table, created_at) 
         VALUES ($1, $2, $3, NOW())`,
        [
          "LISTING_TOKENIZED", 
          1, 
          `Listing ${listing.id} (Issuer ${issuerId}) tokenized successfully. Tx: ${receipt.hash}`
        ]
      );
    });

    return NextResponse.json({
      success: true,
      txHash: receipt.hash,
      contractAddress: TOKEN_CONTRACT_ADDRESS,
      blockNumber: receipt.blockNumber,
      issuerId: listing.issuer_id,
      listingId: listing.id,
      securityId: listing.id,
      gasUsed: receipt.gasUsed?.toString() || "0",
      explorerUrl: `https://etherscan.io/tx/${receipt.hash}`
    });

  } catch (err) {
    console.error("❌ Tokenize error:", err);

    // Rollback status if possible
    if (listingIdForRollback) {
      try {
        await query(`UPDATE listings SET status = 'pending' WHERE id = $1`, [listingIdForRollback]);
      } catch (rollbackErr) {
        console.error("Rollback failed:", rollbackErr);
      }
    }

    return NextResponse.json(
      { success: false, error: err.message || "Tokenization failed" },
      { status: 500 }
    );
  }
}
