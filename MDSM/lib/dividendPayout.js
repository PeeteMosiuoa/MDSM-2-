// lib/dividendPayout.js (run as separate process or in server startup)
const cron = require('node-cron');

cron.schedule('0 2 * * *', async () => { // every day at 2:00 AM
  console.log("Running dividend payout engine...");

  try {
    // Find dividends due today
    const due = await db.query(`
      SELECT d.*, s.total_supply 
      FROM dividends d
      JOIN securities s ON d.security_id = s.id
      WHERE d.payment_date = CURRENT_DATE
        AND d.status = 'pending'
    `);

    for (const div of due.rows) {
      const holders = await db.query(`
        SELECT user_id, units 
        FROM portfolio 
        WHERE security_id = $1 AND units > 0
      `, [div.security_id]);

      const totalPayout = Number(div.amount_per_token) * Number(div.total_supply);

      // Check issuer has enough funds
      const issuerWallet = await db.query(
        "SELECT balance FROM wallets WHERE user_id = (SELECT issuer_id FROM securities WHERE id = $1)",
        [div.security_id]
      );

      if (Number(issuerWallet.rows[0]?.balance || 0) < totalPayout) {
        console.error(`Insufficient funds for dividend ${div.id}`);
        continue;
      }

      // Atomic payout
      await db.query("BEGIN");

      try {
        // Deduct from issuer
        await db.query(
          "UPDATE wallets SET balance = balance - $1 WHERE user_id = (SELECT issuer_id FROM securities WHERE id = $2)",
          [totalPayout, div.security_id]
        );

        // Credit each holder
        for (const holder of holders.rows) {
          const amount = Number(holder.units) * Number(div.amount_per_token);
          
          await db.query(
            "UPDATE wallets SET balance = balance + $1 WHERE user_id = $2",
            [amount, holder.user_id]
          );

          // Log transaction
          await db.query(
            `INSERT INTO wallet_transactions 
             (user_id, amount, type, description, reference_id)
             VALUES ($1, $2, 'credit', $3, $4)`,
            [
              holder.user_id,
              amount,
              `Dividend from ${div.security_id}`,
              div.id
            ]
          );
        }

        // Mark as paid
        await db.query(
          "UPDATE dividends SET status = 'paid', updated_at = NOW() WHERE id = $1",
          [div.id]
        );

        await db.query("COMMIT");
        console.log(`Dividend ${div.id} paid successfully`);
      } catch (err) {
        await db.query("ROLLBACK");
        console.error(`Failed to pay dividend ${div.id}:`, err);
      }
    }
  } catch (err) {
    console.error("Dividend payout engine error:", err);
  }
});