"use client";

import { useState } from "react";
import type { RelayResult } from "@/lib/client/actions";
import { ApiError } from "@/lib/client/api";
import { friendly } from "@/lib/client/errors";
import { usePendingOp } from "@/lib/client/hooks";

export type ActionResult = { tone: "ok" | "bad"; text: string; hash?: string };

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
  const [result, setResult] = useState<ActionResult | null>(null);

  async function run(label: string, fn: () => Promise<RelayResult | { hash: string } | void>, okText: string) {
    setBusy(label);
    setResult(null);
    pending.start(label);
    try {
      const r = await fn();
      if (r && "status" in r && r.status !== "success") {
        setResult({ tone: "bad", text: "The transaction was submitted but reverted onchain. Nothing changed.", hash: r.hash });
      } else {
        setResult({ tone: "ok", text: okText, hash: r ? r.hash : undefined });
      }
      pending.clear();
    } catch (e) {
      if (definitelyNotSent(e)) {
        setResult({ tone: "bad", text: friendly(e) });
        pending.clear();
      } else {
        setResult({ tone: "bad", text: `${friendly(e)} It may still have been sent, so this action stays locked for two minutes while the booking is checked.` });
      }
    } finally {
      setBusy(null);
      await refresh();
    }
  }

  return { run, busy, result, setResult, recovering: busy === null ? pending.op : null };
}
