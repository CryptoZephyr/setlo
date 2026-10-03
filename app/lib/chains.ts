import { defineChain, type Address, type Chain } from "viem";
import { arbitrumSepolia } from "viem/chains";

export const robinhoodTestnet = defineChain({
  id: 46630,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.chain.robinhood.com"] } },
  blockExplorers: {
    default: { name: "Robinhood Explorer", url: "https://explorer.testnet.chain.robinhood.com" },
  },
  testnet: true,
});

export type SetloChain = {
  chain: Chain;
  setlo: Address;
  usdg: Address;
  rpcEnv: "ARB_SEPOLIA_RPC_URL" | "ROBINHOOD_RPC_URL";
};

export const CHAINS: Record<number, SetloChain> = {
  [arbitrumSepolia.id]: {
    chain: arbitrumSepolia,
    setlo: "0xccf304db9ab8607b379b0f7f87cbb4d269a1de73",
    usdg: "0xFFC95faa3d63Cde504a05B567C600B78C0b41892",
    rpcEnv: "ARB_SEPOLIA_RPC_URL",
  },
  [robinhoodTestnet.id]: {
    chain: robinhoodTestnet,
    setlo: "0xccf304db9ab8607b379b0f7f87cbb4d269a1de73",
    usdg: "0x7E955252E15c84f5768B83c41a71F9eba181802F",
    rpcEnv: "ROBINHOOD_RPC_URL",
  },
};

export function getChain(chainId: number): SetloChain {
  const c = CHAINS[chainId];
  if (!c) throw new HttpError(400, `unsupported chain ${chainId}`);
  return c;
}

export function txUrl(chainId: number, hash: string): string {
  return `${getChain(chainId).chain.blockExplorers!.default.url}/tx/${hash}`;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
