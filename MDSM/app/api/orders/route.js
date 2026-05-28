import { z } from "zod";
import { query, withTransaction as transaction } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { corsResponse, corsError, handleOptions } from "@/lib/cors";
import { validateRequest } from "@/lib/validate";
import { logAudit, getClientIp } from "@/lib/audit";

export async function GET(request) {
  const { user, response } = await requireAuth(request);
  if (response) return response;

  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const orderType = url.searchParams.get("type");
    const securityId = url.searchParams.get("security_id");
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    let sql = `SELECT o.*, s.name as security_name, s.symbol as security_symbol
               FROM orders o
               JOIN securities s ON o.security_id = s.id`;
    let countSql = `SELECT COUNT(*) FROM orders o`;
    const params = [];
    const conditions = [];

    // Non-admin users only see their own orders
    if (!["admin", "regulator"].includes(user.role)) {
      conditions.push(`o.user_id = $${params.length + 1}`);
      params.push(user.id);
    }

    if (status) {
      conditions.push(`o.status = $${params.length + 1}`);
      params.push(status);
    }
    if (orderType) {
      conditions.push(`o.order_type = $${params.length + 1}`);
      params.push(orderType);
    }
    if (securityId) {
      conditions.push(`o.security_id = $${params.length + 1}`);
      params.push(securityId);
    }

    if (conditions.length > 0) {
      const where = " WHERE " + conditions.join(" AND ");
      sql += where;
      countSql += where;
    }

    const countParams = [...params];
    sql += ` ORDER BY o.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const [ordersResult, countResult] = await Promise.all([
      query(sql, params),
      query(countSql, countParams),
    ]);

    return corsResponse({
      orders: ordersResult.rows,
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].count),
        pages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
      },
    });
  } catch (err) {
    console.error("List orders error:", err);
    return corsError("Failed to fetch orders", 500);
  }
}

const orderSchema = z.object({
  security_id: z.number().int().positive(),
  order_type: z.enum(["buy", "sell"]),
  quantity: z.number().positive("Quantity must be positive"),
  price_per_unit: z.number().positive("Price must be positive"),
});

export async function POST(request) {
  const { user, response: authResponse } = await requireAuth(request);
  if (authResponse) return authResponse;

  if (!["investor", "broker"].includes(user.role)) {
    return corsError("Only investors and brokers can place orders", 403);
  }

  if (!user.is_verified) {
    return corsError("KYC verification required before trading", 403);
  }

  const { data, response } = await validateRequest(request, orderSchema);
  if (response) return response;

  try {
    const result = await transaction(async (client) => {
      // Check security exists and is listed
      const security = await client.query(
        "SELECT * FROM securities WHERE id = $1 AND status = 'listed'",
        [data.security_id]
      );
      if (security.rows.length === 0) {
        throw new Error("Security not found or not listed");
      }

      const sec = security.rows[0];
      const totalAmount = data.quantity * data.price_per_unit;

      if (data.order_type === "buy") {
        // Check available supply
        if (data.quantity > parseFloat(sec.available_supply)) {
          throw new Error("Insufficient available supply");
        }
      } else {
        // Sell order - check user has enough holdings
        const wallet = await client.query(
          "SELECT quantity FROM wallets WHERE user_id = $1 AND security_id = $2",
          [user.id, data.security_id]
        );
        if (wallet.rows.length === 0 || parseFloat(wallet.rows[0].quantity) < data.quantity) {
          throw new Error("Insufficient holdings to sell");
        }
      }

      // Create the order
      const order = await client.query(
        `INSERT INTO orders (user_id, security_id, order_type, quantity, price_per_unit, total_amount)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [user.id, data.security_id, data.order_type, data.quantity, data.price_per_unit, totalAmount]
      );

      // Try to match buy orders immediately (simplified matching)
      if (data.order_type === "buy") {
        // Decrease available supply
        await client.query(
          "UPDATE securities SET available_supply = available_supply - $1, updated_at = NOW() WHERE id = $2",
          [data.quantity, data.security_id]
        );

        // Create a trade
        const trade = await client.query(
          `INSERT INTO trades (buy_order_id, security_id, buyer_id, seller_id, quantity, price_per_unit, total_amount)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [order.rows[0].id, data.security_id, user.id, sec.issuer_id, data.quantity, data.price_per_unit, totalAmount]
        );

        // Update order status
        await client.query(
          "UPDATE orders SET status = 'filled', filled_quantity = $1, updated_at = NOW() WHERE id = $2",
          [data.quantity, order.rows[0].id]
        );

        // Update buyer wallet
        await client.query(
          `INSERT INTO wallets (user_id, security_id, quantity, average_buy_price)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id, security_id)
           DO UPDATE SET quantity = wallets.quantity + $3,
                         average_buy_price = (wallets.average_buy_price * wallets.quantity + $4 * $3) / (wallets.quantity + $3)`,
          [user.id, data.security_id, data.quantity, data.price_per_unit]
        );

        return { order: { ...order.rows[0], status: "filled", filled_quantity: data.quantity }, trade: trade.rows[0] };
      }

      return { order: order.rows[0], trade: null };
    });

    await logAudit({
      userId: user.id,
      action: "ORDER_PLACED",
      entityType: "order",
      entityId: result.order.id,
      details: {
        type: data.order_type,
        security_id: data.security_id,
        quantity: data.quantity,
        price: data.price_per_unit,
        status: result.order.status,
      },
      ipAddress: getClientIp(request),
    });

    if (result.trade) {
      await logAudit({
        userId: user.id,
        action: "TRADE_EXECUTED",
        entityType: "trade",
        entityId: result.trade.id,
        details: {
          security_id: data.security_id,
          quantity: data.quantity,
          price: data.price_per_unit,
          total: data.quantity * data.price_per_unit,
        },
        ipAddress: getClientIp(request),
      });
    }

    return corsResponse({ message: "Order placed", ...result }, 201);
  } catch (err) {
    console.error("Place order error:", err);
    return corsError(err.message || "Failed to place order", 400);
  }
}

export async function OPTIONS() {
  return handleOptions();
}
