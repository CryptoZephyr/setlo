import type { Address, Hex } from "viem";
import { getChain } from "./chains";

export const CLIENT_ACTION = { Confirm: 0, Release: 1, Cancel: 2 } as const;
export type ClientActionName = keyof typeof CLIENT_ACTION;

export function setloDomain(chainId: number) {
  return { name: "Setlo", version: "1", chainId, verifyingContract: getChain(chainId).setlo } as const;
}

/** Paxos testnet USDG permit domain (checked against DOMAIN_SEPARATOR on both chains). */
export function usdgDomain(chainId: number) {
  return { name: "Global Dollar", version: "1", chainId, verifyingContract: getChain(chainId).usdg } as const;
}

export const fundTypes = {
  Fund: [
    { name: "client", type: "address" },
    { name: "packageId", type: "uint256" },
    { name: "configHash", type: "bytes32" },
    { name: "amount", type: "uint256" },
    { name: "autoConfirm", type: "bool" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

export const acceptTypes = {
  Accept: [
    { name: "supplier", type: "address" },
    { name: "packageId", type: "uint256" },
    { name: "slotIndex", type: "uint256" },
    { name: "slotHash", type: "bytes32" },
    { name: "revision", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

export const declineTypes = {
  Decline: [
    { name: "supplier", type: "address" },
    { name: "packageId", type: "uint256" },
    { name: "slotIndex", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

export const clientActionTypes = {
  ClientAction: [
    { name: "client", type: "address" },
    { name: "packageId", type: "uint256" },
    { name: "action", type: "uint8" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

export const permitTypes = {
  Permit: [
    { name: "owner", type: "address" },
    { name: "spender", type: "address" },
    { name: "value", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

export type TypedRequest =
  | { domain: ReturnType<typeof setloDomain>; types: typeof fundTypes; primaryType: "Fund"; message: Record<string, unknown> }
  | { domain: ReturnType<typeof setloDomain>; types: typeof acceptTypes; primaryType: "Accept"; message: Record<string, unknown> }
  | { domain: ReturnType<typeof setloDomain>; types: typeof declineTypes; primaryType: "Decline"; message: Record<string, unknown> }
  | {
      domain: ReturnType<typeof setloDomain>;
      types: typeof clientActionTypes;
      primaryType: "ClientAction";
      message: Record<string, unknown>;
    }
  | { domain: ReturnType<typeof usdgDomain>; types: typeof permitTypes; primaryType: "Permit"; message: Record<string, unknown> };

export type Sig = { v: number; r: Hex; s: Hex };
export type AddressLike = Address;
