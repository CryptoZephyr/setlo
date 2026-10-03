"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { Address } from "viem";
import { useSession } from "@/components/app/session";
import { PageLoading } from "@/components/app/shell";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/status";
import { ApiError } from "@/lib/client/api";
import { friendly } from "@/lib/client/errors";
import { CopyButton } from "./parts";

type Setup = { role: "client" | "supplier"; title: string; wallet: Address; registeredAt: string | null };

/** Invite links resolve to the booking; setup links register the signed-in payout account. */
export function TokenLanding({ kind, token }: { kind: "invite" | "setup"; token: string }) {
  const { api, email, logout } = useSession();
  const router = useRouter();
  const [setup, setSetup] = useState<Setup | null>(null);
  const [error, setError] = useState<{ status: number; text: string } | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      if (kind === "invite") {
        const r = await api<{ ref: string }>(`/api/invites/${token}`);
        router.replace(`/b/${r.ref}`);
      } else {
        setSetup(await api<Setup>(`/api/setup/${token}`));
      }
    } catch (e) {
      setError({ status: e instanceof ApiError ? e.status : 0, text: friendly(e) });
    }
  }, [api, kind, router, token]);
  useEffect(() => void load(), [load]);

  if (error) {
    const wrongEmail = error.status === 403;
    return (
      <div className="mx-auto max-w-lg pt-10">
        <Notice
          tone="bad"
          title={wrongEmail ? "This link was sent to a different email" : error.status === 410 ? "This invitation was replaced" : error.status === 404 ? "Link not found" : "Couldn't open this link"}
          action={
            wrongEmail ? (
              <Button intent="secondary" onPress={() => void logout()}>Sign in with that email</Button>
            ) : error.status === 404 || error.status === 410 ? (
              <LinkButton href="/app" intent="secondary">Go to your bookings</LinkButton>
            ) : (
              <Button intent="secondary" onPress={() => void load()}>Try again</Button>
            )
          }
        >
          {wrongEmail ? `You're signed in as ${email}. ${error.text}.` : error.status === 410 ? "The agency sent a newer invitation for this slot. Ask them for the current link." : error.text}
        </Notice>
      </div>
    );
  }
  if (!setup) return <PageLoading label={kind === "invite" ? "Opening your invitation" : "Setting up your payout account"} />;
  return (
    <div className="mx-auto max-w-lg pt-6">
      <Card>
        <h1 className="font-display text-3xl">Your payout account is ready</h1>
        <p className="mt-2 text-[15px] text-text-muted">
          The agency can now add you as the {setup.role} for <span className="font-medium text-text">{setup.title}</span>. You&apos;ll get a separate invitation to review the booking once it&apos;s created.
        </p>
        <div className="mt-5 rounded-md bg-surface-muted p-4">
          <p className="text-[13px] text-text-muted">Payout account for {email}</p>
          <p className="mt-1 font-mono text-[13px] break-all">{setup.wallet}</p>
          <div className="mt-3"><CopyButton text={setup.wallet} label="Copy address" /></div>
        </div>
        <p className="mt-4 text-[13px] text-text-muted">Setlo created this account for your email. Payments in this test version are test USDG with no value.</p>
        <LinkButton href="/app" className="mt-5" intent="secondary">Go to your bookings</LinkButton>
      </Card>
    </div>
  );
}
