import { Skeleton } from "@/components/ui/feedback";

export default function Loading() {
  return (
    <div
      style={{ display: "grid", gap: "var(--s-4)" }}
      aria-busy="true"
      aria-label="Loading"
    >
      <Skeleton width="8rem" height="0.9rem" />
      <Skeleton width="22rem" height="2rem" />
      <Skeleton width="60%" height="1rem" />
      <div
        style={{
          display: "grid",
          gap: "var(--s-5)",
          gridTemplateColumns: "1fr",
          marginTop: "var(--s-4)",
        }}
      >
        <Skeleton height="14rem" style={{ borderRadius: "var(--r-lg)" }} />
        <Skeleton height="10rem" style={{ borderRadius: "var(--r-lg)" }} />
      </div>
    </div>
  );
}
