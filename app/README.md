# Setlo app

Next.js app: API routes for the relayer, deadlines, QuickNode events and invites. The frontend is not built yet.

```sh
pnpm install
cp .env.example .env.local   # fill in values
pnpm dev                     # http://localhost:3000
pnpm lint && pnpm typecheck && pnpm test && pnpm build
pnpm abi                     # regenerate lib/abi.ts after `forge build` in ../contracts
```

Schema: `../supabase/migrations`. RLS is on for every table with no policies, so only server routes (service role) can read or write.

## Routes

| Route | Auth | What it does |
| --- | --- | --- |
| `POST /api/relay` | none (signatures) | `{chainId, functionName, args}` for `fundWithPermit`, `acceptWithSig`, `declineWithSig`, `clientActionWithSig`, `expirePackage`, `releaseBalances`. Simulated first (the contract checks signatures, nonces and state), then sent; `Credited` events in the receipt trigger `claimFor` for each recipient. Rate limited per IP and per package. |
| `POST /api/deadlines` | none | `{chainId, packageId}`. Polled by open app sessions. Sends `expirePackage` or the automatic `releaseBalances` when due, otherwise returns `nextCheckAt`. |
| `POST /api/webhooks/quicknode?chainId=` | HMAC (`x-qn-*` headers) | QuickNode stream of Setlo logs. Same idempotent handler as relayer receipts: claims credited balances and emails payout notices. |
| `POST /api/packages` | Privy | Agency registers metadata for a package it created onchain; creates client + supplier invites, emails them (Gmail), returns copyable links. |
| `GET /api/invites/:token` | Privy | Opens an invite; only the invited email may open it. |

## Live smoke test

Creates a 0.08 USDG package, funds it with a relayed permit + instruction, relays both acceptances and the release, checks the relayer pushed every payout, then sweeps the supplier payouts back:

```sh
pnpm build && pnpm start &
SETLO_PRIVATE_KEY=0x... RPC_URL=$ARB_SEPOLIA_RPC_URL node scripts/relay-smoke.mjs
```
