---
name: rogue-launch
description: Set up a local encrypted ROGUE Agent wallet, mint its .rob identity, and execute Agent-authorized token launches on Robinhood Chain from the conversation. Includes deployment, gas-budget and exact-action checks.
---

# ROGUE: install → Agent wallet → .rob → launch

Use `scripts/rogue.mjs` relative to this skill directory with Node.js 22.13+. It is self-contained; no npm install is needed. Set `ROGUE_ORIGIN` to the service the user selected; default is `https://45.76.202.123:8443`. Do not silently change service, network, wallet or spending limits.

This skill includes a wallet execution tool. The Agent can sign and broadcast .rob registration and token-launch transactions locally after the user authorizes the concrete action. Do not send the user back to a browser wallet to complete the normal flow. The website provides instructions, market discovery and optional receipt inspection.

## First use

1. Run `config`. Mainnet is 4663 and testnet is 46630. If `configured` or `executionEnabled` is false, explain that registration and launches are not open on the selected service; do not prepare or execute an onchain action. A request to implement or test the product does not authorize an external deployment or a real financial transaction.
2. For a user-requested new dedicated wallet, run `wallet-init`. The user must first set `ROGUE_WALLET_PASSWORD` (12+ characters) in the local Agent process. Never ask for it in chat, print it, upload it or put it in the backend .env. If unavailable, stop wallet creation and explain the local setup. Never generate the password in a visible shell command or import the user's existing wallet private key.
3. The wallet file defaults to `~/.rogue/agent-wallet.json`; `ROGUE_WALLET_FILE` selects another location. It contains two standard encrypted JSON keystores: the funded transaction wallet and a separate Agent authorization key. Show only their public addresses. Never overwrite a wallet. Explain that the encrypted file and password need separate backups; losing both access and backups loses control. The encrypted `wallet` object is a standard Ethereum keystore for local recovery with compatible tools. This is a local EOA wallet, not MPC or an official Robinhood Agentic Wallet.
4. Run `wallet-status`. Ask the user to fund its displayed transaction address with ETH on the selected Robinhood network. ROGUE does not automatically debit an existing wallet. No .rob registration payment is charged in v1; gas is required.
5. Once a verified deployment exists, configure the user's approved gas limit with `wallet-configure --max-fee-eth DECIMAL [--valid-hours 24]`. Do not invent this budget. It is a maximum gas cost per complete action, not a payment or daily allowance. Policy pins service, RPC, chain, contracts and runtime hashes. Reconfiguration is needed if they change. A policy never authorizes all future launches: each exact action also requires an approval hash. Expiry is at most 168 hours.

## Register .rob

Obtain the requested name, check `name --name NAME.rob`, then run `register --name NAME.rob`. It uses the dedicated wallet automatically. Show the name, wallet, selected chain, free registration plus gas, permanent non-transferability, and the commit/reveal pair of transactions. The returned `approvalHash` binds the exact locally stored plan.

When the user's authorization covers this concrete action and its gas cap, run `wallet-execute --intent ID --approve HASH`. Otherwise ask for confirmation after presenting the prepared action. Do not require a second confirmation when the same reviewed action and budget were already authorized. The tool waits for the commit receipt and a later block, then reveals. A timeout or partial completion means resume the SAME intent and approval hash. Never create a replacement to fix a pending transaction.

One wallet can hold one permanent unique name, 3–24 lowercase letters/digits/internal hyphens. Free plus gas, no rename, burn, expiry or transfer. .rob is ROGUE's onchain namespace, not Internet DNS or Robinhood certification. One wallet is not one person.

## Launch

Run `wallet-status` or `identity` to verify the .rob owner and bound Agent. Collect the exact name, uppercase ticker and approved metadata. `metadata` uploads approved content to the selected server; do not upload private material. External-chain metadata must be public HTTPS or IPFS.

Run `launch --name NAME --symbol SYMBOL --metadata-uri URI`. The tool verifies the challenge and signs the per-launch EIP-712 authorization with the local Agent key. It returns an immutable plan and `approvalHash`; it has not broadcast the launch yet.

