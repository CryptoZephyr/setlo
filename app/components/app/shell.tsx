import Image from "next/image";
import Link from "next/link";
import { Spinner } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { getChain } from "@/lib/chains";

export function Logo({ className, withWord = true, light }: { className?: string; withWord?: boolean; light?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Image src="/img/logo-64.png" alt="" width={32} height={32} className="size-8 rounded-[7px]" priority />
      {withWord && <span className={cn("font-display text-[26px] leading-none tracking-tight", light ? "text-bg" : "text-text")}>Setlo</span>}
    </span>
  );
}

export function NetworkBadge({ chainId }: { chainId: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-[13px] text-text-muted">
      <span className="size-1.5 rounded-full bg-waiting" aria-hidden />
      Test network · {getChain(chainId).chain.name}
    </span>
  );
}

export function PageLoading({ label, detail }: { label: string; detail?: string }) {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 p-6 text-center" role="status" aria-live="polite">
      <Spinner className="size-6 text-brand" />
      <p className="font-medium">{label}</p>
      {detail && <p className="max-w-sm text-sm text-text-muted">{detail}</p>}
    </div>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-border bg-bg">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-3">
          <Logo />
          <p className="max-w-xs text-sm text-text-muted">Shared booking and settlement for event agencies, clients and suppliers. Testnet prototype, settled in test USDG.</p>
        </div>
        <nav aria-label="Product" className="flex flex-col gap-2 text-sm">
          <p className="font-semibold">Product</p>
          <Link className="text-text-muted hover:text-text" href="/#how-it-works">How it works</Link>
          <Link className="text-text-muted hover:text-text" href="/#money">Where the money goes</Link>
          <Link className="text-text-muted hover:text-text" href="/#faq">FAQ</Link>
          <Link className="text-text-muted hover:text-text" href="/demo">Try the demo</Link>
        </nav>
        <nav aria-label="Account" className="flex flex-col gap-2 text-sm">
          <p className="font-semibold">Account</p>
          <Link className="text-text-muted hover:text-text" href="/signin">Sign in</Link>
          <Link className="text-text-muted hover:text-text" href="/app">Your bookings</Link>
          <Link className="text-text-muted hover:text-text" href="/app/new">Create a package</Link>
        </nav>
        <div className="flex flex-col gap-2 text-sm">
          <p className="font-semibold">Contract</p>
          <a className="text-text-muted hover:text-text" href="https://sepolia.arbiscan.io/address/0xccf304db9ab8607b379b0f7f87cbb4d269a1de73" rel="noreferrer" target="_blank">
            Arbitrum Sepolia
          </a>
          <a className="text-text-muted hover:text-text" href="https://explorer.testnet.chain.robinhood.com/address/0xccf304db9ab8607b379b0f7f87cbb4d269a1de73" rel="noreferrer" target="_blank">
            Robinhood Chain Testnet
          </a>
          <a className="text-text-muted hover:text-text" href="https://github.com/CryptoZephyr/setlo" rel="noreferrer" target="_blank">
            Source on GitHub
          </a>
        </div>
      </div>
      <div className="border-t border-border">
        <p className="mx-auto max-w-6xl px-6 py-5 text-[13px] text-text-muted">
          Test networks only. USDG here is test money with no value. Paxos can pause USDG or freeze addresses, including the Setlo contract.
        </p>
      </div>
    </footer>
  );
}
