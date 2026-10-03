import { randomBytes } from "crypto";
import { getAddress } from "viem";
import { z } from "zod";
import { setloAbi } from "@/lib/abi";
import { requireUser } from "@/lib/auth";
import { getChain, HttpError } from "@/lib/chains";
import { publicClient } from "@/lib/clients";
import { inviteEmail, sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { handler, json } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { db } from "@/lib/supabase";

const body = z.object({
  chainId: z.number().int(),
  packageId: z.union([z.string(), z.number()]).transform(BigInt),
  title: z.string().min(1).max(120),
  termsText: z.string().max(5000).default(""),
  clientEmail: z.string().email().toLowerCase(),
  slots: z
    .array(
      z.object({
        index: z.number().int().min(0),
        name: z.string().min(1).max(120),
        email: z.string().email().toLowerCase(),
      }),
    )
    .min(1),
  sendEmails: z.boolean().default(true),
});

function token() {
  return randomBytes(24).toString("base64url");
}

/**
 * Registers offchain metadata for a package the caller already created onchain, creates one invite per
 * supplier slot plus one for the client, and emails them. Returns the copyable invite links.
 */
export const POST = handler(async (req) => {
  const user = await requireUser(req);
  await rateLimit(`packages:ip:${clientIp(req)}`, 10, 60);
  const b = body.parse(await json(req));
  if (!user.wallet) throw new HttpError(400, "no embedded wallet");

  const { setlo } = getChain(b.chainId);
  const client = publicClient(b.chainId);
  const [pkg, slots] = await Promise.all([
    client.readContract({ address: setlo, abi: setloAbi, functionName: "getPackage", args: [b.packageId] }),
    client.readContract({ address: setlo, abi: setloAbi, functionName: "getSlots", args: [b.packageId] }),
  ]);
  if (getAddress(pkg.agency) !== user.wallet) throw new HttpError(403, "not the agency of this package");
  const indexes = b.slots.map((s) => s.index).sort((x, y) => x - y);
  if (indexes.length !== slots.length || indexes.some((v, i) => v !== i)) {
    throw new HttpError(400, `expected metadata for slots 0..${slots.length - 1}`);
  }

  const { data: row, error } = await db()
    .from("packages")
    .insert({
      chain_id: b.chainId,
      package_id: b.packageId.toString(),
      agency_privy_id: user.id,
      title: b.title,
      terms_text: b.termsText,
      client_email: b.clientEmail,
    })
    .select("id")
    .single();
  if (error?.code === "23505") throw new HttpError(409, "package already registered");
  if (error) throw error;

  const slotRows = b.slots.map((s) => ({
    package_ref: row.id,
    slot_index: s.index,
    supplier_name: s.name,
    supplier_email: s.email,
    payout_address: getAddress(slots[s.index].payee),
  }));
  const inviteRows = [
    { token: token(), package_ref: row.id, role: "client" as const, slot_index: null, email: b.clientEmail },
    ...b.slots.map((s) => ({
      token: token(),
      package_ref: row.id,
      role: "supplier" as const,
      slot_index: s.index,
      email: s.email,
    })),
  ];
  const r1 = await db().from("slots").insert(slotRows);
  if (r1.error) throw r1.error;
  const r2 = await db().from("invites").insert(inviteRows);
  if (r2.error) throw r2.error;
  await db()
    .from("funnel_events")
    .insert({ event: "package_registered", privy_id: user.id, chain_id: b.chainId, package_id: b.packageId.toString() });

  const invites = await Promise.all(
    inviteRows.map(async (i) => {
      const link = `${env().APP_URL}/invite/${i.token}`;
      const emailed = b.sendEmails
        ? await sendEmail(inviteEmail(i.email, i.role, b.title, link), { package: row.id, role: i.role, slot: i.slot_index })
        : false;
      return { role: i.role, slotIndex: i.slot_index, email: i.email, link, emailed };
    }),
  );
  return { id: row.id, invites };
});
