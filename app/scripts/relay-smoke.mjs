// Live smoke test of the relayer API with tiny USDG amounts (0.08 USDG, swept back at the end).
// Usage: SETLO_PRIVATE_KEY=0x.. RPC_URL=.. [CHAIN_ID=421614] [API=http://localhost:3000] node scripts/relay-smoke.mjs
import {
  concat,
  createPublicClient,
  createWalletClient,
  encodeAbiParameters,
  http,
  keccak256,
  parseAbi,
  parseAbiParameters,
  parseEventLogs,
  toHex,
} from "viem";
import { privateKeyToAccount, sign } from "viem/accounts";
import { readFileSync } from "fs";

const API = process.env.API ?? "http://localhost:3000";
const CHAIN_ID = Number(process.env.CHAIN_ID ?? 421614);
const SETLO = "0xccf304db9ab8607b379b0f7f87cbb4d269a1de73";
const USDG = { 421614: "0xFFC95faa3d63Cde504a05B567C600B78C0b41892", 46630: "0x7E955252E15c84f5768B83c41a71F9eba181802F" }[CHAIN_ID];
const abiSrc = readFileSync(new URL("../lib/abi.ts", import.meta.url), "utf8");
const setloAbi = JSON.parse(abiSrc.slice(abiSrc.indexOf("["), abiSrc.lastIndexOf("]") + 1));
const usdgAbi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function nonces(address) view returns (uint256)",
  "function DOMAIN_SEPARATOR() view returns (bytes32)",
  "function transferWithAuthorization(address,address,uint256,uint256,uint256,bytes32,uint8,bytes32,bytes32)",
]);

const pk = process.env.SETLO_PRIVATE_KEY;
const client = privateKeyToAccount(pk);
const derive = (label) => keccak256(concat([pk, toHex(`setlo-relay-smoke:${label}`)]));
const venuePk = derive("venue");
const catererPk = derive("caterer");
const venue = privateKeyToAccount(venuePk);
const caterer = privateKeyToAccount(catererPk);

const transport = http(process.env.RPC_URL);
const pub = createPublicClient({ transport });
const wallet = createWalletClient({ account: client, transport });
const read = (functionName, args = [], address = SETLO, abi = setloAbi) => pub.readContract({ address, abi, functionName, args });

const T = (s) => keccak256(toHex(s));
const FUND = T("Fund(address client,uint256 packageId,bytes32 configHash,uint256 amount,bool autoConfirm,uint256 nonce,uint256 deadline)");
const ACCEPT = T("Accept(address supplier,uint256 packageId,uint256 slotIndex,bytes32 slotHash,uint256 revision,uint256 nonce,uint256 deadline)");
const ACTION = T("ClientAction(address client,uint256 packageId,uint8 action,uint256 nonce,uint256 deadline)");
const PERMIT = T("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");
const TRANSFER_AUTH = T("TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)");

const digest = (domain, structHash) => keccak256(concat(["0x1901", domain, structHash]));
const enc = (types, values) => keccak256(encodeAbiParameters(parseAbiParameters(types), values));
const sig = async (key, domain, structHash) => sign({ hash: digest(domain, structHash), privateKey: key, to: "hex" });
const json = (v) => JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x));

async function relay(functionName, args, expectStatus = 200) {
  const res = await fetch(`${API}/api/relay`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: json({ chainId: CHAIN_ID, functionName, args }),
  });
  const body = await res.json();
  if (res.status !== expectStatus) throw new Error(`${functionName}: ${res.status} ${JSON.stringify(body)}`);
  console.log(`relay ${functionName} -> ${res.status}`, body.explorer ?? body.error);
  return body;
}

const pool = async () => {
  let t = 0n;
  for (const a of [client.address, venue.address, caterer.address]) {
    t += (await read("balanceOf", [a], USDG, usdgAbi)) + (await read("claimable", [a]));
  }
  return t;
};

const start = await pool();
const setloDomain = await read("domainSeparator");
const usdgDomain = await read("DOMAIN_SEPARATOR", [], USDG, usdgAbi);
const now = (await pub.getBlock()).timestamp;

// 1. Agency (= broadcaster) creates the package directly.
const slots = [
  { payee: venue.address, required: true, deposit: 20000n, holdFee: 10000n, balance: 20000n, termsHash: T("smoke-venue") },
  { payee: caterer.address, required: true, deposit: 10000n, holdFee: 0n, balance: 10000n, termsHash: T("smoke-caterer") },
];
const params = {
  client: client.address,
  eventDate: now + 1900n,
  acceptDeadline: now + 1200n,
  confirmDeadline: now + 1200n,
  finalExpiry: now + 1800n,
  reviewWindow: 60n,
  minResponseWindow: 60n,
  agencyFee: 20000n,
  holdFeeCap: 10000n,
  sharedTermsHash: T("smoke-shared"),
};
const createHash = await wallet.writeContract({ address: SETLO, abi: setloAbi, functionName: "createPackage", args: [params, slots], chain: null });
const createReceipt = await pub.waitForTransactionReceipt({ hash: createHash });
const id = parseEventLogs({ abi: setloAbi, logs: createReceipt.logs, eventName: "PackageCreated" })[0].args.packageId;
console.log("created package", id);

