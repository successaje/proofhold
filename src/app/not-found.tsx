import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";

export default function NotFound() {
  return (
    <main
      style={{
        maxWidth: "40rem",
        margin: "0 auto",
        padding: "var(--s-16) var(--gutter)",
      }}
    >
      <EmptyState
        title="That page does not exist"
        action={
          <Button href="/" variant="secondary">
            Go to the start
          </Button>
        }
      >
        If you followed a buyer link, ask the seller to send it again. Links are long and
        easy to cut short.
      </EmptyState>
    </main>
  );
}
