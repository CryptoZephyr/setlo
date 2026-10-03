import {
  BaseError,
  ContractFunctionRevertedError,
  decodeEventLog,
  nonceManager,
  NonceTooLowError,
  type AbiParameter,
  type Address,
  type Hash,
  type Log,
} from "viem";
import { z } from "zod";
import { setloAbi } from "./abi";
import { getChain, HttpError, txUrl } from "./chains";
import { publicClient, relayerAccount, walletClient } from "./clients";
import { payoutEmail, sendEmail } from "./email";
import { db } from "./supabase";

export const RELAYABLE = [
  "fundWithPermit",
  "acceptWithSig",
  "declineWithSig",
  "clientActionWithSig",
  "expirePackage",
  "releaseBalances",
  "claimFor",
] as const;
export type Relayable = (typeof RELAYABLE)[number];

export const relayRequest = z.object({
  chainId: z.number().int(),
  functionName: z.enum(RELAYABLE),
  args: z.array(z.unknown()),
});

type AbiFn = Extract<(typeof setloAbi)[number], { type: "function" }>;

function abiFunction(name: Relayable): AbiFn {
  return setloAbi.find((x): x is AbiFn => x.type === "function" && x.name === name)!;
}

/** Converts JSON args (numbers as decimal strings) into the types viem expects for `param`. */
export function coerce(param: AbiParameter, value: unknown): unknown {
  if (param.type === "tuple") {
    const components = (param as { components: readonly AbiParameter[] }).components;
    if (typeof value !== "object" || value === null) throw new HttpError(400, `${param.name}: expected object`);
    const obj = value as Record<string, unknown>;
    return Object.fromEntries(components.map((c) => [c.name!, coerce(c, obj[c.name!])]));
  }
  if (/^u?int\d*$/.test(param.type)) {
    if (typeof value !== "string" && typeof value !== "number") throw new HttpError(400, `${param.name}: expected integer`);
    try {
      return param.type === "uint8" ? Number(BigInt(value)) : BigInt(value);
    } catch {
      throw new HttpError(400, `${param.name}: expected integer`);
    }
  }
  if (param.type === "bool") {
    if (typeof value !== "boolean") throw new HttpError(400, `${param.name}: expected boolean`);
    return value;
  }
  if (param.type === "address" || param.type.startsWith("bytes")) {
    if (typeof value !== "string" || !/^0x[0-9a-fA-F]*$/.test(value)) throw new HttpError(400, `${param.name}: expected hex`);
    return value;
  }
  throw new HttpError(400, `unsupported type ${param.type}`);
}

export function coerceArgs(functionName: Relayable, args: unknown[]): unknown[] {
  const inputs = abiFunction(functionName).inputs as readonly AbiParameter[];
  if (args.length !== inputs.length) throw new HttpError(400, `${functionName} takes ${inputs.length} args`);
  return inputs.map((p, i) => coerce(p, args[i]));
}

/** The package a relayed call acts on, for rate limiting and the tx log. */
export function packageIdOf(functionName: Relayable, args: unknown[]): bigint | null {
  switch (functionName) {
    case "fundWithPermit":
      return (args[0] as { packageId: bigint }).packageId;
    case "acceptWithSig":
    case "declineWithSig":
      return args[1] as bigint;
    case "clientActionWithSig":
    case "expirePackage":
    case "releaseBalances":
      return args[0] as bigint;
    case "claimFor":
      return null;
  }
}

function revertReason(e: unknown): string {
  if (e instanceof BaseError) {
    const revert = e.walk((x) => x instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError) return revert.data?.errorName ?? revert.shortMessage;
    return e.shortMessage;
  }
  return String(e);
}

/**
 * Simulates the call from the relayer (the contract checks every signature, nonce, deadline and state
 * transition, so a passing simulation is the authoritative validation), then submits it, waits for the
 * receipt and processes its events (claims + payout emails).
 */
