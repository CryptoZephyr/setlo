import { createPublicClient, createWalletClient, http, type PublicClient, type WalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getChain } from "./chains";
import { env } from "./env";

const publicClients = new Map<number, PublicClient>();
const walletClients = new Map<number, WalletClient>();

export function publicClient(chainId: number): PublicClient {
  let c = publicClients.get(chainId);
  if (!c) {
    const { chain, rpcEnv } = getChain(chainId);
    c = createPublicClient({ chain, transport: http(env()[rpcEnv]) });
    publicClients.set(chainId, c);
  }
  return c;
}

export function relayerAccount() {
  return privateKeyToAccount(env().RELAYER_PRIVATE_KEY as `0x${string}`);
}

export function walletClient(chainId: number): WalletClient {
  let c = walletClients.get(chainId);
  if (!c) {
    const { chain, rpcEnv } = getChain(chainId);
    c = createWalletClient({ account: relayerAccount(), chain, transport: http(env()[rpcEnv]) });
    walletClients.set(chainId, c);
  }
  return c;
}
