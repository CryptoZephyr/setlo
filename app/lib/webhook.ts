import { createHmac, timingSafeEqual } from "crypto";
import type { RawLog } from "./relay";

/** QuickNode Streams/Webhooks signature: hex HMAC-SHA256(secret, nonce + timestamp + body). */
export function verifySignature(
  secret: string,
  body: string,
  nonce: string | null,
  timestamp: string | null,
  signature: string | null,
  maxAgeSec = 300,
  nowSec = Math.floor(Date.now() / 1000),
): boolean {
  if (!nonce || !timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowSec - ts) > maxAgeSec) return false;
  const expected = createHmac("sha256", secret).update(nonce + timestamp + body).digest("hex");
  const got = signature.replace(/^sha256=/, "");
  return got.length === expected.length && timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

/**
 * Pulls EVM logs out of a webhook payload regardless of nesting (QuickNode filters can return blocks,
 * receipts, or bare log arrays).
 */
export function extractLogs(payload: unknown): RawLog[] {
  const out: RawLog[] = [];
  const visit = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(visit);
    if (typeof v !== "object" || v === null) return;
    const o = v as Record<string, unknown>;
    if (typeof o.address === "string" && Array.isArray(o.topics) && typeof o.data === "string" && o.transactionHash) {
      out.push({
        address: o.address as RawLog["address"],
        topics: o.topics as RawLog["topics"],
        data: o.data as RawLog["data"],
        transactionHash: o.transactionHash as RawLog["transactionHash"],
        logIndex: typeof o.logIndex === "string" ? Number(BigInt(o.logIndex)) : (o.logIndex as number),
        blockNumber:
          typeof o.blockNumber === "string" || typeof o.blockNumber === "number" ? BigInt(o.blockNumber) : undefined,
      });
      return;
    }
    Object.values(o).forEach(visit);
  };
  visit(payload);
  return out;
}
