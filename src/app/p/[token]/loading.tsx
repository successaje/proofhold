import { Skeleton } from "@/components/ui/feedback";

export default function Loading() {
  return (
    <main
      style={{
        maxWidth: "44rem",
        margin: "0 auto",
        padding: "var(--s-6) var(--gutter)",
        display: "grid",
        gap: "var(--s-4)",
      }}
      aria-busy="true"
      role="status"
      aria-label="Loading"
    >
      <Skeleton width="10rem" height="0.9rem" />
      <Skeleton width="70%" height="2rem" />
      <Skeleton width="30%" height="1.4rem" />
      <Skeleton
        height="16rem"
        style={{ borderRadius: "var(--r-lg)", marginTop: "var(--s-3)" }}
      />
      <Skeleton height="10rem" style={{ borderRadius: "var(--r-lg)" }} />
    </main>
  );
}
