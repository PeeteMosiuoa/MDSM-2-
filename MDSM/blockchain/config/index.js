// blockchain/config/index.js
require('dotenv').config(); // loads .env if present

module.exports = {
  network: {
    name: 'mdsm-local-qbft',
    rpcUrl: process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545',
    chainId: Number(process.env.BLOCKCHAIN_CHAIN_ID) || 1337,
  },
  accounts: {
    // Use ONE backend-controlled account (from your validators or pre-funded)
    // NEVER commit real keys → always .env
    backendPrivateKey: process.env.BACKEND_PRIVATE_KEY,
  },
  contracts: {
    // Add addresses after you deploy (via hardhat or manually)
    tradeRegistry: process.env.TRADE_REGISTRY_ADDRESS || null,
  },
};