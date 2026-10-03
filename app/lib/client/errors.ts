import { ApiError } from "./api";

const CONTRACT: Record<string, string> = {
  ConfigMismatch: "The booking changed before this went through. Review the latest terms and try again.",
  DeadlinePassed: "The deadline for this action has passed.",
  SignatureExpired: "This approval expired before it was sent. Try again.",
  InvalidSignature: "The approval signature didn't match. Sign in again and retry.",
  InvalidNonce: "This approval was already used. Refreshing the booking state.",
  InvalidAccountNonce: "This approval was already used. Refreshing the booking state.",
  InvalidStatus: "The booking is no longer in a state that allows this action.",
  NotReady: "Not every condition is met yet.",
  NotPayee: "This payout account isn't the one named on this slot.",
  NotClient: "Only the client named on this booking can do this.",
  NotAgency: "Only the agency that created this booking can do this.",
  WrongAmount: "The funding amount no longer matches. Refresh and review the amount again.",
  HoldFeeCapExceeded: "This change would push hold fees above the cap the client approved.",
  InvalidParams: "Some booking details are invalid. Check the dates and amounts.",
  NothingToClaim: "Nothing is waiting to be paid out.",
  ERC20InsufficientBalance: "Not enough test USDG in the payout account.",
  ERC20InsufficientAllowance: "The spending approval didn't go through. Try funding again.",
  EnforcedPause: "New bookings are paused right now. Existing bookings are not affected.",
};

/** Plain-language message for an API, contract or wallet error. */
export function friendly(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 429) return "Too many requests. Wait a minute and try again.";
    for (const [k, v] of Object.entries(CONTRACT)) if (e.message.includes(k)) return v;
    return e.message.charAt(0).toUpperCase() + e.message.slice(1);
  }
  const msg = e instanceof Error ? e.message : String(e);
  for (const [k, v] of Object.entries(CONTRACT)) if (msg.includes(k)) return v;
  if (/user rejected|denied/i.test(msg)) return "The request was cancelled.";
  if (/insufficient funds/i.test(msg)) return "Not enough test ETH to pay the network fee for this transaction.";
  return msg.split("\n")[0].slice(0, 240);
}
