/**
 * The proofhold aggregate and its state machine.
 *
 * Statuses describe where the money is and what both parties are waiting for.
 * Transitions are checked by `assertTransition`; every module that changes a
 * status goes through it so the audit chain and the UI agree.
 */
import type { AcceptanceTest } from "./test";

export const statuses = [
  "draft",
  "proposed",
  "held",
  "checking",
  "awaiting_buyer",
  "in_review",
  "released",
  "partially_released",
  "voided",
  "disputed",
  "expired",
  "cancelled",
] as const;
export type Status = (typeof statuses)[number];

export const kinds = ["service", "goods"] as const;
export type Kind = (typeof kinds)[number];

export interface Proofhold {
  id: string;
  workspaceId: string;
  buyerToken: string;
  title: string;
  kind: Kind;
  brief: string;
  amountCents: number;
  currency: string;
  buyerEmail: string | null;
  buyerName: string | null;
  status: Status;
  test: AcceptanceTest;
  testHash: string;
  sellerAgreedAt: string | null;
  buyerAgreedAt: string | null;
  paypalOrderId: string | null;
  paypalAuthorizationId: string | null;
  authorizationExpiresAt: string | null;
  honorPeriodEndsAt: string | null;
  silenceWindowEndsAt: string | null;
  evidenceSubmittedAt: string | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const transitions: Record<Status, readonly Status[]> = {
  draft: ["proposed", "cancelled"],
  proposed: ["held", "cancelled", "expired"],
  held: ["checking", "cancelled", "expired"],
  checking: ["awaiting_buyer", "in_review", "held", "expired"],
  awaiting_buyer: ["released", "partially_released", "in_review", "checking", "expired"],
  in_review: [
    "released",
    "partially_released",
    "voided",
    "disputed",
    "checking",
    "expired",
  ],
  released: [],
  partially_released: ["disputed"],
  voided: ["disputed"],
  disputed: ["released", "partially_released", "voided"],
  expired: [],
  cancelled: [],
};

export function canTransition(from: Status, to: Status): boolean {
  return transitions[from].includes(to);
}

export class InvalidTransition extends Error {
  constructor(
    public readonly from: Status,
    public readonly to: Status,
  ) {
    super(`Cannot move a proofhold from ${from} to ${to}`);
  }
}

export function assertTransition(from: Status, to: Status): void {
  if (!canTransition(from, to)) throw new InvalidTransition(from, to);
}

/** Statuses in which PayPal is holding the buyer's money. */
export const activeHoldStatuses: readonly Status[] = [
  "held",
  "checking",
  "awaiting_buyer",
  "in_review",
];

export function isHoldActive(status: Status): boolean {
  return activeHoldStatuses.includes(status);
}

export function isTerminal(status: Status): boolean {
  return transitions[status].length === 0;
}

/** Human labels and tone used by status indicators across the UI. */
export const statusMeta: Record<
  Status,
  { label: string; tone: StatusTone; summary: string }
> = {
  draft: { label: "Draft", tone: "neutral", summary: "Not yet sent to the buyer." },
  proposed: {
    label: "Awaiting approval",
    tone: "neutral",
    summary: "Waiting for the buyer to approve with PayPal.",
  },
  held: {
    label: "Held",
    tone: "held",
    summary: "PayPal is holding the payment. Waiting for evidence.",
  },
  checking: { label: "Checking", tone: "held", summary: "Evidence is being verified." },
  awaiting_buyer: {
    label: "Buyer window",
    tone: "held",
    summary: "Checks are done. The buyer can confirm or object.",
  },
  in_review: {
    label: "In review",
    tone: "held",
    summary: "The buyer objected. A partial release can be proposed.",
  },
  released: {
    label: "Released",
    tone: "pass",
    summary: "PayPal captured the full amount.",
  },
  partially_released: {
    label: "Partly released",
    tone: "pass",
    summary: "Part of the hold was captured; the rest was voided.",
  },
  voided: {
    label: "Voided",
    tone: "fail",
    summary: "The hold was released back to the buyer.",
  },
  disputed: {
    label: "Disputed",
    tone: "fail",
    summary: "A PayPal dispute is open with the evidence bundle attached.",
  },
  expired: {
    label: "Expired",
    tone: "neutral",
    summary: "The authorization lapsed before a decision.",
  },
  cancelled: {
    label: "Cancelled",
    tone: "neutral",
    summary: "Cancelled before any money was held.",
  },
};

export type StatusTone = "neutral" | "held" | "pass" | "fail";

export const outcomes = ["capture", "partial_capture", "void", "escalate"] as const;
export type Outcome = (typeof outcomes)[number];

export const verdicts = ["pass", "fail", "abstain", "pending"] as const;
export type Verdict = (typeof verdicts)[number];

export const checkSources = ["validator", "examiner", "buyer", "tracking"] as const;
export type CheckSource = (typeof checkSources)[number];

export interface CheckResult {
  id: string;
  proofholdId: string;
  predicateId: string;
  round: number;
  source: CheckSource;
  verdict: Verdict;
  confidence: number | null;
  reasons: string[];
  detail: Record<string, unknown>;
  createdAt: string;
}

export interface EvidenceItem {
  id: string;
  proofholdId: string;
  kind: "file" | "tracking" | "note";
  name: string;
  mime: string | null;
  size: number;
  sha256: string | null;
  metadata: Record<string, unknown>;
  note: string | null;
  createdAt: string;
}

export interface Decision {
  id: string;
  proofholdId: string;
  outcome: Outcome;
  amountCents: number;
  actor: "system" | "seller" | "buyer";
  rationale: Record<string, unknown>;
  paypalCaptureId: string | null;
  paypalDisputeId: string | null;
  createdAt: string;
}

export interface Message {
  id: string;
  proofholdId: string;
  author: "seller" | "buyer" | "system";
  body: string;
  createdAt: string;
}

export function formatAmount(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    cents / 100,
  );
}
