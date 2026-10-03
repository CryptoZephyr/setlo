import type { Tone } from "@/components/ui/status";
import { sum } from "./money";
import { STATUS, type ChainSlot, type PackageState, type Role } from "./types";

/** Best estimate of chain time now, from the block time at the last read. */
export function chainNow(state: PackageState): number {
  return state.blockTime + Math.max(0, Math.floor((Date.now() - state.readAt) / 1000));
}

export type SlotStatus = { tone: Tone; label: string };

export function slotStatus(state: PackageState, s: ChainSlot): SlotStatus {
  const st = state.pkg.status;
  if (st === STATUS.Open) {
    if (s.accepted) return { tone: "ok", label: "Accepted" };
    if (s.declined) return { tone: "bad", label: "Declined" };
    if (s.acceptedVersion !== 0) return { tone: "changed", label: "Terms changed · needs to accept again" };
    if (chainNow(state) > state.pkg.acceptDeadline) return { tone: "neutral", label: "Did not respond" };
    return { tone: "waiting", label: "Waiting to accept" };
  }
  if (!s.accepted) return { tone: "neutral", label: s.declined ? "Declined" : "Not booked" };
  if (st === STATUS.Confirmed) return { tone: "ok", label: "Booked · deposit credited" };
  if (st === STATUS.Released) return { tone: "paid", label: "Booked · balance credited" };
  if (st === STATUS.Cancelled) return { tone: "neutral", label: "Booking cancelled" };
  return { tone: "neutral", label: "Booking expired" };
}

export type PackageStatus = { tone: Tone; label: string; detail: string };

export function requiredProgress(state: PackageState) {
  const req = state.slots.filter((s) => s.required);
  return { accepted: req.filter((s) => s.accepted).length, total: req.length };
}

export function fundingCurrent(state: PackageState) {
  return state.approvalCurrent && BigInt(state.pkg.funded) >= BigInt(state.requiredFunding);
}

export function packageStatus(state: PackageState): PackageStatus {
  const p = state.pkg;
  const now = chainNow(state);
  const { accepted, total } = requiredProgress(state);
  switch (p.status) {
    case STATUS.Open: {
      if (state.slots.some((s) => s.required && s.declined))
        return { tone: "bad", label: "A required supplier declined", detail: "The agency can replace them before the deadline, or the booking expires." };
      if (now > p.acceptDeadline && accepted < total)
        return { tone: "waiting", label: "Acceptance deadline passed", detail: "Checking the chain; the booking expires and the client's refund is credited." };
      if (now > p.confirmDeadline)
        return { tone: "waiting", label: "Confirmation deadline passed", detail: "Checking the chain; the booking expires and the client's refund is credited." };
      const funded = fundingCurrent(state);
      if (!funded && BigInt(p.funded) > BigInt(0) && !state.approvalCurrent)
        return { tone: "changed", label: "Changed · client must approve again", detail: `${accepted} of ${total} required suppliers accepted.` };
      if (!funded) return { tone: "waiting", label: "Waiting for client funding", detail: `${accepted} of ${total} required suppliers accepted.` };
      if (accepted < total) return { tone: "waiting", label: `Funded · ${accepted} of ${total} required accepted`, detail: "Deposits release when every required supplier accepts." };
      return { tone: "waiting", label: "Ready · waiting for the client to confirm", detail: "Every required supplier accepted and funding covers the package." };
    }
    case STATUS.Confirmed:
      return now < p.eventDate
        ? { tone: "ok", label: "Confirmed", detail: "Deposits and the agency fee were credited. Balances are held until after the event." }
        : { tone: "ok", label: "Event held · balances waiting", detail: "The client can release balances now; they release automatically after the review window." };
    case STATUS.Released:
      return { tone: "paid", label: "Balances released", detail: "Every booked supplier's balance was credited for payout." };
    case STATUS.Cancelled:
      return { tone: "neutral", label: "Cancelled after confirmation", detail: "Deposits already credited stay with suppliers. The rest was credited back to the client." };
    case STATUS.Expired:
      return { tone: "neutral", label: "Expired", detail: "Not every required supplier accepted in time. The client's remaining funds were credited back, minus earned hold fees." };
    default:
      return { tone: "neutral", label: "Unknown", detail: "" };
  }
}

