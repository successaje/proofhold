import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";

export default function BuyerLinkNotFound() {
  return (
    <main
      id="main"
      style={{
        maxWidth: "40rem",
        margin: "0 auto",
        padding: "var(--s-16) var(--gutter)",
      }}
    >
      <EmptyState
        title="This link is not valid"
        action={
          <Button href="/" variant="secondary">
            What Proofhold is
          </Button>
        }
      >
        Buyer links are long and easy to cut short when copied. Ask the seller to send it
        again. If the seller cancelled before you approved, the link no longer works, and
        nothing was ever held.
      </EmptyState>
    </main>
  );
}
