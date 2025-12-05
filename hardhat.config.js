require("@nomicfoundation/hardhat-toolbox");
require("solidity-coverage");
require("dotenv").config();

// const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.19",
  settings: {
    optimizer: {
      enabled: true,
      runs: 200
    }
  },
  // 未生效，使用 .solcover.js 来配置
  // coverage: {
  //   enabled: true,
  //   settings: {
  //     exclude: [
  //       "contracts/test/**",
  //     ]
  //   }
  // }
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    sepolia: {
      url: `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts: [process.env.PRIVATE_KEY],
    }
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  }
};
