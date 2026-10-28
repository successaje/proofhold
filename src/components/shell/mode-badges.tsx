import { Bot, FlaskConical, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/status";
import type { SystemInfo } from "@/lib/view";

export function ModeBadges({ system }: { system: SystemInfo }) {
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
          system.aiAvailable
            ? `Compiler and examiner run on ${system.model}`
            : "ANTHROPIC_API_KEY not set: starter tests and buyer decisions instead"
        }
      >
        {system.aiAvailable ? "Examiner on" : "Examiner off"}
      </Badge>
    </>
  );
}
