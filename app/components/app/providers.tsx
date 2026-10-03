"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { arbitrumSepolia } from "viem/chains";
import { robinhoodTestnet } from "@/lib/chains";

export function Providers({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (!appId)
    return (
      <div className="mx-auto max-w-lg p-10" role="alert">
        <p className="font-semibold">Sign-in isn&apos;t configured</p>
        <p className="mt-1 text-sm text-text-muted">This deployment is missing NEXT_PUBLIC_PRIVY_APP_ID.</p>
      </div>
    );
  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["email"],
        appearance: { theme: "light", accentColor: "#1F5E4B", logo: "/img/logo-128.png", landingHeader: "Sign in to Setlo" },
        embeddedWallets: { ethereum: { createOnLogin: "users-without-wallets" }, showWalletUIs: false },
        defaultChain: arbitrumSepolia,
        supportedChains: [arbitrumSepolia, robinhoodTestnet],
      }}
    >
      {children}
    </PrivyProvider>
  );
}
