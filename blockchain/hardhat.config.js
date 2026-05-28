require("@nomicfoundation/hardhat-ethers");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    besu: {
      url: process.env.BLOCKCHAIN_RPC_URL || "http://127.0.0.1:8545",
      chainId: Number(process.env.BLOCKCHAIN_CHAIN_ID || 1337),
      accounts: process.env.BACKEND_PRIVATE_KEY
        ? [process.env.BACKEND_PRIVATE_KEY.startsWith("0x")
            ? process.env.BACKEND_PRIVATE_KEY
            : `0x${process.env.BACKEND_PRIVATE_KEY}`]
        : [],
      gasPrice: 0,
    },
  },
  paths: {
    sources:   "./contracts",
    artifacts: "./artifacts",
    cache:     "./cache",
  },
};
