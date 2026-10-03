"use client";

import { ShieldQuestion } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, Notice, StatusPill } from "@/components/ui/status";
import { dateTime } from "@/lib/client/time";
import { usdg } from "@/lib/money";
import { slotStatus } from "@/lib/status";
import { CATEGORIES, type PackageMeta, type PackageState, type VersionSnapshot } from "@/lib/types";
import { AddressLink, Amount, TxLink } from "./parts";
import type { ActionProgress, ActionResult } from "./use-action";

export const categoryLabel = (c: string) => CATEGORIES.find((x) => x.id === c)?.label ?? "Other";

/**
 * One slot for an action's lifecycle: progress while it runs, then the outcome. The outcome is focused
 * and scrolled into view, since the button that started it may be far down the page.
 */
export function ResultNotice({ result, progress, chainId, onDismiss }: { result: ActionResult | null; progress?: ActionProgress | null; chainId: number; onDismiss?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!result || !ref.current) return;
    ref.current.focus({ preventScroll: true });
    ref.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [result]);
  if (progress)
    return (
      <Notice tone="waiting" busy title={`${progress.label} in progress`}>
        {progress.step ?? "Starting…"} Keep this page open.
      </Notice>
    );
  if (!result) return null;
  const ok = result.tone === "ok";
  return (
    <Notice
      ref={ref}
      tone={ok ? "ok" : "bad"}
      title={ok ? `${result.label}: done` : `${result.label} didn't go through`}
      action={onDismiss && <Button intent="ghost" size="sm" onPress={onDismiss}>Dismiss</Button>}
    >
      {result.text} {result.hash && <TxLink chainId={chainId} hash={result.hash} />}
    </Notice>
  );
}

export function RecoveringNotice({ op }: { op: { label: string; at: number } | null }) {
  if (!op) return null;
  return (
    <Notice tone="waiting" title={`Checking your earlier “${op.label}”`}>
      You submitted this {Math.max(1, Math.round((Date.now() - op.at) / 1000))} s ago and the page was reloaded. We&apos;re reading the chain before you can try again, so it isn&apos;t sent twice.
    </Notice>
  );
}

export function TermsText({ text, empty = "No written terms." }: { text: string; empty?: string }) {
  return text.trim() ? <p className="text-[15px] whitespace-pre-wrap">{text}</p> : <p className="text-[15px] text-text-muted">{empty}</p>;
}

/** Every supplier slot with its named payout account; used by agency and client. */
export function SupplierList({ state, meta, showEmails }: { state: PackageState; meta: PackageMeta; showEmails?: boolean }) {
  return (
    <ul className="flex flex-col gap-3">
      {state.slots.map((s, i) => {
        const m = meta.slots[i];
        const st = slotStatus(state, s);
        const mismatch = m && m.payoutAddress.toLowerCase() !== s.payee.toLowerCase();
        return (
          <li key={i} className="rounded-lg border border-border bg-surface p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">{m?.name ?? `Slot ${i + 1}`}</p>
                <p className="text-[13px] text-text-muted">
                  {categoryLabel(m?.category ?? "other")} · {s.required ? "Required" : "Optional"} · slot {i + 1}, version {s.version}
                </p>
              </div>
              <StatusPill tone={st.tone}>{st.label}</StatusPill>
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-[13px]">
              <div><dt className="text-text-muted">Deposit</dt><dd><Amount value={s.deposit} /></dd></div>
              <div><dt className="text-text-muted">of which paid hold</dt><dd><Amount value={s.holdFee} /></dd></div>
              <div><dt className="text-text-muted">Balance</dt><dd><Amount value={s.balance} /></dd></div>
            </dl>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-text-muted">
              <span>Payout account <AddressLink chainId={state.chainId} address={s.payee} /></span>
              {showEmails && m?.email && <span>{m.email}</span>}
              <span className="inline-flex items-center gap-1"><ShieldQuestion className="size-3.5" aria-hidden /> Email-authenticated · business identity unverified</span>
            </div>
            {mismatch && <p className="mt-2 text-[13px] text-bad">The registered account doesn&apos;t match the onchain payout account. Refresh; if it persists, ask the agency.</p>}
            {m?.termsText && (
              <details className="mt-3">
                <summary className="cursor-pointer text-[13px] font-medium text-brand">Supplier terms</summary>
                <div className="mt-2"><TermsText text={m.termsText} /></div>
              </details>
            )}
          </li>
        );
      })}
    </ul>
  );
}

type Snap = VersionSnapshot["snapshot"];

function diff(a: Snap, b: Snap): string[] {
  const out: string[] = [];
  if (a.eventDate !== b.eventDate) out.push(`Event date: ${dateTime(a.eventDate)} → ${dateTime(b.eventDate)}. Every supplier must accept again.`);
  if (a.sharedTermsText !== b.sharedTermsText) out.push("Shared terms text changed. Every supplier must accept again.");
  if (a.agencyFee !== b.agencyFee) out.push(`Agency fee: ${usdg(a.agencyFee)} → ${usdg(b.agencyFee)}`);
  b.slots.forEach((s, i) => {
    const o = a.slots[i];
    if (!o) return;
    const who = `Slot ${i + 1}`;
    if (o.payee.toLowerCase() !== s.payee.toLowerCase())
      out.push(`${who}: supplier replaced, ${o.name} → ${s.name} (new payout account). ${usdg(o.holdFee)} hold fee stays with ${o.name} if they had accepted.`);
    for (const k of ["deposit", "holdFee", "balance"] as const)
      if (o[k] !== s[k]) out.push(`${who} ${k === "holdFee" ? "paid hold" : k}: ${usdg(o[k])} → ${usdg(s[k])}`);
    if (o.termsText !== s.termsText && o.payee.toLowerCase() === s.payee.toLowerCase()) out.push(`${who}: supplier terms text changed. ${s.name} must accept again.`);
  });
  return out;
}

/** What changed since the configuration the client last approved. */
export function ChangeSummary({ state, versions }: { state: PackageState; versions: VersionSnapshot[] }) {
  if (state.approvalCurrent || BigInt(state.pkg.funded) === BigInt(0)) return null;
  const approved = versions.find((v) => v.configHash.toLowerCase() === state.pkg.approvedConfig.toLowerCase());
  const latest = versions.find((v) => v.configHash.toLowerCase() === state.configHash.toLowerCase());
  const lines = approved && latest ? diff(approved.snapshot, latest.snapshot) : [];
  return (
    <Card className="border-changed/30">
      <StatusPill tone="changed">Changed since you approved</StatusPill>
      <h2 className="mt-3 text-lg font-semibold">The agency changed this package</h2>
      {lines.length ? (
        <ul className="mt-3 list-disc pl-5 text-[15px]">{lines.map((l) => <li key={l}>{l}</li>)}</ul>
      ) : (
        <p className="mt-2 text-[15px] text-text-muted">We couldn&apos;t match a saved copy of the version you approved. Review every supplier and amount below.</p>
      )}
      <p className="mt-3 text-[15px] text-text-muted">Your earlier funding stays held. Nothing confirms until you approve the current version.</p>
    </Card>
  );
}
