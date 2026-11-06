import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";

export default function ProofholdNotFound() {
  return (
    <EmptyState
      title="No proofhold with that id in your workspace"
      action={
        <Button href="/app" variant="secondary">
          Back to proofholds
        </Button>
      }
    >
      It may belong to another workspace, or the id in the address was cut short. Your own
      proofholds are listed on the Proofholds page.
    </EmptyState>
  );
}
