import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  type Address,
  type EIP1193Provider,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getChain } from "@/lib/chains";
import type { TypedRequest } from "@/lib/typed";

/** Anything that can sign Setlo approvals and (for agencies) send package transactions. */
export type Signer = {
  address: Address;
  signTypedData(req: TypedRequest): Promise<Hex>;
  wallet(chainId: number): Promise<WalletClient>;
};

const publics = new Map<number, PublicClient>();
export function browserClient(chainId: number): PublicClient {
  let c = publics.get(chainId);
  if (!c) {
    c = createPublicClient({ chain: getChain(chainId).chain, transport: http() });
    publics.set(chainId, c);
  }
  return c;
}

export function keySigner(pk: Hex): Signer {
  const account = privateKeyToAccount(pk);
  return {
    address: account.address,
    signTypedData: (req) => account.signTypedData(req as never),
    wallet: async (chainId) => createWalletClient({ account, chain: getChain(chainId).chain, transport: http() }),
  };
}

export function providerSigner(
  address: Address,
  getProvider: () => Promise<EIP1193Provider>,
  switchChain: (chainId: number) => Promise<void>,
  signTypedData: (req: TypedRequest) => Promise<Hex>,
): Signer {
  return {
    address,
    signTypedData,
    wallet: async (chainId) => {
      await switchChain(chainId);
      return createWalletClient({ account: address, chain: getChain(chainId).chain, transport: custom(await getProvider()) });
    },
  };
}
