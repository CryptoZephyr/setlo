import { decodeEventLog, parseSignature, type Address, type Hex } from "viem";
import { setloAbi } from "@/lib/abi";
import { getChain } from "@/lib/chains";
import {
  acceptTypes,
  CLIENT_ACTION,
  clientActionTypes,
  declineTypes,
  fundTypes,
  permitTypes,
  setloDomain,
  usdgDomain,
  type ClientActionName,
} from "@/lib/typed";
import type { AccountState, PackageState } from "@/lib/types";
import { apiFetch } from "./api";
import { browserClient, type Signer } from "./signer";

export type RelayResult = { hash: Hex; status: "success" | "reverted"; explorer: string };

const SIG_TTL = 30 * 60;

function deadline() {
  return BigInt(Math.floor(Date.now() / 1000) + SIG_TTL).toString();
}

export function account(chainId: number, address: Address) {
  return apiFetch<AccountState>(`/api/chain/${chainId}/accounts/${address}`);
}

export function packageState(chainId: number, packageId: string, signal?: AbortSignal) {
  return apiFetch<PackageState>(`/api/chain/${chainId}/packages/${packageId}`, { signal });
}

function relay(chainId: number, functionName: string, args: unknown[]) {
  return apiFetch<RelayResult>("/api/relay", { body: { chainId, functionName, args } });
}

/** Amount the client still has to send for the current configuration (0 if already covered). */
export function amountDue(state: PackageState): bigint {
  const req = BigInt(state.requiredFunding);
  const funded = BigInt(state.pkg.funded);
  return funded >= req ? BigInt(0) : req - funded;
}

export class InsufficientBalance extends Error {
  constructor(
    public needed: bigint,
    public available: bigint,
  ) {
    super("insufficient USDG");
  }
}

/**
 * Funding approval: a Setlo instruction bound to this package's current configuration, plus (if money
 * is due) a USDG permit for exactly that amount. Relayed, so the client needs no ETH.
 */
export async function fund(signer: Signer, state: PackageState, autoConfirm: boolean): Promise<RelayResult> {
  const { chainId } = state;
  const acc = await account(chainId, signer.address);
  const amount = amountDue(state);
  if (amount > BigInt(0) && BigInt(acc.usdg) < amount) throw new InsufficientBalance(amount, BigInt(acc.usdg));
  const ins = {
    client: signer.address,
    packageId: state.packageId,
    configHash: state.configHash,
    amount: amount.toString(),
    autoConfirm,
    nonce: acc.setloNonce,
    deadline: deadline(),
  };
  const sig = await signer.signTypedData({ domain: setloDomain(chainId), types: fundTypes, primaryType: "Fund", message: ins });
  let permit = { value: "0", deadline: "0", v: 0, r: `0x${"0".repeat(64)}`, s: `0x${"0".repeat(64)}` };
  if (amount > BigInt(0) && BigInt(acc.allowance) < amount) {
    const p = { owner: signer.address, spender: getChain(chainId).setlo, value: amount.toString(), nonce: acc.usdgNonce, deadline: ins.deadline };
    const ps = parseSignature(await signer.signTypedData({ domain: usdgDomain(chainId), types: permitTypes, primaryType: "Permit", message: p }));
    permit = { value: p.value, deadline: p.deadline, v: Number(ps.v ?? BigInt(27 + (ps.yParity ?? 0))), r: ps.r, s: ps.s };
  }
  return relay(chainId, "fundWithPermit", [ins, sig, permit]);
}

export async function accept(signer: Signer, state: PackageState, slotIndex: number): Promise<RelayResult> {
  const { chainId } = state;
  const acc = await account(chainId, signer.address);
  const msg = {
    supplier: signer.address,
    packageId: state.packageId,
    slotIndex: String(slotIndex),
    slotHash: state.slots[slotIndex].slotHash,
    revision: String(state.pkg.revision),
    nonce: acc.setloNonce,
    deadline: deadline(),
  };
  const sig = await signer.signTypedData({ domain: setloDomain(chainId), types: acceptTypes, primaryType: "Accept", message: msg });
  return relay(chainId, "acceptWithSig", [msg.supplier, msg.packageId, msg.slotIndex, msg.slotHash, msg.revision, msg.nonce, msg.deadline, sig]);
}

export async function decline(signer: Signer, state: PackageState, slotIndex: number): Promise<RelayResult> {
  const { chainId } = state;
  const acc = await account(chainId, signer.address);
  const msg = { supplier: signer.address, packageId: state.packageId, slotIndex: String(slotIndex), nonce: acc.setloNonce, deadline: deadline() };
  const sig = await signer.signTypedData({ domain: setloDomain(chainId), types: declineTypes, primaryType: "Decline", message: msg });
  return relay(chainId, "declineWithSig", [msg.supplier, msg.packageId, msg.slotIndex, msg.nonce, msg.deadline, sig]);
}

