// lib/orderService.js
const { Pool } = require('pg');
const { recordTradeOnChain } = require('./recordTrade');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Execute a client order:
 * - Validate order & wallets
 * - Record trade in DB
 * - Send on-chain transaction
 * - Update DB with tx_hash
 */
async function executeOrder(orderId, brokerId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1️⃣ Fetch the order
    const { rows: orders } = await client.query(
      `SELECT * FROM orders WHERE id = $1 FOR UPDATE`,
      [orderId]
    );
    if (!orders[0]) throw new Error(`Order #${orderId} not found`);
    const order = orders[0];
    if (order.status.toLowerCase() !== 'pending') {
      throw new Error(`Order #${orderId} is already ${order.status}`);
    }

    // 2️⃣ Fetch wallets
    const { rows: buyerRows } = await client.query(
      `SELECT wallet_address, full_name FROM users WHERE id = $1`,
      [order.investor_id]
    );
    const { rows: brokerRows } = await client.query(
      `SELECT wallet_address, full_name FROM users WHERE id = $1`,
      [brokerId]
    );

    const buyerWallet = buyerRows[0]?.wallet_address;
    const sellerWallet = brokerRows[0]?.wallet_address;
    if (!buyerWallet || !sellerWallet) {
      throw new Error(`Missing wallet address for buyer or broker`);
    }

    // 3️⃣ Compute totals
    const quantity = Number(order.quantity);
    const price = Number(order.price);
    const total = quantity * price;

    // 4️⃣ Insert trade record in DB as pending
    const { rows: tradeRows } = await client.query(
      `INSERT INTO trades
        (order_id, buyer_id, seller_id, security_id, quantity, price, total, status, executed_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',NOW())
        RETURNING id`,
      [orderId, order.investor_id, brokerId, order.security_id, quantity, price, total]
    );
    const tradeId = tradeRows[0].id;

    await client.query(`UPDATE orders SET status='processing' WHERE id=$1`, [orderId]);

    await client.query('COMMIT');

    // 5️⃣ Record trade on-chain
    const txHash = await recordTradeOnChain({
      id: tradeId,
      type: order.type || 'buy',
      quantity,
      price,
      total,
      security_id: order.security_id,
      executed_at: new Date(),
      executed_by: brokerId,
      investor_id: order.investor_id,
    });

    // 6️⃣ Update trade + order after successful on-chain tx
    await client.query(
      `UPDATE trades SET status='filled', onchain_tx_hash=$1 WHERE id=$2`,
      [txHash, tradeId]
    );
    await client.query(
      `UPDATE orders SET status='filled', executed_at=NOW(), onchain_tx_hash=$1 WHERE id=$2`,
      [txHash, orderId]
    );

    return { success: true, tradeId, txHash };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[EXECUTE ORDER ERROR]', err);
    return { success: false, message: err.message };
  } finally {
    client.release();
  }
}

module.exports = { executeOrder };