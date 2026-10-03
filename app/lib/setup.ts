import { getAddress } from "viem";
import { setupEmail, sendEmail } from "./email";
import { newToken, setupLink } from "./meta";
import { db } from "./supabase";
import type { Readiness } from "./types";

type SetupRow = {
  token: string;
  role: "client" | "supplier";
  participant_key: string;
  email: string;
  registered_wallet: string | null;
  registered_at: string | null;
};

/** A participant is ready only once they opened their setup link and confirmed their payout account. */
export async function readiness(rows: SetupRow[]): Promise<Readiness[]> {
  return rows.map((r) => {
    const w = r.registered_wallet;
    return {
      key: r.participant_key,
      role: r.role,
      email: r.email,
      link: setupLink(r.token),
      wallet: w ? getAddress(w) : null,
      registeredAt: r.registered_at,
    };
  });
}

export const SETUP_COLS = "token, role, participant_key, email, registered_wallet, registered_at";

/** Creates (or re-creates, if the email changed) one setup invite per participant key. */
export async function ensureSetupInvites(
  scope: { draft_id: string } | { package_ref: string },
  wanted: { key: string; role: "client" | "supplier"; email: string }[],
  title: string,
  send: boolean,
): Promise<{ rows: SetupRow[]; emailed: Record<string, boolean> }> {
  const col = "draft_id" in scope ? "draft_id" : "package_ref";
  const id = "draft_id" in scope ? scope.draft_id : scope.package_ref;
  const { data: existing } = await db().from("setup_invites").select(SETUP_COLS).eq(col, id);
  const byKey = new Map((existing ?? []).map((r: SetupRow) => [r.participant_key, r]));
  const emailed: Record<string, boolean> = {};
  const out: SetupRow[] = [];
  for (const w of wanted) {
    const cur = byKey.get(w.key);
    if (cur && cur.email === w.email) {
      out.push(cur);
      continue;
    }
    if (cur) await db().from("setup_invites").delete().eq("token", cur.token);
    const row = { token: newToken(), [col]: id, role: w.role, participant_key: w.key, email: w.email };
    const { data, error } = await db().from("setup_invites").insert(row).select(SETUP_COLS).single();
    if (error) throw error;
    out.push(data as SetupRow);
    if (send) emailed[w.key] = await sendEmail(setupEmail(w.email, w.role, title, setupLink(row.token)), { setup: w.key });
  }
  return { rows: out, emailed };
}
