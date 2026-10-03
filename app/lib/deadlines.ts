import { setloAbi } from "./abi";
import { getChain } from "./chains";
import { publicClient } from "./clients";
import { submit, type Relayable } from "./relay";

const OPEN = 1;
const CONFIRMED = 2;

export type DeadlineResult =
  | { action: "none"; status: number; nextCheckAt: number | null }
  | { action: Relayable; hash: string; status: string; explorer: string };

/**
 * Called by any open app session showing the package. Submits `expirePackage` or the automatic
 * `releaseBalances` once the chain clock allows it; otherwise reports when to ask again.
 */
export async function runDeadline(chainId: number, packageId: bigint): Promise<DeadlineResult> {
  const client = publicClient(chainId);
  const [pkg, block] = await Promise.all([
    client.readContract({ address: getChain(chainId).setlo, abi: setloAbi, functionName: "getPackage", args: [packageId] }),
    client.getBlock(),
  ]);
  const now = block.timestamp;

  if (pkg.status === OPEN) {
    if (now > pkg.acceptDeadline || now > pkg.confirmDeadline) {
      // Past acceptDeadline only expires if a required slot is still unaccepted; the contract decides.
      try {
        return { action: "expirePackage", ...(await submit(chainId, "expirePackage", [packageId])) };
      } catch {
        // Not expirable yet (all required accepted); next chance is the confirm deadline.
      }
    }
    const next = now <= pkg.acceptDeadline ? pkg.acceptDeadline : pkg.confirmDeadline;
    return { action: "none", status: pkg.status, nextCheckAt: Number(next) + 1 };
  }
  if (pkg.status === CONFIRMED) {
    const releaseAt = pkg.eventDate + pkg.reviewWindow;
    if (now >= releaseAt) return { action: "releaseBalances", ...(await submit(chainId, "releaseBalances", [packageId])) };
    return { action: "none", status: pkg.status, nextCheckAt: Number(releaseAt) };
  }
  return { action: "none", status: pkg.status, nextCheckAt: null };
}
