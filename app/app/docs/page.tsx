import { redirect } from "next/navigation";
import { DOC_PAGES, docHref } from "@/lib/docs";

export default function Docs() {
  redirect(docHref(DOC_PAGES[0]));
}
