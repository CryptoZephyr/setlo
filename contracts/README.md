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

| Chain | SetloPackages | USDG |
| --- | --- | --- |
| Arbitrum Sepolia (421614) | [`0xccf304db9ab8607b379b0f7f87cbb4d269a1de73`](https://sepolia.arbiscan.io/address/0xccf304db9ab8607b379b0f7f87cbb4d269a1de73) (Sourcify exact match) | `0xFFC95faa3d63Cde504a05B567C600B78C0b41892` |
