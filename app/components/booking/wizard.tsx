"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getAddress } from "viem";
import { useSession } from "@/components/app/session";
import { PageLoading } from "@/components/app/shell";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Checkbox, DateTimeField, MoneyField, Select, Switch, TextArea, TextField } from "@/components/ui/field";
import { Card, Notice, StatusPill } from "@/components/ui/status";
import { CHAINS } from "@/lib/chains";
import { account, createPackage, faucet } from "@/lib/client/actions";
import { friendly } from "@/lib/client/errors";
import { dateTime } from "@/lib/client/time";
import { parseUsdg, sum, usdg } from "@/lib/money";
import { termsHash } from "@/lib/terms";
import { CATEGORIES, type DraftData, type DraftDetail, type DraftSlot, type Readiness } from "@/lib/types";
import { CopyButton } from "./parts";

const STEPS = ["Basics", "Suppliers", "Money and dates", "Payout accounts", "Review and create"] as const;
const MIN_GAS = BigInt(60_000_000_000_000);

const newSlot = (): DraftSlot => ({
  key: Math.random().toString(36).slice(2, 10),
  name: "",
  email: "",
  category: "venue",
  required: true,
  deposit: "",
  holdFee: "0",
  balance: "0",
  termsText: "",
});

const empty = (): DraftData => ({
  title: "",
  clientEmail: "",
  sharedTermsText: "",
  eventDate: null,
  acceptDeadline: null,
  confirmDeadline: null,
  finalExpiry: null,
  reviewWindowHours: "48",
  minResponseHours: "24",
  agencyFee: "0",
  holdFeeCap: "0",
  slots: [newSlot()],
});

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
const hours = (s: string) => (/^\d+(\.\d+)?$/.test(s.trim()) ? Math.round(Number(s) * 3600) : null);

function validate(d: DraftData, step: number, now: number): string[] {
  const e: string[] = [];
  if (step === 0) {
    if (!d.title.trim()) e.push("Give the package a name.");
    if (!isEmail(d.clientEmail)) e.push("Enter the client's email.");
    if (!d.eventDate) e.push("Choose the event date.");
  }
  if (step === 1) {
    if (!d.slots.some((s) => s.required)) e.push("At least one supplier must be required.");
    const emails = new Set<string>();
    d.slots.forEach((s, i) => {
      const n = `Supplier ${i + 1}`;
      if (!s.name.trim()) e.push(`${n}: add a name.`);
      if (!isEmail(s.email)) e.push(`${n}: enter an email.`);
      else if (s.email.trim().toLowerCase() === d.clientEmail.trim().toLowerCase()) e.push(`${n}: the client can't also be a supplier.`);
      else if (emails.has(s.email.trim().toLowerCase())) e.push(`${n}: each supplier needs their own email.`);
      emails.add(s.email.trim().toLowerCase());
      const dep = parseUsdg(s.deposit), hold = parseUsdg(s.holdFee), bal = parseUsdg(s.balance);
      if (dep === null || hold === null || bal === null) e.push(`${n}: amounts must be USDG with up to 6 decimals.`);
      else {
        if (hold > dep) e.push(`${n}: the paid hold is part of the deposit, so it can't be larger.`);
        if (dep + bal === BigInt(0)) e.push(`${n}: add a deposit or a balance.`);
      }
    });
  }
  if (step === 2) {
    if (parseUsdg(d.agencyFee) === null) e.push("Agency fee must be a USDG amount.");
    const cap = parseUsdg(d.holdFeeCap);
    const holds = sum(d.slots.map((s) => parseUsdg(s.holdFee) ?? BigInt(0)));
    if (cap === null) e.push("Hold-fee cap must be a USDG amount.");
    else if (cap < holds) e.push(`The hold-fee cap must cover the current paid holds (${usdg(holds)}).`);
    const { acceptDeadline: a, confirmDeadline: c, finalExpiry: f, eventDate: ev } = d;
    if (!a || !c || !f || !ev) e.push("Set every deadline.");
    else {
      if (a <= now + 60) e.push("The acceptance deadline must be in the future.");
      if (!(a <= c && c <= f && f <= ev)) e.push("Deadlines must run in order: accept ≤ confirm ≤ final expiry ≤ event.");
    }
    const mr = hours(d.minResponseHours);
    if (!mr || mr <= 0) e.push("Minimum response time must be more than 0 hours.");
    if (hours(d.reviewWindowHours) === null) e.push("Review window must be a number of hours.");
  }
  return e;
}

