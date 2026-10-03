"use client";

import { Check, Copy, ExternalLink, RefreshCw } from "lucide-react";
import { useState } from "react";
import type { Address } from "viem";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Notice, StatusPill } from "@/components/ui/status";
import { getChain, txUrl } from "@/lib/chains";
import { retryPayout } from "@/lib/client/actions";
import { friendly } from "@/lib/client/errors";
import { dateTime, duration } from "@/lib/client/time";
import { usdg } from "@/lib/money";
import { chainNow, paymentFor, totals } from "@/lib/status";
import { STATUS, type PackageMeta, type PackageState } from "@/lib/types";

export function Amount({ value, className, strong }: { value: bigint | string; className?: string; strong?: boolean }) {
  return <span className={cn("tabular whitespace-nowrap", strong && "font-semibold", className)}>{usdg(value)}</span>;
}

export function short(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      intent="secondary"
      size="sm"
      onPress={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 2000);
      }}
      aria-label={`${label}: ${text}`}
    >
      {done ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      {done ? "Copied" : label}
    </Button>
  );
}

export function AddressLink({ chainId, address }: { chainId: number; address: string }) {
  const url = `${getChain(chainId).chain.blockExplorers!.default.url}/address/${address}`;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-[13px] text-text-muted hover:text-text" title={address}>
      {short(address)}
      <ExternalLink className="size-3" aria-hidden />
      <span className="sr-only">(opens explorer)</span>
    </a>
  );
}

export function TxLink({ chainId, hash, children }: { chainId: number; hash: string; children?: React.ReactNode }) {
  return (
    <a href={txUrl(chainId, hash)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] text-brand hover:underline">
      {children ?? "View transaction"}
      <ExternalLink className="size-3" aria-hidden />
    </a>
  );
}

export function StaleBanner({ stale, error, onRetry }: { stale: boolean; error: string | null; onRetry: () => void }) {
  if (!stale) return null;
  return (
    <Notice
      tone="waiting"
      title="Showing the last state we could read"
      action={
        <Button intent="secondary" size="sm" onPress={onRetry}>
          <RefreshCw className="size-4" aria-hidden /> Check again
        </Button>
      }
    >
      {error ?? "The network is slow to respond. Don't repeat an action until the state updates."}
    </Notice>
  );
}

function Row({ label, value, sub, strong }: { label: React.ReactNode; value: bigint | string; sub?: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className={cn("text-[15px]", strong ? "font-semibold" : "text-text-muted")}>
        {label}
        {sub && <span className="block text-[13px] font-normal text-text-muted">{sub}</span>}
      </dt>
      <dd>
        <Amount value={value} strong={strong} />
      </dd>
    </div>
  );
}

/** Where the client's money is in this booking. */
export function MoneyBreakdown({ state, meta }: { state: PackageState; meta: PackageMeta }) {
  const t = totals(state);
  const p = state.pkg;
  const nameOf = (a: string) => meta.slots.find((s) => s.payoutAddress.toLowerCase() === a.toLowerCase())?.name ?? short(a);
  const capLeft = BigInt(p.holdFeeCap) - t.earned;
  return (
    <div>
      <dl className="divide-y divide-border">
        <Row label="Supplier deposits" sub="Credited when the booking confirms" value={t.deposits} />
        <Row label="… of which paid holds" sub="Part of each deposit. Earned on acceptance, kept even if the booking expires" value={t.holds} />
        <Row label="Supplier balances" sub="Held until after the event" value={t.balances} />
        <Row label="Agency fee" sub="Credited when the booking confirms" value={t.agencyFee} />
        {t.earned > BigInt(0) && <Row label="Hold fees already earned by replaced suppliers" value={t.earned} />}
        <Row label="Total to fund" value={state.requiredFunding} strong />
      </dl>
      <dl className="mt-4 divide-y divide-border rounded-md bg-surface-muted px-4">
        <Row label="Funded by the client" value={p.funded} />
        <Row label="Held by the Setlo contract now" value={p.held} />
        <Row label="Hold-fee cap approved by the client" sub={`${usdg(capLeft > BigInt(0) ? capLeft : BigInt(0))} of the cap is unused`} value={p.holdFeeCap} />
      </dl>
      {state.earnedHolds.length > 0 && (
        <div className="mt-4 text-[15px]">
          <p className="font-medium">Hold fees kept by replaced suppliers</p>
          <ul className="mt-1 text-text-muted">
            {state.earnedHolds.map((e, i) => (
              <li key={i} className="flex justify-between gap-4 py-1">
                <span>{nameOf(e.recipient)} <AddressLink chainId={state.chainId} address={e.recipient} /></span>
                <Amount value={e.amount} />
              </li>
            ))}
          </ul>
        </div>
      )}
      {p.status === STATUS.Open && (
        <p className="mt-4 text-[13px] text-text-muted">
          If this booking expires, hold fees earned so far stay with those suppliers and everything else is credited back to the client.
        </p>
      )}
    </div>
  );
}

