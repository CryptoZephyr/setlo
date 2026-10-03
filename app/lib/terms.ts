import { keccak256, stringToHex, type Hex } from "viem";

/** Onchain commitment to human-readable terms: keccak256 of the exact UTF-8 text. */
export function termsHash(text: string): Hex {
  return keccak256(stringToHex(text));
}
