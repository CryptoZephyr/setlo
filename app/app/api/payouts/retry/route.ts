import { getAddress, isAddress } from "viem";
import { z } from "zod";
import { setloAbi } from "@/lib/abi";
import { getChain, HttpError } from "@/lib/chains";
import { publicClient } from "@/lib/clients";
import { handler, json } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { submit } from "@/lib/relay";

export const maxDuration = 60;

const body = z.object({ chainId: z.number().int(), recipient: z.string().refine(isAddress).transform((a) => getAddress(a)) });

/** Pushes a recipient's credited balance to them again (e.g. after an automatic payout failed). */
export const POST = handler(async (req) => {
  const { chainId, recipient } = body.parse(await json(req));
  await rateLimit(`payout:ip:${clientIp(req)}`, 10, 60);
  await rateLimit(`payout:addr:${chainId}:${recipient}`, 3, 300);
  const owed = await publicClient(chainId).readContract({
    address: getChain(chainId).setlo,
    abi: setloAbi,
    functionName: "claimable",
    args: [recipient],
  });
  if (owed === BigInt(0)) throw new HttpError(409, "nothing is waiting to be paid out");
  return submit(chainId, "claimFor", [recipient]);
});
