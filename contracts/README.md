# Setlo contracts

`SetloPackages` is a singleton, non-upgradeable package contract per chain. It holds a client's USDG for a multi-supplier booking and settles it by fixed rules:

- Supplier deposits and the agency fee become claimable only when every required supplier has accepted the current terms and the client has approved the current configuration.
- If the package expires, accepted suppliers keep their hold fees (capped by `holdFeeCap`) and the client gets the remainder.
- After confirmation, the client releases balances (or anyone can after `eventDate + reviewWindow`), or cancels before the event: deposits stay with suppliers, balances return to the client.
- All payouts are pull-based credits; `claimFor` lets a relayer push them to the recipient.
- The owner can only pause `createPackage`. There is no function that moves, redirects or freezes funds.

Gasless flows use EIP-712 signatures (`fundWithPermit`, `acceptWithSig`, `declineWithSig`, `clientActionWithSig`). `fundWithPermit` binds the package id, `configHash`, amount and auto-confirm choice, so a permit alone cannot be pointed at another package.

## Develop

```sh
forge build
forge test          # unit, fuzz and invariant tests
forge coverage --ir-minimum
```

## Deploy

USDG is pinned per chain in `script/Deploy.s.sol` (Arbitrum Sepolia 421614, Robinhood Chain Testnet 46630).

```sh
OWNER_WALLET_ADDRESS=0x... forge script script/Deploy.s.sol --rpc-url $RPC_URL --private-key $SETLO_PRIVATE_KEY --broadcast
```

## Deployments

The same address on both chains (deployer nonce 0). Both are Sourcify exact matches.

| Chain | SetloPackages | USDG |
| --- | --- | --- |
| Arbitrum Sepolia (421614) | [`0xccf304db9ab8607b379b0f7f87cbb4d269a1de73`](https://sepolia.arbiscan.io/address/0xccf304db9ab8607b379b0f7f87cbb4d269a1de73) | `0xFFC95faa3d63Cde504a05B567C600B78C0b41892` |
| Robinhood Chain Testnet (46630) | [`0xccf304db9ab8607b379b0f7f87cbb4d269a1de73`](https://explorer.testnet.chain.robinhood.com/address/0xccf304db9ab8607b379b0f7f87cbb4d269a1de73) | `0x7E955252E15c84f5768B83c41a71F9eba181802F` |

## Live end-to-end run

`script/E2E.s.sol` exercises a deployment with sub-dollar USDG amounts. The broadcaster acts as client, agency and relayer; suppliers are throwaway keys derived from it that only sign, and their payouts are swept back with EIP-3009, so the run ends with the broadcaster's USDG unchanged.

```sh
export SETLO_ADDRESS=0xccf304db9ab8607b379b0f7f87cbb4d269a1de73
# Package A: permit funding, relayed accepts, auto-confirm, claims, relayed release.
# Package B (created first): funded, one accept, one decline (expires ~10 minutes later).
PHASE=setup forge script script/E2E.s.sol --rpc-url $RPC_URL --private-key $SETLO_PRIVATE_KEY --broadcast --slow
# After package B's acceptDeadline: expire, refund minus the earned hold fee.
PHASE=expire PACKAGE_B=<id> forge script script/E2E.s.sol --rpc-url $RPC_URL --private-key $SETLO_PRIVATE_KEY --broadcast --slow
```
