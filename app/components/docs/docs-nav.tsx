"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/components/ui/cn";
import { docGroups, docHref } from "@/lib/docs";

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <nav aria-label="Documentation" className="flex flex-col gap-6 text-[15px]">
      {docGroups().map(({ group, pages }) => (
        <div key={group}>
          <p className="mb-2 text-[13px] font-medium tracking-wide text-text-muted uppercase">{group}</p>
          <ul className="flex flex-col gap-0.5">
            {pages.map((p) => {
              const href = docHref(p);
              const active = path === href;
              return (
                <li key={p.path}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn("block rounded-md px-3 py-1.5 hover:bg-surface-muted", active ? "bg-brand-soft font-medium text-brand" : "text-text")}
                  >
                    {p.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function DocsSidebar() {
  return (
    <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-64 shrink-0 overflow-y-auto border-r border-border py-8 pr-4 lg:block">
      <NavList />
    </aside>
  );
}

export function DocsMobileNav() {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center gap-2 px-4 text-[15px] font-medium sm:px-6"
      >
        {open ? <X className="size-4" aria-hidden /> : <Menu className="size-4" aria-hidden />}
        Documentation menu
      </button>
      {open && (
        <div className="px-4 pb-6 sm:px-6">
          <NavList onNavigate={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
