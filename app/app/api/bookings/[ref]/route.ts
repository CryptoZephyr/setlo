import { requireUser } from "@/lib/auth";
import { handler } from "@/lib/http";
import { loadInvites, loadMeta, loadPackageRow, loadVersions, roleFor } from "@/lib/meta";
import { readPackageState } from "@/lib/state";
import type { BookingDetail } from "@/lib/types";

/** Offchain booking details for a participant. Chain state comes from /api/chain/... */
export const GET = handler(async (req, ctx): Promise<BookingDetail> => {
  const { ref } = await ctx.params;
  const user = await requireUser(req);
  const row = await loadPackageRow(ref);
  const state = await readPackageState(row.chain_id, BigInt(row.package_id));
  const { role, slotIndex } = await roleFor(user, row, state);
  const [meta, invites, versions] = await Promise.all([
    loadMeta(row, role === "agency"),
    role === "agency" ? loadInvites(ref) : Promise.resolve([]),
    loadVersions(ref),
  ]);
  return { meta, role, slotIndex, invites, versions, me: { email: user.email, wallet: user.wallet } };
});
