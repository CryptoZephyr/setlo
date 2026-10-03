import { requireUser } from "@/lib/auth";
import { HttpError } from "@/lib/chains";
import { handler } from "@/lib/http";
import { db } from "@/lib/supabase";

function mask(email: string) {
  const [local, domain] = email.split("@");
  return `${local.slice(0, 2)}***@${domain}`;
}

/** Registers the signed-in participant's embedded wallet as their payout account for this invitation. */
export const GET = handler(async (req, ctx) => {
  const { token } = await ctx.params;
  const user = await requireUser(req);
  const { data: s } = await db()
    .from("setup_invites")
    .select("token, role, email, registered_privy_id, registered_wallet, registered_at, drafts (data), packages (title)")
    .eq("token", token)
    .maybeSingle();
  if (!s) throw new HttpError(404, "setup link not found");
  if (user.email !== s.email) throw new HttpError(403, `this link was sent to ${mask(s.email)}`);
  if (!user.wallet) throw new HttpError(409, "your payout account is still being created");
  if (s.registered_privy_id && s.registered_privy_id !== user.id) throw new HttpError(409, "already registered by another account");

  let registeredAt = s.registered_at as string | null;
  if (!s.registered_wallet) {
    registeredAt = new Date().toISOString();
    await db()
      .from("setup_invites")
      .update({ registered_privy_id: user.id, registered_wallet: user.wallet, registered_at: registeredAt })
      .eq("token", token);
  }
  const draft = s.drafts as unknown as { data: { title?: string } } | null;
  const pkg = s.packages as unknown as { title: string } | null;
  return {
    role: s.role,
    title: draft?.data?.title || pkg?.title || "a booking",
    wallet: s.registered_wallet ?? user.wallet,
    registeredAt,
  };
});
