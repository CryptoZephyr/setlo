"use client";

import { useState } from "react";
import type { OnStep, RelayResult } from "@/lib/client/actions";
import { ApiError } from "@/lib/client/api";
import { friendly } from "@/lib/client/errors";
import { usePendingOp } from "@/lib/client/hooks";

export type ActionResult = { tone: "ok" | "bad"; label: string; text: string; hash?: string };
export type ActionProgress = { label: string; step: string | null };

/**
 * Runs one submission at a time, remembers it across refreshes, and reports only what the receipt shows.
 * Callers refresh chain state afterwards; the booking view is the source of truth.
 */
/** True when the error proves nothing was broadcast (rejected, failed simulation or refused by the server). */
function definitelyNotSent(e: unknown) {
  if (e instanceof ApiError) return e.status >= 400 && e.status < 500;
  if (!(e instanceof Error)) return false;
  return /UserRejected|ContractFunctionExecution|ContractFunctionRevert|EstimateGas|InsufficientFunds/.test(e.name) || /user rejected|denied|execution reverted|insufficient funds/i.test(e.message);
}

export function useAction(pendingKey: string | null, refresh: () => Promise<void>) {
  const pending = usePendingOp(pendingKey);
  const [busy, setBusy] = useState<string | null>(null);
  const [step, setStep] = useState<string | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);

  async function run(label: string, fn: (onStep: OnStep) => Promise<RelayResult | { hash: string } | void>, okText: string) {
    setBusy(label);
    setStep(null);
    setResult(null);
    pending.start(label);
    try {
      const r = await fn(setStep);
      if (r && "status" in r && r.status !== "success") {
        setResult({ tone: "bad", label, text: "The transaction was submitted but reverted onchain. Nothing changed.", hash: r.hash });
      } else {
        setResult({ tone: "ok", label, text: okText, hash: r ? r.hash : undefined });
      }
      pending.clear();
    } catch (e) {
      if (definitelyNotSent(e)) {
        setResult({ tone: "bad", label, text: friendly(e) });
        pending.clear();
      } else {
        setResult({ tone: "bad", label, text: `${friendly(e)} It may still have been sent, so this action stays locked for two minutes while the booking is checked.` });
      }
    } finally {
      setBusy(null);
      setStep(null);
      await refresh();
    }
  }

  const progress: ActionProgress | null = busy === null ? null : { label: busy, step };
  return { run, busy, progress, result, setResult, recovering: busy === null ? pending.op : null };
}