Show the .rob name, token details, fixed one-billion supply, ETH curve, deployment, fees, graduation target, Uniswap v4 destination, permanent liquidity policy, expiry and gas budget. With the user's authorization for those exact parameters, invoke `wallet-execute --intent ID --approve HASH`. The tool signs with the dedicated wallet and broadcasts directly to the selected RPC. Never expose a private key or manually extract one for cast, scripts or another service. Never bypass the executor's local plan, policy, runtime or gas checks.

Each launch requires the current bound Agent signature, chain/factory binding, parameter hashes, nonce and deadline. A changed signer invalidates old-key authorizations. Signatures prove credential authorization, not that an LLM ran or a public Skill was installed. Do not advertise cryptographic AI-only access.

## Independent ROGUE platform token

`platform` reads `/api/platform-token`. ROGUE is deployed independently with the same one-billion supply, 18 decimals and no mint/owner/tax as ordinary tokens; it never launches through this public factory and has no curve or graduation. Do not use a user's `.rob` launch command as a substitute for a requested official platform-token deployment.

Realized platform fees are reserved 80% for ETH→ROGUE buybacks to DEAD and 20% for operations. The pool is separately funded by the issuer, using ETH/ROGUE Uniswap v4 (0.30%, tick 60, no hook). No pool, no liquidity or failed slippage checks means the budget waits. Locked ordinary-token LP assets are excluded. Blackhole transfers leave ERC-20 totalSupply unchanged; report protocol buybacks separately from other DEAD transfers. Read all five deployment hashes and the revenue binding. Platform maintenance/deployment plans are operator work; the user wallet executor must not bypass its mint-and-launch allowlist to perform them.

## Resume and results

`wallet-execute` persists a signed transaction and hash BEFORE broadcasting. For `pending` or `waiting_for_block`, resume the same command; no new nonce or replacement transaction. Pending receipt recovery remains available when the signing policy expires, but new signatures require renewal. A reverted transaction needs inspection and a fresh user-approved plan. For a stale lock, inspect its PID and pending state before recovery; do not delete a live lock.

Report only successful verified receipts, the selected chain, .rob name and actual token address. `intent ID` reads receipts. If the local wallet file or pending journal is unavailable, stop and recover it rather than generating a replacement wallet. Existing encrypted files are not automatically backed up by ROGUE.

## Commands

```sh
node scripts/rogue.mjs config
node scripts/rogue.mjs platform
node scripts/rogue.mjs wallet-init
node scripts/rogue.mjs wallet-status
node scripts/rogue.mjs wallet-configure --max-fee-eth USER_APPROVED_CAP
node scripts/rogue.mjs name --name ranger.rob
node scripts/rogue.mjs register --name ranger.rob
node scripts/rogue.mjs wallet-execute --intent ID --approve RETURNED_HASH
node scripts/rogue.mjs identity
node scripts/rogue.mjs metadata --name "My Ranger" --description "Approved public text"
node scripts/rogue.mjs launch --name "My Ranger" --symbol RGR --metadata-uri APPROVED_URI
node scripts/rogue.mjs wallet-execute --intent ID --approve RETURNED_HASH
node scripts/rogue.mjs intent ID
```

The wallet executor currently permits .rob registration and token launch only, with zero ETH call value and bounded gas. It refuses arbitrary transfers, approvals and other calldata. Legacy CLI buy/sell/graduate commands prepare intents only; do not claim this executor performs them. Do not silently replace the Agent flow with website signing.

Local protocol tests use chain 31337 only when `ROGUE_LOCAL_DEV=true` and a loopback `ROGUE_WALLET_RPC_URL` is explicitly supplied. Production uses the official Robinhood network RPC by default; `ROGUE_WALLET_RPC_URL` selects a user-approved dedicated HTTPS RPC. The platform API never receives keys, passwords or signed raw transactions.
