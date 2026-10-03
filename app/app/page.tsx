import Link from "next/link";
import { ArrowRight, Building2, CalendarCheck2, Coins, FileCheck2, Handshake, RotateCcw, Users } from "lucide-react";
import { Photo } from "@/components/landing/photo";
import { Logo, Footer } from "@/components/app/shell";
import { LinkButton } from "@/components/ui/button";

const steps = [
  { t: "The agency builds one package", d: "Event date, shared terms, and a slot for each supplier with its deposit, optional paid hold, and post-event balance." },
  { t: "The client reviews and funds it", d: "They see every named supplier, payout account and amount, then approve that exact configuration. No crypto wallet or gas needed." },
  { t: "Each supplier accepts their own terms", d: "Suppliers sign in with the invited email and accept or decline only their slot. Accepting early can earn the hold fee the client approved." },
  { t: "The booking confirms together", d: "When every required supplier has accepted and funding covers the package, deposits and the agency fee are credited and paid out." },
  { t: "Balances settle after the event", d: "The client releases balances, or they release automatically when the review window ends." },
];

const faqs = [
  {
    q: "What happens if one supplier says no?",
    a: "Nothing is booked yet. The agency can replace that supplier before the acceptance deadline. If the package still isn't complete by the deadline, it expires and the client's remaining funds are credited back, minus the hold fees suppliers had already earned.",
  },
  {
    q: "Is this real money?",
    a: "No. This prototype runs on test networks (Arbitrum Sepolia and Robinhood Chain Testnet) with test USDG, a test version of Paxos' Global Dollar. It has no value.",
  },
  {
    q: "Do I need a crypto wallet?",
    a: "No. You sign in with an email code and Setlo creates a payout account for you. Clients and suppliers never pay network fees; Setlo relays their signed approvals.",
  },
  {
    q: "Are suppliers verified?",
    a: "Each supplier is email-authenticated: they signed in with the address the agency invited. Setlo does not verify business identity, so the client approves each named supplier and payout account before funding.",
  },
  {
    q: "What if terms change after someone accepted?",
    a: "Changing one supplier's quote asks only that supplier to accept again. Changing the event date or shared terms asks everyone. Any change asks the client to approve the new total. Total hold fees can never exceed the cap the client set, and nothing can extend past the final expiry.",
  },
  {
    q: "Is there dispute resolution?",
    a: "Not in this version. The client can release balances early or let them release automatically after the review window. Setlo records acceptances, payments, expiries and cancellations; it does not prove a service was delivered.",
  },
  {
    q: "Can anything stop a payout?",
    a: "Paxos can pause USDG transfers or freeze addresses, including the Setlo contract. Each recipient is paid separately, so one frozen recipient doesn't block the others, but a freeze of the contract itself would block all payouts.",
  },
];

