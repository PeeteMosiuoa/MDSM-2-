// blockchain/contracts/SecurityTokenRegistry.js
// JS wrapper for the SecurityTokenRegistry smart contract.
// ABI matches SecurityTokenRegistry.sol exactly.

export const SECURITY_TOKEN_REGISTRY_ABI = [
  // ── Constructor ───────────────────────────────────────────────
  "constructor()",

  // ── Admin ─────────────────────────────────────────────────────
  "function owner() view returns (address)",
  "function minters(address) view returns (bool)",
  "function addMinter(address account) external",
  "function removeMinter(address account) external",
  "function transferOwnership(address newOwner) external",

  // ── Token Operations ──────────────────────────────────────────
  "function mintSecurity(uint256 securityId, address to, uint256 amount, string calldata symbol) external",
  "function executeTrade(bytes32 tradeId, uint256 securityId, address buyer, address seller, uint256 quantity, uint256 price) external",
  "function recordTrade(bytes32 tradeId, address buyer, address seller, uint256 quantity, uint256 price, string calldata assetSymbol, bytes32 dataHash) external",

  // ── Views ─────────────────────────────────────────────────────
  "function getBalance(uint256 securityId, address holder) view returns (uint256)",
  "function getHolders(uint256 securityId) view returns (address[])",
  "function getTrade(bytes32 tradeId) view returns (uint256 securityId, address buyer, address seller, uint256 quantity, uint256 price, uint256 timestamp)",
  "function totalSupply(uint256 securityId) view returns (uint256)",
  "function securityExists(uint256 securityId) view returns (bool)",
  "function balances(uint256 securityId, address holder) view returns (uint256)",

  // ── Events ────────────────────────────────────────────────────
  "event SecurityMinted(uint256 indexed securityId, address indexed to, uint256 amount, string symbol)",
  "event TokensTransferred(uint256 indexed securityId, address indexed from, address indexed to, uint256 amount)",
  "event TradeExecuted(bytes32 indexed tradeId, uint256 indexed securityId, address buyer, address seller, uint256 quantity, uint256 price, uint256 timestamp)",
  "event MinterAdded(address indexed minter)",
  "event MinterRemoved(address indexed minter)",
];

/**
 * Get the deployed SecurityTokenRegistry contract instance.
 * Creates a fresh provider+signer each call — always call provider.destroy() after use.
 */
export function getRegistryClient() {
  const rpcUrl          = process.env.BLOCKCHAIN_RPC_URL || "http://127.0.0.1:8545";
  const privateKey      = process.env.BACKEND_PRIVATE_KEY;
  const contractAddress = process.env.TRADE_REGISTRY_ADDRESS; // reuse same env var

  if (!privateKey)      throw new Error("BACKEND_PRIVATE_KEY env var is not set");
  if (!contractAddress) throw new Error("TRADE_REGISTRY_ADDRESS env var is not set");

  const chainId  = BigInt(process.env.BLOCKCHAIN_CHAIN_ID || "1337");
  const network  = new (require("ethers").ethers.Network)("besu-qbft", chainId);
  const provider = new (require("ethers").ethers.JsonRpcProvider)(rpcUrl, network, { staticNetwork: network });
  const signer   = new (require("ethers").ethers.Wallet)(privateKey, provider);
  const contract = new (require("ethers").ethers.Contract)(contractAddress, SECURITY_TOKEN_REGISTRY_ABI, signer);

  return { provider, signer, contract };
}
