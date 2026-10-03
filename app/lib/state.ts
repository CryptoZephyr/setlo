import { erc20Abi, parseAbi, type Address } from "viem";
import { setloAbi } from "./abi";
import { getChain, HttpError } from "./chains";
import { publicClient } from "./clients";
import { db } from "./supabase";
import type { AccountState, PackageState, PaymentEvent, TxRecord } from "./types";

const permitAbi = parseAbi(["function nonces(address) view returns (uint256)"]);

/** Reads everything a booking screen needs from chain (authoritative) plus processed receipts (evidence). */
export async function readPackageState(chainId: number, packageId: bigint): Promise<PackageState> {
  const { setlo } = getChain(chainId);
  const c = publicClient(chainId);
  const base = { address: setlo, abi: setloAbi } as const;
  const [pkg, slots, earned, required, cfg, ready, block] = await Promise.all([
    c.readContract({ ...base, functionName: "getPackage", args: [packageId] }),
    c.readContract({ ...base, functionName: "getSlots", args: [packageId] }),
    c.readContract({ ...base, functionName: "getEarnedHolds", args: [packageId] }),
    c.readContract({ ...base, functionName: "requiredFunding", args: [packageId] }),
    c.readContract({ ...base, functionName: "configHash", args: [packageId] }),
    c.readContract({ ...base, functionName: "isReadyToConfirm", args: [packageId] }),
    c.getBlock(),
  ]);
  if (pkg.status === 0) throw new HttpError(404, "package not found");

  const slotHashes = await Promise.all(slots.map((_, i) => c.readContract({ ...base, functionName: "slotHash", args: [packageId, BigInt(i)] })));
  const participants = [
    ...new Set([pkg.agency, pkg.client, ...slots.map((s) => s.payee), ...earned.map((e) => e.recipient)].map((a) => a.toLowerCase())),
  ] as Address[];
  const claimables = await Promise.all(participants.map((a) => c.readContract({ ...base, functionName: "claimable", args: [a] })));

  const [{ data: logs }, { data: txs }] = await Promise.all([
    db()
      .from("processed_logs")
      .select("event, recipient, amount, tx_hash, package_id, created_at")
      .eq("chain_id", chainId)
      .in("recipient", participants)
      .order("created_at", { ascending: true }),
    db()
      .from("tx_log")
      .select("hash, fn, status, created_at")
      .eq("chain_id", chainId)
      .eq("package_id", packageId.toString())
      .order("created_at", { ascending: true }),
  ]);

  const payments: PaymentEvent[] = (logs ?? [])
    .filter((l) => l.event === "Claimed" || String(l.package_id) === packageId.toString())
    .map((l) => ({ kind: l.event, recipient: l.recipient, amount: String(l.amount), txHash: l.tx_hash, at: l.created_at }));

  return {
    chainId,
    packageId: packageId.toString(),
    blockTime: Number(block.timestamp),
    readAt: Date.now(),
    pkg: {
      agency: pkg.agency,
      client: pkg.client,
      status: pkg.status,
      autoConfirm: pkg.autoConfirm,
      revision: pkg.revision,
      eventDate: Number(pkg.eventDate),
      acceptDeadline: Number(pkg.acceptDeadline),
      confirmDeadline: Number(pkg.confirmDeadline),
      finalExpiry: Number(pkg.finalExpiry),
      reviewWindow: Number(pkg.reviewWindow),
      minResponseWindow: Number(pkg.minResponseWindow),
      agencyFee: pkg.agencyFee.toString(),
      holdFeeCap: pkg.holdFeeCap.toString(),
      earnedHoldTotal: pkg.earnedHoldTotal.toString(),
      funded: pkg.funded.toString(),
      held: pkg.held.toString(),
      sharedTermsHash: pkg.sharedTermsHash,
      approvedConfig: pkg.approvedConfig,
    },
    slots: slots.map((s, i) => ({
      payee: s.payee,
      required: s.required,
      declined: s.declined,
      deposit: s.deposit.toString(),
      holdFee: s.holdFee.toString(),
      balance: s.balance.toString(),
      termsHash: s.termsHash,
      version: s.version,
      acceptedVersion: s.acceptedVersion,
      acceptedRevision: s.acceptedRevision,
      accepted: s.acceptedVersion !== 0 && s.acceptedVersion === s.version && s.acceptedRevision === pkg.revision,
      slotHash: slotHashes[i],
    })),
    earnedHolds: earned.map((e) => ({ recipient: e.recipient, amount: e.amount.toString() })),
    requiredFunding: required.toString(),
    configHash: cfg,
    ready,
    approvalCurrent: pkg.approvedConfig === cfg,
    claimable: Object.fromEntries(participants.map((a, i) => [a, claimables[i].toString()])),
    payments,
    txs: (txs ?? []).map((t): TxRecord => ({ hash: t.hash, fn: t.fn, status: t.status, at: t.created_at })),
  };
}

export async function readAccount(chainId: number, address: Address): Promise<AccountState> {
  const { setlo, usdg } = getChain(chainId);
  const c = publicClient(chainId);
  const [bal, eth, setloNonce, usdgNonce, claimable, allowance] = await Promise.all([
    c.readContract({ address: usdg, abi: erc20Abi, functionName: "balanceOf", args: [address] }),
    c.getBalance({ address }),
    c.readContract({ address: setlo, abi: setloAbi, functionName: "nonces", args: [address] }),
    c.readContract({ address: usdg, abi: permitAbi, functionName: "nonces", args: [address] }),
    c.readContract({ address: setlo, abi: setloAbi, functionName: "claimable", args: [address] }),
    c.readContract({ address: usdg, abi: erc20Abi, functionName: "allowance", args: [address, setlo] }),
  ]);
  return {
    chainId,
    address,
    usdg: bal.toString(),
    eth: eth.toString(),
    setloNonce: setloNonce.toString(),
    usdgNonce: usdgNonce.toString(),
    claimable: claimable.toString(),
    allowance: allowance.toString(),
  };
}
