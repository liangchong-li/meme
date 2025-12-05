// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";

// import "hardhat/console.sol";

contract MemeToken is ERC20, Ownable {
    // 税率分母
    uint256 private constant TAX_DENOMINATOR = 10000;
    // 基本税率 5%
    uint256 public baseTax = 500;
    // 税金分配
    // 40% 用于流动性
    uint256 public liquidityTax = 4000;
    // 30% 用于营销钱包
    uint256 public marketingTax = 3000;
    // 20% 销毁
    uint256 public burnTax = 2000;
    // 10% 给与团队
    uint256 public teamTax = 1000;

    // 营销钱包地址
    address public marketingWallet;
    // 团队钱包地址
    address public teamWallet;

    // 交易限制
    // 最大持有额度
    uint256 public maxWalletAmount;
    // 单笔交易最大额度
    uint256 public maxTxAmount;
    // 每日交易次数限制
    uint256 public maxDayilyTx;

    // 每日交易次数mapping
    mapping(address => UserDailyTx) public dailyTxCount;

    struct UserDailyTx {
        // 上次交易日期
        uint256 lastTxDate;
        // 日期下，交易次数
        uint256 txCount;
    }

    // ==== 白名单/免税/免限 ====
    mapping(address => bool) public isExcludedFromFee; // 免除交易税地址
    mapping(address => bool) public isExcludedFromLimits; // 免除限制地址（大户、合约操作等）
    // 黑名单
    mapping(address => bool) public blacklisted;
    // 自动做市
    IUniswapV2Router02 public immutable uniswapV2Router;

    // 防机器人
    bool public tradingEnabled = false;

    // ==== 事件声明 ====
    // 流动性添加事件
    event LiquidityAdded(
        uint256 tokenAmount,
        uint256 ethAmount,
        uint256 liquidity
    );
    event TradingEnabled();
    event UpdateTax(uint256 baseTax);
    event UpdateTaxDistribution(
        uint256 _liquidityTax,
        uint256 _marketingTax,
        uint256 _burnTax,
        uint256 _teamTax
    );

    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _initialSupply,
        address _marketingWallet,
        address _teamWallet,
        address _uniswapRouterAddress
    ) ERC20(_name, _symbol) {
        require(
            _marketingWallet != address(0),
            "Marketing wallet can not be zero address"
        );
        require(
            _teamWallet != address(0),
            "team wallet can not be zero address"
        );
        // 70% 供应给项目方，30% 添加到流动性
        _mint(msg.sender, (_initialSupply * 7) / 10);
        _mint(msg.sender, (_initialSupply * 3) / 10);
        marketingWallet = _marketingWallet;
        teamWallet = _teamWallet;

        // 最大持有量，为总数的 2%
        maxWalletAmount = (_initialSupply * 2) / 100;
        // 单笔交易最大额度，为总数的 1%
        maxTxAmount = (_initialSupply * 1) / 100;
        // 每日交易次数限制为 10 次
        maxDayilyTx = 10;

        uniswapV2Router = IUniswapV2Router02(_uniswapRouterAddress);

        // 设置免税地址名单
        isExcludedFromFee[_msgSender()] = true;
        isExcludedFromFee[address(this)] = true;
        isExcludedFromFee[_marketingWallet] = true;
        isExcludedFromFee[_teamWallet] = true;
        // 设置免限地址名单
        isExcludedFromLimits[_msgSender()] = true;
        isExcludedFromLimits[address(this)] = true;
        isExcludedFromLimits[_marketingWallet] = true;
        isExcludedFromLimits[_teamWallet] = true;
    }

    // ==== 启用交易 ====
    function enableTrading() external onlyOwner {
        require(!tradingEnabled, "Trading already enabled");
        tradingEnabled = true;
        emit TradingEnabled();
    }

    // ==== 修改税率 ====
    function updateTax(uint256 _baseTax) external onlyOwner {
        require(_baseTax <= 1000, "Base tax must be less than 10%");
        baseTax = _baseTax;
        emit UpdateTax(_baseTax);
    }

    function updateTaxDistribution(
        uint256 _liquidityTax,
        uint256 _marketingTax,
        uint256 _burnTax,
        uint256 _teamTax
    ) external onlyOwner {
        require(
            _liquidityTax + _marketingTax + _burnTax + _teamTax == 10000,
            "tax distribution must be 100%"
        );
        liquidityTax = _liquidityTax;
        marketingTax = _marketingTax;
        burnTax = _burnTax;
        teamTax = _teamTax;

        emit UpdateTaxDistribution(
            _liquidityTax,
            _marketingTax,
            _burnTax,
            _teamTax
        );
    }

    // ==== 修改地址 ====
    function updateMarketingWallet(
        address _marketingWallet
    ) external onlyOwner {
        require(
            _marketingWallet != address(0),
            "Marketing wallet can not be zero address"
        );
        marketingWallet = _marketingWallet;
    }

    function updateTeamWallet(address _teamWallet) external onlyOwner {
        require(
            _teamWallet != address(0),
            "Team wallet can not be zero address"
        );
        teamWallet = _teamWallet;
    }

    // ==== 修改交易限制 ====
    function updateMaxWalletAmount(
        uint256 _maxWalletAmount
    ) external onlyOwner {
        maxWalletAmount = _maxWalletAmount;
    }

    function updateMaxTxAmount(uint256 _maxTxAmount) external onlyOwner {
        maxTxAmount = _maxTxAmount;
    }

    function updateMaxDayilyTx(uint256 _maxDayilyTx) external onlyOwner {
        maxDayilyTx = _maxDayilyTx;
    }

    // ==== 设置白名单、黑名单 ====
    function excludeFromFee(address account, bool excluded) external onlyOwner {
        isExcludedFromFee[account] = excluded;
    }

    function excludeFromLimits(
        address account,
        bool excluded
    ) external onlyOwner {
        isExcludedFromLimits[account] = excluded;
    }

    function setBlacklist(address account, bool value) external onlyOwner {
        blacklisted[account] = value;
    }

    // 新增流动性
    function addLiquidityWithETH(
        uint256 tokenAmount
    ) external payable onlyOwner {
        require(msg.value > 0, "ETH amount must be greater than zero");
        require(tokenAmount > 0, "Token amount must be greater than zero");
        // 授权 Router 使用 token
        _approve(address(this), address(uniswapV2Router), tokenAmount);
        // router 添加流动性
        (uint amountToken, uint amountETH, uint liquidity) = uniswapV2Router
            .addLiquidityETH{value: msg.value}(
            address(this),
            tokenAmount,
            0,
            0,
            owner(),
            block.timestamp
        );

        emit LiquidityAdded(amountToken, amountETH, liquidity);
    }

    // 接受ETH
    receive() external payable {}

    // 资金救援,ETH
    function rescueETH() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    // 资金救援,非本合约token
    function rescueToken(address token, uint256 amount) external onlyOwner {
        require(token != address(this), "Cannot rescue own tokens");
        IERC20(token).transfer(owner(), amount);
    }

    // ==== 转账覆盖函数：增加税收 & 限制 ====
    function _transfer(
        address from,
        address to,
        uint256 value
    ) internal virtual override {
        require(from != address(0), "Transfer from the zero address");
        require(to != address(0), "Transfer to the zero address");
        require(value > 0, "Transfer value must be gerater than zero");
        require(
            !blacklisted[from] && !blacklisted[to],
            "Address is blacklisted"
        );
        // 防机器人
        if (!tradingEnabled) {
            require(
                isExcludedFromLimits[from] || isExcludedFromLimits[to],
                "Trading is not enabled yet"
            );
        }
        if (!isExcludedFromLimits[from] && !isExcludedFromLimits[to]) {
            require(
                value <= maxTxAmount,
                "Transfer value must be less than maxTxAmount"
            );
            // 每日交易次数检查，并更新
            checkAndUpdateDailyTxCount(_msgSender());
        }
        if (!isExcludedFromLimits[to]) {
            require(
                balanceOf(to) + value <= maxWalletAmount,
                "Exeeds maximum wallet token amount"
            );
        }

        if (isExcludedFromFee[from] || isExcludedFromFee[to]) {
            super._transfer(_msgSender(), to, value);
        } else {
            uint256 taxFee = _takeTax(value);
            super._transfer(_msgSender(), to, value - taxFee);
        }
    }

    function checkAndUpdateDailyTxCount(address user) internal {
        if (isExcludedFromFee[user]) {
            return;
        }
        uint256 today = block.timestamp / 1 days;
        // console.log("today: ", today);
        if (dailyTxCount[user].lastTxDate != today) {
            dailyTxCount[user].lastTxDate = today;
            dailyTxCount[user].txCount = 0;
        }
        // 检查是否超过每日交易次数
        require(
            dailyTxCount[user].txCount < maxDayilyTx,
            "Exceeds daily transaction limit"
        );
        dailyTxCount[user].txCount += 1;
    }

    // ==== 内部税收逻辑 ====
    function _takeTax(uint256 value) internal returns (uint256 taxFee) {
        taxFee = (value * baseTax) / TAX_DENOMINATOR;
        if (taxFee > 0) {
            uint256 liquidityAmount = (taxFee * liquidityTax) / TAX_DENOMINATOR;
            if (liquidityAmount > 0) {
                super._transfer(_msgSender(), address(this), liquidityAmount);
            }

            uint256 marketingAmount = (taxFee * marketingTax) / TAX_DENOMINATOR;
            if (marketingAmount > 0) {
                super._transfer(_msgSender(), marketingWallet, marketingAmount);
            }

            uint256 teamAmount = (taxFee * teamTax) / TAX_DENOMINATOR;
            if (teamAmount > 0) {
                super._transfer(_msgSender(), teamWallet, teamAmount);
            }

            uint256 burnAmount = (taxFee * burnTax) / TAX_DENOMINATOR;
            if (burnAmount > 0) {
                _burn(_msgSender(), burnAmount);
            }
        }
    }
}
