import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { HttpError } from "@/lib/chains";
import { ownDraft } from "@/lib/drafts";
import { handler, json } from "@/lib/http";
import { ensureSetupInvites, readiness } from "@/lib/setup";
import type { DraftData } from "@/lib/types";

const body = z.object({ sendEmails: z.boolean().default(true) });
const email = z.string().email();

/** One setup link per participant of the saved draft; returns who has a payout account ready. */
export const POST = handler(async (req, ctx) => {
  const { id } = await ctx.params;
  const d = await ownDraft(await requireUser(req), id);
  const { sendEmails } = body.parse(await json(req));
  const data = d.data as DraftData;
  const wanted = [
    { key: "client", role: "client" as const, email: data.clientEmail.trim().toLowerCase() },
    ...data.slots.map((s) => ({ key: s.key, role: "supplier" as const, email: s.email.trim().toLowerCase() })),
  ];
  for (const w of wanted) if (!email.safeParse(w.email).success) throw new HttpError(400, `invalid email: ${w.email || "(empty)"}`);
  const { rows, emailed } = await ensureSetupInvites({ draft_id: id }, wanted, data.title || "a booking", sendEmails);
  return { readiness: await readiness(rows), emailed };
});
