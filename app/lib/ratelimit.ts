import { HttpError } from "./chains";
import { db } from "./supabase";

/**
 * Fixed-window limit backed by the `rate_limits` table (serverless instances share no memory).
 * Throws 429 once `key` has been hit more than `max` times in the current `windowSec` window.
 */
export async function rateLimit(key: string, max: number, windowSec: number): Promise<void> {
  const { data, error } = await db().rpc("hit_rate_limit", { p_key: key, p_window_sec: windowSec });
  if (error) throw error;
  if ((data as number) > max) throw new HttpError(429, "rate limited");
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
