# .rob identity contract

Source: [`contracts/RobIdentity.sol`](../contracts/RobIdentity.sol). Solidity `0.8.26`, OpenZeppelin Contracts `5.6.1`, MIT licensed.

## What the contract provides

An ERC-721 identity named `ROGUE .rob Identity` (`ROB`). Names and images are generated onchain. It has no owner, proxy, fee recipient or payable registration function. It does not implement token issuance, swaps, liquidity, platform revenue or buybacks.

Each wallet may register one name. Labels contain 3–24 lowercase ASCII letters, digits or hyphens; the first and last characters cannot be hyphens. The token ID is `uint256(keccak256(bytes(label)))`. A name has no expiry and cannot be transferred, renamed, burned or approved for transfer. It advertises ERC-5192's locked interface.

## Commit and reveal

1. Obtain an available label, the registering wallet, a distinct nonzero Agent signer and a random 32-byte salt.
2. Compute the commitment using `makeCommitment(label, account, agentSigner, salt)`.
3. The registering wallet calls `commit(commitment)`.
4. Wait for a later block, then call `register(label, agentSigner, salt)` from the same wallet within 24 hours of the commitment timestamp.

The commitment binds the identity contract, chain ID, wallet, label hash, Agent signer and salt:

```solidity
keccak256(abi.encode(
    address(this),
    block.chainid,
    account,
    keccak256(bytes(label)),
    agentSigner,
    salt
))
```

Registration has zero ETH call value. The two transactions still incur network gas. Commit/reveal prevents a copied reveal from registering the same name for a different wallet; it does not guarantee a name remains available until the user's transaction confirms.

## Reading an identity

| Function | Purpose |
| --- | --- |
| `validLabel(label)` | Validate the lowercase label without `.rob` |
| `available(label)` | Check whether a valid label is currently unregistered |
| `tokenIdOf(account)` | Get the wallet's token ID, or zero |
| `nameOf(account)` | Get the wallet's full name, or an empty string |
| `resolve("ranger.rob")` | Resolve a valid name to its holder, or the zero address |
| `agentSignerOf(account)` | Get the wallet's currently bound Agent signer |
| `tokenURI(id)` | Get base64 JSON with an embedded SVG |

## Agent signer recovery

The identity owner calls `setAgentSigner(nextSigner)` to replace the bound Agent key. The replacement must be nonzero and distinct from the owner. This does not transfer or rename the NFT. Services using the identity must check the current signer, scope signatures to their own contract and chain, and protect against replay.

The NFT proves control of a wallet-bound name and an authorization key. It cannot prove that a particular model ran, that a Skill was installed, or that a wallet belongs to a unique human.

## Compile and inspect

Run `npm ci && npm run compile`. The generated `artifacts/RobIdentity.json` contains its ABI, creation bytecode and runtime bytecode. `npm test` deploys this contract only to an ephemeral local EVM and exercises registration, collision protection, lock behavior, signer rotation and expiry.

There is no mainnet deployment command or embedded live address in this repository. Compiling or testing does not authorize a public-chain deployment. An independently deployed identity registry is not automatically accepted by the ROGUE service.
