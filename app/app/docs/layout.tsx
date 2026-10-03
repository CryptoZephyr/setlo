import Link from "next/link";
import { Footer, Logo } from "@/components/app/shell";
import { DocsMobileNav, DocsSidebar } from "@/components/docs/docs-nav";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border bg-bg/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <span className="flex items-center gap-3">
            <Link href="/" aria-label="Setlo home"><Logo /></Link>
            <Link href="/docs" className="rounded-full border border-border px-2.5 py-0.5 text-[13px] text-text-muted hover:text-text">Docs</Link>
          </span>
          <nav className="flex items-center gap-1 text-[15px] sm:gap-2" aria-label="Main">
            <Link href="/demo" className="hidden min-h-11 items-center rounded-md px-3 hover:bg-surface-muted sm:inline-flex">Demo</Link>
            <a href="https://github.com/CryptoZephyr/setlo" rel="noreferrer" target="_blank" className="hidden min-h-11 items-center rounded-md px-3 hover:bg-surface-muted sm:inline-flex">GitHub</a>
            <Link href="/app" className="inline-flex min-h-11 items-center rounded-md px-3 hover:bg-surface-muted">Open app</Link>
          </nav>
        </div>
      </header>
      <DocsMobileNav />
      <div className="mx-auto flex max-w-7xl gap-10 px-4 sm:px-6">
        <DocsSidebar />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
      <Footer />
    </>
  );
}