// 2. Negative check: a call the contract would revert is rejected by simulation, nothing is sent.
await relay("expirePackage", [id.toString()], 422);

// 3. Relayed funding: EIP-712 instruction + EIP-2612 permit.
const amount = await read("requiredFunding", [id]);
const deadline = now + 3600n;
const ins = { client: client.address, packageId: id, configHash: await read("configHash", [id]), amount, autoConfirm: true, nonce: await read("nonces", [client.address]), deadline };
const fundSig = await sig(pk, setloDomain, enc("bytes32,address,uint256,bytes32,uint256,bool,uint256,uint256", [FUND, ins.client, ins.packageId, ins.configHash, ins.amount, ins.autoConfirm, ins.nonce, ins.deadline]));
const permitNonce = await read("nonces", [client.address], USDG, usdgAbi);
const p = await sign({ hash: digest(usdgDomain, enc("bytes32,address,address,uint256,uint256,uint256", [PERMIT, client.address, SETLO, amount, permitNonce, deadline])), privateKey: pk });
await relay("fundWithPermit", [ins, fundSig, { value: amount, deadline, v: Number(p.v), r: p.r, s: p.s }]);

// 4. Relayed supplier acceptances; the last one auto-confirms and the relayer pushes deposits out.
const revision = (await read("getPackage", [id])).revision;
for (const [i, key, acct] of [[0n, venuePk, venue], [1n, catererPk, caterer]]) {
  const sh = await read("slotHash", [id, i]);
  const nonce = await read("nonces", [acct.address]);
  const s = await sig(key, setloDomain, enc("bytes32,address,uint256,uint256,bytes32,uint256,uint256,uint256", [ACCEPT, acct.address, id, i, sh, BigInt(revision), nonce, deadline]));
  await relay("acceptWithSig", [acct.address, id, i, sh, revision, nonce, deadline, s]);
}
if ((await read("getPackage", [id])).status !== 2) throw new Error("not confirmed");
if ((await read("claimable", [venue.address])) !== 0n) throw new Error("venue deposit not auto-claimed");

// 5. Relayed client release; balances pushed out automatically.
const nonce = await read("nonces", [client.address]);
const releaseSig = await sig(pk, setloDomain, enc("bytes32,address,uint256,uint8,uint256,uint256", [ACTION, client.address, id, 1, nonce, deadline]));
await relay("clientActionWithSig", [id, 1, nonce, deadline, releaseSig]);
const pkg = await read("getPackage", [id]);
if (pkg.status !== 3 || pkg.held !== 0n) throw new Error("not released");
for (const a of [client.address, venue.address, caterer.address]) {
  if ((await read("claimable", [a])) !== 0n) throw new Error(`claimable left for ${a}`);
}
console.log("venue", await read("balanceOf", [venue.address], USDG, usdgAbi), "caterer", await read("balanceOf", [caterer.address], USDG, usdgAbi));

// 6. Deadline endpoint reports nothing to do for a released package.
const dl = await (await fetch(`${API}/api/deadlines`, { method: "POST", headers: { "content-type": "application/json" }, body: json({ chainId: CHAIN_ID, packageId: id }) })).json();
console.log("deadlines ->", dl);

// 7. Sweep supplier payouts back (EIP-3009) and check conservation.
for (const [key, acct] of [[venuePk, venue], [catererPk, caterer]]) {
  const value = await read("balanceOf", [acct.address], USDG, usdgAbi);
  if (value === 0n) continue;
  const n = keccak256(toHex(`${acct.address}:${value}:${now}`));
  const s = await sign({ hash: digest(usdgDomain, enc("bytes32,address,address,uint256,uint256,uint256,bytes32", [TRANSFER_AUTH, acct.address, client.address, value, 0n, deadline, n])), privateKey: key });
  const h = await wallet.writeContract({ address: USDG, abi: usdgAbi, functionName: "transferWithAuthorization", args: [acct.address, client.address, value, 0n, deadline, n, Number(s.v), s.r, s.s], chain: null });
  await pub.waitForTransactionReceipt({ hash: h });
}
const end = await pool();
if (end !== start) throw new Error(`pool changed: ${start} -> ${end}`);
console.log("OK: package", id, "settled via relayer; USDG pool unchanged", end);
