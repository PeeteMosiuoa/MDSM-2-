import { query } from "@/lib/db";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return Response.json({ error: "userId required" });
    }

    const alerts = await query(
      `SELECT * FROM alerts WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );

    return Response.json({ success: true, data: alerts.rows });
  } catch (err) {
    console.error("Alerts API error:", err);
    return Response.json({ error: "Failed to fetch alerts" });
  }
}