/** Confirm, Release and Cancel, signed by the client and relayed through `clientActionWithSig`. */
export async function clientAction(signer: Signer, state: PackageState, action: ClientActionName): Promise<RelayResult> {
  const { chainId } = state;
  const acc = await account(chainId, signer.address);
  const msg = { client: signer.address, packageId: state.packageId, action: CLIENT_ACTION[action], nonce: acc.setloNonce, deadline: deadline() };
  const sig = await signer.signTypedData({ domain: setloDomain(chainId), types: clientActionTypes, primaryType: "ClientAction", message: msg });
  return relay(chainId, "clientActionWithSig", [msg.packageId, msg.action, msg.nonce, msg.deadline, sig]);
}

export function checkDeadline(chainId: number, packageId: string) {
  return apiFetch<{ action: string; hash?: string; nextCheckAt?: number | null }>("/api/deadlines", { body: { chainId, packageId } });
}

export function expireNow(chainId: number, packageId: string) {
  return relay(chainId, "expirePackage", [packageId]);
}

export function retryPayout(chainId: number, recipient: Address) {
  return apiFetch<RelayResult>("/api/payouts/retry", { body: { chainId, recipient } });
}

export async function faucet(chainId: number, address: Address, kind: "gas" | "usdg", amount?: bigint) {
  const r = await apiFetch<{ sent: string; hash?: Hex; explorer?: string; reason?: string }>("/api/faucet", {
    body: { chainId, address, kind, amount: amount?.toString() },
  });
  if (kind === "gas" && r.hash) await untilVisible(chainId, r.hash);
  return r;
}

/** The browser sends through a different RPC than the server, which can lag behind by a few blocks. */
async function untilVisible(chainId: number, hash: Hex) {
  const c = browserClient(chainId);
  for (let i = 0; i < 20; i++) {
    if (await c.getTransactionReceipt({ hash }).then(() => true, () => false)) return;
    await new Promise((r) => setTimeout(r, 1500));
  }
}

// ------------------------------------------------------------------ agency transactions (agency pays gas)

export type SlotInput = { payee: Address; required: boolean; deposit: bigint; holdFee: bigint; balance: bigint; termsHash: Hex };
export type PackageParams = {
  client: Address;
  eventDate: bigint;
  acceptDeadline: bigint;
  confirmDeadline: bigint;
  finalExpiry: bigint;
  reviewWindow: bigint;
  minResponseWindow: bigint;
  agencyFee: bigint;
  holdFeeCap: bigint;
  sharedTermsHash: Hex;
};

async function send(signer: Signer, chainId: number, functionName: string, args: unknown[]) {
  const c = browserClient(chainId);
  const { request } = await c.simulateContract({
    account: signer.address,
    address: getChain(chainId).setlo,
    abi: setloAbi,
    functionName: functionName as never,
    args: args as never,
  });
  const w = await signer.wallet(chainId);
  // Use the wallet's own account so a local key signs and sends a raw transaction.
  const hash = await w.writeContract({ ...request, account: w.account ?? signer.address } as never);
  const receipt = await c.waitForTransactionReceipt({ hash, timeout: 90_000 });
  if (receipt.status !== "success") throw new Error("The transaction was reverted onchain.");
  return { hash, receipt };
}

export async function createPackage(signer: Signer, chainId: number, params: PackageParams, slots: SlotInput[]) {
  const { hash, receipt } = await send(signer, chainId, "createPackage", [params, slots]);
  for (const log of receipt.logs) {
    try {
      const ev = decodeEventLog({ abi: setloAbi, topics: log.topics, data: log.data });
      if (ev.eventName === "PackageCreated") return { hash, packageId: ev.args.packageId.toString() };
    } catch {
      // other contract's log
    }
  }
  throw new Error("Package created but its id was not found in the receipt.");
}

export function updateQuote(signer: Signer, chainId: number, packageId: string, slotIndex: number, s: Omit<SlotInput, "payee" | "required">) {
  return send(signer, chainId, "updateQuote", [BigInt(packageId), BigInt(slotIndex), s.deposit, s.holdFee, s.balance, s.termsHash]);
}

export function replaceSupplier(signer: Signer, chainId: number, packageId: string, slotIndex: number, s: Omit<SlotInput, "required">) {
  return send(signer, chainId, "replaceSupplier", [BigInt(packageId), BigInt(slotIndex), s.payee, s.deposit, s.holdFee, s.balance, s.termsHash]);
}

export function updateSharedTerms(signer: Signer, chainId: number, packageId: string, eventDate: bigint, sharedTermsHash: Hex) {
  return send(signer, chainId, "updateSharedTerms", [BigInt(packageId), eventDate, sharedTermsHash]);
}
