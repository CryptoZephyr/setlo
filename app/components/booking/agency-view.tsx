"use client";

import { useCallback, useEffect, useState } from "react";
import { getAddress, type Address } from "viem";
import { useSession } from "@/components/app/session";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/dialog";
import { DateTimeField, MoneyField, Select, TextArea, TextField } from "@/components/ui/field";
import { Card, Notice, StatusPill } from "@/components/ui/status";
import { account, expireNow, faucet, replaceSupplier, updateQuote, updateSharedTerms } from "@/lib/client/actions";
import { friendly } from "@/lib/client/errors";
import { parseUsdg, usdgInput } from "@/lib/money";
import { chainNow, requiredProgress } from "@/lib/status";
import { termsHash } from "@/lib/terms";
import { CATEGORIES, STATUS, type AccountState, type BookingDetail, type Category, type PackageState, type Readiness } from "@/lib/types";
import { Deadlines, History, MoneyBreakdown, PaymentPanel } from "./parts";
import { CopyButton } from "./parts";
import { RecoveringNotice, ResultNotice, SupplierList, TermsText } from "./shared";
import { useAction } from "./use-action";

type Edit = { kind: "quote" | "replace"; slot: number } | { kind: "shared" } | null;

const MIN_GAS = BigInt(30_000_000_000_000); // 0.00003 ETH covers one agency transaction on these testnets

