import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { CopyCode } from "./copy-code";
import { Notice } from "@/components/ui/status";
import { anchor, docHref, type DocPage as Page, type DocSection } from "@/lib/docs";

function Section({ s }: { s: DocSection }) {
  return (
    <section id={anchor(s.title)} className="mt-10 scroll-mt-24">
      <h2 className="text-xl font-semibold">
        <a href={`#${anchor(s.title)}`} className="hover:underline">{s.title}</a>
      </h2>
      {s.body?.map((p, i) => (
        <p key={i} className="mt-3 text-[15px] leading-relaxed text-text-muted">{p}</p>
      ))}
      {s.list && (
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-text-muted">
          {s.list.map((x) => <li key={x}>{x}</li>)}
        </ul>
      )}
      {s.flow && (
        <ol className="mt-4 grid gap-px overflow-hidden rounded-lg border border-border bg-border">
          {s.flow.map((x, i) => (
            <li key={x} className="flex gap-4 bg-surface p-4">
              <span className="font-display text-2xl leading-none text-brand">{i + 1}</span>
              <p className="text-[15px] leading-relaxed">{x}</p>
            </li>
          ))}
        </ol>
      )}
      {s.table && (
        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-[14px]">
            <thead className="bg-surface-muted">
              <tr>{s.table.head.map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody>
              {s.table.rows.map((r) => (
                <tr key={r.join("|")} className="border-t border-border align-top">
                  {r.map((c, i) => (
                    <td key={i} className={c.startsWith("0x") ? "px-3 py-2 font-mono text-[13px] break-all" : "px-3 py-2 text-text-muted"}>{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {s.code && (
        <div className="mt-4 overflow-hidden rounded-lg border border-border bg-surface">
          <div className="flex justify-end border-b border-border px-2 py-1.5">
            <CopyCode text={s.code} />
          </div>
          <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed"><code>{s.code}</code></pre>
        </div>
      )}
      {s.callout && (
        <Notice tone={s.callout.warning ? "waiting" : "info"} className="mt-4" title={s.callout.title}>{s.callout.body}</Notice>
      )}
    </section>
  );
}

export function DocPage({ page, prev, next }: { page: Page; prev: Page | null; next: Page | null }) {
  return (
    <div className="flex gap-10">
      <article className="min-w-0 flex-1 py-10 sm:py-14">
        <p className="text-sm font-medium tracking-wide text-brand uppercase">{page.group}</p>
        <h1 className="mt-2 font-display text-4xl sm:text-5xl">{page.title}</h1>
        <p className="mt-4 text-lg text-text-muted">{page.description}</p>
        {page.sections.map((s) => <Section key={s.title} s={s} />)}
        <nav aria-label="Previous and next" className="mt-14 grid gap-3 border-t border-border pt-6 sm:grid-cols-2">
          {prev ? (
            <Link href={docHref(prev)} className="rounded-lg border border-border p-4 hover:bg-surface-muted">
              <span className="flex items-center gap-1 text-[13px] text-text-muted"><ArrowLeft className="size-3.5" aria-hidden /> Previous</span>
              <span className="mt-1 block font-medium">{prev.title}</span>
            </Link>
          ) : <span />}
          {next && (
            <Link href={docHref(next)} className="rounded-lg border border-border p-4 text-right hover:bg-surface-muted">
              <span className="flex items-center justify-end gap-1 text-[13px] text-text-muted">Next <ArrowRight className="size-3.5" aria-hidden /></span>
              <span className="mt-1 block font-medium">{next.title}</span>
            </Link>
          )}
        </nav>
      </article>
      {page.sections.length > 1 && (
        <aside className="sticky top-16 hidden h-fit w-52 shrink-0 py-14 xl:block">
          <p className="mb-2 text-[13px] font-medium tracking-wide text-text-muted uppercase">On this page</p>
          <ul className="flex flex-col gap-1.5 text-sm">
            {page.sections.map((s) => (
              <li key={s.title}><a href={`#${anchor(s.title)}`} className="text-text-muted hover:text-text">{s.title}</a></li>
            ))}
          </ul>
        </aside>
      )}
    </div>
  );
}
