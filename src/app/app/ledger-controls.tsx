"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LedgerBucket, LedgerSort } from "@/lib/domain/ledger";
import styles from "./list.module.css";

const buckets: { value: LedgerBucket; label: string }[] = [
  { value: "all", label: "All" },
  { value: "attention", label: "Needs attention" },
  { value: "active", label: "Active" },
  { value: "closed", label: "Closed" },
];
const sorts: { value: LedgerSort; label: string }[] = [
  { value: "updated", label: "Last activity" },
  { value: "created", label: "Newest" },
  { value: "amount", label: "Amount" },
  { value: "title", label: "Title" },
];

/** Search, bucket and sort live in the URL so a filtered view can be shared and exported. */
export function LedgerControls({
  q,
  bucket,
  sort,
  counts,
}: {
  q: string;
  bucket: LedgerBucket;
  sort: LedgerSort;
  counts: Record<LedgerBucket, number>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [text, setText] = useState(q);
  const timer = useRef<number | null>(null);

  function push(patch: Record<string, string | undefined>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (!v || v === "all" || v === "updated") next.delete(k);
      else next.set(k, v);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  useEffect(() => {
    if (text === q) return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => push({ q: text }), 250);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const exportHref = `/api/proofholds/export${params.toString() ? `?${params.toString()}` : ""}`;

  return (
    <div className={styles.controls}>
      <label className={styles.search}>
        <Search aria-hidden="true" />
        <input
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Search title, buyer, brief or id"
          aria-label="Search proofholds"
        />
      </label>
      <div className={styles.buckets} role="radiogroup" aria-label="Show">
        {buckets.map((b) => (
          <button
            key={b.value}
            type="button"
            role="radio"
            aria-checked={bucket === b.value}
            className={styles.bucket}
            onClick={() => push({ bucket: b.value })}
          >
            {b.label}
            <span className={styles.count}>{counts[b.value]}</span>
          </button>
        ))}
      </div>
      <label className={styles.sort}>
        <span>Sort</span>
        <select
          value={sort}
          onChange={(e) => push({ sort: e.target.value })}
          aria-label="Sort proofholds"
        >
          {sorts.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <Button href={exportHref} variant="secondary" size="sm" icon={<Download />}>
        Export CSV
      </Button>
    </div>
  );
}
