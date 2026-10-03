"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/components/app/session";
import { NetworkBadge, PageLoading } from "@/components/app/shell";
import { Button, LinkButton } from "@/components/ui/button";
import { ErrorState, Notice, Skeleton, StatusPill } from "@/components/ui/status";
import { ApiError } from "@/lib/client/api";
import { friendly } from "@/lib/client/errors";
import { useChainState } from "@/lib/client/hooks";
import { nextStep, packageStatus } from "@/lib/status";
import type { BookingDetail } from "@/lib/types";
import { AgencyView } from "./agency-view";
import { ClientView } from "./client-view";
import { StaleBanner } from "./parts";
import { SupplierView } from "./supplier-view";

export function BookingPage({ bookingRef }: { bookingRef: string }) {
  const { api, email, logout } = useSession();
  const [detail, setDetail] = useState<BookingDetail | null>(null);
  const [error, setError] = useState<{ status: number; text: string } | null>(null);
  const [retrying, setRetrying] = useState(false);

  const loadDetail = useCallback(async () => {
    try {
      setDetail(await api<BookingDetail>(`/api/bookings/${bookingRef}`));
      setError(null);
    } catch (e) {
      setError({ status: e instanceof ApiError ? e.status : 0, text: friendly(e) });
    }
  }, [api, bookingRef]);
  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const chain = useChainState(detail?.meta.chainId ?? null, detail?.meta.packageId ?? null);
  const refresh = useCallback(async () => {
    await Promise.all([chain.refresh(), loadDetail()]);
  }, [chain, loadDetail]);

  if (error && !detail)
    return (
      <ErrorState
        title={error.status === 403 ? "This booking isn't shared with this account" : error.status === 404 ? "Booking not found" : "Couldn't load this booking"}
        action={
          error.status === 403 ? (
            <Button intent="secondary" onPress={() => void logout()}>Sign in with another email</Button>
          ) : error.status === 404 ? (
            <LinkButton href="/app" intent="secondary">Go to your bookings</LinkButton>
          ) : (
            <Button
              intent="secondary"
              pending={retrying}
              onPress={async () => {
                setRetrying(true);
                await loadDetail();
                setRetrying(false);
              }}
            >
              Try again
            </Button>
          )
        }
      >
        {error.status === 403 ? `You're signed in as ${email}. ${error.text}` : error.text}
      </ErrorState>
    );
  if (!detail) return <PageLoading label="Loading booking" />;
  const s = chain.state;
  const status = s ? packageStatus(s) : null;
  const next = s ? nextStep(s, detail.role, detail.slotIndex) : null;
  const roleLabel = detail.role === "agency" ? "You're the agency" : detail.role === "client" ? "You're the client" : `You're a supplier · slot ${(detail.slotIndex ?? 0) + 1}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link href="/app" className="text-sm text-text-muted hover:text-text">← All bookings</Link>
        <div className="flex flex-wrap items-center gap-2">
          <NetworkBadge chainId={detail.meta.chainId} />
          <span className="text-[13px] text-text-muted">{roleLabel}</span>
        </div>
        <h1 className="font-display text-4xl leading-tight sm:text-5xl">{detail.meta.title}</h1>
        {status ? (
          <div className="flex flex-col gap-2">
            <div><StatusPill tone={status.tone}>{status.label}</StatusPill></div>
            <p className="text-[15px] text-text-muted">{status.detail}</p>
          </div>
        ) : (
          <Skeleton className="h-8 w-56" />
        )}
      </div>
      {chain.error && !s && (
        <Notice tone="bad" title="Couldn't read the booking from the chain" action={<Button intent="secondary" onPress={() => void chain.refresh()}>Try again</Button>}>
          {chain.error}
        </Notice>
      )}
      <StaleBanner stale={chain.stale} error={chain.error} onRetry={() => void chain.refresh()} />
      {chain.checking && <Notice tone="waiting">A deadline has passed. Checking the chain and submitting the due action…</Notice>}
      {next && <Notice tone={next.tone} title="Next step">{next.text}</Notice>}
      {!s ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      ) : detail.role === "agency" ? (
        <AgencyView detail={detail} state={s} refresh={refresh} />
      ) : detail.role === "client" ? (
        <ClientView detail={detail} state={s} refresh={refresh} />
      ) : (
        <SupplierView detail={detail} state={s} refresh={refresh} />
      )}
    </div>
  );
}
