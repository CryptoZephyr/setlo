import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getChain, HttpError } from "@/lib/chains";
import { ownDraft } from "@/lib/drafts";
import { draftData } from "@/lib/draft-schema";
import { handler, json } from "@/lib/http";
import { readiness, SETUP_COLS } from "@/lib/setup";
import { db } from "@/lib/supabase";
import type { DraftDetail } from "@/lib/types";

export const GET = handler(async (req, ctx): Promise<DraftDetail> => {
  const { id } = await ctx.params;
  const d = await ownDraft(await requireUser(req), id);
  const { data: rows } = await db().from("setup_invites").select(SETUP_COLS).eq("draft_id", id);
  return {
    id: d.id,
    chainId: d.chain_id,
    data: d.data,
    updatedAt: d.updated_at,
    packageRef: d.package_ref,
    readiness: await readiness(rows ?? []),
  };
});

const body = z.object({ chainId: z.number().int(), data: draftData, updatedAt: z.string() });

/** Saves the draft. Rejects with 409 if another tab saved a newer version first. */
export const PUT = handler(async (req, ctx) => {
  const { id } = await ctx.params;
  const d = await ownDraft(await requireUser(req), id);
  if (d.package_ref) throw new HttpError(409, "this draft was already created onchain");
  const b = body.parse(await json(req));
  getChain(b.chainId);
  if (b.updatedAt !== d.updated_at) throw new HttpError(409, "this draft was changed in another tab; reload it");
  const { data, error } = await db()
    .from("drafts")
    .update({ chain_id: b.chainId, data: b.data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("updated_at")
    .single();
  if (error) throw error;
  return { updatedAt: data.updated_at };
});

export const DELETE = handler(async (req, ctx) => {
  const { id } = await ctx.params;
  const d = await ownDraft(await requireUser(req), id);
  if (d.package_ref) throw new HttpError(409, "this draft was already created onchain");
  await db().from("drafts").delete().eq("id", id);
  return { ok: true };
});
