import type { Address, Hex } from "viem";

/** Contract `Status` enum. */
export const STATUS = { None: 0, Open: 1, Confirmed: 2, Released: 3, Cancelled: 4, Expired: 5 } as const;
export const STATUS_NAME = ["None", "Open", "Confirmed", "Released", "Cancelled", "Expired"] as const;

/** JSON form of onchain package state: uint128/uint256 as decimal strings, uint64/uint32 as numbers. */
export type ChainPackage = {
  agency: Address;
  client: Address;
  status: number;
  autoConfirm: boolean;
  revision: number;
  eventDate: number;
  acceptDeadline: number;
  confirmDeadline: number;
  finalExpiry: number;
  reviewWindow: number;
  minResponseWindow: number;
  agencyFee: string;
  holdFeeCap: string;
  earnedHoldTotal: string;
  funded: string;
  held: string;
  sharedTermsHash: Hex;
  approvedConfig: Hex;
};

export type ChainSlot = {
  payee: Address;
  required: boolean;
  declined: boolean;
  deposit: string;
  holdFee: string;
  balance: string;
  termsHash: Hex;
  version: number;
  acceptedVersion: number;
  acceptedRevision: number;
  accepted: boolean;
  slotHash: Hex;
};

export type PaymentEvent = { kind: "Credited" | "Claimed"; recipient: Address; amount: string; txHash: Hex; at: string };
export type TxRecord = { hash: Hex; fn: string; status: string; at: string };

export type PackageState = {
  chainId: number;
  packageId: string;
  blockTime: number;
  readAt: number;
  pkg: ChainPackage;
  slots: ChainSlot[];
  earnedHolds: { recipient: Address; amount: string }[];
  requiredFunding: string;
  configHash: Hex;
  ready: boolean;
  approvalCurrent: boolean;
  /** Claimable balance per participant address (lowercase). Credited to Setlo, not yet transferred. */
  claimable: Record<string, string>;
  /** Credits for this package and transfers to its participants, from processed receipts. */
  payments: PaymentEvent[];
  txs: TxRecord[];
};

export type AccountState = {
  chainId: number;
  address: Address;
  usdg: string;
  eth: string;
  setloNonce: string;
  usdgNonce: string;
  claimable: string;
  allowance: string;
};

export type Category = "venue" | "catering" | "av" | "photo" | "decor" | "transport" | "other";
export const CATEGORIES: { id: Category; label: string }[] = [
  { id: "venue", label: "Venue" },
  { id: "catering", label: "Catering" },
  { id: "av", label: "Audio & visual" },
  { id: "photo", label: "Photo & video" },
  { id: "decor", label: "Decor" },
  { id: "transport", label: "Transport" },
  { id: "other", label: "Other" },
];

/** Human-readable metadata the agency stores offchain; hashes of the texts are onchain. */
export type SlotMeta = {
  index: number;
  name: string;
  email: string | null;
  category: Category;
  termsText: string;
  payoutAddress: Address;
};

export type PackageMeta = {
  ref: string;
  chainId: number;
  packageId: string;
  title: string;
  sharedTermsText: string;
  clientEmail: string | null;
  slots: SlotMeta[];
};

export type Role = "agency" | "client" | "supplier";

export type InviteCard = {
  role: "client" | "supplier";
  slotIndex: number | null;
  email: string;
  status: "sent" | "opened" | "revoked";
  link: string;
};

export type VersionSnapshot = {
  id: number;
  configHash: Hex;
  reason: string;
  at: string;
  snapshot: {
    title: string;
    eventDate: number;
    sharedTermsText: string;
    agencyFee: string;
    holdFeeCap: string;
    slots: { name: string; category: Category; required: boolean; deposit: string; holdFee: string; balance: string; termsText: string; payee: Address }[];
  };
};

export type BookingDetail = {
  meta: PackageMeta;
  role: Role;
  slotIndex: number | null;
  invites: InviteCard[];
  versions: VersionSnapshot[];
  me: { email: string | null; wallet: Address | null };
};

export type BookingSummary = {
  ref: string;
  chainId: number;
  packageId: string;
  title: string;
  role: Role;
  slotIndex: number | null;
  createdAt: string;
};

export type DraftSlot = {
  key: string;
  name: string;
  email: string;
  category: Category;
  required: boolean;
  deposit: string;
  holdFee: string;
  balance: string;
  termsText: string;
};

export type DraftData = {
  title: string;
  clientEmail: string;
  sharedTermsText: string;
  eventDate: number | null;
  acceptDeadline: number | null;
  confirmDeadline: number | null;
  finalExpiry: number | null;
  reviewWindowHours: string;
  minResponseHours: string;
  agencyFee: string;
  holdFeeCap: string;
  slots: DraftSlot[];
};

export type Readiness = {
  key: string;
  role: "client" | "supplier";
  email: string;
  link: string;
  wallet: Address | null;
  registeredAt: string | null;
};

export type DraftDetail = {
  id: string;
  chainId: number;
  data: DraftData;
  updatedAt: string;
  packageRef: string | null;
  readiness: Readiness[];
};
