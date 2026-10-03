"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { Footer, Logo, NetworkBadge } from "@/components/app/shell";
import { AddressLink, Deadlines, History, MoneyBreakdown, PaymentPanel, StaleBanner } from "@/components/booking/parts";
import { RecoveringNotice, ResultNotice, SupplierList } from "@/components/booking/shared";
import { useAction } from "@/components/booking/use-action";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Select, Switch } from "@/components/ui/field";
import { Card, Notice, Skeleton, StatusPill, Steps } from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";
import { CHAINS } from "@/lib/chains";
import { accept, amountDue, clientAction, createPackage, decline, expireNow, faucet, fund, type OnStep } from "@/lib/client/actions";
import { friendly } from "@/lib/client/errors";
import { useChainState } from "@/lib/client/hooks";
import { keySigner, type Signer } from "@/lib/client/signer";
import { duration } from "@/lib/client/time";
import { usdg } from "@/lib/money";
import { chainNow, nextStep, packageStatus, slotStatus } from "@/lib/status";
import { termsHash } from "@/lib/terms";
import { STATUS, type PackageMeta, type PackageState, type Role } from "@/lib/types";

/**
 * A real package on a test network. Four throwaway accounts live in this browser; the agency pays its
 * own test-ETH fee from the faucet and the client is funded with a little test USDG.
 */
type DemoRole = "agency" | "client" | "venue" | "catering";
type Stored = { keys: Record<DemoRole, Hex>; chainId: number; packageId: string | null };
const KEY = "setlo:demo:v1";
const ROLES: { id: DemoRole; label: string }[] = [
  { id: "client", label: "Client" },
  { id: "venue", label: "Venue" },
  { id: "catering", label: "Catering" },
  { id: "agency", label: "Agency" },
];
const SETUP_STEPS = ["Send the agency test ETH for its network fee", "Create the package onchain", "Send the demo client test USDG"];
const SHARED = "Demo booking: 80-guest evening side event. Test network, test USDG only.";
const SLOTS = [
  { name: "Harbour Loft (demo venue)", category: "venue" as const, deposit: BigInt(100_000), holdFee: BigInt(20_000), balance: BigInt(50_000), terms: "Venue hire 18:00–23:00, setup from 16:00." },
  { name: "Mesa Kitchen (demo catering)", category: "catering" as const, deposit: BigInt(80_000), holdFee: BigInt(10_000), balance: BigInt(40_000), terms: "Standing dinner for 80 guests, two staff." },
];
const AGENCY_FEE = BigInt(10_000);
const TOTAL = SLOTS.reduce((a, s) => a + s.deposit + s.balance, AGENCY_FEE);

function isKey(v: unknown): v is Hex {
  if (typeof v !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(v)) return false;
  try {
    privateKeyToAccount(v as Hex);
    return true;
  } catch {
    return false;
  }
}

function parseStored(raw: string): Stored | null {
  try {
    const v: unknown = JSON.parse(raw);
    if (!v || typeof v !== "object") return null;
    const o = v as { keys?: Record<string, unknown>; chainId?: unknown; packageId?: unknown };
    const k = o.keys;
    if (!k || !ROLES.every((r) => isKey(k[r.id]))) return null;
    if (typeof o.chainId !== "number" || !Object.values(CHAINS).some((c) => c.chain.id === o.chainId)) return null;
    if (o.packageId !== null && !(typeof o.packageId === "string" && /^\d+$/.test(o.packageId))) return null;
    return { keys: { agency: k.agency as Hex, client: k.client as Hex, venue: k.venue as Hex, catering: k.catering as Hex }, chainId: o.chainId, packageId: o.packageId };
  } catch {
    return null;
  }
}

function load(): Stored {
  const raw = typeof window !== "undefined" ? localStorage.getItem(KEY) : null;
  const parsed = raw ? parseStored(raw) : null;
  if (parsed) return parsed;
  const keys = { agency: generatePrivateKey(), client: generatePrivateKey(), venue: generatePrivateKey(), catering: generatePrivateKey() };
  return { keys, chainId: 421614, packageId: null };
}

