import { describe, expect, it } from "vitest";
import { parseUsdg, usdg, usdgInput } from "@/lib/money";
import { termsHash } from "@/lib/terms";
import { keccak256, toBytes } from "viem";

describe("money", () => {
  it("formats exact six-decimal USDG with the unit", () => {
    expect(usdg(BigInt(1_250_000))).toBe("1.25 USDG");
    expect(usdg(BigInt(1))).toBe("0.000001 USDG");
    expect(usdg(BigInt(0))).toBe("0.00 USDG");
  });
  it("parses and round-trips input", () => {
    expect(parseUsdg("1.5")).toBe(BigInt(1_500_000));
    expect(parseUsdg("1.1234567")).toBeNull();
    expect(parseUsdg("abc")).toBeNull();
    expect(usdgInput(BigInt(1_500_000))).toBe("1.5");
    expect(parseUsdg(usdgInput(BigInt(123_456_789)))).toBe(BigInt(123_456_789));
  });
  it("hashes terms as keccak256 of UTF-8 bytes", () => {
    expect(termsHash("café")).toBe(keccak256(toBytes("café")));
  });
});
