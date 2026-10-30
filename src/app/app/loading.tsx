import { Skeleton } from "@/components/ui/feedback";

export default function Loading() {
  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: "var(--s-4)" }}
      aria-busy="true"
      role="status"
      aria-label="Loading"
    >
      <Skeleton width="14rem" height="2rem" />
      <Skeleton width="60%" height="1rem" />
      <Skeleton
        height="4.5rem"
        style={{ marginTop: "var(--s-4)", borderRadius: "var(--r-lg)" }}
      />
      <Skeleton height="4.5rem" style={{ borderRadius: "var(--r-lg)" }} />
      <Skeleton height="4.5rem" style={{ borderRadius: "var(--r-lg)" }} />
    </div>
  );
}
