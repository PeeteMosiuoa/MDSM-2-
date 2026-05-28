// lib/services/tradeService.js

const { recordTrade } = require('../../blockchain/contracts/TradeRegistry');
const db = require('../db');                    // your postgres pool/client
const { ethers } = require('ethers');           // needed for keccak256 + addresses

// Optional helper: format number to blockchain integer (adjust decimals per asset)
function toBlockchainAmount(value, decimals = 6) {
  return Math.round(Number(value) * (10 ** decimals));
}

/**
 * Records a filled order on-chain using data from PostgreSQL.
 * @param {number|string} orderId - The ID from orders table
 * @returns {Promise<{success: boolean, tradeId: string, txHash?: string, error?: string}>}
 */
async function recordFilledOrderOnChain(orderId) {
  let client; // for transaction / rollback if needed

  try {
    client = await db.connect();           // or use your pool pattern
    await client.query('BEGIN');

    // ── 1. Fetch the filled order from database ───────────────────────
    const orderRes = await client.query(`
      SELECT 
        id,
        investor_id,
        security_id,
        quantity,
        price,
        type,               -- 'buy' or 'sell'
        total,
        executed_by,        -- broker/user who executed
        executed_at,
        status,
        updated_at
      FROM orders
      WHERE id = $1
        AND status = 'filled'
    `, [orderId]);

    if (orderRes.rowCount === 0) {
      throw new Error(`Order ${orderId} not found or not in 'filled' status`);
    }

    const order = orderRes.rows[0];

    // ── 2. Optional: check if already recorded (prevent duplicates) ─────
    const existingTxRes = await client.query(`
      SELECT tx_hash FROM onchain_trades 
      WHERE order_id = $1
    `, [orderId]);   // ← assumes you have or will create this table

    if (existingTxRes.rowCount > 0 && existingTxRes.rows[0].tx_hash) {
      return {
        success: true,
        tradeId: String(order.id),
        txHash: existingTxRes.rows[0].tx_hash,
        alreadyRecorded: true
      };
    }

    // ── 3. Prepare addresses (you must have wallet addresses linked)
    // This part depends on your schema – adjust!
    // Example: assume investor_id → users table → wallet_address
    const buyerRes = await client.query(`
      SELECT wallet_address FROM users 
      WHERE id = $1 AND wallet_address IS NOT NULL
    `, [order.type === 'buy' ? order.investor_id : order.executed_by]);

    const sellerRes = await client.query(`
      SELECT wallet_address FROM users 
      WHERE id = $1 AND wallet_address IS NOT NULL
    `, [order.type === 'sell' ? order.investor_id : order.executed_by]);

    if (buyerRes.rowCount === 0 || sellerRes.rowCount === 0) {
      throw new Error('Missing wallet address for buyer or seller');
    }

    const buyerAddress  = ethers.utils.getAddress(buyerRes.rows[0].wallet_address);
    const sellerAddress = ethers.utils.getAddress(sellerRes.rows[0].wallet_address);

    // ── 4. Build payload for smart contract ────────────────────────────
    const fullOrderJson = JSON.stringify({
      orderId: order.id,
      investorId: order.investor_id,
      securityId: order.security_id,
      quantity: order.quantity,
      price: order.price,
      type: order.type,
      total: order.total,
      executedAt: order.executed_at.toISOString(),
      executedBy: order.executed_by
    });

    const tradePayload = {
      tradeId: String(order.id),                       // simple string ID
      // tradeId: ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`order-${order.id}`)),
      buyer:  order.type === 'buy'  ? buyerAddress  : sellerAddress,
      seller: order.type === 'sell' ? sellerAddress : buyerAddress,
      quantity: toBlockchainAmount(order.quantity),
      price:    toBlockchainAmount(order.price),
      assetSymbol: `SEC-${order.security_id}`,         // or join with securities table
      dataHash: ethers.utils.keccak256(ethers.utils.toUtf8Bytes(fullOrderJson))
    };

    // ── 5. Record on blockchain ───────────────────────────────────────
    const receipt = await recordTrade(tradePayload);

    // ── 6. Save proof to database (create onchain_trades table if missing)
    await client.query(`
      INSERT INTO onchain_trades (
        order_id, tx_hash, block_number, recorded_at, status
      ) VALUES ($1, $2, $3, NOW(), 'confirmed')
    `, [
      order.id,
      receipt.transactionHash,
      receipt.blockNumber
    ]);

    await client.query(`
      UPDATE orders 
      SET updated_at = NOW(), 
          -- optional: add onchain_tx_hash column if you want it directly in orders
      WHERE id = $1
    `, [order.id]);

    await client.query('COMMIT');

    return {
      success: true,
      tradeId: String(order.id),
      txHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber
    };

  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error(`Failed to record order ${orderId} on-chain:`, error);

    return {
      success: false,
      tradeId: String(orderId),
      error: error.message
    };

  } finally {
    if (client) client.release();
  }
}

module.exports = {
  recordFilledOrderOnChain,
  // keep executeAndRecord if you still need the old API flow
};