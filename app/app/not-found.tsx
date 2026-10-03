import Link from "next/link";
import { Logo } from "@/components/app/shell";
import { LinkButton } from "@/components/ui/button";
import { Notice } from "@/components/ui/status";

export const metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center px-4 py-12">
      <Link href="/" className="mb-8" aria-label="Setlo home"><Logo /></Link>
      <div className="w-full max-w-lg">
        <Notice
          tone="neutral"
          title="This page doesn't exist"
          action={
            <>
              <LinkButton href="/app">Go to your bookings</LinkButton>
              <LinkButton href="/" intent="secondary">Home page</LinkButton>
            </>
          }
        >
          If you followed an invitation or setup link, check that you copied all of it, or ask the agency to send it again.
        </Notice>
      </div>
    </main>
  );
}
