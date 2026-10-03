import { describe, expect, it } from "vitest";
import { coerceArgs, formatUsdg, packageIdOf } from "@/lib/relay";

const sig = "0x" + "ab".repeat(65);
const hash = "0x" + "11".repeat(32);
const addr = "0xB3d77D3058ee580bD28ba9C4b69281424f7eF7F0";

describe("coerceArgs", () => {
  it("converts JSON integers and nested tuples", () => {
    const args = coerceArgs("fundWithPermit", [
      { client: addr, packageId: "7", configHash: hash, amount: "280000", autoConfirm: true, nonce: 0, deadline: "99" },
      sig,
      { value: "280000", deadline: "99", v: 27, r: hash, s: hash },
    ]);
    expect(args[0]).toMatchObject({ packageId: BigInt(7), amount: BigInt(280000), autoConfirm: true });
    expect(args[2]).toMatchObject({ v: 27, value: BigInt(280000) });
    expect(packageIdOf("fundWithPermit", args)).toBe(BigInt(7));
  });

  it("maps the client action enum to a number", () => {
    const args = coerceArgs("clientActionWithSig", ["3", 1, "0", "99", sig]);
    expect(args).toEqual([BigInt(3), 1, BigInt(0), BigInt(99), sig]);
  });

  it("rejects wrong arity and bad types", () => {
    expect(() => coerceArgs("expirePackage", [])).toThrow(/takes 1 args/);
    expect(() => coerceArgs("expirePackage", ["x"])).toThrow(/expected integer/);
    expect(() => coerceArgs("claimFor", ["not-hex"])).toThrow(/expected hex/);
  });
});

describe("formatUsdg", () => {
  it("formats 6-decimal amounts", () => {
    expect(formatUsdg(BigInt(140000))).toBe("0.14");
    expect(formatUsdg(BigInt(100000000))).toBe("100");
    expect(formatUsdg(BigInt(1))).toBe("0.000001");
  });
});
