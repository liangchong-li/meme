// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IWETH {
    function deposit() external payable;

    function transfer(address to, uint value) external returns (bool);

    function withdraw(uint) external;
}

interface IERC20 {
    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external returns (bool);

    function balanceOf(address account) external view returns (uint256);

    function approve(address spender, uint256 amount) external returns (bool);
}

contract MockUniswapV2Router02 {
    address public factory;
    address public WETH;

    // 用于记录调用
    struct AddLiquidityCall {
        address token;
        uint256 amountTokenDesired;
        uint256 amountTokenMin;
        uint256 amountETHMin;
        address to;
        uint256 deadline;
    }

    AddLiquidityCall public lastAddLiquidityCall;
    uint256 public mockLiquidity = 1000;

    // 添加流动性返回值
    uint256 public mockAmountToken = 0;
    uint256 public mockAmountETH = 0;

    event AddLiquidityCalled(
        address token,
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to,
        uint256 deadline
    );

    constructor(address _weth) {
        WETH = _weth;
        factory = address(this); // 使用自身作为factory模拟
    }

    // 设置模拟返回值
    function setMockReturns(
        uint256 _amountToken,
        uint256 _amountETH,
        uint256 _liquidity
    ) external {
        mockAmountToken = _amountToken;
        mockAmountETH = _amountETH;
        mockLiquidity = _liquidity;
    }

    function addLiquidityETH(
        address token,
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to,
        uint256 deadline
    )
        external
        payable
        returns (uint256 amountToken, uint256 amountETH, uint256 liquidity)
    {
        // 记录调用参数
        lastAddLiquidityCall = AddLiquidityCall({
            token: token,
            amountTokenDesired: amountTokenDesired,
            amountTokenMin: amountTokenMin,
            amountETHMin: amountETHMin,
            to: to,
            deadline: deadline
        });

        emit AddLiquidityCalled(
            token,
            amountTokenDesired,
            amountTokenMin,
            amountETHMin,
            to,
            deadline
        );

        // 返回预设的值
        return (mockAmountToken, mockAmountETH, mockLiquidity);
    }

    // 接收 ETH
    receive() external payable {}

    // 获取合约余额
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    // 提取 ETH（用于测试）
    function withdrawETH() external {
        payable(msg.sender).transfer(address(this).balance);
    }
}
