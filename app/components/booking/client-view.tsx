"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/components/app/session";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/dialog";
import { Checkbox, Switch } from "@/components/ui/field";
import { Card, Notice } from "@/components/ui/status";
import { account, amountDue, clientAction, expireNow, faucet, fund, InsufficientBalance } from "@/lib/client/actions";
import { friendly } from "@/lib/client/errors";
import { dateTime } from "@/lib/client/time";
import { usdg } from "@/lib/money";
import { chainNow, fundingCurrent, requiredProgress } from "@/lib/status";
import { STATUS, type AccountState, type BookingDetail, type PackageState } from "@/lib/types";
import { Amount, Deadlines, History, MoneyBreakdown, PaymentPanel } from "./parts";
import { ChangeSummary, RecoveringNotice, ResultNotice, SupplierList, TermsText } from "./shared";
import { useAction } from "./use-action";

export function ClientView({ detail, state, refresh }: { detail: BookingDetail; state: PackageState; refresh: () => Promise<void> }) {
  const { signer } = useSession();
  const act = useAction(`${state.chainId}:${state.packageId}:client`, refresh);
  const [acc, setAcc] = useState<AccountState | null>(null);
  const [approved, setApproved] = useState(false);
  const [autoConfirm, setAutoConfirm] = useState(true);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [faucetMsg, setFaucetMsg] = useState<string | null>(null);
  const p = state.pkg;
  const now = chainNow(state);
  const due = amountDue(state);
  const funded = fundingCurrent(state);
  const { accepted, total } = requiredProgress(state);
  const disabled = !!act.busy || !!act.recovering;

  useEffect(() => {
    account(state.chainId, signer.address).then(setAcc, () => setAcc(null));
  }, [state.chainId, signer.address, state.pkg.funded]);

  useEffect(() => setAutoConfirm(p.autoConfirm || BigInt(p.funded) === BigInt(0)), [p.autoConfirm, p.funded]);

  const wrongAccount = p.client.toLowerCase() !== signer.address.toLowerCase();
  const short = acc && due > BigInt(0) ? BigInt(acc.usdg) < due : false;
  const deadlinePassed = p.status === STATUS.Open && (now > p.confirmDeadline || (now > p.acceptDeadline && accepted < total));

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="flex flex-col gap-6">
        <RecoveringNotice op={act.recovering} />
        <ResultNotice result={act.result} chainId={state.chainId} />
        {wrongAccount && (
          <Notice tone="bad" title="This booking names a different client account">
            The agency set up this booking for another payout account. Ask them to check the client email, or sign in with the email they used.
          </Notice>
        )}
        <ChangeSummary state={state} versions={detail.versions} />

        {p.status === STATUS.Open && !funded && !wrongAccount && (
          <Card>
            <h2 className="text-lg font-semibold">{BigInt(p.funded) > BigInt(0) ? "Approve the current version" : "Review and fund"}</h2>
            <p className="mt-1 text-[15px] text-text-muted">
              You approve this exact package: the named suppliers and payout accounts, every amount, the event date and the terms. Any later change asks you again.
            </p>
            <div className="mt-4 flex items-baseline justify-between gap-4 rounded-md bg-surface-muted p-4">
              <span className="text-[15px]">{due > BigInt(0) ? "You send now" : "Already covered by your earlier funding"}</span>
              <Amount value={due} strong className="text-xl" />
            </div>
            {acc && (
              <p className="mt-2 text-[13px] text-text-muted">
                Your payout account holds {usdg(acc.usdg)} (test USDG). No network fee: Setlo relays your signed approval.
              </p>
            )}
            {short && (
              <Notice
                tone="waiting"
                className="mt-3"
                title="Not enough test USDG"
                action={
                  due <= BigInt(500_000) ? (
                    <Button
                      intent="secondary"
                      size="sm"
                      onPress={async () => {
                        setFaucetMsg(null);
                        try {
                          await faucet(state.chainId, signer.address, "usdg", due);
                          setAcc(await account(state.chainId, signer.address));
                        } catch (e) {
                          setFaucetMsg(friendly(e));
                        }
                      }}
                    >
                      Get test USDG
                    </Button>
                  ) : undefined
                }
              >
                You need {usdg(due)} and have {usdg(acc?.usdg ?? "0")}.{" "}
                {due > BigInt(500_000) ? "The test faucet sends at most 0.50 USDG; ask the agency for a smaller test package." : "Setlo can send you a small amount of test USDG."}
                {faucetMsg && <span className="block text-bad">{faucetMsg}</span>}
              </Notice>
            )}
            <div className="mt-4 flex flex-col gap-1">
              <Switch isSelected={autoConfirm} onChange={setAutoConfirm}>
                Confirm automatically when every required supplier accepts
              </Switch>
              <p className="pl-[52px] text-[13px] text-text-muted">
                {autoConfirm ? "Deposits are credited the moment the last required supplier accepts." : "You'll confirm the booking yourself once everyone has accepted."}
              </p>
              <Checkbox isSelected={approved} onChange={setApproved}>
                I&apos;ve reviewed the named suppliers, their payout accounts and every amount. I understand their business identity isn&apos;t verified by Setlo.
              </Checkbox>
            </div>
            <Button
              className="mt-4"
              full
              size="lg"
              isDisabled={!approved || short || disabled}
              pending={act.busy === "Fund"}
              onPress={() =>
                act.run(
                  "Fund",
                  async () => {
                    try {
                      return await fund(signer, state, autoConfirm);
                    } catch (e) {
                      if (e instanceof InsufficientBalance) throw new Error(`You need ${usdg(e.needed)} and have ${usdg(e.available)}.`);
                      throw e;
                    }
                  },
                  "Funding approved onchain. Your USDG is now held by the Setlo contract for this package.",
                )
              }
            >
              {due > BigInt(0) ? `Approve and send ${usdg(due)}` : "Approve current version"}
            </Button>
            <p className="mt-2 text-[13px] text-text-muted">
              If the booking doesn&apos;t complete by {dateTime(p.confirmDeadline)}, everything except earned hold fees is credited back to you.
            </p>
          </Card>
        )}

        {p.status === STATUS.Open && funded && state.ready && !p.autoConfirm && (
          <Card>
            <h2 className="text-lg font-semibold">Everyone accepted</h2>
            <p className="mt-1 text-[15px] text-text-muted">Confirming credits every deposit and the agency fee for payout. Balances stay held until after the event.</p>
            <Button className="mt-4" full size="lg" isDisabled={disabled} pending={act.busy === "Confirm"} onPress={() => act.run("Confirm", () => clientAction(signer, state, "Confirm"), "Booking confirmed onchain.")}>
              Confirm booking
            </Button>
          </Card>
        )}

        {p.status === STATUS.Confirmed && (
          <Card>
            <h2 className="text-lg font-semibold">{now >= p.eventDate ? "Release supplier balances" : "Booking confirmed"}</h2>
            <p className="mt-1 text-[15px] text-text-muted">
              {now >= p.eventDate
                ? `Release the balances once you're satisfied. If you don't, they release automatically after ${dateTime(p.eventDate + p.reviewWindow)}. There's no dispute process in this version.`
                : "Balances are held until after the event. You can release them early, or cancel before the event date."}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button isDisabled={disabled} pending={act.busy === "Release"} onPress={() => act.run("Release", () => clientAction(signer, state, "Release"), "Balances released onchain and credited to suppliers for payout.")}>
                Release balances
              </Button>
              {now < p.eventDate && (
                <Button intent="danger" isDisabled={disabled} onPress={() => setCancelOpen(true)}>
                  Cancel booking
                </Button>
              )}
            </div>
          </Card>
        )}

        {deadlinePassed && (
          <Card>
            <h2 className="text-lg font-semibold">The deadline has passed</h2>
            <p className="mt-1 text-[15px] text-text-muted">Setlo submits the expiry automatically while this page is open. If it hasn&apos;t updated, submit it yourself.</p>
            <Button className="mt-4" intent="secondary" isDisabled={disabled} pending={act.busy === "Expire"} onPress={() => act.run("Expire", () => expireNow(state.chainId, state.packageId), "Expiry submitted onchain. Your refund is credited for payout.")}>
              Expire and refund now
            </Button>
          </Card>
        )}

        <Card>
          <h2 className="text-lg font-semibold">Suppliers</h2>
          <p className="mt-1 text-[15px] text-text-muted">{accepted} of {total} required suppliers have accepted the current terms.</p>
          <div className="mt-4"><SupplierList state={state} meta={detail.meta} /></div>
        </Card>
        <Card>
          <h2 className="text-lg font-semibold">Shared terms</h2>
          <div className="mt-2"><TermsText text={detail.meta.sharedTermsText} /></div>
        </Card>
      </div>
      <div className="flex flex-col gap-6">
        <Card><h2 className="mb-2 text-lg font-semibold">Money</h2><MoneyBreakdown state={state} meta={detail.meta} /></Card>
        <Card><PaymentPanel state={state} address={signer.address} title="Refunds and payouts to you" /></Card>
        <Card><h2 className="mb-2 text-lg font-semibold">Dates</h2><Deadlines state={state} /></Card>
        <Card><h2 className="mb-3 text-lg font-semibold">History</h2><History state={state} versions={detail.versions} /></Card>
      </div>

      <Sheet isOpen={cancelOpen} onOpenChange={setCancelOpen} title="Cancel this booking?">
        <p className="text-[15px]">
          Deposits, paid holds and the agency fee already credited stay with the suppliers and agency. The supplier balances still held are credited back to you.
        </p>
        <div className="flex flex-wrap justify-end gap-3">
          <Button intent="secondary" onPress={() => setCancelOpen(false)}>Keep booking</Button>
          <Button
            intent="danger"
            onPress={() => {
              setCancelOpen(false);
              void act.run("Cancel", () => clientAction(signer, state, "Cancel"), "Booking cancelled onchain. Remaining balances are credited back to you.");
            }}
          >
            Cancel booking
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
