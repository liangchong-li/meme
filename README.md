# MemeToken 项目

一个功能完备的ERC20代币合约，包含税收机制、交易限制、防机器人等功能，适用于Meme币和社区代币项目。

## 功能特性

### 🏦 税收系统

- **基础税率**: 5%（可调整，最高10%）
- **税收分配**:
  - 40% 用于流动性
  - 30% 用于营销钱包
  - 20% 销毁
  - 10% 给予团队

### 🛡️ 交易保护机制

- **最大持有量**: 总供应量的2%
- **单笔交易限额**: 总供应量的1%
- **每日交易次数限制**: 10次
- **黑名单系统**: 阻止恶意地址

### 🤖 防机器人措施

- 交易启用开关（项目方手动开启）
- 交易前需启用交易功能

### 🔧 可配置参数

所有关键参数均可通过所有者函数调整：

- 税率和税收分配
- 钱包地址（营销、团队）
- 交易限制参数
- 白名单/黑名单



## 测试

运行测试套件：

```bash
npx hardhat test
```



测试覆盖：

- 代币基本功能
- 税收机制
- 交易限制
- 权限管理
- 流动性添加



## 合约部署

### 前提条件

1. Node.js 16+
2. npm 或 yarn
3. Hardhat  2.26.3

### 安装依赖

```bash
npm install
```



### 环境变量

创建 `.env` 文件并配置以下变量：

```env
PRIVATE_KEY=你的私钥
INFURA_API_KEY=你的Infura API密钥
ETHERSCAN_API_KEY=你的Etherscan API密钥
```



### 编译合约

```bash
npx hardhat compile
```



### 部署合约

```bash
npx hardhat run scripts/deploy.js --network sepolia
```



## 合约交互

### 基础功能

1. **启用交易**:

```javascript
await token.enableTrading();
```



2. **修改税率**:

```javascript
await token.updateTax(300); // 设置为3%
```



3. **添加流动性**:

```javascript
await token.addLiquidityWithETH(tokenAmount, {
  value: ethAmount
});
```



### 管理功能

- `updateTaxDistribution()`: 修改税收分配比例
- `updateMarketingWallet()`: 更新营销钱包
- `updateTeamWallet()`: 更新团队钱包
- `updateMaxWalletAmount()`: 更新最大持有量
- `excludeFromFee()`: 添加/移除免税地址
- `setBlacklist()`: 管理黑名单

### 紧急功能

- `rescueETH()`: 提取合约中的ETH
- `rescueToken()`: 提取误转入合约的其他代币



## 安全考虑

### ✅ 已实现的安全措施

1. **输入验证**: 所有函数都包含必要的参数检查
2. **权限控制**: 关键函数仅所有者可调用
3. **交易限制**: 防止鲸鱼操纵和机器人攻击
4. **税收机制**: 可调节的税率防止滥用

### ⚠️ 注意事项

1. **交易启用**: 部署后需手动启用交易
2. **初始流动性**: 建议添加足够的初始流动性
3. **参数设置**: 合理设置交易限制参数
4. **钱包安全**: 妥善保管所有者私钥