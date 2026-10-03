import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, ErrorState, Notice, Skeleton, StatusPill, Steps, type Tone } from "@/components/ui/status";
import { usdg } from "@/lib/money";

export const metadata = { title: "States (dev)" };

const TONES: [Tone, string][] = [
  ["waiting", "Waiting to accept"],
  ["ok", "Accepted"],
  ["paid", "Paid to your payout account"],
  ["bad", "Declined"],
  ["changed", "Terms changed · needs to accept again"],
  ["neutral", "Expired"],
  ["info", "Test network"],
];

/** Development-only reference of status, notice and loading treatments. */
export default function States() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-10">
      <h1 className="font-display text-4xl">States</h1>
      <Card className="flex flex-wrap gap-2">{TONES.map(([t, l]) => <StatusPill key={t} tone={t}>{l}</StatusPill>)}</Card>
      <div className="flex flex-col gap-3">
        {TONES.map(([t, l]) => <Notice key={t} tone={t} title={l} action={<Button intent="secondary" size="sm">Action</Button>}>Body text with an amount of {usdg(BigInt(1_250_000))}.</Notice>)}
      </div>
      <Notice tone="waiting" busy title="Accept in progress">Waiting for your signature… Keep this page open.</Notice>
      <Card className="flex flex-col gap-3"><Steps steps={["First step", "Second step", "Third step"]} current={1} /><Steps steps={["First step", "Second step"]} current={1} failed /></Card>
      <ErrorState className="pt-0" title="Couldn't load this booking" action={<Button intent="secondary" size="sm">Try again</Button>}>Can&apos;t reach Setlo. Check your connection and try again.</ErrorState>
      <Card className="flex flex-col gap-3"><Skeleton className="h-6 w-48" /><Skeleton className="h-24" /></Card>
      <Card className="flex flex-wrap gap-3">
        <Button>Primary</Button><Button intent="secondary">Secondary</Button><Button intent="ghost">Ghost</Button><Button intent="danger">Danger</Button><Button pending>Pending</Button><Button isDisabled>Disabled</Button>
      </Card>
    </main>
  );
}
