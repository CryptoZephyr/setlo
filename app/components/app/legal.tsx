import Link from "next/link";
import { Footer, Logo } from "./shell";

export const UPDATED = "3 October 2026";
export const CONTACT = "setlo.app@gmail.com";

export function LegalPage({ title, intro, sections }: { title: string; intro: string; sections: { h: string; p: React.ReactNode[] }[] }) {
  return (
    <>
      <header className="border-b border-border bg-bg">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" aria-label="Setlo home"><Logo /></Link>
          <Link href="/docs" className="inline-flex min-h-11 items-center rounded-md px-3 text-[15px] hover:bg-surface-muted">Docs</Link>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-6 py-14 sm:py-20">
        <h1 className="font-display text-4xl sm:text-5xl">{title}</h1>
        <p className="mt-3 text-sm text-text-muted">Last updated {UPDATED}</p>
        <p className="mt-6 text-lg text-text-muted">{intro}</p>
        {sections.map((s) => (
          <section key={s.h} className="mt-10">
            <h2 className="text-xl font-semibold">{s.h}</h2>
            {s.p.map((x, i) => (
              <p key={i} className="mt-3 text-[15px] leading-relaxed text-text-muted">{x}</p>
            ))}
          </section>
        ))}
      </main>
      <Footer />
    </>
  );
}
