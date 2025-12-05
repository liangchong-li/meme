const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// 配置参数（可以根据需要修改）
const CONFIG = {
    tokenName: "MemeToken",
    tokenSymbol: "LCMT",
    initialSupply: "1000000000",
    marketingWallet: null, // 将在部署时设置
    teamWallet: null, // 将在部署时设置
    uniswapRouter: "0xC532a74256D3Db42D0Bf7a0400fEFDbad7694008"
};

async function main() {
    // 获取部署账户
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);

    // 如果没有指定钱包地址，使用部署者地址
    CONFIG.marketingWallet = CONFIG.marketingWallet || deployer.address;
    CONFIG.teamWallet = CONFIG.teamWallet || deployer.address;

    // 获取网络信息
    const network = hre.network;
    console.log("Network:", network.name);
    console.log("Chain ID:", network.config.chainId);

    const MemeToken = await ethers.getContractFactory("MemeToken");
    const memeToken = await MemeToken.deploy(
        CONFIG.tokenName,
        CONFIG.tokenSymbol,
        hre.ethers.parseEther(CONFIG.initialSupply),
        CONFIG.marketingWallet,
        CONFIG.teamWallet,
        CONFIG.uniswapRouter
    );

    console.log("Waiting for transaction confirmation...");
    // 等待部署完成
    await memeToken.waitForDeployment();

    console.log(`MemeToken deployed successfully!`);
    const contractAddress = await memeToken.getAddress();
    console.log(`Contract Address: ${contractAddress}`);

    const deploymentTx = await memeToken.deploymentTransaction();
    console.log(`Transaction Hash: ${deploymentTx.hash}`);

    // 等待额外的区块确认
    console.log("Waiting for 3 block confirmations...");
    // await deploymentTx.wait(3);

    // 获取部署交易收据
    const receipt = await hre.ethers.provider.getTransactionReceipt(deploymentTx.hash);
    const blockNumber = receipt?.blockNumber || "unknown";

    // 保存部署信息
    await saveDeploymentInfo(network, memeToken, CONFIG, deployer.address, deploymentTx, blockNumber);

    console.log("Deployment completed successfully!");
}

// 保存部署信息
async function saveDeploymentInfo(network, contract, config, deployer, deploymentTx, blockNumber) {
    const deploymentDir = path.join(__dirname, "..", "deployments");

    // 创建目录
    if (!fs.existsSync(deploymentDir)) {
        fs.mkdirSync(deploymentDir, { recursive: true });
    }

    const networkDir = path.join(deploymentDir, network.name);
    if (!fs.existsSync(networkDir)) {
        fs.mkdirSync(networkDir, { recursive: true });
    }

    // 获取合约地址
    const contractAddress = await contract.getAddress();

    const deploymentInfo = {
        network: network.name,
        chainId: network.chainId || "unknown",
        // chainId: network.config.chainId || "unknown",
        contract: {
            name: "MemeToken",
            address: contractAddress,
            deployer: deployer,
            transactionHash: deploymentTx.hash,
            blockNumber: blockNumber,
            timestamp: new Date().toISOString()
        },
        configuration: {
            tokenName: config.tokenName,
            tokenSymbol: config.tokenSymbol,
            initialSupply: config.initialSupply,
            marketingWallet: config.marketingWallet,
            teamWallet: config.teamWallet,
            uniswapRouter: config.uniswapRouter
        },
        verification: {
            constructorArguments: [
                config.tokenName,
                config.tokenSymbol,
                hre.ethers.parseEther(config.initialSupply).toString(),
                config.marketingWallet,
                config.teamWallet,
                config.uniswapRouter
            ]
        }
    };

    const infoPath = path.join(networkDir, "deployment.json");
    console.log("deploymentInfo: ", deploymentInfo);
    fs.writeFileSync(infoPath, JSON.stringify(deploymentInfo, null, 2));

    // 也保存一个简单的地址文件
    const addressPath = path.join(networkDir, "address.txt");
    fs.writeFileSync(addressPath, contractAddress);

    console.log(`Deployment information saved to: ${infoPath}`);
    console.log(`Contract address saved to: ${addressPath}`);

    return deploymentInfo;
}

// 错误处理
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(`❌ Deployment failed: ${error.message}`);
        console.error(error.stack);
        process.exit(1);
    });