import { AlertTriangle, CheckCircle2, Circle, Clock, Info, Repeat, XCircle } from "lucide-react";
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

export function Notice({ tone = "info", title, children, action, className }: { tone?: Tone; title?: string; children?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  const Icon = tone === "bad" || tone === "waiting" ? AlertTriangle : toneIcon[tone];
  return (
    <div role={tone === "bad" ? "alert" : "status"} className={cn("flex gap-3 rounded-md p-4 text-[15px]", toneCls[tone], className)}>
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
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
