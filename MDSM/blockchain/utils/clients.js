// blockchain/utils/client.js
const { ethers } = require('ethers');
const config = require('../config');

const provider = new ethers.JsonRpcProvider(config.network.rpcUrl, {
  chainId: config.network.chainId,
  name: config.network.name,
});

let signer = null;
if (config.accounts.backendPrivateKey) {
  signer = new ethers.Wallet(config.accounts.backendPrivateKey, provider);
}

function getSigner() {
  if (!signer) throw new Error('No backend private key configured');
  return signer;
}

function getProvider() {
  return provider;
}

// Optional: generic contract factory
function getContract(address, abi) {
  const connectedSigner = signer || provider;
  return new ethers.Contract(address, abi, connectedSigner);
}

module.exports = {
  provider,
  getSigner,
  getProvider,
  getContract,
};