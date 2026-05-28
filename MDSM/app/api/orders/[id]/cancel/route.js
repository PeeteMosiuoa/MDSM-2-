import { query, withTransaction as transaction } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { corsResponse, corsError, handleOptions } from "@/lib/cors";
import { logAudit, getClientIp } from "@/lib/audit";

export async function PUT(request, { params }) {
  const { id } = await params;
  const { user, response } = await requireAuth(request);
  if (response) return response;

  try {
    const result = await transaction(async (client) => {
      const order = await client.query(
        "SELECT * FROM orders WHERE id = $1 AND user_id = $2",
        [id, user.id]
      );

      if (order.rows.length === 0) {
        throw new Error("Order not found");
      }

      if (order.rows[0].status !== "pending") {
        throw new Error("Only pending orders can be cancelled");
      }

      // If buy order, restore supply
      if (order.rows[0].order_type === "buy") {
        await client.query(
          "UPDATE securities SET available_supply = available_supply + $1, updated_at = NOW() WHERE id = $2",
          [order.rows[0].quantity, order.rows[0].security_id]
        );
      }

      const updated = await client.query(
        "UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = $1 RETURNING *",
        [id]
      );

      return updated.rows[0];
    });

    await logAudit({
      userId: user.id,
      action: "ORDER_CANCELLED",
      entityType: "order",
      entityId: parseInt(id),
      details: { order_type: result.order_type, security_id: result.security_id },
      ipAddress: getClientIp(request),
    });

    return corsResponse({ message: "Order cancelled", order: result });
  } catch (err) {
    console.error("Cancel order error:", err);
    return corsError(err.message || "Failed to cancel order", 400);
  }
}

export async function OPTIONS() {
  return handleOptions();
}
