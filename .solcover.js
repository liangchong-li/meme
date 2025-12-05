module.exports = {
  // solidity-coverage 使用此字段来跳过指定的合约文件/目录
  // 路径通常相对于仓库根或 contracts 目录，使用通配符也可
  skipFiles: [
    // 如果你要跳过测试合约放在 contracts/test 下的情形
    "contracts/test/",
    // 常见要跳过的目录
    "mocks/",
    "scripts/",
    "test/"
  ]
};
