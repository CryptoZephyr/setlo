"use client";

import { X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { cn } from "./cn";
import { StatusIcon } from "./status";

type ToastTone = "ok" | "bad" | "info";
type Toast = { id: number; tone: ToastTone; title: string; body?: string };
type Show = (t: Omit<Toast, "id">) => void;

const Ctx = createContext<Show | null>(null);
const TTL = 5000;

/** Short confirmations for actions whose result isn't otherwise visible on the page. */
export function useToast(): Show {
  const show = useContext(Ctx);
  if (!show) throw new Error("useToast outside <ToastProvider>");
  return show;
}

const toneCls: Record<ToastTone, string> = {
  ok: "border-ok/30 [&_svg.tone]:text-ok",
  bad: "border-bad/30 [&_svg.tone]:text-bad",
  info: "border-border [&_svg.tone]:text-text-muted",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(0);
  const dismiss = useCallback((id: number) => setToasts((ts) => ts.filter((t) => t.id !== id)), []);
  const show = useCallback<Show>((t) => setToasts((ts) => [...ts.slice(-2), { ...t, id: ++next.current }]), []);
  return (
    <Ctx.Provider value={show}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </Ctx.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const t = setTimeout(onDismiss, TTL);
    return () => clearTimeout(t);
  }, [paused, onDismiss]);
  return (
    <div
      role={toast.tone === "bad" ? "alert" : "status"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={cn("pointer-events-auto flex w-full max-w-sm gap-3 rounded-md border bg-surface p-4 text-[15px] shadow-pop", toneCls[toast.tone])}
    >
      <StatusIcon tone={toast.tone === "info" ? "info" : toast.tone} className="tone mt-0.5 size-5" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{toast.title}</p>
        {toast.body && <p className="mt-0.5 text-text-muted">{toast.body}</p>}
      </div>
      <button onClick={onDismiss} className="-m-2 flex size-9 shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-surface-muted" aria-label="Dismiss">
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