export function Wizard() {
  const { api, signer } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const [draftId, setDraftId] = useState<string | null>(params.get("draft"));
  const [chainId, setChainId] = useState<number>(421614);
  const [data, setData] = useState<DraftData | null>(params.get("draft") ? null : empty());
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<Readiness[]>([]);

  useEffect(() => {
    const id = params.get("draft");
    if (!id) return;
    api<DraftDetail>(`/api/drafts/${id}`).then(
      (d) => {
        if (d.packageRef) return router.replace(`/b/${d.packageRef}`);
        setData(d.data);
        setChainId(d.chainId);
        setUpdatedAt(d.updatedAt);
        setReadiness(d.readiness);
      },
      (e) => setSaveError(friendly(e)),
    );
  }, [api, params, router]);

  const save = useCallback(async (): Promise<string | null> => {
    if (!data) return null;
    setSaving(true);
    setSaveError(null);
    try {
      if (!draftId) {
        const r = await api<{ id: string; updatedAt: string }>("/api/drafts", { method: "POST", body: { chainId, data } });
        setDraftId(r.id);
        setUpdatedAt(r.updatedAt);
        router.replace(`/app/new?draft=${r.id}`);
        return r.id;
      }
      const r = await api<{ updatedAt: string }>(`/api/drafts/${draftId}`, { method: "PUT", body: { chainId, data, updatedAt } });
      setUpdatedAt(r.updatedAt);
      return draftId;
    } catch (e) {
      setSaveError(friendly(e));
      return null;
    } finally {
      setSaving(false);
    }
  }, [api, chainId, data, draftId, router, updatedAt]);

  if (!data) return saveError ? <Notice tone="bad" title="Couldn't load this draft">{saveError}</Notice> : <PageLoading label="Loading draft" />;
  const set = (patch: Partial<DraftData>) => setData({ ...data, ...patch });
  const setSlot = (i: number, patch: Partial<DraftSlot>) => set({ slots: data.slots.map((s, j) => (j === i ? { ...s, ...patch } : s)) });

  async function next() {
    const e = validate(data!, step, Math.floor(Date.now() / 1000));
    setErrors(e);
    if (e.length) return;
    if (await save()) setStep(step + 1);
  }

  function quickTest() {
    const t = Math.floor(Date.now() / 1000);
    set({
      acceptDeadline: t + 15 * 60,
      confirmDeadline: t + 20 * 60,
      finalExpiry: t + 25 * 60,
      eventDate: Math.max(data!.eventDate ?? 0, t + 30 * 60),
      reviewWindowHours: "0.1",
      minResponseHours: "0.1",
    });
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="font-display text-4xl sm:text-5xl">New package</h1>
        <p className="mt-2 text-[15px] text-text-muted">Drafts save each time you continue. Nothing goes onchain until the last step.</p>
      </div>
      <ol className="flex flex-wrap gap-2" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button
              type="button"
              disabled={i > step}
              onClick={() => setStep(i)}
              aria-current={i === step ? "step" : undefined}
              className={cn(
                "min-h-11 rounded-full border px-3 text-sm",
                i === step ? "border-brand bg-brand-soft font-medium text-brand" : i < step ? "border-border bg-surface" : "border-border bg-surface text-text-muted opacity-60",
              )}
            >
              {i + 1}. {s}
            </button>
          </li>
        ))}
      </ol>
      {errors.length > 0 && (
        <Notice tone="bad" title="Fix these to continue">
          <ul className="list-disc pl-5">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
        </Notice>
      )}
      {saveError && <Notice tone="bad" title="Draft not saved">{saveError}</Notice>}

      {step === 0 && (
        <Card className="flex flex-col gap-4">
          <TextField label="Package name" value={data.title} onChange={(v) => set({ title: v })} placeholder="ETH Lisbon side event, 12 Nov" isRequired />
          <Select
            label="Test network"
            value={String(chainId)}
            onChange={(v) => setChainId(Number(v))}
            options={Object.values(CHAINS).map((c) => ({ id: String(c.chain.id), label: c.chain.name }))}
            description="Both use test USDG with no value."
          />
          <TextField label="Client email" type="email" value={data.clientEmail} onChange={(v) => set({ clientEmail: v })} description="The client funds the package and approves every change." isRequired />
          <DateTimeField label="Event date" value={data.eventDate} onChange={(v) => set({ eventDate: v })} />
          <TextArea label="Shared terms" value={data.sharedTermsText} onChange={(v) => set({ sharedTermsText: v })} rows={6} placeholder="Guest count, location, cancellation terms that apply to every supplier" description="Every supplier accepts these exact words. A change asks everyone again." />
        </Card>
      )}

      {step === 1 && (
        <div className="flex flex-col gap-4">
          {data.slots.map((s, i) => (
            <Card key={s.key} className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold">Supplier {i + 1}</h2>
                {data.slots.length > 1 && (
                  <Button intent="ghost" size="sm" onPress={() => set({ slots: data.slots.filter((_, j) => j !== i) })} aria-label={`Remove supplier ${i + 1}`}>
                    <Trash2 className="size-4" aria-hidden /> Remove
                  </Button>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Business name" value={s.name} onChange={(v) => setSlot(i, { name: v })} isRequired />
                <TextField label="Email" type="email" value={s.email} onChange={(v) => setSlot(i, { email: v })} isRequired />
                <Select label="Category" value={s.category} onChange={(v) => setSlot(i, { category: v })} options={CATEGORIES} />
                <div className="flex items-end pb-1">
                  <Switch isSelected={s.required} onChange={(v) => setSlot(i, { required: v })}>{s.required ? "Required for the booking" : "Optional"}</Switch>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <MoneyField label="Deposit" value={s.deposit} onChange={(v) => setSlot(i, { deposit: v })} description="Credited when the booking confirms." />
                <MoneyField label="of which paid hold" value={s.holdFee} onChange={(v) => setSlot(i, { holdFee: v })} description="Earned on acceptance, even if the booking expires." />
                <MoneyField label="Balance" value={s.balance} onChange={(v) => setSlot(i, { balance: v })} description="Released after the event." />
              </div>
              <TextArea label="Supplier terms" value={s.termsText} onChange={(v) => setSlot(i, { termsText: v })} rows={3} placeholder="What this supplier provides" />
            </Card>
          ))}
          {data.slots.length < 12 && (
            <Button intent="secondary" onPress={() => set({ slots: [...data.slots, newSlot()] })}>
              <Plus className="size-4" aria-hidden /> Add supplier
            </Button>
          )}
        </div>
      )}

      {step === 2 && (
        <Card className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <MoneyField label="Agency fee" value={data.agencyFee} onChange={(v) => set({ agencyFee: v })} description="Credited to you when the booking confirms." />
            <MoneyField label="Hold-fee cap" value={data.holdFeeCap} onChange={(v) => set({ holdFeeCap: v })} description="The most the client can lose in paid holds, including replaced suppliers." />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-surface-muted p-3">
            <p className="text-[13px] text-text-muted">For a quick test, set deadlines 15 to 30 minutes from now.</p>
            <Button intent="secondary" size="sm" onPress={quickTest}>Use short test deadlines</Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <DateTimeField label="Suppliers accept by" value={data.acceptDeadline} onChange={(v) => set({ acceptDeadline: v })} />
            <DateTimeField label="Booking confirms by" value={data.confirmDeadline} onChange={(v) => set({ confirmDeadline: v })} />
            <DateTimeField label="Final expiry" value={data.finalExpiry} onChange={(v) => set({ finalExpiry: v })} description="Changes can extend deadlines, never past this." />
            <DateTimeField label="Event date" value={data.eventDate} onChange={(v) => set({ eventDate: v })} />
            <TextField label="Review window after the event (hours)" inputMode="decimal" value={data.reviewWindowHours} onChange={(v) => set({ reviewWindowHours: v })} description="Balances release automatically after this." />
            <TextField label="Minimum response time after a change (hours)" inputMode="decimal" value={data.minResponseHours} onChange={(v) => set({ minResponseHours: v })} />
          </div>
        </Card>
      )}

      {step === 3 && draftId && <Accounts api={api} draftId={draftId} data={data} readiness={readiness} setReadiness={setReadiness} />}

      {step === 4 && draftId && (
        <Review
          data={data}
          chainId={chainId}
          draftId={draftId}
          readiness={readiness}
          onCreated={(ref) => router.replace(`/b/${ref}`)}
          api={api}
          signer={signer}
        />
      )}

      <div className="flex flex-wrap justify-between gap-3">
        <Button intent="secondary" isDisabled={step === 0} onPress={() => setStep(step - 1)}>Back</Button>
        <div className="flex gap-3">
          <Button intent="ghost" pending={saving} onPress={() => void save()}>Save draft</Button>
          {step < 3 && <Button pending={saving} onPress={() => void next()}>Continue</Button>}
          {step === 3 && <Button isDisabled={!readiness.length || readiness.some((r) => !r.wallet)} onPress={() => setStep(4)}>Continue</Button>}
        </div>
      </div>
    </div>
  );
}

