"use client";

import { useLinkWithOAuth, useLinkWithPasskey, usePrivy } from "@privy-io/react-auth";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/status";
import { friendly } from "@/lib/client/errors";

/** Lets a signed-in user add Google or a passkey so returning sign-ins skip the email code. */
export function QuickSignIn() {
  const { user } = usePrivy();
  const { initOAuth, state: oauth } = useLinkWithOAuth();
  const { linkWithPasskey } = useLinkWithPasskey();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    if (oauth.status === "error") setError(linkError(oauth.error, "Google account"));
    if (oauth.status === "done") setDone("Google sign-in is on. Next time, choose Continue with Google.");
  }, [oauth]);

  if (!user) return null;
  const google = user.google?.email;
  const passkeys = user.linkedAccounts.filter((a) => a.type === "passkey").length;

  async function addPasskey() {
    setBusy(true);
    setError(null);
    try {
      await linkWithPasskey({ name: "Setlo" });
      setDone("Passkey added. Next time, choose Sign in with a passkey on this device.");
    } catch (e) {
      setError(linkError(e, "passkey"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold">Sign-in methods</h2>
      <p className="mt-1 text-[15px] text-text-muted">
        Email code always works. Add Google or a passkey to skip the code next time. They sign in to this same account, so your bookings and payout account stay the same.
      </p>
      {done && <Notice tone="ok" className="mt-4">{done}</Notice>}
      {error && <Notice tone="bad" className="mt-4">{error}</Notice>}
      <div className="mt-4 flex flex-wrap gap-2">
        {google ? (
          <p className="text-sm text-text-muted">Google sign-in is on ({google}).</p>
        ) : (
          <Button intent="secondary" pending={oauth.status === "loading"} isDisabled={busy} onPress={() => { setError(null); initOAuth({ provider: "google" }).catch((e: unknown) => setError(linkError(e, "Google account"))); }}>
            Link Google
          </Button>
        )}
        {passkeys > 0 ? (
          <p className="text-sm text-text-muted">Passkey sign-in is on ({passkeys === 1 ? "1 passkey" : `${passkeys} passkeys`}).</p>
        ) : (
          <Button intent="secondary" pending={busy} onPress={() => void addPasskey()}>
            Add a passkey
          </Button>
        )}
      </div>
    </Card>
  );
}

function linkError(e: unknown, what: string) {
  const msg = e instanceof Error ? e.message : String(e ?? "");
  if (/linked_to_another_user|already.*(linked|associated)/i.test(msg)) return `That ${what} is already used by a different Setlo account.`;
  if (/cancel|denied|abort|not allowed/i.test(msg)) return "The request was cancelled.";
  return friendly(e ?? `Couldn't link the ${what}.`);
}
