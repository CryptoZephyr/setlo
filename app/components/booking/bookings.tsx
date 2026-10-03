"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/components/app/session";
import { NetworkBadge } from "@/components/app/shell";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, Notice, Skeleton } from "@/components/ui/status";
import { friendly } from "@/lib/client/errors";
import { dateTime } from "@/lib/client/time";
import type { BookingSummary } from "@/lib/types";

type DraftRow = { id: string; chainId: number; title: string; updatedAt: string };
const roleLabel = { agency: "Agency", client: "Client", supplier: "Supplier" } as const;

export function Bookings() {
  const { api } = useSession();
  const [bookings, setBookings] = useState<BookingSummary[] | null>(null);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [b, d] = await Promise.all([api<{ bookings: BookingSummary[] }>("/api/packages"), api<{ drafts: DraftRow[] }>("/api/drafts")]);
      setBookings(b.bookings);
      setDrafts(d.drafts);
      setError(null);
    } catch (e) {
      setError(friendly(e));
    } finally {
      setLoading(false);
    }
  }, [api]);
  useEffect(() => void load(), [load]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl sm:text-5xl">Bookings</h1>
          <p className="mt-2 text-[15px] text-text-muted">Packages you run as an agency, and bookings you were invited to.</p>
        </div>
        <LinkButton href="/app/new">New package</LinkButton>
      </div>
      {error && <Notice tone="bad" title="Couldn't load your bookings" action={<Button intent="secondary" pending={loading} onPress={() => void load()}>Try again</Button>}>{error}</Notice>}
      {drafts.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">Drafts</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {drafts.map((d) => (
              <li key={d.id}>
                <Link href={`/app/new?draft=${d.id}`} className="block rounded-lg border border-dashed border-border-strong bg-surface p-4 hover:border-brand">
                  <p className="font-semibold">{d.title || "Untitled package"}</p>
                  <p className="text-[13px] text-text-muted">Draft · saved {dateTime(Math.floor(new Date(d.updatedAt).getTime() / 1000))}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section>
        {bookings === null && !error ? (
          <div className="grid gap-3 sm:grid-cols-2"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
        ) : bookings && bookings.length === 0 ? (
          <Card className="text-center">
            <h2 className="text-lg font-semibold">No bookings yet</h2>
            <p className="mx-auto mt-1 max-w-md text-[15px] text-text-muted">
              Agencies start by creating a package. If someone invited you, open the link they sent, signed in with the same email.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <LinkButton href="/app/new">Create a package</LinkButton>
              <LinkButton href="/demo" intent="secondary">Try the demo</LinkButton>
            </div>
          </Card>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {bookings?.map((b) => (
              <li key={b.ref}>
                <Link href={`/b/${b.ref}`} className="block rounded-lg border border-border bg-surface p-4 hover:border-brand">
                  <div className="flex flex-wrap items-center gap-2">
                    <NetworkBadge chainId={b.chainId} />
                    <span className="text-[13px] text-text-muted">{roleLabel[b.role]}{b.slotIndex !== null ? ` · slot ${b.slotIndex + 1}` : ""}</span>
                  </div>
                  <p className="mt-2 font-semibold">{b.title}</p>
                  <p className="text-[13px] text-text-muted">Created {dateTime(Math.floor(new Date(b.createdAt).getTime() / 1000))}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
