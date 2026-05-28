import { query, withTransaction } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { corsResponse, corsError, handleOptions } from "@/lib/cors";
import { logAudit, getClientIp } from "@/lib/audit";

// ── POST /api/dividends/[id]/process ─────────────────────────────────────────
// Snapshot holdings as of record_date, create dividend_payments rows, credit
// each investor's wallet, and mark the dividend as paid.
// Callable by: issuer (own securities) or admin.
export async function POST(request, { params }) {
  const { id } = await params;
  const { user, response: authResponse } = await requireRole(request, ["issuer", "admin"]);
  if (authResponse) return authResponse;

  try {
    // 1. Load dividend
    const divRes = await query(
      `SELECT d.*,
              s.symbol     AS security_symbol,
              s.name       AS security_name,
              i.user_id    AS issuer_user_id
         FROM dividends d
         JOIN securities s ON s.id = d.security_id
         JOIN issuers    i ON i.id = s.issuer_id
        WHERE d.id = $1`,
      [id]
    );

    if (divRes.rows.length === 0) return corsError("Dividend not found", 404);
    const div = divRes.rows[0];

    if (user.role === "issuer" && div.issuer_user_id !== user.id)
      return corsError("You can only process dividends for your own securities", 403);

    if (div.status === "paid")
      return corsError("This dividend has already been paid", 400);

    if (div.status === "cancelled")
      return corsError("This dividend has been cancelled", 400);

    // 2. Check payment_date has arrived (or admin override)
    const today      = new Date();
    const paymentDay = new Date(div.payment_date);
    if (user.role !== "admin" && today < paymentDay) {
      return corsError(
        `Payment date is ${div.payment_date}. You can process early only as admin.`,
        400
      );
    }

    // 3. Snapshot eligible holders as of record_date
    //    Anyone holding > 0 shares in `holdings` on or before the record_date.
    //    We use current holdings — for a real exchange you'd store daily snapshots.
    const holdersRes = await query(
      `SELECT h.user_id,
              h.quantity                    AS shares_held,
              ROUND(h.quantity * $2, 2)     AS amount,
              w.id                          AS wallet_id
         FROM holdings  h
         JOIN wallets   w ON w.user_id = h.user_id AND w.security_id IS NULL
        WHERE h.security_id = $1
          AND h.quantity    > 0
          AND h.updated_at <= ($3::date + INTERVAL '1 day')`,
      [div.security_id, div.amount_per_share, div.record_date]
    );

    if (holdersRes.rows.length === 0) {
      // Mark paid with zero payout if no eligible holders
      await query(
        `UPDATE dividends SET status='paid', total_payout=0, updated_at=NOW() WHERE id=$1`,
        [id]
      );
      return corsResponse({ message: "No eligible shareholders found. Dividend marked paid.", paid: 0 });
    }

    // 4. Process payments inside a transaction
    let paidCount = 0;
    let totalPaid = 0;

    await withTransaction(async (client) => {
      // Mark dividend as processing
      await client.query(
        `UPDATE dividends SET status='processing', updated_at=NOW() WHERE id=$1`,
        [id]
      );

      for (const holder of holdersRes.rows) {
        const { user_id, shares_held, amount, wallet_id } = holder;

        if (!wallet_id || parseFloat(amount) <= 0) continue;

        try {
          // Credit investor wallet
          await client.query(
            `UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE id = $2`,
            [amount, wallet_id]
          );

          // Record wallet transaction
          const txRes = await client.query(
            `INSERT INTO wallet_transactions
               (wallet_id, transaction_type, amount, reference_id, description, created_at)
             VALUES ($1, 'credit', $2, $3, $4, NOW())
             RETURNING id`,
            [
              wallet_id,
              amount,
              `DIV-${id}`,
              `Dividend: ${div.security_symbol} @ M${div.amount_per_share}/share × ${shares_held} shares`,
            ]
          );

          const walletTxId = txRes.rows[0]?.id ?? null;

          // Insert dividend_payments record
          await client.query(
            `INSERT INTO dividend_payments
               (dividend_id, investor_id, security_id, shares_held, amount, status, wallet_transaction_id, paid_at)
             VALUES ($1,$2,$3,$4,$5,'paid',$6,NOW())`,
            [id, user_id, div.security_id, shares_held, amount, walletTxId]
          );

          // Notify investor via alerts
          await client.query(
            `INSERT INTO alerts (user_id, title, message, alert_type, created_at)
             VALUES ($1,$2,$3,'success',NOW())`,
            [
              user_id,
              `Dividend Payment: ${div.security_symbol}`,
              `You received M${amount} in dividends — ${shares_held} shares × M${div.amount_per_share} per share.`,
            ]
          );

          paidCount++;
          totalPaid += parseFloat(amount);

        } catch (holderErr) {
          console.error(`[DIVIDEND] Failed to pay investor ${user_id}:`, holderErr.message);

          // Record the failure but continue with others
          await client.query(
            `INSERT INTO dividend_payments
               (dividend_id, investor_id, security_id, shares_held, amount, status, paid_at)
             VALUES ($1,$2,$3,$4,$5,'failed',NOW())`,
            [id, user_id, div.security_id, shares_held, amount]
          );
        }
      }

      // Mark dividend paid
      await client.query(
        `UPDATE dividends
            SET status      = 'paid',
                total_payout = $2,
                updated_at  = NOW()
          WHERE id = $1`,
        [id, totalPaid.toFixed(2)]
      );
    });

    await logAudit({
      userId:     user.id,
      action:     "DIVIDEND_PROCESSED",
      entityType: "dividend",
      entityId:   parseInt(id),
      details:    { security: div.security_symbol, paid_count: paidCount, total_paid: totalPaid },
      ipAddress:  getClientIp(request),
    });

    return corsResponse({
      message:    `Dividend processed — M${totalPaid.toFixed(2)} paid to ${paidCount} shareholder(s)`,
      dividend_id: parseInt(id),
      paid_count:  paidCount,
      total_paid:  totalPaid.toFixed(2),
    });

  } catch (err) {
    console.error("[POST /api/dividends/[id]/process]", err);
    return corsError("Failed to process dividend: " + err.message, 500);
  }
}

export async function OPTIONS() {
  return handleOptions();
}
