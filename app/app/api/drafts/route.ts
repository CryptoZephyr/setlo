import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getChain } from "@/lib/chains";
import { draftData } from "@/lib/draft-schema";
import { handler, json } from "@/lib/http";
import { db } from "@/lib/supabase";

const body = z.object({ chainId: z.number().int(), data: draftData });

export const POST = handler(async (req) => {
  const user = await requireUser(req);
  const b = body.parse(await json(req));
  getChain(b.chainId);
  const { data, error } = await db()
    .from("drafts")
    .insert({ agency_privy_id: user.id, chain_id: b.chainId, data: b.data })
    .select("id, updated_at")
    .single();
  if (error) throw error;
  return { id: data.id, updatedAt: data.updated_at };
});

/** Unfinished drafts (not yet created onchain). */
export const GET = handler(async (req) => {
  const user = await requireUser(req);
  const { data } = await db()
    .from("drafts")
    .select("id, chain_id, data, updated_at")
    .eq("agency_privy_id", user.id)
    .is("package_ref", null)
    .order("updated_at", { ascending: false });
  return {
    drafts: (data ?? []).map((d) => ({ id: d.id, chainId: d.chain_id, title: d.data?.title ?? "", updatedAt: d.updated_at })),
  };
});
