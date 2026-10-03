"use client";

import { useEffect } from "react";
import { Button, LinkButton } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/status";

/** Shown by route error boundaries when a page crashes while rendering. */
export function RouteError({ error, reset, home = "/" }: { error: Error & { digest?: string }; reset: () => void; home?: string }) {
  useEffect(() => console.error(error), [error]);
  return (
    <ErrorState
      title="Something went wrong on this page"
      className="px-4 pb-10"
      action={
        <>
          <Button onPress={reset}>Try again</Button>
          <LinkButton href={home} intent="secondary">{home === "/" ? "Go to the home page" : "Go to your bookings"}</LinkButton>
        </>
      }
    >
      Nothing was sent onchain by this error. If you had just started an action, check the booking before trying it again.
      {error.digest && <span className="mt-1 block text-[13px] text-text-muted">Reference: {error.digest}</span>}
    </ErrorState>
  );
}
