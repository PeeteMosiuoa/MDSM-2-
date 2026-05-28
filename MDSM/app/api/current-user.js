// pages/api/current-user.js (or app/api/current-user/route.js if app router)
import { getServerSession } from "@/lib/session"; // or your session logic
import { query } from "@/lib/db";

export async function GET(req) {
  try {
    const session = await getServerSession(req); // implement session check
    if (!session?.userId) {
      return new Response(JSON.stringify({ user: null }), { status: 200 });
    }

    const result = await query("SELECT id, name, email FROM users WHERE id = $1", [session.userId]);
    const user = result.rows[0] || null;

    return new Response(JSON.stringify({ user }), { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ user: null }), { status: 500 });
  }
}