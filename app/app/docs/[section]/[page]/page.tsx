import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocPage } from "@/components/docs/doc-page";
import { DOC_PAGES, findDoc } from "@/lib/docs";

type Params = { section: string; page: string };

export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  return DOC_PAGES.map((p) => {
    const [section, page] = p.path.split("/");
    return { section, page };
  });
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { section, page } = await params;
  const doc = findDoc(`${section}/${page}`);
  return doc ? { title: `${doc.page.title} · Docs`, description: doc.page.description } : {};
}

export default async function Doc({ params }: { params: Promise<Params> }) {
  const { section, page } = await params;
  const doc = findDoc(`${section}/${page}`);
  if (!doc) notFound();
  return <DocPage {...doc} />;
}
