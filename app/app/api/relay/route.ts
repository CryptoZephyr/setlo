import { HttpError } from "@/lib/chains";
import { handler, json } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { coerceArgs, packageIdOf, relayRequest, submit } from "@/lib/relay";
import { db } from "@/lib/supabase";

export const maxDuration = 60;

/** Submits a user-signed (or permissionless) Setlo call and pays its gas. Only whitelisted functions. */
export const POST = handler(async (req) => {
  const { chainId, functionName, args: raw } = relayRequest.parse(await json(req));
  if (functionName === "claimFor") throw new HttpError(403, "claims are pushed automatically");
  const args = coerceArgs(functionName, raw);
  const packageId = packageIdOf(functionName, args);
  await rateLimit(`relay:ip:${clientIp(req)}`, 30, 60);
  await rateLimit(`relay:pkg:${chainId}:${packageId}`, 20, 60);
  const result = await submit(chainId, functionName, args);
  await db()
    .from("funnel_events")
    .insert({ event: `relay_${functionName}`, chain_id: chainId, package_id: packageId?.toString() ?? null });
  return result;
});
