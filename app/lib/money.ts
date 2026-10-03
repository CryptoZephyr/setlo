const UNIT = BigInt(1_000_000);

/** Exact USDG display (6 decimals, at least 2 shown), always labelled. */
export function usdg(amount: bigint | string, opts: { label?: boolean } = {}): string {
  const v = typeof amount === "string" ? BigInt(amount) : amount;
  const neg = v < BigInt(0);
  const abs = neg ? -v : v;
  const whole = (abs / UNIT).toLocaleString("en-US");
  let frac = (abs % UNIT).toString().padStart(6, "0").replace(/0+$/, "");
  if (frac.length < 2) frac = frac.padEnd(2, "0");
  const s = `${neg ? "−" : ""}${whole}.${frac}`;
  return opts.label === false ? s : `${s} USDG`;
}

/** Parses a user-entered USDG amount ("12", "12.5", "0.000001"). Returns null if invalid. */
export function parseUsdg(input: string): bigint | null {
  const s = input.trim().replace(/,/g, "");
  if (!/^\d+(\.\d{0,6})?$/.test(s)) return null;
  const [w, f = ""] = s.split(".");
  return BigInt(w) * UNIT + BigInt(f.padEnd(6, "0"));
}

export function sum(values: (bigint | string)[]): bigint {
  return values.reduce<bigint>((a, b) => a + BigInt(b), BigInt(0));
}

/** Plain decimal for prefilling an input, e.g. 1500000n → "1.5". */
export function usdgInput(amount: bigint | string): string {
  const v = BigInt(amount);
  const frac = (v % UNIT).toString().padStart(6, "0").replace(/0+$/, "");
  return frac ? `${v / UNIT}.${frac}` : `${v / UNIT}`;
}
