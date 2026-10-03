"use client";

import { useCreateWallet, usePrivy, useSignTypedData, useWallets } from "@privy-io/react-auth";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Address, EIP1193Provider, Hex } from "viem";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/status";
import { apiFetch } from "@/lib/client/api";
import { friendly } from "@/lib/client/errors";
import { providerSigner, type Signer } from "@/lib/client/signer";
import { PageLoading } from "./shell";

type Session = {
  email: string;
  wallet: Address;
  signer: Signer;
  api: <T>(path: string, opts?: { method?: string; body?: unknown }) => Promise<T>;
  logout: () => Promise<void>;
};

const Ctx = createContext<Session | null>(null);

export function useSession(): Session {
  const s = useContext(Ctx);
  if (!s) throw new Error("useSession outside <RequireSession>");
  return s;
}

/**
 * Signed-in area: sends signed-out visitors to /signin (keeping their destination), waits for the
 * embedded payout account, and registers it with Setlo before rendering children.
 */
export function RequireSession({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, user, getAccessToken, logout } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const { createWallet } = useCreateWallet();
  const { signTypedData } = useSignTypedData();
  const router = useRouter();
  const path = usePathname();
  const [synced, setSynced] = useState<Address | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (ready && !authenticated) router.replace(`/signin?next=${encodeURIComponent(path)}`);
  }, [ready, authenticated, router, path]);

  const embedded = wallets.find((w) => w.walletClientType === "privy");
  const address = (user?.wallet?.address ?? embedded?.address) as Address | undefined;

  useEffect(() => {
    if (!ready || !authenticated || !walletsReady || address) return;
    createWallet().catch((e: unknown) => {
      if (!String(e).includes("already has")) setError(friendly(e));
    });
  }, [ready, authenticated, walletsReady, address, createWallet]);

  useEffect(() => {
    if (!authenticated || !address) return;
    let stop = false;
    (async () => {
      for (let i = 0; i < 6 && !stop; i++) {
        try {
          const token = await getAccessToken();
          const me = await apiFetch<{ wallet: Address | null }>("/api/me", { method: "POST", body: {}, token });
          if (me.wallet) {
            setSynced(me.wallet);
            setError(null);
            return;
          }
        } catch (e) {
          setError(friendly(e));
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
      if (!stop) setError((e) => e ?? "Your payout account isn't ready yet.");
    })();
    return () => {
      stop = true;
    };
  }, [authenticated, address, getAccessToken, attempt]);

  const api = useCallback(
    async <T,>(p: string, opts: { method?: string; body?: unknown } = {}) => apiFetch<T>(p, { ...opts, token: await getAccessToken() }),
    [getAccessToken],
  );

  const session = useMemo<Session | null>(() => {
    if (!synced || !embedded || !user?.email?.address) return null;
    const signer = providerSigner(
      synced,
      () => embedded.getEthereumProvider() as Promise<EIP1193Provider>,
      (id) => embedded.switchChain(id),
      async (req) => (await signTypedData(JSON.parse(JSON.stringify(req)), { address: synced })).signature as Hex,
    );
    return { email: user.email.address.toLowerCase(), wallet: synced, signer, api, logout };
  }, [synced, embedded, user, signTypedData, api, logout]);

  if (!ready || !authenticated) return <PageLoading label="Checking your sign-in" />;
  if (error && !session)
    return (
      <ErrorState className="px-4 pt-24" title="Account setup didn't finish" action={<Button onPress={() => setAttempt((n) => n + 1)}>Try again</Button>}>
        {error}
      </ErrorState>
    );
  if (!session) return <PageLoading label="Setting up your payout account" detail="Setlo creates it for you. This takes a few seconds the first time." />;
  return <Ctx.Provider value={session}>{children}</Ctx.Provider>;
}
