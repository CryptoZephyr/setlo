export type DocSection = {
  title: string;
  body?: string[];
  list?: string[];
  flow?: string[];
  table?: { head: string[]; rows: string[][] };
  code?: string;
  callout?: { title: string; body: string; warning?: boolean };
};

export type DocPage = { group: string; path: string; title: string; description: string; sections: DocSection[] };

const SETLO = "0xccf304db9ab8607b379b0f7f87cbb4d269a1de73";
const APP = "https://setlo-mu.vercel.app";

export const DOC_PAGES: DocPage[] = [
  // Start
  {
    group: "Start",
    path: "start/introduction",
    title: "What is Setlo?",
    description: "Setlo books every supplier for an event together, and releases deposits only when all of the required suppliers say yes.",
    sections: [
      {
        title: "In one sentence",
        body: [
          "An event agency puts the venue, caterer, AV and other suppliers into one package. The client funds that package once in USDG. Each supplier accepts or declines their own slot. Deposits go out only when every required supplier has accepted; if that doesn't happen in time, the client gets the money back, minus any hold fees they approved.",
        ],
      },
      {
        title: "Who it is for",
        list: [
          "Agencies that assemble events from several independent suppliers and are tired of chasing confirmations.",
          "Clients who don't want to pay a venue deposit before they know the caterer and AV are also booked.",
          "Suppliers who want a clear, signed set of terms and a guaranteed deposit once the booking confirms.",
        ],
      },
      {
        title: "The one rule Setlo enforces",
        callout: {
          title: "All required suppliers, or nobody",
          body: "No supplier deposit and no agency fee is paid out until every required supplier has accepted the version of the package the client approved and funded. This rule lives in the SetloPackages smart contract, not in Setlo's servers.",
        },
      },
      {
        title: "Where to go next",
        body: ["Read how it works for the five-step flow, or try the live demo, which runs a real booking on a test network in a few minutes."],
      },
    ],
  },
  {
    group: "Start",
    path: "start/why-setlo",
    title: "Why Setlo exists",
    description: "An event is only booked when every supplier is booked. Today each deposit is paid separately.",
    sections: [
      {
        title: "The problem",
        body: [
          "A typical event needs four to eight suppliers. Each one asks for its own deposit, on its own timeline, over email or chat. A client can end up paying the venue before finding out the caterer is unavailable that day, and then has to argue to get that deposit back.",
          "Agencies sit in the middle, chasing confirmations and fronting money, with no shared record of who agreed to what.",
        ],
      },
      {
        title: "What Setlo changes",
        list: [
          "One package, one funding step. The client sees every named supplier, payout account and amount, and approves that exact configuration.",
          "Conditional release. Deposits are held until the whole required set accepts. Partial bookings don't cost the client anything beyond the paid holds they agreed to.",
          "A shared record. Acceptances, changes, payments and refunds are onchain events everyone can check.",
          "No crypto setup for anyone. People sign in with an email code; Setlo creates their payout account and pays the network fees for clients and suppliers.",
        ],
      },
    ],
  },
  {
    group: "Start",
    path: "start/how-it-works",
    title: "How Setlo works",
    description: "Five steps from quote to settled.",
    sections: [
      {
        title: "The lifecycle",
        flow: [
          "The agency builds one package: event date, shared terms, deadlines, an agency fee, and a slot per supplier with a deposit, an optional paid hold and a post-event balance.",
          "The client reviews and funds it. They approve the exact suppliers, payout accounts and amounts with one signature. Setlo relays it, so the client pays no network fee.",
          "Each supplier accepts or declines their own slot, also with a relayed signature.",
          "When every required supplier has accepted and funding covers the package, the booking confirms. Deposits and the agency fee are credited and paid out automatically.",
          "After the event, the client releases the balances, or they release automatically when the review window ends.",
        ],
      },
      {
        title: "If it doesn't come together",
        body: [
          "If a required supplier declines, the agency can replace them before the acceptance deadline. If the package is still incomplete at the deadline, it expires: suppliers who accepted keep their paid hold fee, and everything else goes back to the client.",
        ],
      },
      {
        title: "What counts as done",
        callout: { title: "Evidence, not promises", body: "Setlo only shows money as paid or refunded after it sees the matching transfer onchain. Until then it says \"credited\" or \"waiting\"." },
      },
    ],
  },
  {
    group: "Start",
    path: "start/try-setlo",
    title: "Try Setlo",
    description: "Run a real booking on a test network in about two minutes.",
    sections: [
      {
        title: "The live demo",
        body: [
          `Open ${APP}/demo and press "Start a fresh demo package". Setlo creates a two-supplier package (a demo venue and a demo caterer) on Arbitrum Sepolia and gives you a role switcher, so you can act as the client and each supplier in one browser.`,
        ],
        flow: [
          "As the client, fund the package. The demo tops up the client with test USDG first.",
          "Switch to each supplier and accept. When the last required supplier accepts, deposits and the agency fee are credited and paid out.",
          "Switch back to the client and release balances, or try declining a supplier and expiring the package to see the refund.",
        ],
      },
      {
        title: "With your own account",
        body: [
          `Sign in at ${APP}/signin with an email code, then create a package from "New package". You need the client's and each supplier's email; they get an invite link to confirm their payout account and act on their slot.`,
        ],
      },
      { title: "Test money only", callout: { title: "Testnet", body: "Setlo runs on Arbitrum Sepolia and Robinhood Chain Testnet with test USDG. It has no monetary value.", warning: true } },
    ],
  },

  // Using Setlo
  {
    group: "Using Setlo",
    path: "using-setlo/sign-in-and-account",
    title: "Sign in and your account",
    description: "An email code is all anyone needs. Setlo creates the payout account.",
    sections: [
      {
        title: "Signing in",
        body: [
          "Sign in with your email and a one-time code. On first sign-in, Privy creates an embedded wallet for you; Setlo registers it as your payout account. Signing in again with the same email brings back the same bookings and payout account.",
          "Once signed in, you can link Google or add a passkey from the Account page to sign in faster next time. They can only be added to an existing account, so they never create a second account with a different payout wallet.",
        ],
      },
      {
        title: "The Account page",
        list: [
          "Your email and registered payout address, with copy and explorer links.",
          "Your USDG balance on each supported network, plus anything credited to you and still waiting to be paid out.",
          "Your sign-in methods (email, Google, passkey) and a sign-out button.",
        ],
      },
      { title: "Not in this version", body: ["Sending or withdrawing USDG from inside Setlo. Your payout account is a normal address, and its balance and history are visible on the network explorer."] },
    ],
  },
  {
    group: "Using Setlo",
    path: "using-setlo/create-a-package",
    title: "Create a package (agency)",
    description: "A five-step wizard turns a quote into an onchain package.",
    sections: [
      {
        title: "The steps",
        flow: [
          "Basics: package name, test network, client email, event date and shared terms.",
          "Suppliers: a slot per supplier with business name, email, category, whether they are required, and their own terms.",
          "Money and dates: each slot's deposit, paid hold and balance; the agency fee; the hold-fee cap; the acceptance, confirmation and final-expiry deadlines; the review window after the event.",
          "Payout accounts: Setlo emails a setup link to the client and each supplier. Each person signs in and confirms the payout account for this booking.",
          "Review and create: the agency creates the package onchain and Setlo emails the invites.",
        ],
      },
      {
        title: "Drafts",
        body: ["Drafts save as you go and can be reopened from your bookings list. Creating the package onchain is the agency's own transaction; Setlo sends the agency a small amount of test ETH for the network fee when needed."],
      },
      {
        title: "Changing a package later",
        list: [
          "Changing one supplier's quote asks only that supplier to accept again.",
          "Replacing a supplier invites the new one. A replaced supplier who had accepted keeps their paid hold.",
          "Changing the event date or shared terms asks every supplier again.",
          "Any change that alters the total asks the client to approve again. Nothing can extend past the final expiry.",
        ],
      },
    ],
  },
  {
    group: "Using Setlo",
    path: "using-setlo/review-and-fund",
    title: "Review and fund (client)",
    description: "The client approves the exact package and funds it with one signature.",
    sections: [
      {
        title: "What the client sees",
        body: ["Every slot with the supplier's name, payout address, deposit, paid hold and balance; the agency fee; the deadlines; and the shared and per-supplier terms."],
      },
      {
        title: "Funding",
        body: [
          "The client signs two things in one step: a USDG permit, and a Setlo funding instruction that names this package, its exact configuration and the amount. Setlo's relayer submits both and pays the network fee.",
          "Auto-confirm is on by default: the booking confirms the moment the last required supplier accepts. If the client turns it off, they confirm manually once everyone has accepted.",
        ],
      },
      {
        title: "If the package changes",
        body: ["The status changes to \"Changed · client must approve again\". The client reviews the change and signs a new instruction. If the total went down, the difference is credited back to the client right away."],
      },
    ],
  },
  {
    group: "Using Setlo",
    path: "using-setlo/accept-or-decline",
    title: "Accept or decline (supplier)",
    description: "Each supplier acts on their own slot and nothing else.",
    sections: [
      {
        title: "Opening the invite",
        body: ["The invite link only works for the invited email. If you sign in with another address, Setlo says who the invite was sent to. The slot must name the payout account you confirmed for this booking."],
      },
      {
        title: "Accepting",
        body: [
          "Accepting signs your exact terms: deposit, paid hold, balance, terms text and the package version. If anything changes afterwards, your acceptance no longer counts and you are asked to accept again.",
          "Accepting earns your paid hold fee. You keep it even if the booking later expires because another supplier didn't accept.",
        ],
      },
      { title: "Declining", body: ["Declining frees the agency to replace you. You receive nothing from that slot."] },
    ],
  },
  {
    group: "Using Setlo",
    path: "using-setlo/confirm-and-release",
    title: "Confirmation and release",
    description: "Deposits go out at confirmation; balances go out after the event.",
    sections: [
      {
        title: "Confirmation",
        body: ["When the last required supplier accepts and funding covers the package, the booking confirms (automatically, or when the client presses Confirm). Each accepted supplier's deposit and the agency fee are credited and paid out. Unaccepted optional slots are refunded to the client."],
      },
      {
        title: "After the event",
        body: [
          "The client releases supplier balances from the booking page. If they don't, anyone can release them once the event date plus the review window has passed; an open Setlo page asks the relayer to do it automatically.",
          "Before the event date, the client can cancel a confirmed booking. Deposits already paid stay with the suppliers; balances go back to the client.",
        ],
      },
    ],
  },
  {
    group: "Using Setlo",
    path: "using-setlo/payouts",
    title: "Payouts",
    description: "Credited money is pushed to each payout account automatically.",
    sections: [
      {
        title: "Credited, then paid out",
        body: [
          "The contract first credits each recipient. Setlo's relayer then calls claimFor, which transfers the credited USDG to the recipient's own payout account. Setlo can trigger the transfer but can't send it anywhere else.",
          "A payout email goes to the recipient when the transfer lands.",
        ],
      },
      {
        title: "Payouts are per account",
        body: ["One transfer pays out everything credited to an account, which can include money from other bookings. The booking page labels it \"Transferred to your payout account\" rather than claiming it was this booking's payment."],
      },
      {
        title: "If a payout is stuck",
        body: ["If an amount stays \"waiting to be paid out\", press \"Send payout again\" on the booking page. It sends whatever is credited to that account."],
      },
    ],
  },
  {
    group: "Using Setlo",
    path: "using-setlo/expiry-and-refunds",
    title: "Expiry and refunds",
    description: "If the package doesn't come together, the client gets the remainder back.",
    sections: [
      {
        title: "When a package expires",
        list: [
          "A required supplier hasn't accepted by the acceptance deadline.",
          "The booking hasn't confirmed by the confirmation deadline.",
          "The final expiry has passed.",
        ],
      },
      {
        title: "Who gets what",
        body: ["Suppliers who accepted (and replaced suppliers who had accepted) are credited their paid hold fee. The rest of the client's funding is credited back to the client and paid out to their payout account. The total of paid holds can never exceed the hold-fee cap the client approved."],
      },
      {
        title: "Who triggers it",
        body: ["Anyone can expire an expirable package. While a booking page is open, Setlo asks the relayer to do it; the page also shows an \"Expire and refund now\" button."],
      },
    ],
  },

  // Architecture
  {
    group: "Architecture",
    path: "architecture/system-overview",
    title: "System overview",
    description: "The contract holds the money and decides. Everything else is convenience.",
    sections: [
      {
        title: "Components",
        code: `Agency / Client / Supplier (browser)
        │  email sign-in, EIP-712 signatures
        ▼
Next.js app on Vercel ── Privy (email login, embedded wallets)
        │            ├── Supabase (drafts, invites, profiles, terms text, tx log)
        │            └── Gmail SMTP (invites, setup links, payout notices)
        ▼
Relayer route (server key, pays gas)
        │  QuickNode RPC
        ▼
SetloPackages contract ── Paxos USDG (permit, transfers)
        │
        └── events ─▶ QuickNode Webhooks ─▶ /api/webhooks/quicknode ─▶ claimFor + payout emails`,
      },
      {
        title: "Who owns what",
        table: {
          head: ["Component", "Owns", "Does not own"],
          rows: [
            ["SetloPackages contract", "Package state, funds custody, acceptance rules, credits and claims", "Identity, emails, terms text"],
            ["Next.js app", "Screens for each role, signing, reading live state from the chain", "Balances or statuses as truth"],
            ["Relayer", "Submitting signed actions and permissionless calls, paying gas", "Any decision: it can only submit what users signed or what anyone may call"],
            ["Privy", "Email login, embedded wallets, signing", "Funds rules"],
            ["Supabase", "Drafts, invites, profiles, terms text, package versions, tx log, processed events", "Money: balances and statuses are always read from the contract"],
            ["QuickNode", "RPC reads/writes and contract event delivery", "Correctness: events are deduplicated and re-checked onchain"],
          ],
        },
      },
    ],
  },
  {
    group: "Architecture",
    path: "architecture/package-lifecycle",
    title: "Package lifecycle",
    description: "Five onchain states and the money that moves at each transition.",
    sections: [
      {
        title: "States",
        code: `Open ──(last required accept + funding; auto or clientConfirm)──▶ Confirmed
Open ──(deadline missed / final expiry)──▶ Expired
Confirmed ──(releaseBalances, or review window passed)──▶ Released
Confirmed ──(cancelAfterConfirm, before event date)──▶ Cancelled`,
      },
      {
        title: "Money by transition",
        table: {
          head: ["Transition", "Credited"],
          rows: [
            ["Confirm", "Each accepted slot's deposit to its supplier; agency fee to the agency; unaccepted optional slots back to the client"],
            ["Release", "Each booked slot's balance to its supplier"],
            ["Cancel after confirm", "Unreleased balances back to the client"],
            ["Expire", "Earned hold fees to suppliers who accepted; the remainder to the client"],
            ["Change that lowers the total", "The excess back to the client immediately"],
          ],
        },
      },
      {
        title: "Invariant",
        body: ["Every unit funded is either still held for a package, credited to someone, or already claimed. Foundry invariant tests check that the contract's USDG balance always covers what it owes."],
      },
    ],
  },
  {
    group: "Architecture",
    path: "architecture/signatures-and-relaying",
    title: "Signatures and relaying",
    description: "Clients and suppliers sign; the relayer submits and pays gas.",
    sections: [
      {
        title: "What each person signs (EIP-712)",
        table: {
          head: ["Signer", "Message", "Binds"],
          rows: [
            ["Client", "Fund + USDG permit", "Package id, config hash (every slot's payee, amounts and terms), amount, auto-confirm, nonce, deadline"],
            ["Supplier", "Accept", "Package id, slot, slot hash (payee, amounts, terms hash, version), package revision, nonce, deadline"],
            ["Supplier", "Decline", "Package id, slot, nonce, deadline"],
            ["Client", "ClientAction", "Confirm, Release or Cancel for one package, nonce, deadline"],
          ],
        },
      },
      {
        title: "Why the permit alone isn't enough",
        body: ["A USDG permit only grants an allowance. The funding instruction is what ties the money to one package and one configuration, so a relayer can't point a client's permit at another package."],
      },
      {
        title: "Agency transactions",
        body: ["Creating and changing a package are sent from the agency's own embedded wallet, so the agency pays a small test-ETH fee. Setlo tops it up when needed."],
      },
    ],
  },
  {
    group: "Architecture",
    path: "architecture/relayer",
    title: "The relayer",
    description: "One server route that can submit a fixed list of contract calls.",
    sections: [
      {
        title: "Allowed calls",
        code: "fundWithPermit · acceptWithSig · declineWithSig · clientActionWithSig · expirePackage · releaseBalances · claimFor",
        body: ["POST /api/relay accepts only these functions on the Setlo contract, converts the arguments to the ABI types, rate-limits per IP and per package, and submits. claimFor is not accepted from the browser; payouts are pushed by the server."],
      },
      {
        title: "Deadlines without a scheduler",
        body: ["Vercel Hobby has no frequent cron, so an open booking page polls /api/deadlines. The server reads the package and the chain clock, and submits expirePackage or the automatic releaseBalances when the contract would allow it."],
      },
      {
        title: "Reliability",
        list: [
          "The relayer tracks its own transaction counter and retries once on a \"nonce too low\" error, because the RPC can return a stale counter when several transactions go out in a row.",
          "After a credit, automatic payouts wait until the RPC has reached the crediting block and retry a zero read up to four times before logging that they gave up.",
        ],
      },
    ],
  },
  {
    group: "Architecture",
    path: "architecture/events-and-verification",
    title: "Events and verification",
    description: "How Setlo knows something actually happened.",
    sections: [
      {
        title: "Two paths for events",
        body: [
          "When the relayer submits a transaction, it reads the receipt and handles the events itself: Credited triggers claimFor for that recipient, Claimed triggers the payout email.",
          "QuickNode Webhooks also deliver every SetloPackages event on both networks to /api/webhooks/quicknode. The route checks QuickNode's HMAC signature, stores the transaction, and runs the same handler. A processed_logs table makes each event run once, whichever path sees it first.",
        ],
      },
      {
        title: "What the screens read",
        body: ["Booking pages read package state, slots, claimable amounts and event history from the contract on every load. Supabase only supplies names, emails and terms text, and the server checks that stored terms text matches the onchain terms hash."],
      },
    ],
  },

  // Reference
  {
    group: "Reference",
    path: "reference/networks-and-assets",
    title: "Networks and assets",
    description: "Two test networks, one token.",
    sections: [
      {
        title: "Supported networks",
        table: {
          head: ["Network", "Chain ID", "SetloPackages", "USDG"],
          rows: [
            ["Arbitrum Sepolia", "421614", SETLO, "0xFFC95faa3d63Cde504a05B567C600B78C0b41892"],
            ["Robinhood Chain Testnet", "46630", SETLO, "0x7E955252E15c84f5768B83c41a71F9eba181802F"],
          ],
        },
      },
      {
        title: "USDG",
        body: ["Paxos' Global Dollar, 6 decimals. Setlo uses its EIP-2612 permit for gasless funding. Amounts are always labelled USDG; Setlo doesn't convert them to other currencies."],
      },
    ],
  },
  {
    group: "Reference",
    path: "reference/money-terms",
    title: "Money terms",
    description: "What each amount in a package means.",
    sections: [
      {
        title: "Per slot",
        table: {
          head: ["Term", "Meaning"],
          rows: [
            ["Deposit", "Credited to the supplier when the booking confirms."],
            ["Paid hold (part of the deposit)", "Earned when the supplier accepts. Kept even if the booking later expires. Can't exceed the deposit."],
            ["Balance", "Credited to the supplier when balances are released after the event."],
          ],
        },
      },
      {
        title: "Per package",
        table: {
          head: ["Term", "Meaning"],
          rows: [
            ["Agency fee", "Credited to the agency when the booking confirms. It's the agency's income, shown openly to the client."],
            ["Hold-fee cap", "The most the client can lose in paid holds, including suppliers who were replaced after accepting."],
            ["Required funding", "Deposits + balances of every slot + agency fee + hold fees already earned by replaced suppliers."],
          ],
        },
      },
      { title: "Setlo's own fee", body: ["None. Setlo takes no cut in this version and pays the network fees for clients and suppliers."] },
    ],
  },
  {
    group: "Reference",
    path: "reference/deadlines",
    title: "Deadlines",
    description: "Every package carries its own timers, enforced by the contract clock.",
    sections: [
      {
        title: "Timers",
        table: {
          head: ["Timer", "What happens when it passes"],
          rows: [
            ["Suppliers accept by", "If a required supplier hasn't accepted, the package can be expired."],
            ["Booking confirms by", "If the booking hasn't confirmed, the package can be expired."],
            ["Final expiry", "Hard limit. No change can push any deadline past it."],
            ["Event date", "Cancel after confirm is no longer possible; the client can release balances."],
            ["Review window", "After event date + review window, anyone can release balances."],
            ["Minimum response time", "After a supplier change, the acceptance deadline moves out so people get at least this long to respond, never past the final expiry."],
          ],
        },
      },
    ],
  },
  {
    group: "Reference",
    path: "reference/statuses",
    title: "Statuses",
    description: "The words Setlo shows and what they mean onchain.",
    sections: [
      {
        title: "Package",
        table: {
          head: ["Shown", "Meaning"],
          rows: [
            ["Waiting for client funding", "Open; the client hasn't funded the current version."],
            ["Changed · client must approve again", "Open; the package changed after funding."],
            ["Funded · n of m required accepted", "Open; waiting for suppliers."],
            ["Ready · waiting for the client to confirm", "Open; auto-confirm is off and everyone accepted."],
            ["A required supplier declined", "Open; the agency can replace them before the deadline."],
            ["Confirmed", "Deposits and agency fee credited; balances held until after the event."],
            ["Event held · balances waiting", "Confirmed, event date passed."],
            ["Balances released", "Released; every booked balance credited."],
            ["Cancelled after confirmation", "Cancelled; unreleased balances credited back to the client."],
            ["Expired", "Expired; remainder credited to the client minus earned holds."],
          ],
        },
      },
      {
        title: "Supplier slot",
        list: ["Waiting to accept", "Accepted", "Declined", "Terms changed · needs to accept again", "Did not respond", "Booked · deposit credited", "Booked · balance credited"],
      },
    ],
  },
  {
    group: "Reference",
    path: "reference/limitations",
    title: "Limitations",
    description: "What this version deliberately doesn't do.",
    sections: [
      {
        title: "Not in this version",
        list: [
          "Real money. Test networks and test USDG only.",
          "Dispute resolution or proof of delivery. The client releases balances, or they release after the review window.",
          "Business identity checks. Suppliers are email-authenticated; the client approves each named supplier.",
          "Sending or withdrawing USDG inside the app.",
          "Scheduled reminder emails. Deadline actions run when someone has a booking page open, or via the manual buttons.",
          "Private quotes. Amounts and payout addresses are public onchain.",
        ],
      },
    ],
  },

  // Security
  {
    group: "Security",
    path: "security/trust-model",
    title: "Trust model",
    description: "What you have to trust, and what you can check yourself.",
    sections: [
      {
        title: "Trust boundaries",
        table: {
          head: ["Party", "Can", "Cannot"],
          rows: [
            ["Contract owner", "Pause and unpause new package creation", "Move, redirect or freeze any funds. The contract isn't upgradeable."],
            ["Relayer", "Submit signed actions, expire/release when allowed, trigger payouts", "Change a signed action, fund a different package, or pay a payout to anyone but the recipient"],
            ["Agency", "Build and change the package before confirmation", "Release any money without the client's approval of that version and every required acceptance"],
            ["Paxos (USDG issuer)", "Pause USDG or freeze addresses, including the Setlo contract", "—"],
          ],
        },
      },
      {
        title: "What you can verify",
        body: ["The contract source is verified on Sourcify for both networks. Every package, acceptance, credit and payout is an event on a public explorer."],
      },
    ],
  },
  {
    group: "Security",
    path: "security/authorization",
    title: "Authorization and replay protection",
    description: "Every signature is narrow, single-use and time-limited.",
    sections: [
      {
        title: "Protections",
        list: [
          "EIP-712 domain includes the chain ID and contract address, so a signature can't be used on another network or contract.",
          "Per-signer nonces: each signature works once.",
          "Every signature has a deadline.",
          "Acceptances are bound to the slot version and package revision, so accepting stale terms doesn't count after a change.",
          "Funding is bound to the configuration hash; if anything changed, it reverts with ConfigMismatch.",
          "The permit is wrapped so a front-run permit can't block funding.",
        ],
      },
      {
        title: "Server checks",
        list: [
          "API routes verify the Privy access token and that the caller is a participant of the booking.",
          "Invites and setup links are bound to the invited email.",
          "Relay, deadline, payout and faucet routes are rate-limited.",
        ],
      },
    ],
  },
  {
    group: "Security",
    path: "security/recovery",
    title: "Recovery and emergency controls",
    description: "What happens when a piece of the system fails.",
    sections: [
      {
        title: "Failure cases",
        table: {
          head: ["If…", "Then"],
          rows: [
            ["The relayer is down", "Every action can still be called directly from the user's wallet. Credits stay claimable."],
            ["An automatic payout fails", "The amount stays credited. \"Send payout again\" retries it."],
            ["A deadline passes with nobody online", "Nothing moves until someone opens the booking or presses Expire/Release; the funds are safe in the contract."],
            ["A recipient's address is frozen by Paxos", "Only that recipient's claim fails; others are paid separately."],
            ["The Setlo contract is frozen or USDG is paused", "All payouts are blocked until Paxos lifts it."],
            ["Something goes wrong with new packages", "The owner can pause package creation. Existing bookings carry on."],
          ],
        },
      },
    ],
  },
  {
    group: "Security",
    path: "security/privacy",
    title: "Privacy",
    description: "What is public, what Setlo stores, and what stays private.",
    sections: [
      {
        title: "Public onchain",
        body: ["Package amounts, deadlines, payout addresses, terms hashes, acceptances and every transfer. Don't put anything in a booking you aren't comfortable being public."],
      },
      {
        title: "Stored by Setlo",
        body: ["Emails, business names, terms text, drafts, invites and a log of transactions, in Supabase. See the privacy policy for details."],
      },
      { title: "Never stored by Setlo", body: ["Embedded wallet keys (held by Privy) and login codes."] },
    ],
  },

  // Proof
  {
    group: "Proof",
    path: "proof/live-deployment",
    title: "Live deployment",
    description: "What is running today.",
    sections: [
      {
        title: "Hosted",
        list: [
          `App and API: ${APP} (Vercel, deployed from main).`,
          "Contract: SetloPackages at the same address on both networks, source verified on Sourcify (exact match).",
          "Events: QuickNode Webhooks on both networks deliver every SetloPackages event to the app.",
        ],
      },
      {
        title: "Contract deployments",
        table: {
          head: ["Network", "Deploy transaction"],
          rows: [
            ["Arbitrum Sepolia", "0x1f915dce9ace7779584961f33dd2230904efce43d36129f3b8272770c85e3ce2"],
            ["Robinhood Chain Testnet", "0x374cbccf6d04b4b6821815dcd178b0655c9dc37310e1cce4729e0a0e097b101d"],
          ],
        },
      },
      {
        title: "What this proves",
        callout: { title: "Scope", body: "These records prove the contract is deployed and its source matches. They don't prove any particular booking happened; look up that booking's events on the explorer for that." },
      },
    ],
  },
  {
    group: "Proof",
    path: "proof/tests",
    title: "Tests and live runs",
    description: "How the rules are checked.",
    sections: [
      {
        title: "Automated",
        list: [
          "Contract: 43 Foundry unit and fuzz tests plus 2 invariant tests (funds always cover what is owed). CI runs forge fmt, build and test on every PR.",
          "App: Vitest unit tests for amounts, relay argument handling and webhook parsing; CI runs lint, typecheck, tests and a production build.",
        ],
      },
      {
        title: "Live, on both test networks",
        list: [
          "contracts/script/E2E.s.sol: a funded, accepted, confirmed and released package, and a declined package that expires with a refund minus the earned hold.",
          "app/scripts/relay-smoke.mjs: a full booking through the relayer API with automatic payouts.",
          "Both use sub-dollar amounts and sweep test payouts back afterwards.",
        ],
      },
    ],
  },

  // Help
  {
    group: "Help",
    path: "help/troubleshooting",
    title: "Troubleshooting",
    description: "Real messages you might see, and what to do.",
    sections: [
      {
        title: "Common messages",
        table: {
          head: ["Message", "Cause", "Fix"],
          rows: [
            ["Not enough test ETH to pay the network fee", "The agency wallet has no test ETH for its own transaction.", "Use the \"Get test ETH\" button that appears, then retry."],
            ["The booking changed before this went through", "The package changed after you loaded it (ConfigMismatch).", "Review the latest version and sign again."],
            ["This approval was already used", "A signature was submitted twice.", "The page refreshes the state; nothing else is needed."],
            ["Too many requests", "A rate limit was hit.", "Wait a minute and retry."],
            ["This invite was sent to …", "You're signed in with a different email.", "Sign out and sign in with the invited email."],
            ["This slot names a different payout account", "The onchain payee isn't the account you confirmed for this booking.", "Ask the agency to send a new setup link."],
            ["Waiting to be paid out (stays)", "An automatic payout didn't go through.", "Press \"Send payout again\"."],
            ["New bookings are paused right now", "The owner paused package creation.", "Existing bookings are not affected; try creating later."],
          ],
        },
      },
      {
        title: "Unclear results",
        body: ["If a transaction was sent but its result couldn't be confirmed, Setlo locks that action for two minutes and re-reads the chain, so you don't send it twice."],
      },
    ],
  },
  {
    group: "Help",
    path: "help/faq",
    title: "FAQ",
    description: "Short answers to common questions.",
    sections: [
      { title: "Is this real money?", body: ["No. Setlo runs on test networks with test USDG, which has no value."] },
      { title: "Do I need a crypto wallet?", body: ["No. You sign in with an email code and Setlo creates a payout account for you."] },
      { title: "Who pays network fees?", body: ["Setlo's relayer pays them for clients and suppliers. Agencies pay a small test-ETH fee for creating and changing packages, which Setlo tops up."] },
      { title: "What if one supplier says no?", body: ["Nothing is booked yet. The agency can replace them before the deadline; otherwise the package expires and the client is refunded minus earned hold fees."] },
      { title: "Can Setlo take or redirect the money?", body: ["No. The contract owner can only pause new packages, and payouts always go to the recipient's own address."] },
      { title: "Is there dispute resolution?", body: ["Not in this version. Setlo records acceptances and payments; it doesn't prove a service was delivered."] },
    ],
  },
];

export const docHref = (p: DocPage) => `/docs/${p.path}`;

export function findDoc(path: string) {
  const i = DOC_PAGES.findIndex((p) => p.path === path);
  return i < 0 ? null : { page: DOC_PAGES[i], prev: DOC_PAGES[i - 1] ?? null, next: DOC_PAGES[i + 1] ?? null };
}

export function docGroups() {
  const groups = [...new Set(DOC_PAGES.map((p) => p.group))];
  return groups.map((g) => ({ group: g, pages: DOC_PAGES.filter((p) => p.group === g) }));
}

export const anchor = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