function metaFor(s: Stored, signers: Record<DemoRole, Signer>): PackageMeta {
  return {
    ref: "demo",
    chainId: s.chainId,
    packageId: s.packageId ?? "0",
    title: "Demo side event",
    sharedTermsText: SHARED,
    clientEmail: null,
    slots: SLOTS.map((x, index) => ({ index, name: x.name, email: null, category: x.category, termsText: x.terms, payoutAddress: signers[index === 0 ? "venue" : "catering"].address })),
  };
}

export function Demo() {
  const toast = useToast();
  const [stored, setStored] = useState<Stored | null>(null);
  const [role, setRole] = useState<DemoRole>("client");
  const [phase, setPhase] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setStored(load()), []);
  const save = (s: Stored) => {
    localStorage.setItem(KEY, JSON.stringify(s));
    setStored(s);
  };
  const signers = useMemo(
    () => (stored ? (Object.fromEntries(Object.entries(stored.keys).map(([k, v]) => [k, keySigner(v)])) as Record<DemoRole, Signer>) : null),
    [stored],
  );
  const chain = useChainState(stored?.packageId ? stored.chainId : null, stored?.packageId ?? null);

  async function start() {
    if (!stored || !signers) return;
    setError(null);
    setFailed(false);
    try {
      const { chainId } = stored;
      let packageId = stored.packageId;
      if (!packageId) {
        setPhase(0);
        await faucet(chainId, signers.agency.address, "gas");
        setPhase(1);
        const now = Math.floor(Date.now() / 1000);
        const c = await createPackage(
          signers.agency,
          chainId,
          {
            client: signers.client.address,
            acceptDeadline: BigInt(now + 6 * 60),
            confirmDeadline: BigInt(now + 7 * 60),
            finalExpiry: BigInt(now + 8 * 60),
            eventDate: BigInt(now + 9 * 60),
            reviewWindow: BigInt(120),
            minResponseWindow: BigInt(60),
            agencyFee: AGENCY_FEE,
            holdFeeCap: BigInt(50_000),
            sharedTermsHash: termsHash(SHARED),
          },
          SLOTS.map((x, i) => ({ payee: signers[i === 0 ? "venue" : "catering"].address, required: true, deposit: x.deposit, holdFee: x.holdFee, balance: x.balance, termsHash: termsHash(x.terms) })),
        );
        packageId = c.packageId;
        save({ ...stored, packageId });
      }
      setPhase(2);
      await faucet(chainId, signers.client.address, "usdg", TOTAL);
      setRole("client");
      setPhase(null);
      toast({ tone: "ok", title: "Demo package ready", body: "You're viewing it as the client. Fund it to start." });
    } catch (e) {
      setError(friendly(e));
      setFailed(true);
    }
  }

  function reset(chainId = stored?.chainId ?? 421614) {
    localStorage.removeItem(KEY);
    const s = load();
    save({ ...s, chainId });
  }

  const s = chain.state;
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" aria-label="Setlo home"><Logo /></Link>
          <Link href="/signin" className="inline-flex min-h-11 items-center rounded-md px-3 text-[15px] hover:bg-surface-muted">Sign in</Link>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
        <div>
          <h1 className="font-display text-4xl sm:text-5xl">Try a booking</h1>
          <p className="mt-2 max-w-2xl text-[15px] text-text-muted">
            A real package on a test network with two suppliers and a 6-minute acceptance deadline. Switch roles to fund, accept or decline, and watch deposits release or the refund arrive. Test USDG has no value; the demo accounts live only in this browser.
          </p>
        </div>
        {!stored || !signers ? (
          <Skeleton className="h-56 max-w-xl" />
        ) : !stored.packageId || phase !== null ? (
          <Card className="flex max-w-xl flex-col gap-4">
            <Select
              label="Test network"
              value={String(stored.chainId)}
              onChange={(v) => !stored.packageId && phase === null && save({ ...stored, chainId: Number(v) })}
              options={Object.values(CHAINS).map((c) => ({ id: String(c.chain.id), label: c.chain.name }))}
            />
            <p className="text-[15px]">The client funds {usdg(TOTAL)}: two supplier deposits and balances plus a {usdg(AGENCY_FEE)} agency fee.</p>
            {phase !== null && <Steps steps={SETUP_STEPS} current={phase} failed={failed} />}
            {error && <Notice tone="bad" title="Couldn't start the demo">{error} Trying again picks up where it stopped.</Notice>}
            <Button size="lg" pending={phase !== null && !failed} onPress={() => void start()}>
              {failed ? "Try again" : "Start a fresh demo package"}
            </Button>
          </Card>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <NetworkBadge chainId={stored.chainId} />
                <span className="text-[13px] text-text-muted">Package #{stored.packageId}</span>
              </div>
              <Button intent="ghost" size="sm" onPress={() => reset()}>Start over with a new package</Button>
            </div>
            <div role="tablist" aria-label="View as" className="flex flex-wrap gap-2">
              {ROLES.map((r) => (
                <button
                  key={r.id}
                  role="tab"
                  aria-selected={role === r.id}
                  onClick={() => setRole(r.id)}
                  className={cn("min-h-11 rounded-full border px-4 text-[15px]", role === r.id ? "border-brand bg-brand text-brand-contrast" : "border-border bg-surface hover:border-brand")}
                >
                  {r.label}
                </button>
              ))}
            </div>
            {error && <Notice tone="bad">{error}</Notice>}
            <StaleBanner stale={chain.stale} error={chain.error} onRetry={() => void chain.refresh()} />
            {chain.checking && <Notice tone="waiting">A deadline has passed. Checking the chain and submitting the due action…</Notice>}
            {!s ? (
              <Notice tone="waiting">Reading the package from the chain…</Notice>
            ) : (
              <DemoRoleView key={role} role={role} state={s} signers={signers} meta={metaFor(stored, signers)} refresh={chain.refresh} topUp={() => faucet(stored.chainId, signers.client.address, "usdg", TOTAL)} />
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}

function DemoRoleView({
  role,
  state,
  signers,
  meta,
  refresh,
  topUp,
}: {
  role: DemoRole;
  state: PackageState;
  signers: Record<DemoRole, Signer>;
  meta: PackageMeta;
  refresh: () => Promise<void>;
  topUp: () => Promise<unknown>;
}) {
  const act = useAction(`demo:${state.chainId}:${state.packageId}:${role}`, refresh);
  const [autoConfirm, setAutoConfirm] = useState(true);
  const p = state.pkg;
  const now = chainNow(state);
  const st = packageStatus(state);
  const slotIndex = role === "venue" ? 0 : role === "catering" ? 1 : null;
  const appRole: Role = role === "agency" || role === "client" ? role : "supplier";
  const next = nextStep(state, appRole, slotIndex);
  const signer = signers[role];
  const disabled = !!act.busy || !!act.recovering;
  const run = useCallback((label: string, fn: (step: OnStep) => ReturnType<typeof fund>, ok: string) => void act.run(label, fn, ok), [act]);
  const deadlinePassed = p.status === STATUS.Open && (now > p.confirmDeadline || (now > p.acceptDeadline && state.slots.some((x) => x.required && !x.accepted)));

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="flex flex-col gap-6">
        <Card>
          <StatusPill tone={st.tone}>{st.label}</StatusPill>
          <p className="mt-2 text-[15px] text-text-muted">{st.detail}</p>
          <Notice tone={next.tone} className="mt-4" title="Next step for this role">{next.text}</Notice>
          {p.status === STATUS.Open && now < p.acceptDeadline && <p className="mt-3 text-[13px] text-text-muted">Acceptance closes in {duration(p.acceptDeadline - now)}.</p>}
          <div className="mt-4 flex flex-col gap-3"><RecoveringNotice op={act.recovering} /><ResultNotice result={act.result} progress={act.progress} chainId={state.chainId} onDismiss={() => act.setResult(null)} /></div>

          <div className="mt-4 flex flex-col gap-3">
            {role === "client" && p.status === STATUS.Open && amountDue(state) > BigInt(0) && (
              <>
                <Switch isSelected={autoConfirm} onChange={setAutoConfirm}>Confirm automatically when every required supplier accepts</Switch>
                <Button size="lg" isDisabled={disabled} pending={act.busy === "Fund"} onPress={() => run("Fund", async (step) => { step("Sending the demo client test USDG…"); await topUp(); return fund(signer, state, autoConfirm, step); }, "Funding approved onchain.")}>
                  Approve and send {usdg(amountDue(state))}
                </Button>
              </>
            )}
            {role === "client" && p.status === STATUS.Open && state.ready && !p.autoConfirm && (
              <Button size="lg" isDisabled={disabled} pending={act.busy === "Confirm"} onPress={() => run("Confirm", (step) => clientAction(signer, state, "Confirm", step), "Booking confirmed onchain.")}>Confirm booking</Button>
            )}
            {role === "client" && p.status === STATUS.Confirmed && (
              <div className="flex flex-wrap gap-3">
                <Button isDisabled={disabled} pending={act.busy === "Release"} onPress={() => run("Release", (step) => clientAction(signer, state, "Release", step), "Balances released onchain.")}>Release balances</Button>
                {now < p.eventDate && <Button intent="danger" isDisabled={disabled} pending={act.busy === "Cancel"} onPress={() => run("Cancel", (step) => clientAction(signer, state, "Cancel", step), "Booking cancelled onchain.")}>Cancel booking</Button>}
              </div>
            )}
            {slotIndex !== null && p.status === STATUS.Open && !state.slots[slotIndex].accepted && !state.slots[slotIndex].declined && now <= p.acceptDeadline && (
              <div className="flex flex-wrap gap-3">
                <Button size="lg" isDisabled={disabled} pending={act.busy === "Accept"} onPress={() => run("Accept", (step) => accept(signer, state, slotIndex, step), "Acceptance recorded onchain.")}>Accept terms</Button>
                <Button size="lg" intent="secondary" isDisabled={disabled} pending={act.busy === "Decline"} onPress={() => run("Decline", (step) => decline(signer, state, slotIndex, step), "Decline recorded onchain.")}>Decline</Button>
              </div>
            )}
            {deadlinePassed && (
              <Button intent="secondary" isDisabled={disabled} pending={act.busy === "Expire"} onPress={() => run("Expire", (step) => expireNow(state.chainId, state.packageId, step), "Expiry submitted onchain.")}>Expire and refund now</Button>
            )}
          </div>
        </Card>
        {slotIndex !== null ? (
          <Card>
            <p className="font-semibold">{meta.slots[slotIndex].name}</p>
            <p className="mt-1 text-[13px] text-text-muted">{slotStatus(state, state.slots[slotIndex]).label}</p>
            <p className="mt-3 text-[15px]">{meta.slots[slotIndex].termsText}</p>
            <p className="mt-2 text-[15px]">Deposit {usdg(state.slots[slotIndex].deposit)} (of which paid hold {usdg(state.slots[slotIndex].holdFee)}) · balance {usdg(state.slots[slotIndex].balance)}</p>
          </Card>
        ) : (
          <Card><h2 className="mb-3 text-lg font-semibold">Suppliers</h2><SupplierList state={state} meta={meta} /></Card>
        )}
      </div>
      <div className="flex flex-col gap-6">
        <Card>
          <PaymentPanel state={state} address={signer.address} title={`Payments to the ${role}`} />
          <p className="mt-3 text-[13px] text-text-muted">Demo {role} account <AddressLink chainId={state.chainId} address={signer.address} /></p>
        </Card>
        {role !== "venue" && role !== "catering" && <Card><h2 className="mb-2 text-lg font-semibold">Money</h2><MoneyBreakdown state={state} meta={meta} /></Card>}
        <Card><h2 className="mb-2 text-lg font-semibold">Dates</h2><Deadlines state={state} /></Card>
        <Card><h2 className="mb-3 text-lg font-semibold">History</h2><History state={state} versions={[]} /></Card>
      </div>
    </div>
  );
}
