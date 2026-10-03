"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "./shell";
import { useSession } from "./session";

export function AppHeader() {
  const { email, logout } = useSession();
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/app" aria-label="Setlo, your bookings">
          <Logo />
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2" aria-label="Main">
          <Link href="/app" className="hidden min-h-11 items-center rounded-md px-3 text-[15px] hover:bg-surface-muted sm:inline-flex">
            Bookings
          </Link>
          <Link href="/app/new" className="inline-flex min-h-11 items-center rounded-md px-3 text-[15px] hover:bg-surface-muted">
            New package
          </Link>
          <span className="hidden max-w-48 truncate text-sm text-text-muted md:inline" title={email}>
            {email}
          </span>
          <Button intent="ghost" size="sm" onPress={() => void logout()}>
            Sign out
          </Button>
        </nav>
      </div>
    </header>
  );
}
