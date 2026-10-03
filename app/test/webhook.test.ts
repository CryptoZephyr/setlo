import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import { extractLogs, verifySignature } from "@/lib/webhook";

describe("verifySignature", () => {
  const secret = "s3cret";
  const body = '{"a":1}';
  const sign = (n: string, t: string) => createHmac("sha256", secret).update(n + t + body).digest("hex");

  it("accepts a valid fresh signature, with or without sha256= prefix", () => {
    expect(verifySignature(secret, body, "n", "1000", sign("n", "1000"), 300, 1100)).toBe(true);
    expect(verifySignature(secret, body, "n", "1000", "sha256=" + sign("n", "1000"), 300, 1100)).toBe(true);
  });

  it("rejects tampering, missing headers and stale timestamps", () => {
    expect(verifySignature(secret, body + " ", "n", "1000", sign("n", "1000"), 300, 1100)).toBe(false);
    expect(verifySignature(secret, body, null, "1000", sign("n", "1000"), 300, 1100)).toBe(false);
    expect(verifySignature(secret, body, "n", "1000", sign("n", "1000"), 300, 2000)).toBe(false);
  });
});

describe("extractLogs", () => {
  it("finds logs at any depth and parses hex log indexes", () => {
    const log = { address: "0xabc", topics: ["0x1"], data: "0x", transactionHash: "0xdead", logIndex: "0x2" };
    const logs = extractLogs({ data: [{ receipts: [{ logs: [log] }] }] });
    expect(logs).toEqual([{ ...log, logIndex: 2 }]);
  });

  it("parses hex block numbers", () => {
    const log = { address: "0xabc", topics: ["0x1"], data: "0x", transactionHash: "0xdead", logIndex: 0, blockNumber: "0x10" };
    expect(extractLogs([log])[0].blockNumber).toBe(BigInt(16));
  });
});
