import { Note } from "@/components/ui/panel";
import type { ProofholdView } from "@/lib/view";

type Outcome = {
  kind: string;
  reason?: string;
  releasesOnSilence?: boolean;
  fraction?: number;
  blocking?: string[];
};

export function DecisionNote({
  ph,
  audience,
}: {
  ph: ProofholdView;
  audience: "seller" | "buyer";
}) {
  const decision = ph.decision as { outcome?: Outcome; summary?: string } | null;
  const o = decision?.outcome;
  if (!o) return null;
  if (ph.status === "awaiting_buyer") {
    if (o.kind === "blocked")
      return (
        <Note tone="held">
          <strong>Blocked.</strong>{" "}
          {(o.reason ?? "").replace(
            /^Release is blocked until the buyer confirms:\s*/i,
            "",
          )}{" "}
          {audience === "buyer"
            ? "There is no deadline: nothing moves until you confirm or object."
            : "There is no deadline: nothing moves until the buyer confirms or objects, or you add evidence and resubmit."}
        </Note>
      );
    if (o.kind === "wait" && o.releasesOnSilence)
      return (
        <Note tone="pass">
          {o.reason}{" "}
          {audience === "buyer"
            ? "If you do nothing, the release happens when the window closes."
            : "If the buyer does nothing, the release happens when the window closes."}
        </Note>
      );
    if (o.kind === "wait") return <Note tone="held">{o.reason}</Note>;
  }
  if (ph.status === "in_review")
    return (
      <Note tone="held">
        <strong>In review.</strong>{" "}
        {audience === "seller"
          ? "The buyer objected. Propose a partial release, add evidence and resubmit, or end the hold."
          : "You objected. The seller can offer a partial release, resubmit, or end the hold."}
      </Note>
    );
  return null;
}
