import type { AuditEntry } from "@/lib/audit/chain";
import { statusMeta, type Status } from "@/lib/domain/proofhold";
import { formatDate, formatMoney } from "@/lib/format";
import { Timeline, type TimelineItem } from "@/components/ui/timeline";

function describe(
  e: AuditEntry,
  currency: string,
): { title: string; detail?: string; tone?: TimelineItem["tone"] } {
  const d = e.data as Record<string, unknown>;
  switch (e.type) {
    case "created":
      return { title: "Proofhold created" };
    case "test_edited":
      return {
        title: "Acceptance test edited",
        detail: `hash ${String(d.to).slice(0, 12)}…`,
      };
    case "seller_agreed":
      return { title: "Seller agreed to the test and sent the link", tone: "info" };
    case "order_created":
      return {
        title: "PayPal order created",
        detail: `order ${d.orderId}; test hash bound as custom_id`,
        tone: "info",
      };
    case "buyer_agreed":
      return {
        title: "Buyer approved; PayPal authorized the hold",
        detail: `authorization ${d.authorizationId}, valid until ${formatDate(String(d.expiresAt))}`,
        tone: "held",
      };
    case "approval_cancelled":
      return { title: "Buyer left PayPal without approving" };
    case "evidence_added":
      return {
        title: `File added: ${d.name}`,
        detail: `sha256 ${String(d.sha256).slice(0, 12)}…`,
      };
    case "evidence_removed":
      return { title: `File removed: ${d.name}` };
    case "tracking_added":
      return { title: `Tracking recorded: ${d.carrier} ${d.number}` };
    case "evidence_submitted":
      return { title: `Evidence submitted (round ${d.round})`, tone: "info" };
    case "examined":
      return {
        title: "Examiner reviewed the evidence",
        detail: String(d.summary ?? ""),
        tone: "info",
      };
    case "examiner_failed":
      return {
        title: "Examiner could not run",
        detail: String(d.message ?? ""),
        tone: "fail",
      };
    case "decision": {
      const o = d.outcome as { kind?: string; reason?: string } | undefined;
      return {
        title: `Decision: ${o?.kind?.replace("_", " ") ?? "recorded"}`,
        detail: o?.reason,
        tone: o?.kind === "blocked" || o?.kind === "review" ? "held" : "info",
      };
    }
    case "buyer_confirmed":
      return {
        title: "Buyer confirmed",
        detail: d.message ? String(d.message) : undefined,
        tone: "pass",
      };
    case "buyer_objected":
      return { title: "Buyer objected", detail: String(d.reason ?? ""), tone: "fail" };
    case "offer_proposed":
      return {
        title: `Seller offered ${formatMoney(Number(d.amountCents), currency)}`,
        detail: d.note ? String(d.note) : undefined,
        tone: "held",
      };
    case "offer_accepted":
      return { title: "Buyer accepted the offer", tone: "pass" };
    case "offer_declined":
      return { title: "Buyer declined the offer", tone: "fail" };
    case "released":
      return {
        title: `PayPal captured ${formatMoney(Number(d.amountCents), currency)}`,
        detail: `capture ${d.captureId} (${d.captureStatus})`,
        tone: "pass",
      };
    case "remainder_voided":
      return {
        title: `Remainder of ${formatMoney(Number(d.amountCents), currency)} returned to the buyer`,
        tone: "info",
      };
    case "voided":
      return {
        title: "Hold voided; money returned to the buyer",
        detail: String(d.reason ?? ""),
        tone: "fail",
      };
    case "expired":
      return {
        title: "Authorization expired",
        detail: String(d.reason ?? ""),
        tone: "fail",
      };
    case "tracker_attached":
      return {
        title: `Tracking attached to the PayPal order: ${d.carrier} ${d.number}`,
        tone: "info",
      };
    case "tracker_attach_failed":
      return {
        title: "Could not attach tracking to the PayPal order",
        detail: String(d.message ?? ""),
        tone: "fail",
      };
    case "reauthorized":
      return {
        title: "Reauthorized after the honor period",
        detail: `new authorization ${d.to}`,
        tone: "info",
      };
    case "reconciled":
      return { title: `Reconciled with PayPal: ${d.paypalStatus}`, tone: "info" };
    case "webhook":
      return { title: `PayPal webhook: ${d.type}` };
    case "dispute_opened":
      return {
        title: `PayPal dispute opened (${d.disputeId})`,
        detail: String(d.reason ?? ""),
        tone: "fail",
      };
    case "evidence_filed":
      return {
        title: "Evidence bundle filed with PayPal",
        detail: `${(d.files as string[])?.length ?? 0} files, ${d.bundleEntries} audit entries`,
        tone: "info",
      };
    case "dispute_resolved":
      return {
        title: `Dispute resolved: ${String(d.outcome ?? "")
          .replace("RESOLVED_", "")
          .replace("_", " ")
          .toLowerCase()}`,
        tone: String(d.outcome).includes("SELLER") ? "pass" : "fail",
      };
    case "window_closed":
      return {
        title: "Buyer window closed; release still blocked",
        detail: String(d.reason ?? ""),
        tone: "held",
      };
    case "cancelled":
      return { title: `Cancelled by the ${d.by}` };
    case "status":
      return {
        title: `${statusMeta[d.from as Status]?.label ?? d.from} → ${statusMeta[d.to as Status]?.label ?? d.to}`,
      };
    default:
      return { title: e.type.replace(/_/g, " ") };
  }
}

export function History({ audit, currency }: { audit: AuditEntry[]; currency: string }) {
  const items: TimelineItem[] = [...audit].reverse().map((e) => {
    const info = describe(e, currency);
    return {
      key: e.id,
      title: info.title,
      detail: info.detail,
      meta: `${formatDate(e.createdAt)} · #${e.seq} ${e.hash.slice(0, 8)}`,
      tone: info.tone,
    };
  });
  return <Timeline items={items} />;
}