/** The one thing the viewer should do next, or what they are waiting on. */
export function nextStep(state: PackageState, role: Role, slotIndex: number | null): { tone: Tone; text: string } {
  const p = state.pkg;
  const now = chainNow(state);
  const funded = fundingCurrent(state);
  const pending = state.slots.filter((s) => s.required && !s.accepted);
  if (p.status === STATUS.Open) {
    if (role === "supplier" && slotIndex !== null) {
      const s = state.slots[slotIndex];
      if (s.accepted) return { tone: "ok", text: "You accepted. Your deposit is credited only when every required supplier accepts and the client's funding covers the package." };
      if (s.declined) return { tone: "neutral", text: "You declined this slot." };
      if (now > p.acceptDeadline) return { tone: "neutral", text: "The acceptance deadline has passed." };
      if (s.acceptedVersion !== 0) return { tone: "changed", text: "Your terms changed. Review and accept again." };
      return { tone: "waiting", text: "Review your terms and accept or decline." };
    }
    const declined = state.slots.findIndex((s) => s.required && s.declined);
    if (role === "agency") {
      if (declined >= 0) return { tone: "bad", text: `Replace the supplier on slot ${declined + 1} before ${"the acceptance deadline"}.` };
      if (!funded) return { tone: "waiting", text: state.approvalCurrent || BigInt(p.funded) === BigInt(0) ? "Waiting for the client to review and fund." : "Waiting for the client to approve the changed package." };
      if (pending.length) return { tone: "waiting", text: `Waiting for ${pending.length} required supplier${pending.length > 1 ? "s" : ""} to accept.` };
      return { tone: "waiting", text: "Waiting for the client to confirm." };
    }
    if (role === "client") {
      if (!funded) return { tone: "waiting", text: BigInt(p.funded) > BigInt(0) && !state.approvalCurrent ? "The package changed. Review the changes and approve again." : "Review the package and fund it." };
      if (pending.length) return { tone: "waiting", text: `Waiting for ${pending.length} required supplier${pending.length > 1 ? "s" : ""} to accept.` };
      if (!p.autoConfirm) return { tone: "waiting", text: "Every required supplier accepted. Confirm the booking." };
    }
  }
  if (p.status === STATUS.Confirmed) {
    if (role === "client") return now < p.eventDate ? { tone: "ok", text: "Booked. Release balances after the event." } : { tone: "waiting", text: "The event date has passed. Release balances, or they release automatically after the review window." };
    return { tone: "ok", text: now < p.eventDate ? "Booked. Balances are held until after the event." : "Waiting for the client to release balances, or the automatic release." };
  }
  return { tone: "neutral", text: packageStatus(state).detail };
}

export function totals(state: PackageState) {
  const deposits = sum(state.slots.map((s) => s.deposit));
  const balances = sum(state.slots.map((s) => s.balance));
  const holds = sum(state.slots.map((s) => s.holdFee));
  return { deposits, balances, holds, agencyFee: BigInt(state.pkg.agencyFee), earned: BigInt(state.pkg.earnedHoldTotal) };
}

/** Per-recipient payment evidence for this booking. */
export function paymentFor(state: PackageState, address: string) {
  const a = address.toLowerCase();
  const credits = state.payments.filter((e) => e.kind === "Credited" && e.recipient.toLowerCase() === a);
  const credited = sum(credits.map((e) => e.amount));
  const since = credits.length ? credits[0].at : null;
  // Claimed events are account-wide; only transfers after this booking's first credit can include it.
  const transfers = since === null ? [] : state.payments.filter((e) => e.kind === "Claimed" && e.recipient.toLowerCase() === a && e.at >= since);
  const waiting = BigInt(state.claimable[a] ?? "0");
  return { credited, transfers, waiting };
}
