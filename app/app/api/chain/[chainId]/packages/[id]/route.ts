import { z } from "zod";
import { handler } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { readPackageState } from "@/lib/state";

const params = z.object({ chainId: z.coerce.number().int(), id: z.string().regex(/^\d+$/).transform(BigInt) });

/** Public onchain state of a package (everything here is already public on the chain). */
export const GET = handler(async (req, ctx) => {
  const { chainId, id } = params.parse(await ctx.params);
  await rateLimit(`state:ip:${clientIp(req)}`, 120, 60);
  return readPackageState(chainId, id);
});