export function AgencyView({ detail, state, refresh }: { detail: BookingDetail; state: PackageState; refresh: () => Promise<void> }) {
  const { signer } = useSession();
  const act = useAction(`${state.chainId}:${state.packageId}:agency`, refresh);
  const [edit, setEdit] = useState<Edit>(null);
  const [acc, setAcc] = useState<AccountState | null>(null);
  const [gasMsg, setGasMsg] = useState<string | null>(null);
  const p = state.pkg;
  const now = chainNow(state);
  const open = p.status === STATUS.Open;
  const { accepted, total } = requiredProgress(state);
  const disabled = !!act.busy || !!act.recovering;
  const lowGas = acc ? BigInt(acc.eth) < MIN_GAS : false;

  useEffect(() => {
    account(state.chainId, signer.address).then(setAcc, () => setAcc(null));
  }, [state.chainId, signer.address, act.result]);

  const deadlinePassed = open && (now > p.confirmDeadline || (now > p.acceptDeadline && accepted < total));

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="flex flex-col gap-6">
        <RecoveringNotice op={act.recovering} />
        <ResultNotice result={act.result} chainId={state.chainId} />
        {open && lowGas && (
          <Notice
            tone="waiting"
            title="Your account needs test ETH to change this package"
            action={
              <Button
                intent="secondary"
                size="sm"
                onPress={async () => {
                  setGasMsg(null);
                  try {
                    await faucet(state.chainId, signer.address, "gas");
                    setAcc(await account(state.chainId, signer.address));
                  } catch (e) {
                    setGasMsg(friendly(e));
                  }
                }}
              >
                Get test ETH
              </Button>
            }
          >
            Agency changes are sent from your own account and need a small network fee. Clients and suppliers don&apos;t pay fees.
            {gasMsg && <span className="block text-bad">{gasMsg}</span>}
          </Notice>
        )}

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Invitations</h2>
            <span className="text-[13px] text-text-muted">Share links directly; email can land in spam.</span>
          </div>
          <ul className="mt-4 flex flex-col divide-y divide-border">
            {detail.invites.filter((i) => i.status !== "revoked").map((i) => (
              <li key={i.link} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-medium">{i.role === "client" ? "Client" : (detail.meta.slots[i.slotIndex ?? 0]?.name ?? "Supplier")}</p>
                  <p className="truncate text-[13px] text-text-muted">{i.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill tone={i.status === "opened" ? "ok" : "neutral"}>{i.status === "opened" ? "Opened" : "Not opened yet"}</StatusPill>
                  <CopyButton text={i.link} label="Copy link" />
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Suppliers</h2>
            <span className="text-[15px] text-text-muted">{accepted} of {total} required accepted</span>
          </div>
          <div className="mt-4"><SupplierList state={state} meta={detail.meta} showEmails /></div>
          {open && (
            <div className="mt-4 flex flex-col gap-3">
              <p className="text-[13px] text-text-muted">
                Changing a supplier&apos;s amounts or terms asks that supplier and the client to approve again. Replacing a supplier who already accepted lets them keep their paid hold, which counts toward the client&apos;s cap.
              </p>
              <div className="flex flex-wrap gap-2">
                {state.slots.map((_, i) => (
                  <span key={i} className="flex gap-2">
                    <Button intent="secondary" size="sm" isDisabled={disabled || lowGas} onPress={() => setEdit({ kind: "quote", slot: i })}>Edit slot {i + 1}</Button>
                    <Button intent="ghost" size="sm" isDisabled={disabled || lowGas} onPress={() => setEdit({ kind: "replace", slot: i })}>Replace slot {i + 1}</Button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Shared terms</h2>
            {open && <Button intent="secondary" size="sm" isDisabled={disabled || lowGas} onPress={() => setEdit({ kind: "shared" })}>Change date or terms</Button>}
          </div>
          <div className="mt-2"><TermsText text={detail.meta.sharedTermsText} /></div>
          {open && <p className="mt-3 text-[13px] text-text-muted">Changing the date or shared terms asks every supplier and the client to approve again.</p>}
        </Card>

        {deadlinePassed && (
          <Card>
            <h2 className="text-lg font-semibold">The deadline has passed</h2>
            <p className="mt-1 text-[15px] text-text-muted">Expiry is submitted automatically while someone has this booking open. You can submit it now.</p>
            <Button className="mt-4" intent="secondary" isDisabled={disabled} pending={act.busy === "Expire"} onPress={() => act.run("Expire", () => expireNow(state.chainId, state.packageId), "Expiry submitted onchain.")}>
              Expire now
            </Button>
          </Card>
        )}
      </div>
      <div className="flex flex-col gap-6">
        <Card><h2 className="mb-2 text-lg font-semibold">Money</h2><MoneyBreakdown state={state} meta={detail.meta} /></Card>
        <Card><PaymentPanel state={state} address={signer.address} title="Agency fee payout" /></Card>
        <Card><h2 className="mb-2 text-lg font-semibold">Dates</h2><Deadlines state={state} /></Card>
        <Card><h2 className="mb-3 text-lg font-semibold">History</h2><History state={state} versions={detail.versions} /></Card>
      </div>
      {edit && (
        <EditSheet
          edit={edit}
          detail={detail}
          state={state}
          onClose={() => setEdit(null)}
          run={(label, fn, ok) => {
            setEdit(null);
            void act.run(label, fn, ok);
          }}
        />
      )}
    </div>
  );
}

function EditSheet({
  edit,
  detail,
  state,
  onClose,
  run,
}: {
  edit: NonNullable<Edit>;
  detail: BookingDetail;
  state: PackageState;
  onClose: () => void;
  run: (label: string, fn: () => Promise<{ hash: string }>, ok: string) => void;
}) {
  const { signer, api } = useSession();
  const ref = detail.meta.ref;
  const slot = edit.kind === "shared" ? null : state.slots[edit.slot];
  const meta = edit.kind === "shared" ? null : detail.meta.slots[edit.slot];
  const [deposit, setDeposit] = useState(slot ? usdgInput(slot.deposit) : "");
  const [hold, setHold] = useState(slot ? usdgInput(slot.holdFee) : "");
  const [balance, setBalance] = useState(slot ? usdgInput(slot.balance) : "");
  const [terms, setTerms] = useState(edit.kind === "shared" ? detail.meta.sharedTermsText : edit.kind === "quote" ? (meta?.termsText ?? "") : "");
  const [eventDate, setEventDate] = useState<number | null>(state.pkg.eventDate);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState<Category>(meta?.category ?? "other");
  const [setup, setSetup] = useState<Readiness | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const checkSetup = useCallback(async () => {
    if (!setup) return;
    const r = await api<{ readiness: Readiness[] }>(`/api/bookings/${ref}/setup-invites`);
    const mine = r.readiness.find((x) => x.key === setup.key);
    if (mine) setSetup(mine);
  }, [api, ref, setup]);
  useEffect(() => {
    if (!setup || setup.wallet) return;
    const t = setInterval(() => void checkSetup().catch(() => undefined), 5000);
    return () => clearInterval(t);
  }, [setup, checkSetup]);

  const amounts = () => {
    const d = parseUsdg(deposit), h = parseUsdg(hold), b = parseUsdg(balance);
    if (d === null || h === null || b === null) throw new Error("Enter every amount in USDG, up to 6 decimals.");
    if (h > d) throw new Error("The paid hold is part of the deposit, so it can't be larger than the deposit.");
    if (d + b === BigInt(0)) throw new Error("A supplier needs a deposit or a balance.");
    return { deposit: d, holdFee: h, balance: b, termsHash: termsHash(terms) };
  };

  function submit() {
    setError(null);
    try {
      const { chainId, packageId } = state;
      if (edit.kind === "shared") {
        if (!eventDate) throw new Error("Choose the event date.");
        if (eventDate < state.pkg.finalExpiry) throw new Error("The event can't be before the booking's final expiry.");
        const text = terms;
        run(
          "Change shared terms",
          async () => {
            const r = await updateSharedTerms(signer, chainId, packageId, BigInt(eventDate), termsHash(text));
            await api(`/api/bookings/${ref}/changes`, { method: "POST", body: { kind: "shared", sharedTermsText: text } });
            return r;
          },
          "Shared terms changed onchain. Every supplier and the client must approve again.",
        );
      } else if (edit.kind === "quote") {
        const a = amounts();
        const i = edit.slot, text = terms;
        run(
          `Edit slot ${i + 1}`,
          async () => {
            const r = await updateQuote(signer, chainId, packageId, i, a);
            await api(`/api/bookings/${ref}/changes`, { method: "POST", body: { kind: "quote", slotIndex: i, termsText: text } });
            return r;
          },
          `Slot ${i + 1} changed onchain. That supplier and the client must approve again.`,
        );
      } else {
        if (!setup?.wallet) throw new Error("Wait for the new supplier to set up their payout account.");
        const a = amounts();
        const payee: Address = getAddress(setup.wallet);
        if (payee.toLowerCase() === state.pkg.client.toLowerCase()) throw new Error("The client's account can't be a supplier.");
        const i = edit.slot, text = terms, n = name, em = email, cat = category;
        run(
          `Replace slot ${i + 1}`,
          async () => {
            const r = await replaceSupplier(signer, chainId, packageId, i, { ...a, payee });
            await api(`/api/bookings/${ref}/changes`, { method: "POST", body: { kind: "replace", slotIndex: i, termsText: text, name: n, email: em, category: cat } });
            return r;
          },
          `Supplier replaced onchain. A new invite was created for ${em}; the client must approve again.`,
        );
      }
    } catch (e) {
      setError(friendly(e));
    }
  }

  const title = edit.kind === "shared" ? "Change date or shared terms" : edit.kind === "quote" ? `Edit slot ${edit.slot + 1}` : `Replace slot ${edit.slot + 1}`;
  return (
    <Sheet isOpen onOpenChange={(o) => !o && onClose()} title={title}>
      {error && <Notice tone="bad">{error}</Notice>}
      {edit.kind === "replace" && (
        <>
          <p className="text-[15px] text-text-muted">
            {slot?.accepted && BigInt(slot.holdFee) > BigInt(0) ? `${meta?.name ?? "The current supplier"} accepted, so they keep their paid hold.` : "The current supplier hasn't accepted the current version, so they don't keep a paid hold."}
          </p>
          <TextField label="Supplier name" value={name} onChange={setName} isRequired />
          <TextField label="Supplier email" type="email" value={email} onChange={setEmail} isRequired />
          <Select label="Category" value={category} onChange={setCategory} options={CATEGORIES} />
          {!setup ? (
            <Button
              intent="secondary"
              pending={busy}
              isDisabled={!name.trim() || !email.includes("@")}
              onPress={async () => {
                setBusy(true);
                setError(null);
                try {
                  setSetup(await api<Readiness>(`/api/bookings/${ref}/setup-invites`, { method: "POST", body: { slotIndex: edit.slot, email: email.trim() } }));
                } catch (e) {
                  setError(friendly(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Invite them to set up a payout account
            </Button>
          ) : setup.wallet ? (
            <Notice tone="ok">Payout account ready for {setup.email}.</Notice>
          ) : (
            <Notice tone="waiting" title="Waiting for the supplier to sign in" action={<CopyButton text={setup.link} label="Copy setup link" />}>
              Send them the setup link. This updates automatically once they sign in.
            </Notice>
          )}
        </>
      )}
      {edit.kind === "shared" ? (
        <>
          <DateTimeField label="Event date" value={eventDate} onChange={setEventDate} description="Must be on or after the final expiry." />
          <TextArea label="Shared terms" value={terms} onChange={setTerms} rows={6} />
        </>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <MoneyField label="Deposit" value={deposit} onChange={setDeposit} />
            <MoneyField label="of which paid hold" value={hold} onChange={setHold} />
            <MoneyField label="Balance" value={balance} onChange={setBalance} />
          </div>
          <TextArea label="Supplier terms" value={terms} onChange={setTerms} rows={5} />
        </>
      )}
      <div className="flex flex-wrap justify-end gap-3">
        <Button intent="secondary" onPress={onClose}>Close</Button>
        <Button onPress={submit} isDisabled={edit.kind === "replace" && !setup?.wallet}>Save change onchain</Button>
      </div>
    </Sheet>
  );
}
