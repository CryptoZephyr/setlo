"use client";

import { useCallback, useEffect, useState } from "react";
import { QuickSignIn } from "@/components/app/quick-sign-in";
import { useSession } from "@/components/app/session";
import { AddressLink, Amount, CopyButton } from "@/components/booking/parts";
import { Button } from "@/components/ui/button";
import { Card, Notice, Skeleton } from "@/components/ui/status";
import { CHAINS } from "@/lib/chains";
import { account } from "@/lib/client/actions";
import { friendly } from "@/lib/client/errors";
import type { AccountState } from "@/lib/types";

type Row = { chainId: number; state?: AccountState; error?: string };
const chainIds = Object.keys(CHAINS).map(Number);

export function Account() {
  const { email, wallet, logout } = useSession();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await Promise.allSettled(chainIds.map((id) => account(id, wallet)));
    setRows(res.map((r, i) => (r.status === "fulfilled" ? { chainId: chainIds[i], state: r.value } : { chainId: chainIds[i], error: friendly(r.reason) })));
    setLoading(false);
  }, [wallet]);
  useEffect(() => void load(), [load]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-4xl sm:text-5xl">Account</h1>
        <p className="mt-2 text-[15px] text-text-muted">Signed in as {email}</p>
      </div>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Payout account</h2>
            <p className="mt-1 text-[15px] text-text-muted">Setlo created this wallet for you. Payments from your bookings arrive here.</p>
          </div>
          <Button intent="secondary" size="sm" pending={loading} onPress={() => void load()}>
            Refresh
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <code className="break-all rounded-md bg-surface-muted px-3 py-2 font-mono text-[13px]">{wallet}</code>
          <CopyButton text={wallet} label="Copy address" />
        </div>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {chainIds.map((id) => {
            const row = rows?.find((r) => r.chainId === id);
            return (
              <li key={id} className="rounded-lg border border-border p-4">
                <p className="text-sm text-text-muted">{CHAINS[id].chain.name}</p>
                {!row ? (
                  <Skeleton className="mt-2 h-7 w-32" />
                ) : row.error ? (
                  <Notice tone="bad" className="mt-2">Couldn&apos;t load the balance. {row.error}</Notice>
                ) : (
                  <>
                    <Amount value={row.state!.usdg} strong className="mt-1 block text-2xl" />
                    {BigInt(row.state!.claimable) > BigInt(0) && (
                      <p className="mt-1 text-[13px] text-text-muted">
                        Plus <Amount value={row.state!.claimable} /> on its way
                      </p>
                    )}
                  </>
                )}
                <div className="mt-2">
                  <AddressLink chainId={id} address={wallet} />
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <QuickSignIn />

      <div>
        <Button intent="secondary" onPress={() => void logout()}>
          Sign out
        </Button>
      </div>
    </div>
  );
}