/** Credited vs. waiting vs. verified transfer, for one recipient. */
export function PaymentPanel({ state, address, title = "Your payments" }: { state: PackageState; address: Address; title?: string }) {
  const { credited, transfers, waiting } = paymentFor(state, address);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  if (credited === BigInt(0) && waiting === BigInt(0) && transfers.length === 0)
    return (
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-[15px] text-text-muted">Nothing has been credited to you for this booking yet.</p>
      </div>
    );
  return (
    <div className="flex flex-col gap-3">
      <p className="font-semibold">{title}</p>
      {credited > BigInt(0) && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-[15px] text-text-muted">Credited for this booking</span>
          <Amount value={credited} strong />
        </div>
      )}
      {waiting > BigInt(0) ? (
        <div className="flex flex-col gap-2 rounded-md bg-waiting-soft p-3">
          <div className="flex items-center justify-between gap-3">
            <StatusPill tone="waiting">Payout processing</StatusPill>
            <Amount value={waiting} />
          </div>
          <p className="text-[13px]">Setlo sends payouts automatically. If this stays here for more than a few minutes, send it again.</p>
          <div>
            <Button
              intent="secondary"
              size="sm"
              pending={busy}
              onPress={async () => {
                setBusy(true);
                setMsg(null);
                try {
                  await retryPayout(state.chainId, address);
                  setMsg({ tone: "ok", text: "Payout submitted. It shows as paid once the transfer is seen onchain." });
                } catch (e) {
                  setMsg({ tone: "bad", text: friendly(e) });
                } finally {
                  setBusy(false);
                }
              }}
            >
              Send payout again
            </Button>
          </div>
          {msg && <p className={cn("text-[13px]", msg.tone === "bad" && "text-bad")}>{msg.text}</p>}
        </div>
      ) : (
        credited > BigInt(0) && transfers.length === 0 && <p className="text-[13px] text-text-muted">Waiting for the transfer record. This usually takes under a minute.</p>
      )}
      {transfers.length > 0 && (
        <ul className="flex flex-col gap-2">
          {transfers.map((t) => (
            <li key={t.txHash} className="flex flex-wrap items-center justify-between gap-2">
              <StatusPill tone="paid">Paid to your payout account</StatusPill>
              <span className="flex items-center gap-3">
                <Amount value={t.amount} />
                <TxLink chainId={state.chainId} hash={t.txHash}>Transfer</TxLink>
              </span>
            </li>
          ))}
          <li className="text-[13px] text-text-muted">A transfer can include payouts from other bookings to the same account.</li>
        </ul>
      )}
    </div>
  );
}

export function Deadlines({ state }: { state: PackageState }) {
  const p = state.pkg;
  const now = chainNow(state);
  const rows: [string, number, string?][] = [
    ["Suppliers accept by", p.acceptDeadline],
    ["Booking confirms by", p.confirmDeadline],
    ["Final expiry (cannot be extended)", p.finalExpiry],
    ["Event", p.eventDate],
    ["Balances release automatically", p.eventDate + p.reviewWindow, "if the client hasn't released them"],
  ];
  return (
    <dl className="divide-y divide-border">
      {rows.map(([label, at, sub]) => (
        <div key={label} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5">
          <dt className="text-[15px] text-text-muted">
            {label}
            {sub && <span className="block text-[13px]">{sub}</span>}
          </dt>
          <dd className="text-right text-[15px]">
            <time dateTime={new Date(at * 1000).toISOString()}>{dateTime(at)}</time>
            {p.status <= STATUS.Confirmed && (
              <span className="block text-[13px] text-text-muted">{at > now ? `in ${duration(at - now)}` : "passed"}</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

const FN_LABEL: Record<string, string> = {
  fundWithPermit: "Client funding approval",
  acceptWithSig: "Supplier accepted",
  declineWithSig: "Supplier declined",
  clientActionWithSig: "Client action",
  expirePackage: "Expiry submitted",
  releaseBalances: "Automatic balance release",
  claimFor: "Payout sent",
};

export function History({ state, versions }: { state: PackageState; versions: { id: number; reason: string; at: string; configHash: string }[] }) {
  const items = [
    ...versions.map((v) => ({ at: v.at, key: `v${v.id}`, node: <span>Package version saved: {v.reason}</span> })),
    ...state.txs.map((t) => ({
      at: t.at,
      key: t.hash,
      node: (
        <span className="flex flex-wrap items-center gap-2">
          {FN_LABEL[t.fn] ?? t.fn}
          {t.status === "reverted" && <StatusPill tone="bad">Reverted</StatusPill>}
          {t.status === "sent" && <StatusPill tone="waiting">Pending</StatusPill>}
          <TxLink chainId={state.chainId} hash={t.hash} />
        </span>
      ),
    })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  if (!items.length) return <p className="text-[15px] text-text-muted">No activity recorded yet.</p>;
  return (
    <ol className="flex flex-col gap-3 border-l border-border pl-4">
      {items.map((i) => (
        <li key={i.key} className="text-[15px]">
          {i.node}
          <span className="block text-[13px] text-text-muted">{dateTime(Math.floor(new Date(i.at).getTime() / 1000))}</span>
        </li>
      ))}
    </ol>
  );
}
