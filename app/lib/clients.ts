import { createPublicClient, createWalletClient, http, nonceManager, type PrivateKeyAccount, type PublicClient, type WalletClient } from "viem";
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

let relayer: PrivateKeyAccount | undefined;

/** Tracks nonces locally: right after a receipt the RPC can still report the previous pending nonce. */
export function relayerAccount(): PrivateKeyAccount {
  relayer ??= privateKeyToAccount(env().RELAYER_PRIVATE_KEY as `0x${string}`, { nonceManager });
  return relayer;
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
