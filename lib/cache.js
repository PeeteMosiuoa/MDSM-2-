/**
 * lib/cache.js
 *
 * Server-side data cache using Next.js unstable_cache (ISR-style memoisation).
 * Import these functions in Server Components or API Route Handlers instead of
 * querying the database or blockchain directly on every request.
 *
 * How it works
 * ────────────
 * unstable_cache wraps an async function and caches its return value in
 * Next.js's server-side data cache, keyed by the cache key array.  The
 * `revalidate` option sets the ISR TTL in seconds; the `tags` option lets
 * you purge specific entries with revalidateTag() from a Server Action or
 * Route Handler.
 *
 * Usage examples
 * ──────────────
 *   import { getCachedSecurities, invalidateSecurities } from '@/lib/cache';
 *
 *   // In a Server Component or API route:
 *   const securities = await getCachedSecurities();
 *
 *   // After an admin approves a new listing:
 *   await invalidateSecurities();
 */

import { unstable_cache, revalidateTag } from 'next/cache';
import { getRows, getRow } from '@/lib/db';

// ── Tag constants (single source of truth) ───────────────────────────────────
export const TAGS = {
  SECURITIES:        'securities',
  MARKET_STATS:      'market-stats',
  BLOCKCHAIN_STATUS: 'blockchain-status',
  CLEARINGS:         'clearings',
  TRADES:            'trades',
};

// ── Securities list ───────────────────────────────────────────────────────────
// Changes only when an admin approves or rejects a listing — revalidate on
// those mutations instead of short-polling.
export const getCachedSecurities = unstable_cache(
  async () => {
    return getRows(
      `SELECT id, name, symbol, type, price, prev_price,
              total_supply, available_tokens, approved, created_at
         FROM securities
        WHERE approved = true
        ORDER BY created_at DESC`
    );
  },
  [TAGS.SECURITIES],
  { revalidate: 60, tags: [TAGS.SECURITIES] }
);

// ── Market overview stats ─────────────────────────────────────────────────────
export const getCachedMarketStats = unstable_cache(
  async () => {
    return getRow(
      `SELECT
         COUNT(*)::int                         AS total_securities,
         SUM(price * total_supply)             AS total_market_cap,
         AVG(price)                            AS avg_price,
         SUM(available_tokens)                 AS total_available
       FROM securities
       WHERE approved = true`
    );
  },
  [TAGS.MARKET_STATS],
  { revalidate: 30, tags: [TAGS.MARKET_STATS] }
);

// ── Recent trades (last 100) ──────────────────────────────────────────────────
export const getCachedTrades = unstable_cache(
  async () => {
    return getRows(
      `SELECT t.id, t.security_id, t.type, t.quantity, t.price, t.total,
              t.broker_fee, t.status, t.onchain_tx_hash, t.executed_at,
              s.symbol, s.name AS security_name
         FROM trades t
         JOIN securities s ON s.id = t.security_id
        WHERE t.status = 'filled'
        ORDER BY t.executed_at DESC
        LIMIT 100`
    );
  },
  [TAGS.TRADES],
  { revalidate: 20, tags: [TAGS.TRADES] }
);

// ── Blockchain records (immutable once written) ───────────────────────────────
export const getCachedBlockchainRecords = unstable_cache(
  async () => {
    return getRows(
      `SELECT br.id, br.security_id, br.tx_hash, br.contract_address,
              br.tokens_minted, br.created_at, s.symbol, s.name AS security_name
         FROM blockchain_records br
         JOIN securities s ON s.id = br.security_id
        ORDER BY br.created_at DESC
        LIMIT 200`
    );
  },
  ['blockchain-records'],
  // Blockchain records are immutable — 5-minute fresh window is fine
  { revalidate: 300, tags: [TAGS.BLOCKCHAIN_STATUS] }
);

// ── Clearing house summary stats ──────────────────────────────────────────────
export const getCachedClearingStats = unstable_cache(
  async () => {
    return getRow(
      `SELECT
         COUNT(*)                                              AS total,
         COUNT(*) FILTER (WHERE status = 'settled')::int      AS settled,
         COUNT(*) FILTER (WHERE status = 'pending')::int      AS pending,
         COUNT(*) FILTER (WHERE status = 'failed')::int       AS failed,
         COALESCE(SUM(total) FILTER (WHERE status = 'settled'), 0) AS total_volume,
         COALESCE(SUM(buyer_fee + seller_fee) FILTER (WHERE status = 'settled'), 0) AS total_fees
       FROM trade_clearings`
    );
  },
  [TAGS.CLEARINGS],
  { revalidate: 60, tags: [TAGS.CLEARINGS] }
);

// ── Tag invalidation helpers (call from Server Actions / Route Handlers) ──────

/** Call after a new security is approved or rejected. */
export function invalidateSecurities() {
  revalidateTag(TAGS.SECURITIES);
  revalidateTag(TAGS.MARKET_STATS);
}

/** Call after a trade is executed or an order book fill settles. */
export function invalidateTrades() {
  revalidateTag(TAGS.TRADES);
  revalidateTag(TAGS.CLEARINGS);
  revalidateTag(TAGS.MARKET_STATS);
}

/** Call after a security is tokenised on-chain. */
export function invalidateBlockchainRecords() {
  revalidateTag(TAGS.BLOCKCHAIN_STATUS);
  revalidateTag(TAGS.SECURITIES);
}