export default function Landing() {
  return (
    <>
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-6">
          <Link href="/" aria-label="Setlo home">
            <Logo light />
          </Link>
          <nav className="flex items-center gap-2 text-[15px]" aria-label="Main">
            <a href="#how-it-works" className="hidden min-h-11 items-center rounded-md px-3 text-bg/90 hover:text-bg sm:inline-flex">
              How it works
            </a>
            <Link href="/signin" className="inline-flex min-h-11 items-center rounded-md px-3 text-bg/90 hover:text-bg">
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative isolate flex min-h-[100svh] items-end overflow-hidden bg-text">
          <div className="absolute inset-0 -z-10">
            <Photo name="hero" priority sizes="100vw" alt="Aerial view of a glass event venue at dusk" />
            <div className="absolute inset-0 bg-gradient-to-t from-text/90 via-text/45 to-text/25" />
          </div>
          <div className="mx-auto w-full max-w-6xl px-6 pt-32 pb-16 sm:pb-24">
            <p className="mb-5 inline-flex rounded-full bg-bg/15 px-3 py-1 text-[13px] text-bg backdrop-blur">Settled in USDG</p>
            <h1 className="max-w-3xl font-display text-[44px] leading-[1.02] text-bg sm:text-7xl">
              Book every supplier together. <em className="text-[#cfe4da]">Release deposits only when all of them say yes.</em>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-bg/85">
              Setlo holds a client&apos;s booking money in one package for the venue, caterer, AV and every other supplier. If a required supplier doesn&apos;t accept in time, the client gets the rest back, minus the hold fees they approved.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <LinkButton href="/demo" intent="onPhoto" size="lg">
                Try the live demo <ArrowRight className="size-4" aria-hidden />
              </LinkButton>
              <LinkButton href="/app/new" intent="secondary" size="lg" className="border-bg/40 bg-transparent text-bg hover:bg-bg/10">
                Create a package
              </LinkButton>
            </div>
            <p className="mt-5 text-[15px] text-bg/85">
              Already use Setlo?{" "}
              <Link href="/signin" className="font-medium text-bg underline underline-offset-4 hover:text-[#cfe4da]">
                Sign in
              </Link>
            </p>
          </div>
        </section>

        {/* Package board */}
        <section className="mx-auto grid max-w-6xl gap-12 px-6 py-20 sm:py-28 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <div className="overflow-hidden rounded-xl lg:order-2">
            <Photo name="lounge" sizes="(min-width: 1024px) 560px, 100vw" alt="Glass lounge set for an evening reception" className="aspect-[4/5]" />
          </div>
          <div>
            <p className="text-sm font-medium tracking-wide text-brand uppercase">One shared package</p>
            <h2 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">Everyone works from the same booking board.</h2>
            <p className="mt-5 text-lg text-text-muted">No more chasing six confirmations over chat. Each person sees exactly what they need to act on.</p>
            <ul className="mt-10 grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              {[
                { i: Building2, t: "The package", d: "Date, shared terms, deadlines and the agency fee, approved by the client." },
                { i: Users, t: "The suppliers", d: "A slot per supplier, required or optional, each with its own quote and status." },
                { i: Coins, t: "The money", d: "What is held, what's credited, and what has actually been paid out, in USDG." },
              ].map(({ i: Icon, t, d }) => (
                <li key={t} className="rounded-lg border border-border bg-surface p-5">
                  <Icon className="size-5 text-brand" aria-hidden />
                  <p className="mt-3 font-semibold">{t}</p>
                  <p className="mt-1 text-[15px] text-text-muted">{d}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Workflow */}
        <section id="how-it-works" className="scroll-mt-8 border-y border-border bg-surface">
          <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
            <p className="text-sm font-medium tracking-wide text-brand uppercase">How it works</p>
            <h2 className="mt-3 max-w-2xl font-display text-4xl leading-tight sm:text-5xl">Five steps from quote to settled.</h2>
            <ol className="mt-12 grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-5">
              {steps.map((s, i) => (
                <li key={s.t} className="bg-surface p-6">
                  <span className="font-display text-3xl text-brand">{i + 1}</span>
                  <p className="mt-3 font-semibold">{s.t}</p>
                  <p className="mt-2 text-[15px] text-text-muted">{s.d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Money */}
        <section id="money" className="mx-auto grid max-w-6xl scroll-mt-8 gap-12 px-6 py-20 sm:py-28 lg:grid-cols-2 lg:items-center">
          <div className="overflow-hidden rounded-xl">
            <Photo name="tables" sizes="(min-width: 1024px) 560px, 100vw" alt="Dinner tables set by the sea" className="aspect-square" />
          </div>
          <div>
            <p className="text-sm font-medium tracking-wide text-brand uppercase">Where the money goes</p>
            <h2 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">Clear rules, set before anyone pays.</h2>
            <dl className="mt-8 divide-y divide-border border-y border-border">
              {[
                { i: Handshake, t: "Deposits", d: "Credited to suppliers only when every required supplier accepts and the booking confirms." },
                { i: CalendarCheck2, t: "Paid holds", d: "An optional fee a supplier earns for accepting and holding the date, even if the booking later expires. Capped by the client." },
                { i: FileCheck2, t: "Balances", d: "Held until after the event, then released by the client or automatically after the review window." },
                { i: RotateCcw, t: "Refunds", d: "If the booking expires, everything not earned as hold fees is credited back to the client." },
              ].map(({ i: Icon, t, d }) => (
                <div key={t} className="flex gap-4 py-5">
                  <Icon className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
                  <div>
                    <dt className="font-semibold">{t}</dt>
                    <dd className="mt-1 text-[15px] text-text-muted">{d}</dd>
                  </div>
                </div>
              ))}
            </dl>
            <div className="mt-8 rounded-lg bg-surface-muted p-5 text-[15px]">
              <p className="font-semibold">Example</p>
              <p className="mt-1 text-text-muted">
                A client funds 1,000.00 USDG for a venue and caterer. The venue accepts early and earns its 30.00 USDG hold fee. The caterer declines and isn&apos;t replaced in time. The booking expires: the venue keeps 30.00 USDG and 970.00 USDG is credited back to the client.
              </p>
            </div>
          </div>
        </section>

        {/* Roles */}
        <section className="border-y border-border bg-surface">
          <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
            <h2 className="max-w-2xl font-display text-4xl leading-tight sm:text-5xl">Start from your side of the booking.</h2>
            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {[
                { t: "Agencies", d: "Build the package, invite the client and suppliers, and track every acceptance in one place.", href: "/app/new", cta: "Create a package" },
                { t: "Clients", d: "Open the link your agency sent, review every supplier and amount, and fund the exact package.", href: "/signin", cta: "Open your invite" },
                { t: "Suppliers", d: "Open your invite to see only your slot and terms, then accept or decline in one step.", href: "/signin", cta: "Open your invite" },
              ].map((r) => (
                <div key={r.t} className="flex flex-col rounded-lg border border-border p-6">
                  <p className="font-display text-2xl">{r.t}</p>
                  <p className="mt-3 flex-1 text-[15px] text-text-muted">{r.d}</p>
                  <Link href={r.href} className="mt-6 inline-flex min-h-11 items-center gap-2 font-medium text-brand hover:underline">
                    {r.cta} <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mx-auto max-w-3xl scroll-mt-8 px-6 py-20 sm:py-28">
          <h2 className="font-display text-4xl leading-tight sm:text-5xl">Questions</h2>
          <div className="mt-10 divide-y divide-border border-y border-border">
            {faqs.map((f) => (
              <details key={f.q} className="group py-2">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 text-lg font-medium [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span className="text-2xl text-text-muted transition-transform group-open:rotate-45" aria-hidden>
                    +
                  </span>
                </summary>
                <p className="pb-4 text-[15px] text-text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Closing */}
        <section className="relative isolate overflow-hidden bg-text">
          <div className="absolute inset-0 -z-10">
            <Photo name="coast" sizes="100vw" alt="A coastal event with guests at long tables" />
            <div className="absolute inset-0 bg-text/60" />
          </div>
          <div className="mx-auto max-w-6xl px-6 py-28 sm:py-40">
            <h2 className="max-w-2xl font-display text-4xl leading-tight text-bg sm:text-6xl">See a whole booking settle in a few minutes.</h2>
            <p className="mt-5 max-w-xl text-lg text-bg/85">
              The demo creates a fresh package with short deadlines on a test network. Switch between agency, client and supplier views and watch the real contract state change.
            </p>
            <div className="mt-9">
              <LinkButton href="/demo" intent="onPhoto" size="lg">
                Start the demo <ArrowRight className="size-4" aria-hidden />
              </LinkButton>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
