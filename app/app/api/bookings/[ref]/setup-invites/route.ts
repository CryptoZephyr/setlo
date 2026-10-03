import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { HttpError } from "@/lib/chains";
import { handler, json } from "@/lib/http";
import { loadPackageRow } from "@/lib/meta";
import { ensureSetupInvites, readiness, SETUP_COLS } from "@/lib/setup";
import { db } from "@/lib/supabase";

const body = z.object({ slotIndex: z.number().int().min(0), email: z.string().email().toLowerCase(), sendEmail: z.boolean().default(true) });

async function agencyRow(req: Request, ref: string) {
  const user = await requireUser(req);
  const row = await loadPackageRow(ref);
  if (row.agency_privy_id !== user.id) throw new HttpError(403, "only the agency can invite a replacement");
  return row;
}

/** Account setup for a replacement supplier, so the agency has a payout account to put onchain. */
export const POST = handler(async (req, ctx) => {
  const { ref } = await ctx.params;
  const row = await agencyRow(req, ref);
  const b = body.parse(await json(req));
  const key = `replace:${b.slotIndex}:${b.email}`;
  const { rows, emailed } = await ensureSetupInvites({ package_ref: ref }, [{ key, role: "supplier", email: b.email }], row.title, b.sendEmail);
  const [r] = await readiness(rows);
  return { ...r, emailed: emailed[key] ?? false };
});

export const GET = handler(async (req, ctx) => {
  const { ref } = await ctx.params;
  await agencyRow(req, ref);
  const { data } = await db().from("setup_invites").select(SETUP_COLS).eq("package_ref", ref);
  return { readiness: await readiness(data ?? []) };
});