export async function submit(chainId: number, functionName: Relayable, args: unknown[]) {
  const { setlo } = getChain(chainId);
  const client = publicClient(chainId);
  let request;
  try {
    ({ request } = await client.simulateContract({
      account: relayerAccount(),
      address: setlo,
      abi: setloAbi,
      functionName,
      args: args as never,
    }));
  } catch (e) {
    throw new HttpError(422, revertReason(e));
  }
  const hash = await write(chainId, request);
  const packageId = packageIdOf(functionName, args);
  await db()
    .from("tx_log")
    .insert({ hash, chain_id: chainId, package_id: packageId?.toString() ?? null, fn: functionName, source: "relayer" });

  const receipt = await client.waitForTransactionReceipt({ hash, timeout: 45_000 });
  await db()
    .from("tx_log")
    .update({ status: receipt.status === "success" ? "success" : "reverted" })
    .eq("hash", hash);
  if (receipt.status === "success") await handleLogs(chainId, receipt.logs);
  return { hash, status: receipt.status, explorer: txUrl(chainId, hash) };
}

/** Another relayer instance may have used the locally tracked nonce; resync and retry before giving up. */
async function write(chainId: number, request: unknown, attempts = 3): Promise<Hash> {
  for (let i = 1; ; i++) {
    try {
      return await walletClient(chainId).writeContract(request as never);
    } catch (e) {
      const nonceTooLow = e instanceof BaseError && e.walk((x) => x instanceof NonceTooLowError) !== null;
      if (!nonceTooLow || i >= attempts) throw e;
      nonceManager.reset({ address: relayerAccount().address, chainId });
      await new Promise((r) => setTimeout(r, 1000 * i));
    }
  }
}

export type RawLog = Pick<Log, "address" | "topics" | "data" | "transactionHash" | "logIndex">;

/**
 * Idempotent event processing shared by relayer receipts and the QuickNode webhook:
 * `Credited` → push the recipient's claimable balance with `claimFor`; `Claimed` → payout email.
 */
export async function handleLogs(chainId: number, logs: readonly RawLog[]): Promise<void> {
  const { setlo } = getChain(chainId);
  const toClaim = new Set<Address>();
  for (const log of logs) {
    if (log.address.toLowerCase() !== setlo.toLowerCase() || !log.transactionHash || log.logIndex == null) continue;
    let ev;
    try {
      ev = decodeEventLog({ abi: setloAbi, topics: log.topics as never, data: log.data });
    } catch {
      continue;
    }
    if (ev.eventName !== "Credited" && ev.eventName !== "Claimed") continue;
    const { data: inserted } = await db()
      .from("processed_logs")
      .upsert(
        {
          chain_id: chainId,
          tx_hash: log.transactionHash,
          log_index: log.logIndex,
          event: ev.eventName,
          package_id: ev.eventName === "Credited" ? ev.args.packageId.toString() : null,
          recipient: ev.args.recipient.toLowerCase(),
          amount: ev.args.amount.toString(),
        },
        { onConflict: "chain_id,tx_hash,log_index", ignoreDuplicates: true },
      )
      .select();
    if (!inserted?.length) continue;

    if (ev.eventName === "Credited") toClaim.add(ev.args.recipient);
    else await notifyPayout(chainId, ev.args.recipient, ev.args.amount, log.transactionHash);
  }
  for (const recipient of toClaim) await claimIfOwed(chainId, recipient);
}

async function claimIfOwed(chainId: number, recipient: Address) {
  const owed = await publicClient(chainId).readContract({
    address: getChain(chainId).setlo,
    abi: setloAbi,
    functionName: "claimable",
    args: [recipient],
  });
  if (owed === BigInt(0)) return;
  try {
    await submit(chainId, "claimFor", [recipient]);
  } catch (e) {
    // A frozen recipient must not block anyone else's claim; it can still `claim()` itself later.
    console.error("claimFor failed", recipient, e);
  }
}

async function notifyPayout(chainId: number, recipient: Address, amount: bigint, hash: Hash) {
  const { data } = await db()
    .from("profiles")
    .select("email")
    .ilike("wallet", recipient)
    .not("email", "is", null)
    .limit(1);
  let email = data?.[0]?.email as string | undefined;
  if (!email) {
    const { data: slot } = await db().from("slots").select("supplier_email").ilike("payout_address", recipient).limit(1);
    email = slot?.[0]?.supplier_email as string | undefined;
  }
  if (!email) return;
  await sendEmail(payoutEmail(email, formatUsdg(amount), txUrl(chainId, hash)), { chainId, hash, recipient });
}

export function formatUsdg(amount: bigint): string {
  const whole = amount / BigInt(1e6);
  const frac = (amount % BigInt(1e6)).toString().padStart(6, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}
