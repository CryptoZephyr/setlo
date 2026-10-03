import { NextResponse } from "next/server";
import { z } from "zod";
import { CHAINS } from "@/lib/chains";
import { env } from "@/lib/env";
import { handleLogs } from "@/lib/relay";
import { db } from "@/lib/supabase";
import { extractLogs, verifySignature } from "@/lib/webhook";

export const maxDuration = 60;

/** One QuickNode stream/webhook per chain, filtered to Setlo logs, pointed at `?chainId=<id>`. */
export async function POST(req: Request) {
  const body = await req.text();
  const ok = verifySignature(
    env().QUICKNODE_WEBHOOK_SECRET,
    body,
    req.headers.get("x-qn-nonce"),
    req.headers.get("x-qn-timestamp"),
    req.headers.get("x-qn-signature"),
  );
  if (!ok) return NextResponse.json({ error: "bad signature" }, { status: 401 });

  const chainId = z.coerce.number().int().safeParse(new URL(req.url).searchParams.get("chainId"));
  if (!chainId.success || !CHAINS[chainId.data]) return NextResponse.json({ error: "unknown chain" }, { status: 400 });

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const logs = extractLogs(payload);
  const hashes = [...new Set(logs.map((l) => l.transactionHash!))];
  if (hashes.length) {
    await db()
      .from("tx_log")
      .upsert(
        hashes.map((hash) => ({ hash, chain_id: chainId.data, fn: "event", source: "webhook", status: "success" })),
        { onConflict: "hash", ignoreDuplicates: true },
      );
  }
  await handleLogs(chainId.data, logs);
  return NextResponse.json({ logs: logs.length });
}
