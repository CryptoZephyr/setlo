"use client";

import { useState } from "react";
import { useSession } from "@/components/app/session";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/dialog";
import { Card, Notice, StatusPill } from "@/components/ui/status";
import { accept, decline } from "@/lib/client/actions";
import { dateTime, duration } from "@/lib/client/time";
import { chainNow, requiredProgress, slotStatus } from "@/lib/status";
import { STATUS, type BookingDetail, type PackageState } from "@/lib/types";
import { AddressLink, Amount, History, PaymentPanel } from "./parts";
import { categoryLabel, RecoveringNotice, ResultNotice, TermsText } from "./shared";
import { useAction } from "./use-action";

export function SupplierView({ detail, state, refresh }: { detail: BookingDetail; state: PackageState; refresh: () => Promise<void> }) {
  const { signer } = useSession();
  const i = detail.slotIndex ?? 0;
  const s = state.slots[i];
  const m = detail.meta.slots[i];
  const act = useAction(`${state.chainId}:${state.packageId}:slot${i}`, refresh);
  const [declineOpen, setDeclineOpen] = useState(false);
  const p = state.pkg;
  const now = chainNow(state);
  const st = slotStatus(state, s);
  const { accepted, total } = requiredProgress(state);
  const mine = s.payee.toLowerCase() === signer.address.toLowerCase();
  const canRespond = p.status === STATUS.Open && !s.accepted && !s.declined && now <= p.acceptDeadline && mine;
  const disabled = !!act.busy || !!act.recovering;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="flex flex-col gap-6">
        <RecoveringNotice op={act.recovering} />
        <ResultNotice result={act.result} progress={act.progress} chainId={state.chainId} onDismiss={() => act.setResult(null)} />
        {!mine && (
          <Notice tone="bad" title="This slot names a different payout account">
            The agency put another account on this slot (<AddressLink chainId={state.chainId} address={s.payee} />), so you can&apos;t accept it from this one. Ask the agency to send a new invite to the email you sign in with.
          </Notice>
        )}
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[13px] text-text-muted">{categoryLabel(m?.category ?? "other")} · {s.required ? "Required supplier" : "Optional supplier"} · version {s.version}</p>
              <h2 className="mt-1 text-xl font-semibold">{m?.name ?? `Slot ${i + 1}`}</h2>
            </div>
            <StatusPill tone={st.tone}>{st.label}</StatusPill>
          </div>
          <dl className="mt-5 divide-y divide-border">
            <div className="flex justify-between gap-4 py-2.5"><dt className="text-text-muted">Deposit, credited when the booking confirms</dt><dd><Amount value={s.deposit} strong /></dd></div>
            <div className="flex justify-between gap-4 py-2.5"><dt className="text-text-muted">… of which paid hold, earned when you accept</dt><dd><Amount value={s.holdFee} /></dd></div>
            <div className="flex justify-between gap-4 py-2.5"><dt className="text-text-muted">Balance, released after the event</dt><dd><Amount value={s.balance} strong /></dd></div>
          </dl>
          <div className="mt-5">
            <p className="font-medium">Your terms</p>
            <div className="mt-1"><TermsText text={m?.termsText ?? ""} /></div>
          </div>
          <div className="mt-5">
            <p className="font-medium">Shared booking terms</p>
            <div className="mt-1"><TermsText text={detail.meta.sharedTermsText} /></div>
          </div>
          <p className="mt-5 text-[15px]">Event: {dateTime(p.eventDate)}</p>
          {p.status === STATUS.Open && (
            <p className="mt-1 text-[15px]">
              Respond by {dateTime(p.acceptDeadline)}
              {now <= p.acceptDeadline && <span className="text-text-muted"> · {duration(p.acceptDeadline - now)} left</span>}
            </p>
          )}
          {s.acceptedVersion !== 0 && !s.accepted && p.status === STATUS.Open && (
            <Notice tone="changed" className="mt-4" title="Your terms changed since you accepted">
              Review the amounts and terms above. Your earlier acceptance no longer counts.
            </Notice>
          )}
          {canRespond && (
            <div className="mt-6 flex flex-col gap-3">
              <p className="text-[13px] text-text-muted">
                Accepting is a signed commitment to these exact terms. Your deposit is credited only when every required supplier accepts and the client&apos;s funding covers the package. No network fee for you.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button size="lg" isDisabled={disabled} pending={act.busy === "Accept"} onPress={() => act.run("Accept", (step) => accept(signer, state, i, step), "Acceptance recorded onchain.")}>
                  Accept these terms
                </Button>
                <Button size="lg" intent="secondary" isDisabled={disabled} onPress={() => setDeclineOpen(true)}>
                  Decline
                </Button>
              </div>
            </div>
          )}
        </Card>
        <Card>
          <h2 className="text-lg font-semibold">Booking progress</h2>
          <p className="mt-1 text-[15px] text-text-muted">
            {accepted} of {total} required suppliers have accepted.{" "}
            {state.approvalCurrent && BigInt(p.funded) >= BigInt(state.requiredFunding) ? "The client's funding covers the current package." : "The client hasn't funded the current version yet."}
          </p>
          <p className="mt-3 text-[13px] text-text-muted">Quotes and payouts are recorded on a public test network, so other people can see amounts and payout accounts.</p>
        </Card>
      </div>
      <div className="flex flex-col gap-6">
        <Card>
          <PaymentPanel state={state} address={signer.address} />
          <p className="mt-4 text-[13px] text-text-muted">Your payout account: <AddressLink chainId={state.chainId} address={signer.address} /></p>
        </Card>
        <Card><h2 className="mb-3 text-lg font-semibold">History</h2><History state={state} versions={detail.versions} /></Card>
      </div>
      <Sheet isOpen={declineOpen} onOpenChange={setDeclineOpen} title="Decline this booking?">
        <p className="text-[15px]">The agency is told you declined and can replace you. You won&apos;t earn the hold fee. This can&apos;t be undone for this version of the terms.</p>
        <div className="flex flex-wrap justify-end gap-3">
          <Button intent="secondary" onPress={() => setDeclineOpen(false)}>Go back</Button>
          <Button
            intent="danger"
            onPress={() => {
              setDeclineOpen(false);
              void act.run("Decline", (step) => decline(signer, state, i, step), "Decline recorded onchain.");
            }}
          >
            Decline
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
