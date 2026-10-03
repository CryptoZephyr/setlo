import { createRemoteJWKSet, jwtVerify } from "jose";
import { getAddress, type Address } from "viem";
import { HttpError } from "./chains";
import { env } from "./env";
import { db } from "./supabase";

export type User = { id: string; email: string | null; wallet: Address | null };

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

type LinkedAccount = { type: string; address?: string; wallet_client_type?: string };

/** Verifies the Privy access token from `Authorization: Bearer`, then loads email and embedded wallet. */
export async function requireUser(req: Request): Promise<User> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new HttpError(401, "missing access token");
  const appId = env().NEXT_PUBLIC_PRIVY_APP_ID;
  jwks ??= createRemoteJWKSet(new URL(`https://auth.privy.io/api/v1/apps/${appId}/jwks.json`));
  let sub: string;
  try {
    const { payload } = await jwtVerify(token, jwks, { issuer: "privy.io", audience: appId });
    sub = payload.sub!;
  } catch {
    throw new HttpError(401, "invalid access token");
  }

  const res = await fetch(`https://auth.privy.io/api/v1/users/${encodeURIComponent(sub)}`, {
    headers: {
      authorization: `Basic ${Buffer.from(`${appId}:${env().PRIVY_APP_SECRET}`).toString("base64")}`,
      "privy-app-id": appId,
    },
  });
  if (!res.ok) throw new HttpError(401, "unknown user");
  const accounts = ((await res.json()) as { linked_accounts: LinkedAccount[] }).linked_accounts;
  const email = accounts.find((a) => a.type === "email")?.address?.toLowerCase() ?? null;
  const embedded = accounts.filter((a) => a.type === "wallet" && a.wallet_client_type === "privy" && a.address).map((a) => getAddress(a.address!));
  const { data: prev } = await db().from("profiles").select("wallet").eq("privy_id", sub).maybeSingle();
  const registered = embedded.find((w) => w.toLowerCase() === (prev?.wallet as string | null | undefined)?.toLowerCase());
  const user: User = { id: sub, email, wallet: registered ?? embedded[0] ?? null };

  await db()
    .from("profiles")
    .upsert({ privy_id: user.id, email: user.email, wallet: user.wallet, last_seen_at: new Date().toISOString() });
  return user;
}
