// blockchain/contracts/TradeRegistry.js
const { getContract } = require('../utils/client');
const config = require('../config');

const ABI = [ /* paste your TradeRegistry ABI here from artifacts/.../TradeRegistry.json */ ];

function getTradeRegistry() {
  const address = config.contracts.tradeRegistry;
  if (!address) throw new Error('TradeRegistry address not set in config / .env');
  return getContract(address, ABI);
}

async function recordTrade(params) {
  const contract = getTradeRegistry();
  const tx = await contract.recordTrade(
    params.tradeId,
    params.buyer,
    params.seller,
    params.quantity,
    params.price,
    params.assetSymbol,
    params.dataHash,
    { gasLimit: 400000 }
  );
  return tx.wait();
}

module.exports = {
  getTradeRegistry,
  recordTrade,
};