/**
 * lib/blockchain/provider.js
 *
 * Singleton read-only JsonRpcProvider for the local QBFT node.
 *
 * Problem this solves
 * ───────────────────
 * recordTrade.js called getClient() on every trade, which creates a brand-new
 * ethers.JsonRpcProvider each time.  That means:
 *   • a fresh TCP connection (+ TLS if HTTPS RPC) per transaction
 *   • ethers' background block-polling loop starts and must be explicitly
 *     destroyed to avoid leaking timers in the Next.js process
 *
 * Read operations (getOnChainBalance, getOnChainHolders, getBlockNumber) are
 * pure JSON-RPC calls with no signing.  A single persistent provider can
 * serve all of them, with a simple reconnect guard.
 *
 * Write operations (mintTokens, recordTrade, executeTrade) still use
 * short-lived Wallet instances because each write must manage its own nonce
 * and the provider destruction guarantee must be upheld per the existing
 * recordTrade.js design contract.  Pass `readProvider` to those functions
 * instead of constructing a new provider.
 *
 * Usage
 * ─────
 *   import { getReadProvider } from '@/lib/blockchain/provider';
 *   const provider = getReadProvider();
 *   const blockNum = await provider.getBlockNumber();
 */

import { ethers } from 'ethers';

let _provider = null;
let _lastHealthy = 0;
const HEALTH_TTL_MS = 30_000; // reuse provider if it was healthy in the last 30 s

function buildProvider() {
  const rpcUrl = process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545';
  const chainId = BigInt(process.env.BLOCKCHAIN_CHAIN_ID || '1337');
  const network = new ethers.Network('besu-qbft', chainId);
  return new ethers.JsonRpcProvider(rpcUrl, network, {
    staticNetwork: network,
    polling: false,       // disable background polling — we call explicitly
    batchMaxCount: 5,     // batch up to 5 JSON-RPC calls per HTTP request
  });
}

/**
 * Returns a module-level singleton read-only provider.
 * Recreates it if the last health check is stale (>30 s ago).
 */
export function getReadProvider() {
  const now = Date.now();
  if (!_provider || now - _lastHealthy > HEALTH_TTL_MS) {
    if (_provider) {
      try { _provider.destroy(); } catch { /* ignore */ }
    }
    _provider = buildProvider();
    _lastHealthy = now;
  }
  return _provider;
}

/**
 * Mark the provider healthy (call after a successful RPC response).
 * Extends the reuse window so we don't recreate on every call.
 */
export function markProviderHealthy() {
  _lastHealthy = Date.now();
}

/**
 * Probe the RPC endpoint and return { ok, blockNumber, latencyMs }.
 * Useful for the admin health-check API route.
 */
export async function probeBlockchainRpc() {
  const t0 = Date.now();
  try {
    const provider = getReadProvider();
    const blockNumber = await provider.getBlockNumber();
    const latencyMs = Date.now() - t0;
    markProviderHealthy();
    return { ok: true, blockNumber, latencyMs };
  } catch (err) {
    // Invalidate the singleton so the next call rebuilds it
    if (_provider) {
      try { _provider.destroy(); } catch { /* ignore */ }
      _provider = null;
    }
    return { ok: false, error: err.message, latencyMs: Date.now() - t0 };
  }
}
