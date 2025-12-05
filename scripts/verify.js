const { run } = require("hardhat");
const fs = require("fs");
const path = require("path");
const { ethers } = require("hardhat");

async function main() {
    console.log("🔍 Verifying contract on Etherscan...");

    const network = await ethers.provider.getNetwork();
    const deploymentDir = path.join(__dirname, "..", "deployments", network.name, "deployment.json");

    if (!fs.existsSync(deploymentDir)) {
        throw new Error(`Deployment info not found for network: ${network.name}`);
    }

    const deploymentInfo = JSON.parse(fs.readFileSync(deploymentDir, "utf8"));

    console.log(`Verifying contract at ${deploymentInfo.contract.address}`);
    console.log(`Network: ${network.name} (Chain ID: ${network.chainId})`);

    try {
        await run("verify:verify", {
            address: deploymentInfo.contract.address,
            constructorArguments: deploymentInfo.verification.constructorArguments
        });

        console.log("✅ Contract verified successfully!");
    } catch (error) {
        if (error.message.includes("Already Verified")) {
            console.log("✅ Contract is already verified");
        } else {
            console.error(`❌ Verification failed: ${error.message}`);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });