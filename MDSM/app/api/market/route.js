import { query } from "@/lib/db";
import { corsResponse, corsError, handleOptions } from "@/lib/cors";

export async function GET() {
  try {
    // Get all listed securities with market data
    const securities = await query(
      `SELECT s.id, s.name, s.symbol, s.security_type, s.price_per_unit, s.currency,
              s.total_supply, s.available_supply,
              (s.total_supply - s.available_supply) as circulating_supply,
              (s.price_per_unit * (s.total_supply - s.available_supply)) as market_cap
       FROM securities s
       WHERE s.status = 'listed'
       ORDER BY market_cap DESC`
    );

    // Get trading volume (last 24h simulation - using all trades)
    const volume = await query(
      `SELECT s.symbol, COUNT(t.id) as trade_count,
              COALESCE(SUM(t.total_amount), 0) as total_volume,
              COALESCE(SUM(t.quantity), 0) as total_quantity
       FROM securities s
       LEFT JOIN trades t ON s.id = t.security_id
       WHERE s.status = 'listed'
       GROUP BY s.id, s.symbol
       ORDER BY total_volume DESC`
    );

    // Market summary
    const totalMarketCap = securities.rows.reduce(
      (sum, s) => sum + parseFloat(s.market_cap || 0),
      0
    );
    const totalVolume = volume.rows.reduce(
      (sum, v) => sum + parseFloat(v.total_volume || 0),
      0
    );

    return corsResponse({
      market_summary: {
        total_listed_securities: securities.rows.length,
        total_market_cap: totalMarketCap.toFixed(2),
        total_trading_volume: totalVolume.toFixed(2),
        currency: "LSL",
        last_updated: new Date().toISOString(),
      },
      securities: securities.rows.map((sec) => {
        const vol = volume.rows.find((v) => v.symbol === sec.symbol);
        return {
          ...sec,
          trade_count: parseInt(vol?.trade_count || 0),
          trading_volume: parseFloat(vol?.total_volume || 0).toFixed(2),
          volume_quantity: parseFloat(vol?.total_quantity || 0).toFixed(4),
        };
      }),
    });
  } catch (err) {
    console.error("Market data error:", err);
    return corsError("Failed to fetch market data", 500);
  }
}

export async function OPTIONS() {
  return handleOptions();
}
