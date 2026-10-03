import { z } from "zod";
import { runDeadline } from "@/lib/deadlines";
import { handler, json } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const maxDuration = 60;

const body = z.object({ chainId: z.number().int(), packageId: z.union([z.string(), z.number()]).transform(BigInt) });

/** Polled by open app sessions; there is no background scheduler on Vercel Hobby. */
export const POST = handler(async (req) => {
  const { chainId, packageId } = body.parse(await json(req));
  await rateLimit(`deadline:ip:${clientIp(req)}`, 30, 60);
  await rateLimit(`deadline:pkg:${chainId}:${packageId}`, 6, 60);
  return runDeadline(chainId, packageId);
});
