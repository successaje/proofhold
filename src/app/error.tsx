"use client";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main
      style={{
        maxWidth: "40rem",
        margin: "0 auto",
        padding: "var(--s-16) var(--gutter)",
      }}
    >
      <EmptyState
        title="Something broke"
        action={
          <div style={{ display: "flex", gap: "var(--s-2)" }}>
            <Button onClick={reset}>Try again</Button>
            <Button href="/" variant="secondary">
              Start page
            </Button>
          </div>
        }
      >
        No money moves because of a page error; every capture and void is a recorded
        decision.
        {error.digest ? <> Reference: {error.digest}.</> : null}
      </EmptyState>
    </main>
  );
}
