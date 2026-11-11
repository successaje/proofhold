import { Bot, FlaskConical, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/status";
import type { SystemInfo } from "@/lib/view";

export function ModeBadges({
  system,
  compact = false,
}: {
  system: SystemInfo;
  compact?: boolean;
}) {
  if (compact) {
    const parts = [
      system.paypalMode === "sandbox" ? "PayPal sandbox" : "Simulated PayPal",
      system.examinerMode === "model"
        ? "examiner on"
        : system.examinerMode === "simulated"
          ? "examiner simulated"
          : "examiner off",
    ];
    return (
      <Badge icon={<FlaskConical />} title={parts.join(" · ")}>
        {system.paypalMode === "sandbox" && system.examinerMode === "model"
          ? "Sandbox"
          : "Simulated"}
      </Badge>
    );
  }
  return (
    <>
      {system.paypalMode === "sandbox" ? (
        <Badge
          icon={<ShieldCheck />}
          title="Orders, authorizations, captures and disputes run against api-m.sandbox.paypal.com"
        >
          PayPal sandbox
        </Badge>
      ) : (
        <Badge
          icon={<FlaskConical />}
          title="No PayPal credentials configured. An in-process simulator applies PayPal's state rules."
        >
          Simulated PayPal
        </Badge>
      )}
      <Badge
        icon={<Bot />}
        title={
          system.examinerMode === "model"
            ? `Compiler and examiner run on ${system.model}`
            : system.examinerMode === "simulated"
              ? "A deterministic stand-in judges judgement lines from file names, readable text and image metadata. Labelled on every verdict; not a real judgement."
              : "No examiner in this deployment: judgement lines fall to the buyer"
        }
      >
        {system.examinerMode === "model"
          ? "Examiner on"
          : system.examinerMode === "simulated"
            ? "Examiner simulated"
            : "Examiner off"}
      </Badge>
    </>
  );
}
