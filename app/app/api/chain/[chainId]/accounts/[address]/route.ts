import { getAddress, isAddress } from "viem";
import { z } from "zod";
import { handler } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { readAccount } from "@/lib/state";

const params = z.object({
  chainId: z.coerce.number().int(),
  address: z.string().refine(isAddress, "invalid address").transform((a) => getAddress(a)),
});

/** Balances and signature nonces for an address. */
export const GET = handler(async (req, ctx) => {
  const { chainId, address } = params.parse(await ctx.params);
  await rateLimit(`account:ip:${clientIp(req)}`, 120, 60);
  return readAccount(chainId, address);
});
