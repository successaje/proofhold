"use client";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <EmptyState
      title="Something broke on this page"
      action={
        <div style={{ display: "flex", gap: "var(--s-2)" }}>
          <Button onClick={reset}>Try again</Button>
          <Button href="/app" variant="secondary">
            Back to proofholds
          </Button>
        </div>
      }
    >
      Your proofholds and any PayPal holds are unaffected: money only moves through
      recorded decisions.
      {error.digest ? <> Reference: {error.digest}.</> : null}
    </EmptyState>
  );
}
