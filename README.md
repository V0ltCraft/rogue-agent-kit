![ROGUE banner](assets/rogue-banner.png)

# ROGUE Agent Kit

The open-source toolkit for ROGUE: install the Skill, create a dedicated Agent wallet, mint your `.rob` identity, and let your Agent prepare and execute token launches you authorize.

[Get the Skill](https://github.com/V0ltCraft/rogue-agent-kit/releases/latest) · [Skill instructions](skills/rogue-launch/SKILL.md) · [.rob contract guide](docs/rob-identity.md) · [Website](https://rogueagentic.app/)

**Registration and token launches open soon.** You can install the toolkit, inspect its source, and run local tests now. Before any onchain action, check the selected service with `config`. No live contract address is announced in this repository.

## What is included

| Component | Location |
| --- | --- |
| Installable Skill and standalone command-line tool | `skills/rogue-launch/` |
| Local encrypted wallet, transaction validation, and execution client | `agent/` |
| `.rob` registration, name resolution, and Agent signer binding | `contracts/RobIdentity.sol` |
| Client name rules, authorization messages, and service verification fields | `shared/` |
| Toolkit compilation, packaging, and local tests | `scripts/`, `tests/` |

The platform backend, website, token factory, bonding curve, Uniswap v4 liquidity implementation, and revenue and buyback contracts are not included. The client uses the platform API; its interfaces and message formats do not contain those platform implementations.

## 1. Install the Skill

Your Agent's device needs **Node.js 22.13 or newer**.

1. Download `rogue-launch.zip` and `rogue-launch.sha256` from [Releases](https://github.com/V0ltCraft/rogue-agent-kit/releases/latest). Verify the archive's SHA-256 checksum, then extract it.
2. Copy the `rogue-launch` folder into your Agent's supported skills directory. For Codex, use `~/.codex/skills/rogue-launch/`, or `%USERPROFILE%\.codex\skills\rogue-launch\` on Windows. Other Agents use their own installation location.
3. Confirm that the folder contains `SKILL.md` and `scripts/rogue.mjs`. The archive includes a standalone tool, so no npm install is needed to use it.

You can also clone this repository and copy `skills/rogue-launch/` directly. Its bundled script is built from the public source in this repository.

Give your Agent a task like this:

> Use the ROGUE Skill to check the service and network first. Help me create a dedicated Agent wallet and register my chosen .rob name. Show the exact action, fees, and gas cap before execution, and wait for my authorization. I will set the wallet password locally; do not ask me to send it in chat.

## 2. Set up your wallet

`ROGUE_ORIGIN` defaults to `https://45.76.202.123:8443`. Confirm any change of service or network before continuing. Run these commands from the installed `rogue-launch` folder:

```sh
node scripts/rogue.mjs config
node scripts/rogue.mjs wallet-init
node scripts/rogue.mjs wallet-status
```

Before wallet creation, set `ROGUE_WALLET_PASSWORD` in the **local Agent process environment**, using at least 12 characters. Never commit passwords, private keys, or wallet backups to GitHub, send them to the website, or paste them into chat.

The wallet file defaults to `~/.rogue/agent-wallet.json`. It contains encrypted keystores for the transaction wallet and a separate Agent authorization key. Set `ROGUE_WALLET_FILE` to choose another location. The tool does not overwrite existing wallets or automatically transfer funds from another wallet.

Back up the encrypted file and keep its password separately. Fund only the displayed transaction wallet address with ETH on the selected network. Registration has no protocol fee, but network gas is required. This is a locally encrypted EOA wallet, not MPC or an official Robinhood Agentic Wallet.

## 3. Mint your .rob identity

When `config` returns both `configured: true` and `executionEnabled: true`, have your Agent verify the service, network, and contracts. Then configure your approved **gas cap for one complete action**:

```sh
node scripts/rogue.mjs wallet-configure --max-fee-eth YOUR_APPROVED_GAS_CAP
node scripts/rogue.mjs name --name ranger.rob
node scripts/rogue.mjs register --name ranger.rob
```

Replace `YOUR_APPROVED_GAS_CAP` with the ETH amount you actually approve. Replace the example `ranger.rob` with your chosen name.

`register` returns a plan, an `id`, and an `approvalHash`. **It has not submitted the minting transactions yet.** Review the name, wallet, network, bound Agent address, and gas cap before asking your Agent to execute:

```sh
node scripts/rogue.mjs wallet-execute --intent RETURNED_ID --approve RETURNED_APPROVAL_HASH
node scripts/rogue.mjs identity
```

Replace both placeholders with the values returned for that plan. Registration uses a commit transaction followed by a reveal transaction in a later block, within the commitment's validity period. After `pending` or `waiting_for_block`, resume the **same command** rather than creating a replacement registration plan. Only confirmed onchain receipts count as a successful registration.

### Name rules

- Unique labels of 3–24 lowercase ASCII letters, digits, or internal hyphens.
- One permanent name per wallet; no rename, transfer, or burn.
- Registration binds a separate Agent authorization key. The wallet owner can rotate that key.
- `.rob` is a ROGUE onchain identity namespace, not Internet DNS or proof that an LLM ran.

## 4. Launch with your Agent

After `.rob` registration, once the service is open:

```sh
node scripts/rogue.mjs launch --name "My Ranger" --symbol RGR --metadata-uri YOUR_APPROVED_PUBLIC_METADATA_URI
node scripts/rogue.mjs wallet-execute --intent RETURNED_ID --approve RETURNED_APPROVAL_HASH
```

Use your approved name, ticker, and public HTTPS or IPFS metadata URI. Every launch requires a fresh Agent authorization and exact plan approval. A gas policy does not authorize future transactions. The executor permits registration and token launches only; it does not execute arbitrary transfers or approvals.

## Build and test

```sh
npm ci
npm run check
npm run build
npm test
```

`npm run build` regenerates the standalone Skill script, `artifacts/rogue-launch.zip`, and its checksum file. Tests run the identity contract and client checks on a local EVM only. They do not deploy public-chain contracts or send real asset transactions.

This repository has no platform deployment scripts. Read the [.rob contract guide](docs/rob-identity.md) before using the identity contract independently. A separately deployed identity registry is not automatically accepted by the ROGUE platform.

## License

MIT. Bundled dependency licenses are included in `skills/rogue-launch/THIRD_PARTY_NOTICES.md`.
