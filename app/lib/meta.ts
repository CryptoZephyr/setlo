import { randomBytes } from "crypto";
import { getAddress, type Address } from "viem";
import type { User } from "./auth";
import { HttpError } from "./chains";
import { env } from "./env";
import { readPackageState } from "./state";
import { db } from "./supabase";
import type { Category, InviteCard, PackageMeta, PackageState, Role, VersionSnapshot } from "./types";

export function newToken() {
  return randomBytes(24).toString("base64url");
}

export function inviteLink(token: string) {
  return `${env().APP_URL}/invite/${token}`;
}

export function setupLink(token: string) {
  return `${env().APP_URL}/setup/${token}`;
}

type PackageRow = {
  id: string;
  chain_id: number;
  package_id: number | string;
  title: string;
  terms_text: string;
  client_email: string;
  agency_privy_id: string;
};

export async function loadPackageRow(ref: string): Promise<PackageRow> {
  const { data } = await db()
    .from("packages")
    .select("id, chain_id, package_id, title, terms_text, client_email, agency_privy_id")
    .eq("id", ref)
    .maybeSingle();
  if (!data) throw new HttpError(404, "booking not found");
  return data as PackageRow;
}

export async function loadMeta(row: PackageRow, includeEmails: boolean): Promise<PackageMeta> {
  const { data: slots } = await db()
    .from("slots")
    .select("slot_index, supplier_name, supplier_email, payout_address, category, terms_text")
    .eq("package_ref", row.id)
    .order("slot_index");
  return {
    ref: row.id,
    chainId: row.chain_id,
    packageId: String(row.package_id),
    title: row.title,
    sharedTermsText: row.terms_text,
    clientEmail: includeEmails ? row.client_email : null,
    slots: (slots ?? []).map((s) => ({
      index: s.slot_index,
      name: s.supplier_name,
      email: includeEmails ? s.supplier_email : null,
      category: s.category as Category,
      termsText: s.terms_text,
      payoutAddress: getAddress(s.payout_address),
    })),
  };
}

/** The caller's role, derived from chain addresses first and then the invited email. */
export async function roleFor(user: User, row: PackageRow, state: PackageState): Promise<{ role: Role; slotIndex: number | null }> {
  if (row.agency_privy_id === user.id) return { role: "agency", slotIndex: null };
  const w = user.wallet?.toLowerCase();
  if (w && state.pkg.client.toLowerCase() === w) return { role: "client", slotIndex: null };
  const idx = state.slots.findIndex((s) => s.payee.toLowerCase() === w);
  if (w && idx >= 0) return { role: "supplier", slotIndex: idx };
  const { data: invite } = await db()
    .from("invites")
    .select("role, slot_index")
    .eq("package_ref", row.id)
    .eq("email", user.email ?? "")
    .neq("status", "revoked")
    .limit(1)
    .maybeSingle();
  if (invite) return { role: invite.role, slotIndex: invite.slot_index };
  throw new HttpError(403, "you are not a participant in this booking");
}

export async function loadInvites(ref: string): Promise<InviteCard[]> {
  const { data } = await db()
    .from("invites")
    .select("token, role, slot_index, email, status, created_at")
    .eq("package_ref", ref)
    .order("created_at");
  return (data ?? []).map((i) => ({
    role: i.role,
    slotIndex: i.slot_index,
    email: i.email,
    status: i.status,
    link: inviteLink(i.token),
  }));
}

export async function loadVersions(ref: string): Promise<VersionSnapshot[]> {
  const { data } = await db()
    .from("package_versions")
    .select("id, config_hash, snapshot, reason, created_at")
    .eq("package_ref", ref)
    .order("id");
  return (data ?? []).map((v) => ({ id: v.id, configHash: v.config_hash, snapshot: v.snapshot, reason: v.reason, at: v.created_at }));
}

/** Stores the current human-readable configuration, keyed by the onchain config hash. */
export async function snapshotVersion(row: PackageRow, reason: string): Promise<void> {
  const state = await readPackageState(row.chain_id, BigInt(row.package_id));
  const meta = await loadMeta(row, false);
  const snapshot: VersionSnapshot["snapshot"] = {
    title: meta.title,
    eventDate: state.pkg.eventDate,
    sharedTermsText: meta.sharedTermsText,
    agencyFee: state.pkg.agencyFee,
    holdFeeCap: state.pkg.holdFeeCap,
    slots: state.slots.map((s, i) => ({
      name: meta.slots[i]?.name ?? `Slot ${i + 1}`,
      category: meta.slots[i]?.category ?? "other",
      required: s.required,
      deposit: s.deposit,
      holdFee: s.holdFee,
      balance: s.balance,
      termsText: meta.slots[i]?.termsText ?? "",
      payee: s.payee as Address,
    })),
  };
  const { error } = await db()
    .from("package_versions")
    .insert({ package_ref: row.id, config_hash: state.configHash, snapshot, reason });
  if (error) throw error;
}
