const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MemeToken", function () {
  let owner, addr1, addr2, addr3, marketingWallet, teamWallet;
  let MemeToken;
  let memeToken;
  let MockRouter;
  let mockRouter;
  // const uniswapRouterAddress = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";

  // 零地址
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

  beforeEach(async function () {
    [owner, addr1, addr2, addr3, marketingWallet, teamWallet] = await ethers.getSigners();

    // 部署 Mock Router
    MockRouter = await ethers.getContractFactory("MockUniswapV2Router02");
    // 使用一个模拟的 WETH 地址
    mockRouter = await MockRouter.deploy(addr1.address); // 随便一个地址作为 WETH

    MemeToken = await ethers.getContractFactory("MemeToken");
    // console.log("marketingWallet 1:", await marketingWallet.address);
    // console.log("marketingWallet 2:", await marketingWallet.getAddress());
    // console.log("marketingWallet 3:", await marketingWallet.target); // undefined
    memeToken = await MemeToken.deploy("MemeToken", "LCMT", ethers.parseEther("1000000"), marketingWallet.address, teamWallet.address, mockRouter.target)
    // console.log("MemeToken deployed to:", await memeToken.getAddress());
  });

  describe("Deployment", function () {
    it("Should revert when deploying with zero marketing wallet", async function () {
      await expect(
        MemeToken.deploy("MemeToken", "LCMT", ethers.parseEther("1000000"), ZERO_ADDRESS, teamWallet.address, owner.address)
      ).to.be.revertedWith("Marketing wallet can not be zero address");
    });

    it("should revert when deploying with zero team wallet", async function () {
      await expect(
        MemeToken.deploy("MemeToken", "LCMT", ethers.parseEther("1000000"), marketingWallet.address, ZERO_ADDRESS, owner.address)
      ).to.be.revertedWith("team wallet can not be zero address");
    });

    it("Should set the correct name and symbol", async function () {
      console.log("MemeToken deployed to:", await memeToken.getAddress());
      expect(await memeToken.name()).to.equal("MemeToken");
      expect(await memeToken.symbol()).to.equal("LCMT");
    });

    it("Should assign the total supply to the owner", async function () {
      const ownerBalance = await memeToken.balanceOf(owner.address);
      expect(ownerBalance).to.equal(ethers.parseEther("1000000"));
    });

    it("Should set correct wallet addresses", async function () {
      expect(await memeToken.marketingWallet()).to.equal(marketingWallet.address);
      expect(await memeToken.teamWallet()).to.equal(teamWallet.address);
    });

    it("Should set correct transaction limits", async function () {
      const maxWallet = await memeToken.maxWalletAmount();
      const maxTx = await memeToken.maxTxAmount();
      const maxDaily = await memeToken.maxDayilyTx();

      // 2% of 1,000,000 = 20,000
      expect(maxWallet).to.equal(ethers.parseEther("20000"));
      // 1% of 1,000,000 = 10,000
      expect(maxTx).to.equal(ethers.parseEther("10000"));
      expect(maxDaily).to.equal(10);
    });

    it("Should set correct tax rates", async function () {
      expect(await memeToken.baseTax()).to.equal(500); // 5%
      expect(await memeToken.liquidityTax()).to.equal(4000); // 40%
      expect(await memeToken.marketingTax()).to.equal(3000); // 30%
      expect(await memeToken.burnTax()).to.equal(2000); // 20%
      expect(await memeToken.teamTax()).to.equal(1000); // 10%
    });

    it("Should exclude key addresses from fee", async function () {
      expect(await memeToken.isExcludedFromFee(owner.address)).to.be.true;
      expect(await memeToken.isExcludedFromFee(memeToken.target)).to.be.true;
      expect(await memeToken.isExcludedFromFee(marketingWallet.address)).to.be.true;
      expect(await memeToken.isExcludedFromFee(teamWallet.address)).to.be.true;
    });

    it("Should exclude key addresses from max wallet", async function () {
      expect(await memeToken.isExcludedFromLimits(owner.address)).to.be.true;
      expect(await memeToken.isExcludedFromLimits(memeToken.target)).to.be.true;
      // expect(await memeToken.isExcludedFromLimits(memeToken.address)).to.be.true;  // TypeError: unsupported addressable value
      // expect(await memeToken.isExcludedFromLimits(memeToken.getAddress())).to.be.true;
    });
  });

  describe("Tax manager", function () {
    it("Should only allow owner to update tax", async function () {
      await expect(memeToken.connect(addr1).updateTax(300))
        .to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should update base tax correctly", async function () {
      expect(await memeToken.baseTax()).to.equal(500);
      await memeToken.updateTax(300);
      expect(await memeToken.baseTax()).to.equal(300);
    });

    it("Should not allow tax more than 10%", async function () {
      await expect(memeToken.updateTax(1001))
        .to.be.revertedWith("Base tax must be less than 10%");
    });

    it("Should emit UpdateTax event", async function () {
      await expect(memeToken.updateTax(300))
        .to.emit(memeToken, "UpdateTax")
        .withArgs(300);
    });

    it("Should update tax distribution correctly", async function () {
      await memeToken.updateTaxDistribution(3000, 3000, 2000, 2000);

      expect(await memeToken.liquidityTax()).to.equal(3000);
      expect(await memeToken.marketingTax()).to.equal(3000);
      expect(await memeToken.burnTax()).to.equal(2000);
      expect(await memeToken.teamTax()).to.equal(2000);
    });

    it("Should require tax distribution to sum to 100%", async function () {
      await expect(
        memeToken.updateTaxDistribution(3000, 3000, 2000, 1000)
      ).to.be.revertedWith("tax distribution must be 100%");
    });

    it("Should emit UpdateTaxDistribution event", async function () {
      await expect(memeToken.updateTaxDistribution(3000, 3000, 2000, 2000))
        .to.emit(memeToken, "UpdateTaxDistribution")
        .withArgs(3000, 3000, 2000, 2000);
    });
  });

  describe("Wallet Management", function () {
    it("Should only allow owner to update marketing wallet", async function () {
      await expect(
        memeToken.connect(addr1).updateMarketingWallet(addr2.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should update marketing wallet correctly", async function () {
      await memeToken.updateMarketingWallet(addr2.address);
      expect(await memeToken.marketingWallet()).to.equal(addr2.address);
    });

    it("Marketing wallet cannot be zero address", async function () {
      await expect(
        memeToken.updateMarketingWallet(ZERO_ADDRESS)  // ethers.constants.AddressZero not working
      ).to.be.revertedWith("Marketing wallet can not be zero address");
    });

    it("Should only allow owner to update team wallet", async function () {
      await expect(
        memeToken.connect(addr1).updateTeamWallet(addr2.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should update team wallet correctly", async function () {
      await memeToken.updateTeamWallet(addr2.address);
      expect(await memeToken.teamWallet()).to.equal(addr2.address);
    });

    it("Team wallet cannot be zero address", async function () {
      await expect(
        memeToken.updateTeamWallet(ZERO_ADDRESS)  // ethers.constants.AddressZero not working
      ).to.be.revertedWith("Team wallet can not be zero address");
    });
  });

  describe("Limit Management", function () {
    it("Should only allow owner to update limits", async function () {
      await expect(
        memeToken.connect(addr1).updateMaxWalletAmount(ethers.parseEther("1000"))
      ).to.be.revertedWith("Ownable: caller is not the owner");

      await expect(
        memeToken.connect(addr1).updateMaxTxAmount(ethers.parseEther("1000"))
      ).to.be.revertedWith("Ownable: caller is not the owner");

      await expect(
        memeToken.connect(addr1).updateMaxDayilyTx(5)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should update max wallet amount correctly", async function () {
      await memeToken.updateMaxWalletAmount(ethers.parseEther("5000"));
      expect(await memeToken.maxWalletAmount()).to.equal(ethers.parseEther("5000"));
    });

    it("Should update max transaction amount correctly", async function () {
      await memeToken.updateMaxTxAmount(ethers.parseEther("2500"));
      expect(await memeToken.maxTxAmount()).to.equal(ethers.parseEther("2500"));
    });

    it("Should update max daily transactions correctly", async function () {
      await memeToken.updateMaxDayilyTx(5);
      expect(await memeToken.maxDayilyTx()).to.equal(5);
    });
  });

  describe("Whitelist and Blacklist Management", function () {
    it("Should only allow owner to manage lists", async function () {
      await expect(
        memeToken.connect(addr1).excludeFromFee(addr2.address, true)
      ).to.be.revertedWith("Ownable: caller is not the owner");

      await expect(
        memeToken.connect(addr1).excludeFromLimits(addr2.address, true)
      ).to.be.revertedWith("Ownable: caller is not the owner");

      await expect(
        memeToken.connect(addr1).setBlacklist(addr2.address, true)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should manage fee exclusion correctly", async function () {
      await memeToken.excludeFromFee(addr2.address, true);
      expect(await memeToken.isExcludedFromFee(addr2.address)).to.be.true;

      await memeToken.excludeFromFee(addr2.address, false);
      expect(await memeToken.isExcludedFromFee(addr2.address)).to.be.false;
    });

    it("Should manage max wallet exclusion correctly", async function () {
      await memeToken.excludeFromLimits(addr2.address, true);
      expect(await memeToken.isExcludedFromLimits(addr2.address)).to.be.true;

      await memeToken.excludeFromLimits(addr2.address, false);
      expect(await memeToken.isExcludedFromLimits(addr2.address)).to.be.false;
    });

    it("Should manage blacklist correctly", async function () {
      await memeToken.setBlacklist(addr2.address, true);
      expect(await memeToken.blacklisted(addr2.address)).to.be.true;

      await memeToken.setBlacklist(addr2.address, false);
      expect(await memeToken.blacklisted(addr2.address)).to.be.false;
    });
  });

  describe("Rescue Functions", function () {
    it("Should only allow owner to rescue funds", async function () {
      // 发送一些ETH到合约
      await owner.sendTransaction({
        to: memeToken.target,
        value: ethers.parseEther("1.0")
      });

      await expect(
        memeToken.connect(addr1).rescueETH()
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should be able to rescue ETH", async function () {
      // 获取初始余额
      const initialContractBalance = await ethers.provider.getBalance(memeToken.target);
      const initialOwnerBalance = await ethers.provider.getBalance(owner.address);
      // console.log("initialContractBalance: ", await ethers.formatEther(initialContractBalance));
      // console.log("initialOwnerBalance: ", await ethers.formatEther(initialOwnerBalance));
      // 发送一些ETH到合约
      const ethAmount = ethers.parseEther("1.0");
      await owner.sendTransaction({
        to: memeToken.target,
        value: ethAmount
      });

      // 验证合约收到ETH
      const contractBalanceAfter = await ethers.provider.getBalance(memeToken.target);
      expect(contractBalanceAfter).to.equal(initialContractBalance + ethAmount); // initialContractBalance.add() 无法工作

      // 救援ETH
      const rescueTx = await memeToken.rescueETH();
      const receipt = await rescueTx.wait();

      // 验证合约余额归零
      const finalContractBalance = await ethers.provider.getBalance(memeToken.target);
      expect(finalContractBalance).to.equal(0);
    });

    it("Should be able to rescue other tokens", async function () {
      // 部署一个测试ERC20代币
      const TestERC20 = await ethers.getContractFactory("ERC20Mock");
      const testToken = await TestERC20.deploy();

      // 给所有者铸造一些代币
      await testToken.mint(owner.address, ethers.parseEther("1000"));

      // meme合约，测试币余额应该为0
      const memeBalanceOfTest = await testToken.balanceOf(memeToken.target);
      expect(memeBalanceOfTest).to.equal(ethers.parseEther("0"));

      // 发送一些测试代币到合约
      await testToken.transfer(memeToken.target, ethers.parseEther("100"));

      // meme合约，测试币余额应该为100
      const memeBalanceOfTestAfterTransfer = await testToken.balanceOf(memeToken.target);
      expect(memeBalanceOfTestAfterTransfer).to.equal(ethers.parseEther("100"));

      // 救援代币
      await memeToken.rescueToken(testToken.target, ethers.parseEther("50"));

      const ownerBalance = await testToken.balanceOf(owner.address);
      // 初始1000 - 转出的100 + 救援的50 = 950
      expect(ownerBalance).to.equal(ethers.parseEther("950"));
      // meme合约，救援后测试币余额应该为50
      const memeBalanceOfTestAfterRescue = await testToken.balanceOf(memeToken.target);
      expect(memeBalanceOfTestAfterRescue).to.equal(ethers.parseEther("50"));
    });

    it("Cannot rescue own tokens", async function () {
      await expect(
        memeToken.rescueToken(memeToken.target, 1000)
      ).to.be.revertedWith("Cannot rescue own tokens");
    });
  });

  describe("Receive Function", function () {
    it("Should accept ETH", async function () {
      // 获取初始合约余额
      const initialBalance = await ethers.provider.getBalance(memeToken.target);
      expect(initialBalance).to.equal(ethers.parseEther("0"));

      const tx = await owner.sendTransaction({
        to: memeToken.target,
        value: ethers.parseEther("1.0")
      });

      await expect(tx)
        .to.changeEtherBalance(memeToken.target, ethers.parseEther("1.0"));

      // 获取初始合约余额
      const balanceAfter = await ethers.provider.getBalance(memeToken.target);
      expect(balanceAfter).to.equal(ethers.parseEther("1"));
    });
  });

  describe("Edge Cases", function () {
    beforeEach(async function () {
      await memeToken.enableTrading();
      await memeToken.transfer(addr1.address, ethers.parseEther("1000"));
    });

    it("Should not allow transfer to zero address", async function () {
      await expect(
        memeToken.connect(addr1).transfer(ZERO_ADDRESS, ethers.parseEther("100"))
      ).to.be.revertedWith("Transfer to the zero address");
    });

    it("Should not allow transfer of zero amount", async function () {
      await expect(
        memeToken.connect(addr1).transfer(addr2.address, 0)
      ).to.be.revertedWith("Transfer value must be gerater than zero");
    });
  });

  describe("Liquidity", function () {
    it("Should only allow owner to add liquidity", async function () {
      await expect(
        memeToken.connect(addr1).addLiquidityWithETH(1000, { value: 1000 })
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Add liquidity requires positive amounts", async function () {
      await expect(
        memeToken.addLiquidityWithETH(0, { value: 1000 })
      ).to.be.revertedWith("Token amount must be greater than zero");

      await expect(
        memeToken.addLiquidityWithETH(1000, { value: 0 })
      ).to.be.revertedWith("ETH amount must be greater than zero");
    });

    it("Should add liquidity", async function () {
      const tokenAmount = ethers.parseEther("1000");
      const ethAmount = ethers.parseEther("1");

      // 给合约转账代币
      await memeToken.transfer(memeToken.target, tokenAmount);

      // 授权
      await memeToken.approve(memeToken.target, tokenAmount);

      // 添加流动性
      await expect(
        memeToken.addLiquidityWithETH(tokenAmount, { value: ethAmount })
      ).to.emit(memeToken, "LiquidityAdded");
    });
  });

  describe("EnableTrading", function () {
    it("Should not allow transfer with tradingEnabled is false", async function () {
      await expect(
        memeToken.connect(addr1).transfer(addr2.address, 10)
      ).to.be.revertedWith("Trading is not enabled yet");
    });

    it("Should allow transfer by isExcludedFromLimits with tradingEnabled is false", async function () {
      // 使用 owner 转账，并且不应该被revert
      await expect(memeToken.connect(owner).transfer(addr2.address, 10))
        .to.not.be.reverted;

      // 使用 marketingWallet 接收转账，并且不应该被revert
      await expect(memeToken.connect(addr2).transfer(marketingWallet.address, 10))
        .to.not.be.reverted;

      // 使用 marketingWallet 转账，并且不应该被revert
      await expect(memeToken.connect(marketingWallet).transfer(addr1.address, 10))
        .to.not.be.reverted;
    });
  });

  describe("Transaction Limits", function () {
    beforeEach(async function () {
      await memeToken.enableTrading();
      await memeToken.transfer(addr1.address, ethers.parseEther("15000"));
    });

    it("Should respect max transaction amount", async function () {
      const maxTx = await memeToken.maxTxAmount();
      const amountExceeding = maxTx + 1n;

      await expect(
        memeToken.connect(addr1).transfer(addr2.address, amountExceeding)
      ).to.be.revertedWith("Transfer value must be less than maxTxAmount");

      // 转账等于最大额度应该成功
      await expect(memeToken.connect(addr1).transfer(addr2.address, maxTx)).to.not.be.reverted;

      // 将addr1 加入到免限名单，然后超过最大额度，应该成功
      await memeToken.transfer(addr1.address, ethers.parseEther("15000"));
      await memeToken.excludeFromLimits(addr1.address, true);
      await expect(memeToken.connect(addr1).transfer(addr2.address, amountExceeding)).to.not.be.reverted;
    });

    it("Should respect max wallet amount", async function () {
      // 先给账户2转 15000 个代币
      await memeToken.transfer(addr2.address, ethers.parseEther("15000"));

      const maxWallet = await memeToken.maxWalletAmount();
      console.log("maxWallet: ", await ethers.formatEther(maxWallet));
      const addr2Balance = await memeToken.balanceOf(addr2.address);
      console.log("addr2Balance: ", await ethers.formatEther(addr2Balance));
      const amountExceeding = maxWallet - addr2Balance + 1n;

      // 超过最大钱包额度，应该失败
      await expect(
        memeToken.connect(addr1).transfer(addr2.address, amountExceeding)
      ).to.be.revertedWith("Exeeds maximum wallet token amount");

      // 小于最大钱包额度，应该成功
      const amountExceedingOK = maxWallet - addr2Balance - 1n;
      await expect(memeToken.connect(addr1).transfer(addr2.address, amountExceedingOK)).to.not.be.reverted;
    });

    it("Excluded addresses are not limited by max wallet", async function () {
      await expect(memeToken.transfer(addr1.address, ethers.parseEther("15000"))).to.be.revertedWith("Exeeds maximum wallet token amount");
      await memeToken.excludeFromLimits(addr1.address, true);
      await expect(memeToken.transfer(addr1.address, ethers.parseEther("15000"))).to.not.be.reverted;
    });

    it("Should respect daily transaction limit", async function () {
      const smallAmount = ethers.parseEther("100");

      // 进行10次交易（达到限制）
      for (let i = 0; i < 10; i++) {
        await memeToken.connect(addr1).transfer(addr2.address, smallAmount);
      }

      // 第11次应该失败
      await expect(
        memeToken.connect(addr1).transfer(addr2.address, smallAmount)
      ).to.be.revertedWith("Exceeds daily transaction limit");

      // 加入白名单，应该成功
      await memeToken.excludeFromLimits(addr1.address, true);
      await expect(
        memeToken.connect(addr1).transfer(addr2.address, smallAmount)
      ).to.not.be.reverted;
    });

    it("Should reset daily transaction count on new day", async function () {
      const smallAmount = ethers.parseEther("100");

      // 进行10次交易
      for (let i = 0; i < 10; i++) {
        await memeToken.connect(addr1).transfer(addr2.address, smallAmount);
      }

      // 增加1天时间
      await ethers.provider.send("evm_increaseTime", [86400]); // 24小时
      await ethers.provider.send("evm_mine");

      // 现在应该可以再次交易
      await memeToken.connect(addr1).transfer(addr2.address, smallAmount);
    });
  });

  describe("Transfers with Tax", function () {
    beforeEach(async function () {
      await memeToken.enableTrading();
      await memeToken.transfer(addr1.address, ethers.parseEther("10000"));
      await memeToken.transfer(addr2.address, ethers.parseEther("10000"));
    });

    it("Should not charge tax for excluded addresses", async function () {
      const amount = ethers.parseEther("1000");

      await memeToken.excludeFromFee(addr1.address, true);

      const initialBalance = await memeToken.balanceOf(addr3.address);
      await memeToken.connect(addr1).transfer(addr3.address, amount);
      const finalBalance = await memeToken.balanceOf(addr3.address);

      expect(finalBalance - initialBalance).to.equal(amount);
    });

    it("Should charge tax for regular transfers", async function () {
      const amount = ethers.parseEther("1000");
      // 初始余额
      const initialBalance = await memeToken.balanceOf(addr3.address);
      // token 初始总供应量
      const initialTotalSupply = await memeToken.totalSupply();

      await memeToken.connect(addr1).transfer(addr3.address, amount);

      const finalBalance = await memeToken.balanceOf(addr3.address);
      const finalTotalSupply = await memeToken.totalSupply();

      // 计算税后收到的金额（5%的税）
      const tax = amount * 5n / 100n; // 5% of 1000 = 50
      const expectedReceived = amount - tax; // 950

      expect(finalBalance - initialBalance).to.equal(expectedReceived);
      // 总供应量应该减少，因为有一部分销毁了
      expect(finalTotalSupply).to.be.lt(initialTotalSupply);
      // 验证销毁部分
      expect(finalTotalSupply + tax * 20n / 100n).to.be.equal(initialTotalSupply);
    });

    it("Blacklisted addresses cannot transfer", async function () {
      // 将 addr1 加入黑名单
      await memeToken.setBlacklist(addr1.address, true);

      await expect(
        memeToken.connect(addr1).transfer(addr2.address, ethers.parseEther("100"))
      ).to.be.revertedWith("Address is blacklisted");
    });

    it("Cannot transfer to blacklisted addresses", async function () {
      // 将 addr3 加入黑名单
      await memeToken.setBlacklist(addr3.address, true);

      await expect(
        memeToken.connect(addr1).transfer(addr3.address, ethers.parseEther("100"))
      ).to.be.revertedWith("Address is blacklisted");
    });

    it("Cannot transfer to tax is zero", async function () {
      await memeToken.updateTax(ethers.parseEther("0"));

      const amount = ethers.parseEther("1000");
      const initialBalance = await memeToken.balanceOf(addr3.address);
      await memeToken.connect(addr1).transfer(addr3.address, amount);
      const finalBalance = await memeToken.balanceOf(addr3.address);

      expect(finalBalance - initialBalance).to.equal(amount);
    });

    it("Cannot transfer to some distribution is zero", async function () {
      await memeToken.updateTax(ethers.parseEther("0"));

      const amount = ethers.parseEther("1000");
      const initialBalance = await memeToken.balanceOf(addr3.address);
      await memeToken.connect(addr1).transfer(addr3.address, amount);
      const finalBalance = await memeToken.balanceOf(addr3.address);

      expect(finalBalance - initialBalance).to.equal(amount);
    });
  });
});
