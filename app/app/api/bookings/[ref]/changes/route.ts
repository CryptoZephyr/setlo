import { getAddress } from "viem";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { HttpError } from "@/lib/chains";
import { inviteEmail, sendEmail } from "@/lib/email";
import { handler, json } from "@/lib/http";
import { inviteLink, loadPackageRow, newToken, snapshotVersion } from "@/lib/meta";
import { readPackageState } from "@/lib/state";
import { db } from "@/lib/supabase";
import { termsHash } from "@/lib/terms";

const category = z.enum(["venue", "catering", "av", "photo", "decor", "transport", "other"]);
const body = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("quote"), slotIndex: z.number().int().min(0), termsText: z.string().max(5000) }),
  z.object({
    kind: z.literal("replace"),
    slotIndex: z.number().int().min(0),
    termsText: z.string().max(5000),
    name: z.string().min(1).max(120),
    email: z.string().email().toLowerCase(),
    category,
    sendEmail: z.boolean().default(true),
  }),
  z.object({ kind: z.literal("shared"), sharedTermsText: z.string().max(5000) }),
]);

/**
 * Records the human-readable side of a change the agency already made onchain (updateQuote,
 * replaceSupplier, updateSharedTerms). Texts must hash to the new onchain commitments.
 */
export const POST = handler(async (req, ctx) => {
  const { ref } = await ctx.params;
  const user = await requireUser(req);
  const row = await loadPackageRow(ref);
  if (row.agency_privy_id !== user.id) throw new HttpError(403, "only the agency can record changes");
  const b = body.parse(await json(req));
  const state = await readPackageState(row.chain_id, BigInt(row.package_id));

  let invite: { email: string; link: string; emailed: boolean } | null = null;
  if (b.kind === "shared") {
    if (termsHash(b.sharedTermsText) !== state.pkg.sharedTermsHash) throw new HttpError(409, "shared terms not updated onchain yet");
    const r = await db().from("packages").update({ terms_text: b.sharedTermsText }).eq("id", ref);
    if (r.error) throw r.error;
  } else {
    const slot = state.slots[b.slotIndex];
    if (!slot) throw new HttpError(400, "no such slot");
    if (termsHash(b.termsText) !== slot.termsHash) throw new HttpError(409, "slot terms not updated onchain yet");
    if (b.kind === "quote") {
      const r = await db().from("slots").update({ terms_text: b.termsText }).eq("package_ref", ref).eq("slot_index", b.slotIndex);
      if (r.error) throw r.error;
    } else {
      const { data: setup } = await db()
        .from("setup_invites")
        .select("registered_wallet")
        .eq("package_ref", ref)
        .eq("email", b.email)
        .not("registered_wallet", "is", null);
      if (!(setup ?? []).some((r) => getAddress(r.registered_wallet) === getAddress(slot.payee)))
        throw new HttpError(409, "the onchain payee is not the payout account this email registered for this booking");
      const u = await db()
        .from("slots")
        .update({
          supplier_name: b.name,
          supplier_email: b.email,
          category: b.category,
          terms_text: b.termsText,
          payout_address: getAddress(slot.payee),
        })
        .eq("package_ref", ref)
        .eq("slot_index", b.slotIndex);
      if (u.error) throw u.error;
      const { data: active } = await db()
        .from("invites")
        .select("token, email")
        .eq("package_ref", ref)
        .eq("slot_index", b.slotIndex)
        .neq("status", "revoked");
      let token = (active ?? []).find((i) => i.email === b.email)?.token as string | undefined;
      const fresh = !token;
      if (!token) {
        const rv = await db().from("invites").update({ status: "revoked" }).eq("package_ref", ref).eq("slot_index", b.slotIndex);
        if (rv.error) throw rv.error;
        token = newToken();
        const ins = await db().from("invites").insert({ token, package_ref: ref, role: "supplier", slot_index: b.slotIndex, email: b.email });
        if (ins.error) throw ins.error;
      }
      const link = inviteLink(token);
      const emailed =
        fresh && b.sendEmail
          ? await sendEmail(inviteEmail(b.email, "supplier", row.title, link), { package: ref, role: "supplier", slot: b.slotIndex })
          : false;
      invite = { email: b.email, link, emailed };
    }
  }
  const reason =
    b.kind === "shared" ? "Event date or shared terms changed" : b.kind === "quote" ? `Slot ${b.slotIndex + 1} terms changed` : `Slot ${b.slotIndex + 1} supplier replaced`;
  await snapshotVersion(row, reason);
  return { ok: true, invite };
});
