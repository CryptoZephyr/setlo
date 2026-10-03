"use client";

import { RouteError } from "@/components/app/route-states";

export default function Error(props: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-dvh items-start justify-center">
      <RouteError {...props} />
    </main>
  );
}
