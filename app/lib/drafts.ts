import type { User } from "./auth";
import { HttpError } from "./chains";
import { db } from "./supabase";

export async function ownDraft(user: User, id: string) {
  const { data } = await db()
    .from("drafts")
    .select("id, chain_id, data, updated_at, package_ref, agency_privy_id")
    .eq("id", id)
    .maybeSingle();
  if (!data || data.agency_privy_id !== user.id) throw new HttpError(404, "draft not found");
  return data;
}
