# ROGUE Agent Kit

ROGUE 的公开 Agent 工具包：安装 Skill、创建专用钱包、铸造 `.rob` 身份，并让 Agent 为你准备和执行已授权的发币操作。

[English guide](docs/README.en.md) · [Skill 指令](skills/rogue-launch/SKILL.md) · [.rob 合约说明](docs/rob-identity.md) · [官网](https://45.76.202.123:8443/#agents)

**注册与发币即将开放。** 工具可以安装、源码可以编译和测试；能否进行链上操作，以所选服务的 `config` 返回结果为准。当前没有在本仓库公布已上线的合约地址。

## 公开范围

| 内容 | 位置 |
| --- | --- |
| 可直接安装的 Skill 与打包后的命令行工具 | `skills/rogue-launch/` |
| 本机加密钱包、交易检查和执行客户端 | `agent/` |
| `.rob` 注册、解析及 Agent 授权密钥绑定合约 | `contracts/RobIdentity.sol` |
| 客户端名称规则、授权消息格式及服务校验字段 | `shared/` |
| 仅针对本工具包的编译、打包和本地测试 | `scripts/`、`tests/` |

平台后端、网站、代币工厂、联合曲线、Uniswap v4 流动性实现、手续费与回购金库实现不在此仓库中。客户端通过平台 API 使用服务；包含的接口与消息格式不是上述平台合约的实现源码。

## 1. 安装 Skill

Agent 所在设备需要 **Node.js 22.13 或更新版本**。

- 从 [Releases](https://github.com/V0ltCraft/rogue-agent-kit/releases/latest) 下载 `rogue-launch.zip` 和 `rogue-launch.sha256`，校验压缩包的 SHA-256 后解压。
- 将 `rogue-launch` 文件夹放入你的 Agent 支持的 Skill 目录。Codex 对应 `~/.codex/skills/rogue-launch/`；Windows 对应 `%USERPROFILE%\.codex\skills\rogue-launch\`。其他 Agent 请使用其自己的 Skill 安装位置。
- 确认该文件夹下有 `SKILL.md` 和 `scripts/rogue.mjs`。压缩包已经包含命令行工具，使用时无需安装 npm 依赖。

也可以克隆仓库后，直接复制 `skills/rogue-launch/`。该目录内的脚本由本仓库的公开源码构建。

把以下任务交给你的 Agent：

> 使用 ROGUE Skill，先检查服务和网络。帮助我创建专用 Agent 钱包，并注册我选择的 .rob 名称。请先展示操作、费用和 Gas 上限，经我确认后再执行。密码由我在设备上设置，不在聊天中发送。

## 2. 设置服务与钱包

`ROGUE_ORIGIN` 默认使用 `https://45.76.202.123:8443`。如需切换服务，先明确确认新的网址与网络。下面的命令从安装后的 `rogue-launch` 目录执行：

```sh
node scripts/rogue.mjs config
node scripts/rogue.mjs wallet-init
node scripts/rogue.mjs wallet-status
```

创建钱包前，请在 **Agent 所在设备的进程环境** 设置 `ROGUE_WALLET_PASSWORD`，至少 12 个字符。不要把密码、私钥或钱包备份提交到 GitHub、发给网站或贴进对话。

钱包默认保存在 `~/.rogue/agent-wallet.json`，包含交易钱包和独立 Agent 授权密钥的加密 keystore。用 `ROGUE_WALLET_FILE` 可以指定其他路径。工具不会覆盖已有钱包，也不会自动从其他钱包转入资金。

备份加密文件，并将密码分开保存。仅向工具显示的交易钱包地址充值正确网络的 ETH。`.rob` 注册本身免费，提交交易仍需网络 Gas。这个钱包是本机加密的 EOA，不是 MPC，也不是 Robinhood 官方提供的 Agentic Wallet。

## 3. 铸造你的 .rob

当 `config` 显示 `configured: true` 且 `executionEnabled: true` 时，先让 Agent 核对服务、网络和合约，再配置你批准的**单次完整操作 Gas 上限**：

```sh
node scripts/rogue.mjs wallet-configure --max-fee-eth YOUR_APPROVED_GAS_CAP
node scripts/rogue.mjs name --name ranger.rob
node scripts/rogue.mjs register --name ranger.rob
```

把 `YOUR_APPROVED_GAS_CAP` 换成你实际批准的 ETH 数值。示例名称 `ranger.rob` 也应换成你自己的名称。

`register` 会返回注册计划、`id` 和 `approvalHash`，**还没有提交铸造交易**。检查名称、钱包、网络、绑定的 Agent 地址及 Gas 上限后，让 Agent 执行：

```sh
node scripts/rogue.mjs wallet-execute --intent RETURNED_ID --approve RETURNED_APPROVAL_HASH
node scripts/rogue.mjs identity
```

将两个占位符换成此次计划返回的值。注册包含 commit 和 reveal 两笔交易，必须跨过至少一个区块，且 reveal 需要在承诺有效期内完成。遇到 `pending` 或 `waiting_for_block` 时，继续执行**同一条命令**，不要新建替代注册计划。成功结果以实际链上回执为准。

### .rob 的规则

- 3–24 位小写英文字母、数字或内部连字符；名称唯一。
- 每个钱包只能注册一个名称，不能改名、转让或销毁。
- 注册时绑定独立 Agent 授权密钥；钱包持有人可以更新该密钥。
- `.rob` 是 ROGUE 的链上身份名称，不是互联网 DNS 域名，也不证明某个 LLM 实际运行过。

## 4. 交给 Agent 发币

完成 `.rob` 注册、且服务已开放后：

```sh
node scripts/rogue.mjs launch --name "My Ranger" --symbol RGR --metadata-uri YOUR_APPROVED_PUBLIC_METADATA_URI
node scripts/rogue.mjs wallet-execute --intent RETURNED_ID --approve RETURNED_APPROVAL_HASH
```

使用你确认的名称、符号和公开 HTTPS / IPFS 资料地址。每次发币都会生成新的 Agent 授权和待确认计划；钱包 Gas 策略不等于对未来所有交易的授权。客户端只允许注册和发币，不提供任意转账或授权执行。

## 从源码构建与测试

```sh
npm ci
npm run check
npm run build
npm test
```

`npm run build` 重新生成安装目录中的独立脚本，以及 `artifacts/rogue-launch.zip` 和校验文件。`npm test` 只在本机 EVM 中测试 `.rob` 合约与客户端规则，不部署外部网络合约，也不发送真实资产交易。

本仓库不提供平台合约的部署脚本。若要独立部署身份合约，请先阅读 [.rob 合约说明](docs/rob-identity.md)；独立部署的身份不会自动成为 ROGUE 平台认可的身份。

## License

MIT。打包工具包含的第三方依赖许可证见 `skills/rogue-launch/THIRD_PARTY_NOTICES.md`。
