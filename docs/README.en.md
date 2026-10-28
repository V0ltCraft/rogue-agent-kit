# ROGUE Agent Kit — usage

[中文](../README.md) · [Skill](../skills/rogue-launch/SKILL.md) · [.rob source](../contracts/RobIdentity.sol)

This repository publishes the Agent-side wallet client, the installable ROGUE Skill and the `.rob` identity contract. Platform services and launchpad contract implementations are not included. Client ABIs and authorization messages are public integration interfaces, not the private platform implementation.

**Registration and token launches open soon.** Install and inspect the toolkit now; check `config` before any onchain action. No live contract address is announced in this repository.

## Install

Use Node.js 22.13+. Download `rogue-launch.zip` and its SHA-256 file from [Releases](https://github.com/V0ltCraft/rogue-agent-kit/releases/latest), verify the archive and extract it. Install the `rogue-launch` folder into your Agent's skills directory. For Codex this is `~/.codex/skills/rogue-launch/` (`%USERPROFILE%\.codex\skills\rogue-launch\` on Windows). Other Agents use their own supported installation location.

The bundled script needs no npm install. Alternatively, clone the repository and copy `skills/rogue-launch/`.

## Wallet and identity

From the installed skill directory:

```sh
node scripts/rogue.mjs config
node scripts/rogue.mjs wallet-init
node scripts/rogue.mjs wallet-status
```

The default service is `https://45.76.202.123:8443`; `ROGUE_ORIGIN` selects a user-approved service. Set `ROGUE_WALLET_PASSWORD` locally in the Agent process before wallet creation (12+ characters). Never paste it into chat or send it to GitHub or ROGUE. Back up `~/.rogue/agent-wallet.json` and keep the password separately. This is a local encrypted EOA wallet with a separate Agent authorization key, not MPC or an official Robinhood Agentic Wallet.

When `configured` and `executionEnabled` are both true, have your Agent verify the selected network and contracts. Fund the displayed transaction address with ETH on that network and approve a gas cap for each complete action:

```sh
node scripts/rogue.mjs wallet-configure --max-fee-eth YOUR_APPROVED_GAS_CAP
node scripts/rogue.mjs name --name ranger.rob
node scripts/rogue.mjs register --name ranger.rob
node scripts/rogue.mjs wallet-execute --intent RETURNED_ID --approve RETURNED_APPROVAL_HASH
node scripts/rogue.mjs identity
```

Replace all placeholders and the example name with your approved values. `register` prepares a plan; `wallet-execute` signs and sends its commit/reveal transactions only after the exact action is authorized. Registration is free; gas is additional. Resume the same intent and approval hash after `pending` or `waiting_for_block` rather than creating a replacement.

Names are unique, 3–24 lowercase ASCII letters/digits/internal hyphens, one permanent non-transferable name per wallet. `.rob` is an onchain namespace, not Internet DNS or proof of AI inference. Wallet owners can rotate the bound Agent signer.

## Launch

Once registered and the service is open, provide approved token details and a public HTTPS or IPFS metadata URI:

```sh
node scripts/rogue.mjs launch --name "My Ranger" --symbol RGR --metadata-uri YOUR_APPROVED_PUBLIC_METADATA_URI
node scripts/rogue.mjs wallet-execute --intent RETURNED_ID --approve RETURNED_APPROVAL_HASH
```

Each launch requires a fresh Agent authorization and exact plan approval. A gas policy does not authorize future actions. The executor permits registration and launches only; it does not sign arbitrary transfers or approvals.

## Build and test

```sh
npm ci
npm run check
npm run build
npm test
```

The build creates the standalone Skill script and reproducible ZIP/checksum files under `artifacts/`. Tests use a local EVM only; they do not deploy or transact on a public network. Platform contract sources, website, server, private configuration and platform deployment scripts are excluded.

MIT licensed. Bundled third-party license texts are included in the Skill folder and ZIP.
