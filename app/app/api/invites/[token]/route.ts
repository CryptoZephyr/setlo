import { requireUser } from "@/lib/auth";
import { getChain, HttpError } from "@/lib/chains";
import { handler } from "@/lib/http";
import { db } from "@/lib/supabase";

function mask(email: string) {
  const [local, domain] = email.split("@");
  return `${local.slice(0, 2)}***@${domain}`;
}

/** Opens an invite. Invites are bound to the invited email; any other login gets a 403. */
export const GET = handler(async (req, ctx) => {
  const { token } = await ctx.params;
  const user = await requireUser(req);
  const { data: invite } = await db()
    .from("invites")
    .select("token, role, slot_index, email, status, packages (id, chain_id, package_id, title, terms_text)")
    .eq("token", token)
    .maybeSingle();
  if (!invite) throw new HttpError(404, "invite not found");
  if (invite.status === "revoked") throw new HttpError(410, "this invite was replaced by a newer one");
  if (user.email !== invite.email) throw new HttpError(403, `this invite was sent to ${mask(invite.email)}`);

  if (invite.status !== "opened") {
    await db().from("invites").update({ status: "opened", opened_by: user.id }).eq("token", token);
  }
  const pkg = invite.packages as unknown as {
    id: string;
    chain_id: number;
    package_id: number;
    title: string;
    terms_text: string;
  };
  const { data: slots } = await db()
    .from("slots")
    .select("slot_index, supplier_name, payout_address")
    .eq("package_ref", pkg.id)
    .order("slot_index");
  await db()
    .from("funnel_events")
    .insert({ event: `invite_opened_${invite.role}`, privy_id: user.id, chain_id: pkg.chain_id, package_id: pkg.package_id });

  return {
    ref: pkg.id,
    role: invite.role,
    slotIndex: invite.slot_index,
    chainId: pkg.chain_id,
    setlo: getChain(pkg.chain_id).setlo,
    packageId: String(pkg.package_id),
    title: pkg.title,
    termsText: pkg.terms_text,
    // Business identity is unverified; names are what the agency entered.
    suppliers: slots ?? [],
    wallet: user.wallet,
  };
});
