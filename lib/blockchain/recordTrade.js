// lib/blockchain/recordTrade.js
//
// On-chain token transfer + trade recording via SecurityTokenRegistry.
// executeTrade()  – atomically transfers tokens AND records the trade.
// recordTrade()   – record-only fallback when wallet addresses unavailable
//                   OR when executeTrade reverts (e.g. security not minted,
//                   insufficient on-chain token balance).
//
// Never throws to the caller — all errors are logged and null is returned.
//
// ── Key design decisions ─────────────────────────────────────────────────────
//
// 1. RECEIPT TIMEOUT (35 s)
//    Block period on this QBFT chain is 20 s (blockperiodseconds=20).
//    waitForReceipt() races tx.wait(1) against 35 s so at least one full
//    block can be produced before we give up.  On timeout the tx hash is
//    returned so the DB shows status='submitted' for later reconciliation.
//
// 2. CALL_EXCEPTION FALLBACK
//    executeTrade() is confirmed on-chain before ethers throws CALL_EXCEPTION.
//    That means the failed tx DID consume a nonce.  On revert we re-fetch
//    the confirmed nonce and retry with the simpler recordTrade() path so
//    every completed order always gets an on-chain audit record.
//
// 3. NONCE STRATEGY: "latest" (not "pending")
//    Each getClient() creates a brand-new signer.  Using the confirmed nonce
//    bypasses any previously-stuck pending transactions.
//
// 4. provider.destroy() in every finally block
//    Prevents the JsonRpcProvider background polling loop that would keep
//    the Next.js process alive and cause non-stop re-renders.

import { ethers } from "ethers";
import { pool } from "@/lib/db";
import { SECURITY_TOKEN_REGISTRY_ABI } from "@/blockchain/contracts/SecurityTokenRegistry";

const TRADE_REGISTRY_ABI = SECURITY_TOKEN_REGISTRY_ABI;

// Block period on this QBFT network is 20 s (blockperiodseconds=20 in genesis).
// We wait 35 s so there is enough time for at least one full block to be
// proposed, voted on, and committed before we give up.
const RECEIPT_TIMEOUT_MS = 35_000;

// ── Lazy client factory ───────────────────────────────────────────────────────

function getClient() {
  const rpcUrl          = process.env.BLOCKCHAIN_RPC_URL || "http://127.0.0.1:8545";
  const privateKey      = process.env.BACKEND_PRIVATE_KEY;
  const contractAddress = process.env.TRADE_REGISTRY_ADDRESS;
  const chainId         = BigInt(process.env.BLOCKCHAIN_CHAIN_ID || "1337");

  if (!privateKey)      throw new Error("BACKEND_PRIVATE_KEY env var is not set");
  if (!contractAddress) throw new Error("TRADE_REGISTRY_ADDRESS env var is not set");

  const network  = new ethers.Network("besu-qbft", chainId);
  const provider = new ethers.JsonRpcProvider(rpcUrl, network, { staticNetwork: network });
  const signer   = new ethers.Wallet(privateKey, provider);
  const contract = new ethers.Contract(contractAddress, TRADE_REGISTRY_ABI, signer);

  return { provider, signer, contract };
}

// ── Receipt helper with timeout ───────────────────────────────────────────────
//
// If the transaction is not included in a block within RECEIPT_TIMEOUT_MS:
//   • throws an error whose .txHash property carries the submitted hash
//   • the caller catches it and saves the hash as status='submitted'
//     so the tx can be tracked/verified later.

async function waitForReceipt(tx) {
  return Promise.race([
    tx.wait(1),
    new Promise((_, reject) =>
      setTimeout(() => {
        const err = new Error(
          `Block confirmation timeout (${RECEIPT_TIMEOUT_MS / 1000}s) ` +
          `— tx submitted but unconfirmed: ${tx.hash}`
        );
        err.txHash = tx.hash;  // carry the hash so the catch block can save it
        err.code   = "TIMEOUT";
        reject(err);
      }, RECEIPT_TIMEOUT_MS)
    ),
  ]);
}

