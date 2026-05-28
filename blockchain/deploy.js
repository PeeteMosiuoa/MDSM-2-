#!/usr/bin/env node
/**
 * blockchain/deploy.js
 *
 * Deploy SecurityTokenRegistry to the local QBFT network.
 * Run once: node blockchain/deploy.js
 *
 * After deployment, copy the printed address into .env.local:
 *   TRADE_REGISTRY_ADDRESS=0x...
 *
 * Requirements:
 *   npm install --save-dev hardhat @nomicfoundation/hardhat-ethers ethers
 *   npx hardhat compile    (produces artifacts)
 *
 * OR use the ethers.js inline deploy below if you have the bytecode.
 */

import { ethers } from "ethers";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load compiled artifact (run `npx hardhat compile` first) ─────────────────
let artifact;
try {
  artifact = JSON.parse(
    readFileSync(
      resolve(__dirname, "artifacts/contracts/SecurityTokenRegistry.sol/SecurityTokenRegistry.json"),
      "utf8"
    )
  );
} catch {
  console.error(
    "\n❌  Artifact not found. Please compile first:\n" +
    "    cd blockchain && npx hardhat compile\n"
  );
  process.exit(1);
}

const { abi, bytecode } = artifact;

async function main() {
  const rpcUrl    = process.env.BLOCKCHAIN_RPC_URL    || "http://127.0.0.1:8545";
  const privateKey = process.env.BACKEND_PRIVATE_KEY;
  const chainId   = BigInt(process.env.BLOCKCHAIN_CHAIN_ID || "1337");

  if (!privateKey) {
    console.error("❌  BACKEND_PRIVATE_KEY is not set in environment");
    process.exit(1);
  }

  console.log(`\n🔗  Connecting to ${rpcUrl} (chain ${chainId})…`);

  const network  = new ethers.Network("besu-qbft", chainId);
  const provider = new ethers.JsonRpcProvider(rpcUrl, network, { staticNetwork: network });
  const signer   = new ethers.Wallet(privateKey, provider);

  console.log(`📬  Deployer: ${signer.address}`);

  const balance = await provider.getBalance(signer.address);
  console.log(`💰  Balance:  ${ethers.formatEther(balance)} ETH`);

  // Deploy
  const factory  = new ethers.ContractFactory(abi, bytecode, signer);
  console.log("\n🚀  Deploying SecurityTokenRegistry…");

  const contract = await factory.deploy({ gasLimit: 3_000_000, gasPrice: 0n });
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log(`\n✅  Deployed at: ${address}`);
  console.log(`\n📋  Add to .env.local:\n    TRADE_REGISTRY_ADDRESS=${address}\n`);

  provider.destroy();
}

main().catch((err) => {
  console.error("Deploy failed:", err);
  process.exit(1);
});
