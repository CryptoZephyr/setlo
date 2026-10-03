"use client";

import { useLoginWithEmail, useLoginWithOAuth, useLoginWithPasskey, usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Form } from "react-aria-components";
import { Logo } from "@/components/app/shell";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { Card, Notice } from "@/components/ui/status";
import { friendly } from "@/lib/client/errors";

/** Only same-site paths are allowed as a post-login destination. */
function safeNext(raw: string | null) {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/app";
}

const QUICK_FAILED = (method: "Google" | "passkey") =>
  `Couldn't sign in with ${method === "Google" ? "Google" : "a passkey"}. If you haven't turned on ${method} sign-in for your Setlo account yet, sign in with an email code first, then turn it on from your Account page.`;

export function SignIn() {
  const { ready, authenticated } = usePrivy();
  const { sendCode, loginWithCode, state } = useLoginWithEmail();
  const { initOAuth, state: oauth } = useLoginWithOAuth();
  const { loginWithPasskey } = useLoginWithPasskey();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const signedOut = params.get("signedout") === "1";
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sent = state.status === "awaiting-code-input" || state.status === "submitting-code";
  const invite = next.startsWith("/invite/") || next.startsWith("/setup/");

  useEffect(() => {
    if (ready && authenticated) router.replace(next);
  }, [ready, authenticated, router, next]);

  useEffect(() => {
    if (oauth.status === "error") setError(QUICK_FAILED("Google"));
  }, [oauth.status]);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-4 py-12">
      <Link href="/" className="mb-8" aria-label="Setlo home">
        <Logo />
      </Link>
      <Card className="w-full max-w-md">
        <h1 className="font-display text-3xl">{sent ? "Check your email" : "Sign in or create an account"}</h1>
        <p className="mt-2 text-[15px] text-text-muted">
          {sent
            ? `We sent a 6-digit code to ${email}. It may take a minute, and can land in spam.`
            : invite
              ? "Use the email address your invitation was sent to. You'll go straight to it after signing in."
              : "Enter your email and we'll send a code. No password or crypto wallet needed. If you've used Setlo before, you'll get back the same bookings and payout account."}
        </p>
        {signedOut && !sent && !error && (
          <Notice tone="ok" className="mt-5">You&apos;re signed out. Sign in with the same email to get back to your bookings.</Notice>
        )}
        {error && <Notice tone="bad" className="mt-5">{error}</Notice>}
        {!sent ? (
          <Form className="mt-6 flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void run(() => sendCode({ email: email.trim() })); }}>
            <TextField label="Email" type="email" autoComplete="email" inputMode="email" value={email} onChange={setEmail} isRequired />
            <Button type="submit" full pending={busy}>Email me a code</Button>
            <div className="flex items-center gap-3 text-[13px] text-text-muted" aria-hidden>
              <span className="h-px flex-1 bg-border" />
              or, if you&apos;ve turned it on
              <span className="h-px flex-1 bg-border" />
            </div>
            <Button intent="secondary" full pending={oauth.status === "loading"} isDisabled={busy} onPress={() => { setError(null); initOAuth({ provider: "google", disableSignup: true }).catch(() => setError(QUICK_FAILED("Google"))); }}>
              Continue with Google
            </Button>
            <Button intent="secondary" full isDisabled={busy} onPress={() => void run(() => loginWithPasskey().catch((e: unknown) => { throw /cancel|denied|abort|not allowed/i.test(String(e)) ? new Error("The request was cancelled.") : new Error(QUICK_FAILED("passkey")); }))}>
              Sign in with a passkey
            </Button>
          </Form>
        ) : (
          <Form className="mt-6 flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void run(() => loginWithCode({ code: code.trim() })); }}>
            <TextField label="Code" autoComplete="one-time-code" inputMode="numeric" value={code} onChange={setCode} isRequired />
            <Button type="submit" full pending={busy}>Sign in</Button>
            <div className="flex flex-wrap justify-between gap-2 text-sm">
              <Button intent="ghost" size="sm" onPress={() => void run(() => sendCode({ email: email.trim() }))}>Send a new code</Button>
              <Button intent="ghost" size="sm" onPress={() => { setCode(""); setError(null); window.location.reload(); }}>Use a different email</Button>
            </div>
          </Form>
        )}
        <p className="mt-6 border-t border-border pt-4 text-[13px] text-text-muted">
          Setlo creates a payout account for your email. Test networks only; amounts are test USDG with no value.
        </p>
      </Card>
    </div>
  );
}