// ── Nonce helper ─────────────────────────────────────────────────────────────
//
// Always use the last *confirmed* nonce ("latest"), not the "pending" one.
// This bypasses any stuck-pending transactions that are clogging the queue.

async function getConfirmedNonce(provider, address) {
  try {
    return await provider.getTransactionCount(address, "latest");
  } catch {
    return undefined; // let ethers fall back to its default
  }
}

// ── Wallet lookup ─────────────────────────────────────────────────────────────

async function getWallet(userId) {
  if (!userId) return null;
  try {
    const res = await pool.query(
      "SELECT wallet_address FROM users WHERE id = $1",
      [userId]
    );
    return res.rows[0]?.wallet_address || null;
  } catch (err) {
    console.error(`[CHAIN] Failed to fetch wallet for user ${userId}:`, err.message);
    return null;
  }
}

// ── Persist chain result to DB ────────────────────────────────────────────────

async function saveChainRecord(orderId, txHash, blockNumber, status, errorMessage = null) {
  try {
    await pool.query(
      `INSERT INTO onchain_trade_records
         (order_id, tx_hash, block_number, status, error_message, recorded_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (order_id) DO UPDATE SET
         tx_hash       = EXCLUDED.tx_hash,
         block_number  = EXCLUDED.block_number,
         status        = EXCLUDED.status,
         error_message = EXCLUDED.error_message,
         recorded_at   = NOW()`,
      [orderId, txHash ?? null, blockNumber ?? 0, status, errorMessage?.substring(0, 500) ?? null]
    );
  } catch (e) {
    console.error(`[CHAIN] DB record failed for #${orderId}:`, e.message);
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Records an executed trade on-chain.
 *
 * Returns the tx hash (string) in three cases:
 *   • 'confirmed' – receipt arrived within RECEIPT_TIMEOUT_MS
 *   • 'submitted' – tx was accepted by the node but not yet confirmed (timeout)
 *
 * Returns null only if the RPC call itself failed (node unreachable, revert, etc.)
 *
 * @param  {object} orderRow  – DB row from orders
 * @param  {string} [symbol]  – Security symbol for fallback path
 * @returns {Promise<string|null>} tx hash or null
 */
export async function recordTradeOnChain(orderRow, symbol = "") {
  console.log(`[CHAIN] Recording order #${orderRow.id} on-chain`);

  let provider = null;

  try {
    const { provider: p, signer, contract } = getClient();
    provider = p;

    const signerAddress = await signer.getAddress();

    // ── Nonce: use confirmed (not pending) to skip stuck txs ─────────────
    const nonce = await getConfirmedNonce(provider, signerAddress);
    const txOverrides = { gasLimit: 300_000, gasPrice: 0n, ...(nonce !== undefined && { nonce }) };

    // ── Determine buyer / seller ──────────────────────────────────────────
    const buyerId  = orderRow.type === "buy"  ? orderRow.investor_id : orderRow.executed_by;
    const sellerId = orderRow.type === "sell" ? orderRow.investor_id : orderRow.executed_by;

    const [buyerWallet, sellerWallet] = await Promise.all([
      getWallet(buyerId),
      getWallet(sellerId),
    ]);

    // ── Trade payload (shared by both paths) ─────────────────────────────
    const tradeId   = ethers.keccak256(ethers.toUtf8Bytes(`order-${orderRow.id}-${Date.now()}`));
    const qty       = BigInt(Math.round(Number(orderRow.quantity)));
    const price     = BigInt(Math.round(Number(orderRow.price) * 1e6));
    const secSymbol = symbol || `SEC-${orderRow.security_id}`;
    const dataHash  = ethers.keccak256(
      ethers.toUtf8Bytes(JSON.stringify({
        orderId:    orderRow.id,
        securityId: orderRow.security_id,
        qty:        orderRow.quantity,
        price:      orderRow.price,
      }))
    );

    // Helper — submit the record-only fallback with a fresh confirmed nonce.
    // A reverted executeTrade DID consume a nonce (the tx was mined, status=0),
    // so we must re-fetch before submitting the fallback.
    const submitRecordTrade = async () => {
      const n = await getConfirmedNonce(provider, signerAddress);
      return contract.recordTrade(
        tradeId,
        buyerWallet  ? ethers.getAddress(buyerWallet)  : ethers.ZeroAddress,
        sellerWallet ? ethers.getAddress(sellerWallet) : ethers.ZeroAddress,
        qty,
        price,
        secSymbol,
        dataHash,
        { gasLimit: 200_000, gasPrice: 0n, ...(n !== undefined && { nonce: n }) }
      );
    };

    // ── Submit the appropriate transaction ────────────────────────────────
    const hasWallets = buyerWallet && sellerWallet &&
                       ethers.isAddress(buyerWallet) && ethers.isAddress(sellerWallet);
    let tx;

    if (hasWallets) {
      // Simulate first so we get a decoded revert reason and don't waste a nonce
      let simOk = false;
      try {
        await contract.executeTrade.staticCall(
          tradeId,
          BigInt(orderRow.security_id),
          ethers.getAddress(buyerWallet),
          ethers.getAddress(sellerWallet),
          qty,
          price,
        );
        simOk = true;
      } catch (simErr) {
        const reason = simErr?.reason ?? simErr?.revert?.name ?? simErr?.message ?? "unknown revert";
        console.warn(
          `[CHAIN] executeTrade simulation failed — skipping to record-only for order #${orderRow.id}\n` +
          `        Reason: ${String(reason).slice(0, 200)}\n` +
          `        (Typical causes: security not minted on-chain, or seller has no on-chain token balance\n` +
          `         because prior trades used the record-only fallback and never transferred tokens.)`
        );
      }

      if (simOk) {
        console.log(`[CHAIN] executeTrade: ${sellerId}→${buyerId} qty=${qty} nonce=${nonce}`);
        tx = await contract.executeTrade(
          tradeId,
          BigInt(orderRow.security_id),
          ethers.getAddress(buyerWallet),
          ethers.getAddress(sellerWallet),
          qty,
          price,
          txOverrides
        );
      } else {
        // Simulation said it would revert — go straight to record-only (saves the nonce)
        tx = await submitRecordTrade();
      }
    } else {
      console.warn(`[CHAIN] Missing wallet(s) (buyer=${buyerId}, seller=${sellerId}) — record-only`);
      tx = await submitRecordTrade();
    }

    console.log(`[CHAIN] Tx submitted: ${tx.hash} — awaiting confirmation…`);

    // ── Wait for confirmation (with timeout) ──────────────────────────────
    let receipt;
    try {
      receipt = await waitForReceipt(tx);
    } catch (waitErr) {
      // Timeout: tx is in the mempool but not yet mined
      if (waitErr.code === "TIMEOUT" && waitErr.txHash) {
        console.warn(`[CHAIN] Order #${orderRow.id}: ${waitErr.message}`);
        await saveChainRecord(orderRow.id, waitErr.txHash, 0, "submitted", "Awaiting confirmation");
        return waitErr.txHash;
      }

      // CALL_EXCEPTION: the tx was mined but the EVM reverted it (status=0).
      // This means the failed tx DID consume a nonce.  Fall back to recordTrade
      // (no token transfer) using a fresh confirmed nonce so the order still
      // gets an on-chain audit entry.
      if (waitErr.code === "CALL_EXCEPTION" && hasWallets) {
        const reason = waitErr?.reason ?? waitErr?.revert?.name ?? waitErr?.message ?? "reverted";
        console.warn(
          `[CHAIN] executeTrade reverted (${String(reason).slice(0, 120)}) ` +
          `— falling back to record-only for order #${orderRow.id}`
        );
        const fbTx = await submitRecordTrade();
        console.log(`[CHAIN] Fallback tx submitted: ${fbTx.hash}`);
        try {
          receipt = await waitForReceipt(fbTx);
        } catch (fbErr) {
          if (fbErr.code === "TIMEOUT" && fbErr.txHash) {
            await saveChainRecord(orderRow.id, fbErr.txHash, 0, "submitted", "Awaiting confirmation");
            return fbErr.txHash;
          }
          throw fbErr;
        }
      } else {
        throw waitErr;
      }
    }

    console.log(`[CHAIN] Confirmed block #${receipt.blockNumber} tx=${receipt.hash}`);
    await saveChainRecord(orderRow.id, receipt.hash, receipt.blockNumber, "confirmed");
    return receipt.hash;

  } catch (err) {
    // ── Hard failure: RPC error, env config missing, unexpected revert ────
    console.error(`[CHAIN] Failed for order #${orderRow.id}:`, err.message);
    if (err.reason) console.error("[CHAIN] Revert:", err.reason);
    if (err.code)   console.error("[CHAIN] Code:", err.code);

    await saveChainRecord(orderRow.id, null, 0, "failed", err.message || "Unknown error");
    return null;

  } finally {
    try { provider?.destroy(); } catch (_) {}
  }
}

/**
 * Mint tokens for a newly approved security.
 * Called from approveListing in store.js.
 */
export async function mintSecurityTokens(securityId, issuerWallet, amount, symbol) {
  console.log(`[CHAIN] Minting ${amount} tokens for security #${securityId} (${symbol})`);

  let provider = null;

  try {
    const { provider: p, signer, contract } = getClient();
    provider = p;

    if (!ethers.isAddress(issuerWallet)) {
      throw new Error(`Invalid issuer wallet address: ${issuerWallet}`);
    }

    const nonce = await getConfirmedNonce(provider, await signer.getAddress());

    const tx = await contract.mintSecurity(
      BigInt(securityId),
      ethers.getAddress(issuerWallet),
      BigInt(amount),
      symbol,
      { gasLimit: 200_000, gasPrice: 0n, ...(nonce !== undefined && { nonce }) }
    );

    console.log(`[CHAIN] Mint tx submitted: ${tx.hash}`);

    const receipt = await waitForReceipt(tx);
    console.log(`[CHAIN] Mint confirmed block #${receipt.blockNumber} tx=${receipt.hash}`);
    return { hash: receipt.hash, blockNumber: receipt.blockNumber, status: "confirmed" };

  } catch (err) {
    if (err.code === "TIMEOUT" && err.txHash) {
      console.warn(`[CHAIN] Mint timeout — tx submitted but unconfirmed: ${err.txHash}`);
      return { hash: err.txHash, blockNumber: null, status: "submitted" };
    }
    console.error(`[CHAIN] Mint failed for security #${securityId}:`, err.message);
    if (err.reason) console.error("Revert:", err.reason);
    return null;

  } finally {
    try { provider?.destroy(); } catch (_) {}
  }
}

/**
 * Query on-chain token balance for a holder.
 * Returns 0n on any error (contract may not be deployed yet).
 */
export async function getOnChainBalance(securityId, holderWallet) {
  let provider = null;
  try {
    const { provider: p, contract } = getClient();
    provider = p;
    if (!ethers.isAddress(holderWallet)) return 0n;
    return await contract.getBalance(BigInt(securityId), ethers.getAddress(holderWallet));
  } catch {
    return 0n;
  } finally {
    try { provider?.destroy(); } catch (_) {}
  }
}

/**
 * Query all on-chain holders for a security.
 * Returns [] on any error.
 */
export async function getOnChainHolders(securityId) {
  let provider = null;
  try {
    const { provider: p, contract } = getClient();
    provider = p;
    return await contract.getHolders(BigInt(securityId));
  } catch {
    return [];
  } finally {
    try { provider?.destroy(); } catch (_) {}
  }
}