type Api = ReturnType<typeof useSession>["api"];

function Accounts({ api, draftId, data, readiness, setReadiness }: { api: Api; draftId: string; data: DraftData; readiness: Readiness[]; setReadiness: (r: Readiness[]) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendEmails, setSendEmails] = useState(true);
  const wantKeys = useMemo(() => ["client", ...data.slots.map((s) => s.key)], [data.slots]);
  const current = readiness.filter((r) => wantKeys.includes(r.key) && (r.key === "client" ? r.email === data.clientEmail.trim().toLowerCase() : data.slots.find((s) => s.key === r.key)?.email.trim().toLowerCase() === r.email));
  const complete = current.length === wantKeys.length;

  const poll = useCallback(async () => {
    const d = await api<DraftDetail>(`/api/drafts/${draftId}`);
    setReadiness(d.readiness);
  }, [api, draftId, setReadiness]);
  useEffect(() => {
    if (!complete || current.every((r) => r.wallet)) return;
    const t = setInterval(() => void poll().catch(() => undefined), 5000);
    return () => clearInterval(t);
  }, [complete, current, poll]);

  const label = (r: Readiness) => (r.key === "client" ? "Client" : (data.slots.find((s) => s.key === r.key)?.name ?? "Supplier"));
  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Payout accounts</h2>
        <p className="mt-1 text-[15px] text-text-muted">
          The package names each person&apos;s payout account onchain, so the client and every supplier first sign in once with their email. Share each link directly; emails can land in spam.
        </p>
      </div>
      {error && <Notice tone="bad">{error}</Notice>}
      {!complete ? (
        <div className="flex flex-col gap-3">
          <Checkbox isSelected={sendEmails} onChange={setSendEmails}>Also email the links</Checkbox>
          <div>
            <Button
              pending={busy}
              onPress={async () => {
                setBusy(true);
                setError(null);
                try {
                  const r = await api<{ readiness: Readiness[] }>(`/api/drafts/${draftId}/setup-invites`, { method: "POST", body: { sendEmails } });
                  setReadiness(r.readiness);
                } catch (e) {
                  setError(friendly(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Create setup links
            </Button>
          </div>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {current.map((r) => (
            <li key={r.key} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="font-medium">{label(r)}</p>
                <p className="truncate text-[13px] text-text-muted">{r.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusPill tone={r.wallet ? "ok" : "waiting"}>{r.wallet ? "Account ready" : "Waiting for sign-in"}</StatusPill>
                {!r.wallet && <CopyButton text={r.link} label="Copy link" />}
              </div>
            </li>
          ))}
        </ul>
      )}
      {complete && current.some((r) => !r.wallet) && <p className="text-[13px] text-text-muted">This list updates automatically.</p>}
    </Card>
  );
}

function Review({
  data,
  chainId,
  draftId,
  readiness,
  onCreated,
  api,
  signer,
}: {
  data: DraftData;
  chainId: number;
  draftId: string;
  readiness: Readiness[];
  onCreated: (ref: string) => void;
  api: Api;
  signer: ReturnType<typeof useSession>["signer"];
}) {
  const storeKey = `setlo:created:${draftId}`;
  const [eth, setEth] = useState<bigint | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ chainId: number; packageId: string; hash: string } | null>(null);
  const [sendEmails, setSendEmails] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem(storeKey);
    if (raw) setCreated(JSON.parse(raw));
  }, [storeKey]);
  const loadGas = useCallback(() => account(chainId, signer.address).then((a) => setEth(BigInt(a.eth)), () => setEth(null)), [chainId, signer.address]);
  useEffect(() => void loadGas(), [loadGas]);

  const wallet = (key: string) => readiness.find((r) => r.key === key)?.wallet ?? null;
  const slots = data.slots.map((s) => ({ ...s, dep: parseUsdg(s.deposit)!, hold: parseUsdg(s.holdFee)!, bal: parseUsdg(s.balance)! }));
  const total = sum([...slots.map((s) => s.dep + s.bal), parseUsdg(data.agencyFee) ?? BigInt(0)]);

  async function register(c: { chainId: number; packageId: string }) {
    const r = await api<{ id: string }>("/api/packages", {
      method: "POST",
      body: {
        chainId: c.chainId,
        packageId: c.packageId,
        title: data.title.trim(),
        termsText: data.sharedTermsText,
        clientEmail: data.clientEmail.trim().toLowerCase(),
        draftId,
        sendEmails,
        slots: data.slots.map((s, index) => ({ index, name: s.name.trim(), email: s.email.trim().toLowerCase(), category: s.category, termsText: s.termsText })),
      },
    });
    localStorage.removeItem(storeKey);
    onCreated(r.id);
  }

  async function create() {
    setError(null);
    setBusy("create");
    try {
      const client = wallet("client");
      if (!client) throw new Error("The client's payout account isn't ready.");
      const c = await createPackage(
        signer,
        chainId,
        {
          client: getAddress(client),
          eventDate: BigInt(data.eventDate!),
          acceptDeadline: BigInt(data.acceptDeadline!),
          confirmDeadline: BigInt(data.confirmDeadline!),
          finalExpiry: BigInt(data.finalExpiry!),
          reviewWindow: BigInt(hours(data.reviewWindowHours) ?? 0),
          minResponseWindow: BigInt(hours(data.minResponseHours) ?? 3600),
          agencyFee: parseUsdg(data.agencyFee) ?? BigInt(0),
          holdFeeCap: parseUsdg(data.holdFeeCap) ?? BigInt(0),
          sharedTermsHash: termsHash(data.sharedTermsText),
        },
        slots.map((s) => ({ payee: getAddress(wallet(s.key)!), required: s.required, deposit: s.dep, holdFee: s.hold, balance: s.bal, termsHash: termsHash(s.termsText) })),
      );
      const rec = { chainId, packageId: c.packageId, hash: c.hash };
      localStorage.setItem(storeKey, JSON.stringify(rec));
      setCreated(rec);
      setBusy("register");
      await register(rec);
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(null);
    }
  }

  const deadlinePast = (data.acceptDeadline ?? 0) <= Math.floor(Date.now() / 1000) + 60;
  const lowGas = eth !== null && eth < MIN_GAS;
  return (
    <Card className="flex flex-col gap-5">
      <h2 className="text-lg font-semibold">{data.title}</h2>
      <dl className="grid gap-x-6 gap-y-2 text-[15px] sm:grid-cols-2">
        <div><dt className="text-text-muted">Client</dt><dd>{data.clientEmail}</dd></div>
        <div><dt className="text-text-muted">Event</dt><dd>{dateTime(data.eventDate!)}</dd></div>
        <div><dt className="text-text-muted">Suppliers accept by</dt><dd>{dateTime(data.acceptDeadline!)}</dd></div>
        <div><dt className="text-text-muted">Final expiry</dt><dd>{dateTime(data.finalExpiry!)}</dd></div>
      </dl>
      <ul className="divide-y divide-border">
        {slots.map((s) => (
          <li key={s.key} className="flex flex-wrap justify-between gap-2 py-2.5 text-[15px]">
            <span>{s.name} <span className="text-text-muted">· {s.required ? "required" : "optional"}</span></span>
            <span className="tabular">{usdg(s.dep)} deposit · {usdg(s.bal)} balance</span>
          </li>
        ))}
        <li className="flex justify-between py-2.5 text-[15px]"><span>Agency fee</span><span className="tabular">{usdg(parseUsdg(data.agencyFee) ?? BigInt(0))}</span></li>
        <li className="flex justify-between py-2.5 font-semibold"><span>Client funds</span><span className="tabular">{usdg(total)}</span></li>
      </ul>
      {error && <Notice tone="bad" title={created ? "Created onchain, not yet registered" : "Package not created"}>{error}</Notice>}
      {created ? (
        <Notice
          tone="waiting"
          title={`Package #${created.packageId} is onchain`}
          action={<Button pending={busy === "register"} onPress={async () => { setBusy("register"); setError(null); try { await register(created); } catch (e) { setError(friendly(e)); } finally { setBusy(null); } }}>Finish and create invites</Button>}
        >
          Setlo still needs to save the names and terms and create the invitations.
        </Notice>
      ) : (
        <>
          {deadlinePast && <Notice tone="bad">The acceptance deadline has passed or is too close. Go back and move it later.</Notice>}
          {lowGas && (
            <Notice
              tone="waiting"
              title="Your account needs test ETH"
              action={<Button intent="secondary" size="sm" onPress={async () => { try { await faucet(chainId, signer.address, "gas"); await loadGas(); } catch (e) { setError(friendly(e)); } }}>Get test ETH</Button>}
            >
              Creating the package is sent from your account and needs a small network fee.
            </Notice>
          )}
          <Checkbox isSelected={sendEmails} onChange={setSendEmails}>Email the invitations (you&apos;ll also get copyable links)</Checkbox>
          <Button size="lg" full isDisabled={deadlinePast || lowGas || !!busy} pending={busy === "create"} onPress={() => void create()}>
            Create package onchain
          </Button>
        </>
      )}
    </Card>
  );
}
