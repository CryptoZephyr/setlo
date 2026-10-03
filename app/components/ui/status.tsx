import { AlertTriangle, CheckCircle2, Circle, Clock, Info, Repeat, XCircle } from "lucide-react";
import { Spinner } from "./button";
import { cn } from "./cn";

export type Tone = "waiting" | "ok" | "paid" | "bad" | "neutral" | "changed" | "info";

const toneCls: Record<Tone, string> = {
  waiting: "bg-waiting-soft text-waiting",
  ok: "bg-ok-soft text-ok",
  paid: "bg-paid-soft text-paid",
  bad: "bg-bad-soft text-bad",
  neutral: "bg-neutral-soft text-neutral",
  changed: "bg-changed-soft text-changed",
  info: "bg-surface-muted text-text",
};

const toneIcon: Record<Tone, typeof Circle> = {
  waiting: Clock,
  ok: CheckCircle2,
  paid: CheckCircle2,
  bad: XCircle,
  neutral: Circle,
  changed: Repeat,
  info: Info,
};

export function StatusIcon({ tone, className }: { tone: Tone; className?: string }) {
  const Icon = tone === "bad" || tone === "waiting" ? AlertTriangle : toneIcon[tone];
  return <Icon className={cn("shrink-0", className)} aria-hidden />;
}

/** Status is always icon + text + colour, never colour alone. */
export function StatusPill({ tone, children, className }: { tone: Tone; children: React.ReactNode; className?: string }) {
  const Icon = toneIcon[tone];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-medium whitespace-nowrap", toneCls[tone], className)}>
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {children}
    </span>
  );
}

export function Notice({
  tone = "info",
  title,
  children,
  action,
  className,
  busy,
  ref,
}: {
  tone?: Tone;
  title?: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  /** Shows a spinner instead of the tone icon while something is in progress. */
  busy?: boolean;
  ref?: React.Ref<HTMLDivElement>;
}) {
  return (
    <div ref={ref} tabIndex={ref ? -1 : undefined} role={tone === "bad" ? "alert" : "status"} className={cn("flex gap-3 rounded-md p-4 text-[15px] outline-none", toneCls[tone], className)}>
      {busy ? <Spinner className="mt-0.5 size-5" /> : <StatusIcon tone={tone} className="mt-0.5 size-5" />}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-text [&_a]:underline">{children}</div>}
        {action && <div className="mt-2 flex flex-wrap gap-2">{action}</div>}
      </div>
    </div>
  );
}

export function Card({ children, className, as: As = "section" }: { children: React.ReactNode; className?: string; as?: "section" | "div" | "article" | "li" }) {
  return <As className={cn("rounded-lg border border-border bg-surface p-5 shadow-card sm:p-6", className)}>{children}</As>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-surface-muted", className)} aria-hidden />;
}

/** Full-width page state for a load that failed or a page that can't be shown. */
export function ErrorState({ title, children, action, className }: { title: string; children?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mx-auto w-full max-w-lg pt-10", className)}>
      <Notice tone="bad" title={title} action={action}>
        {children}
      </Notice>
    </div>
  );
}

/** Ordered progress for a multi-step setup; the current step shows a spinner. */
export function Steps({ steps, current, failed }: { steps: string[]; current: number; failed?: boolean }) {
  return (
    <ol className="flex flex-col gap-2 text-[15px]" aria-label="Progress">
      {steps.map((s, i) => {
        const state = i < current ? "done" : i === current ? (failed ? "failed" : "current") : "todo";
        return (
          <li key={s} className={cn("flex items-center gap-2.5", state === "todo" && "text-text-muted")} aria-current={state === "current" ? "step" : undefined}>
            {state === "done" ? (
              <CheckCircle2 className="size-5 shrink-0 text-ok" aria-hidden />
            ) : state === "current" ? (
              <Spinner className="size-5 text-brand" />
            ) : state === "failed" ? (
              <XCircle className="size-5 shrink-0 text-bad" aria-hidden />
            ) : (
              <Circle className="size-5 shrink-0 text-border-strong" aria-hidden />
            )}
            <span>
              {s}
              <span className="sr-only">{state === "done" ? " (done)" : state === "current" ? " (in progress)" : state === "failed" ? " (failed)" : ""}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
