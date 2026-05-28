import { query } from "@/lib/db";
import { corsResponse, corsError, handleOptions } from "@/lib/cors";

export async function GET(request, { params }) {
  const { securityId } = await params;

  try {
    const security = await query(
      `SELECT s.*, u.full_name AS issuer_name
       FROM securities s
       JOIN users u ON s.issuer_id = u.id
       WHERE s.id = $1 AND s.status = 'listed'`,
      [securityId]
    );

    if (security.rows.length === 0) {
      return corsError("Security not found or not listed", 404);
    }

    const sec = security.rows[0];

    // Recent trades
    const trades = await query(
      `SELECT t.quantity, t.price_per_unit, t.total_amount, t.executed_at
       FROM trades t
       WHERE t.security_id = $1
       ORDER BY t.executed_at DESC
       LIMIT 50`,
      [securityId]
    );

    // Order book (pending orders)
    const buyOrders = await query(
      `SELECT price_per_unit, SUM(quantity - filled_quantity) as total_quantity, COUNT(*) as order_count
       FROM orders
       WHERE security_id = $1 AND order_type = 'buy' AND status = 'pending'
       GROUP BY price_per_unit
       ORDER BY price_per_unit DESC
       LIMIT 10`,
      [securityId]
    );

    const sellOrders = await query(
      `SELECT price_per_unit, SUM(quantity - filled_quantity) as total_quantity, COUNT(*) as order_count
       FROM orders
       WHERE security_id = $1 AND order_type = 'sell' AND status = 'pending'
       GROUP BY price_per_unit
       ORDER BY price_per_unit ASC
       LIMIT 10`,
      [securityId]
    );

    // Volume stats
    const volumeStats = await query(
      `SELECT COUNT(*) as total_trades,
              COALESCE(SUM(total_amount), 0) as total_volume,
              COALESCE(SUM(quantity), 0) as total_quantity,
              COALESCE(AVG(price_per_unit), 0) as avg_price,
              COALESCE(MIN(price_per_unit), 0) as low_price,
              COALESCE(MAX(price_per_unit), 0) as high_price
       FROM trades WHERE security_id = $1`,
      [securityId]
    );

    const circulatingSupply = parseFloat(sec.total_supply) - parseFloat(sec.available_supply);
    const marketCap = parseFloat(sec.price_per_unit) * circulatingSupply;

    return corsResponse({
      security: {
        ...sec,
        circulating_supply: circulatingSupply,
        market_cap: marketCap.toFixed(2),
      },
      stats: volumeStats.rows[0],
      order_book: {
        bids: buyOrders.rows,
        asks: sellOrders.rows,
      },
      recent_trades: trades.rows,
    });
  } catch (err) {
    console.error("Market security error:", err);
    return corsError("Failed to fetch security market data", 500);
  }
}

export async function OPTIONS() {
  return handleOptions();
}
