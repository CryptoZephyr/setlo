"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { STATUS, type PackageState } from "@/lib/types";
import { chainNow } from "@/lib/status";
import { checkDeadline, packageState } from "./actions";
import { friendly } from "./errors";

const POLL_MS = 8000;
const STALE_MS = 30000;

/** Polls onchain state; asks the relayer to run a due deadline action while the page is open. */
export function useChainState(chainId: number | null, packageId: string | null) {
  const [state, setState] = useState<PackageState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastOk, setLastOk] = useState(0);
  const [checking, setChecking] = useState(false);
  const deadlineAt = useRef(0);

  const refresh = useCallback(async () => {
    if (chainId === null || packageId === null) return;
    try {
      const s = await packageState(chainId, packageId);
      setState(s);
      setError(null);
      setLastOk(Date.now());
      const now = chainNow(s);
      const due =
        (s.pkg.status === STATUS.Open && (now > s.pkg.acceptDeadline || now > s.pkg.confirmDeadline)) ||
        (s.pkg.status === STATUS.Confirmed && now >= s.pkg.eventDate + s.pkg.reviewWindow);
      if (due && Date.now() - deadlineAt.current > 30000) {
        deadlineAt.current = Date.now();
        setChecking(true);
        checkDeadline(chainId, packageId)
          .then((r) => (r.action !== "none" ? packageState(chainId, packageId).then(setState) : undefined))
          .catch(() => undefined)
          .finally(() => setChecking(false));
      }
    } catch (e) {
      setError(friendly(e));
    }
  }, [chainId, packageId]);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => document.visibilityState === "visible" && void refresh(), POLL_MS);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const stale = !!state && (Date.now() - lastOk > STALE_MS || !!error);
  return { state, error, stale, checking, refresh, lastOk };
}

type Op = { label: string; at: number };

/**
 * Remembers a submitted action across refreshes. While it is recent, the action stays disabled and the
 * page checks chain state instead of inviting a duplicate submission.
 */
export function usePendingOp(key: string | null) {
  const storageKey = key ? `setlo:op:${key}` : null;
  const [op, setOp] = useState<Op | null>(null);
  useEffect(() => {
    if (!storageKey) return;
    const raw = localStorage.getItem(storageKey);
    if (!raw) return;
    const o = JSON.parse(raw) as Op;
    if (Date.now() - o.at < 120000) setOp(o);
    else localStorage.removeItem(storageKey);
  }, [storageKey]);
  useEffect(() => {
    if (!op || !storageKey) return;
    const t = setTimeout(() => {
      localStorage.removeItem(storageKey);
      setOp(null);
    }, Math.max(0, 120000 - (Date.now() - op.at)));
    return () => clearTimeout(t);
  }, [op, storageKey]);
  const start = useCallback(
    (label: string) => {
      const o = { label, at: Date.now() };
      if (storageKey) localStorage.setItem(storageKey, JSON.stringify(o));
      setOp(o);
    },
    [storageKey],
  );
  const clear = useCallback(() => {
    if (storageKey) localStorage.removeItem(storageKey);
    setOp(null);
  }, [storageKey]);
  return { op, start, clear };
}
