import { erc20Abi, getAddress, isAddress, parseEther } from "viem";
import { z } from "zod";
import { getChain, txUrl } from "@/lib/chains";
import { publicClient, relayerAccount, walletClient } from "@/lib/clients";
import { handler, json } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const maxDuration = 60;

/** Caps per request; testnet value only. */
const GAS_TARGET = parseEther("0.0003");
const GAS_MIN = parseEther("0.0001");
const USDG_MAX = BigInt(500_000); // 0.5 USDG

const body = z.object({
  chainId: z.number().int(),
  address: z.string().refine(isAddress).transform((a) => getAddress(a)),
  kind: z.enum(["gas", "usdg"]),
  /** USDG wanted in base units; topped up to this balance, at most 0.5 USDG. */
  amount: z.string().regex(/^\d+$/).transform(BigInt).optional(),
});

/** Small test-ETH (for agency package transactions) and test-USDG top-ups from Setlo's test wallet. */
export const POST = handler(async (req) => {
  const b = body.parse(await json(req));
  await rateLimit(`faucet:ip:${clientIp(req)}`, 12, 3600);
  await rateLimit(`faucet:${b.kind}:${b.chainId}:${b.address}`, 4, 86400);
  const { usdg } = getChain(b.chainId);
  const c = publicClient(b.chainId);
  const w = walletClient(b.chainId);
  const account = relayerAccount();

  if (b.kind === "gas") {
    const bal = await c.getBalance({ address: b.address });
    if (bal >= GAS_MIN) return { sent: "0", reason: "enough test ETH already" };
    const value = GAS_TARGET - bal;
    const hash = await w.sendTransaction({ account, chain: w.chain, to: b.address, value });
    await c.waitForTransactionReceipt({ hash, timeout: 45_000 });
    return { sent: value.toString(), hash, explorer: txUrl(b.chainId, hash) };
  }
  const want = b.amount && b.amount < USDG_MAX ? b.amount : USDG_MAX;
  const bal = await c.readContract({ address: usdg, abi: erc20Abi, functionName: "balanceOf", args: [b.address] });
  if (bal >= want) return { sent: "0", reason: "enough test USDG already" };
  const hash = await w.writeContract({ account, chain: w.chain, address: usdg, abi: erc20Abi, functionName: "transfer", args: [b.address, want - bal] });
  await c.waitForTransactionReceipt({ hash, timeout: 45_000 });
  return { sent: (want - bal).toString(), hash, explorer: txUrl(b.chainId, hash) };
});
