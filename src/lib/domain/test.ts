/**
 * The acceptance test: what both parties agree "done" means.
 *
 * A test is a list of predicates. Each predicate names the kind of evidence
 * that satisfies it and a check. Checks of kind `judgement` are the only ones
 * an AI examiner looks at; every other kind is decided deterministically.
 *
 * Once both parties agree, the canonical JSON of the test is hashed and the
 * hash is written into the PayPal order so the contract is bound to the
 * payment object PayPal stores.
 */
import { createHash } from "node:crypto";
import { z } from "zod";

export const evidenceTypes = [
  "file",
  "tracking",
  "buyer_confirmation",
  "judgement",
] as const;
export type EvidenceType = (typeof evidenceTypes)[number];

const isoDate = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), "Expected an ISO date");

export const checkSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("count"),
    min: z.number().int().min(1),
    max: z.number().int().min(1).optional(),
    mime: z.array(z.string()).optional(),
  }),
  z.object({ kind: z.literal("mime"), allowed: z.array(z.string()).min(1) }),
  z.object({
    kind: z.literal("dimensions"),
    min_width: z.number().int().positive().optional(),
    min_height: z.number().int().positive().optional(),
    exact_width: z.number().int().positive().optional(),
    exact_height: z.number().int().positive().optional(),
  }),
  z.object({ kind: z.literal("dpi"), min: z.number().int().positive() }),
  z.object({ kind: z.literal("deadline"), before: isoDate }),
  z.object({ kind: z.literal("filename"), pattern: z.string().min(1) }),
  z.object({
    kind: z.literal("size"),
    max_bytes: z.number().int().positive().optional(),
    min_bytes: z.number().int().positive().optional(),
  }),
  z.object({ kind: z.literal("tracking_shipped") }),
  z.object({ kind: z.literal("buyer_confirms"), prompt: z.string().min(1) }),
  z.object({ kind: z.literal("judgement"), criteria: z.string().min(1) }),
]);
export type Check = z.infer<typeof checkSchema>;

export const predicateSchema = z.object({
  id: z.string().regex(/^p\d+$/),
  text: z.string().min(3).max(240),
  evidence: z.enum(evidenceTypes),
  must_pass: z.boolean().default(true),
  check: checkSchema,
});
export type Predicate = z.infer<typeof predicateSchema>;

export const partialReleaseSchema = z.object({
  when_passed: z.array(z.string()).min(1),
  fraction: z.number().min(0.05).max(0.95),
});

export const rulesSchema = z.object({
  silence_window_hours: z.number().int().min(1).max(336).default(72),
  partial_release: z.array(partialReleaseSchema).default([]),
});
export type Rules = z.infer<typeof rulesSchema>;

export const acceptanceTestSchema = z
  .object({
    version: z.literal(1),
    summary: z.string().min(3).max(300),
    predicates: z.array(predicateSchema).min(1).max(12),
    rules: rulesSchema,
    unclear: z.array(z.string().max(300)).default([]),
  })
  .superRefine((t, ctx) => {
    const ids = new Set<string>();
    for (const p of t.predicates) {
      if (ids.has(p.id))
        ctx.addIssue({ code: "custom", message: `Duplicate predicate id ${p.id}` });
      ids.add(p.id);
      if (!checkMatchesEvidence(p)) {
        ctx.addIssue({
          code: "custom",
          message: `Predicate ${p.id}: check ${p.check.kind} does not fit evidence type ${p.evidence}`,
        });
      }
    }
    for (const rule of t.rules.partial_release) {
      for (const id of rule.when_passed) {
        if (!ids.has(id))
          ctx.addIssue({
            code: "custom",
            message: `Partial release refers to unknown ${id}`,
          });
      }
    }
  });
export type AcceptanceTest = z.infer<typeof acceptanceTestSchema>;

const fileChecks = new Set([
  "count",
  "mime",
  "dimensions",
  "dpi",
  "deadline",
  "filename",
  "size",
]);

export function checkMatchesEvidence(p: Pick<Predicate, "evidence" | "check">): boolean {
  switch (p.evidence) {
    case "file":
      return fileChecks.has(p.check.kind);
    case "tracking":
      return p.check.kind === "tracking_shipped";
    case "buyer_confirmation":
      return p.check.kind === "buyer_confirms";
    case "judgement":
      return p.check.kind === "judgement";
  }
}

/** Stable JSON with sorted keys so equal tests hash equally. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((k) => [k, sortKeys((value as Record<string, unknown>)[k])]),
    );
  }
  return value;
}

export function hashTest(test: AcceptanceTest): string {
  return createHash("sha256").update(canonicalJson(test)).digest("hex");
}

/** Parse untrusted JSON (from the compiler or a form) into a valid test. */
export function parseTest(input: unknown): AcceptanceTest {
  return acceptanceTestSchema.parse(input);
}

export function describeCheck(check: Check): string {
  switch (check.kind) {
    case "count":
      return `${check.min}${check.max ? `–${check.max}` : "+"} file${check.min === 1 && !check.max ? "" : "s"}${
        check.mime ? ` (${check.mime.map(shortMime).join(", ")})` : ""
      }`;
    case "mime":
      return `file type ${check.allowed.map(shortMime).join(" or ")}`;
    case "dimensions": {
      const parts: string[] = [];
      if (check.exact_width && check.exact_height)
        parts.push(`exactly ${check.exact_width}×${check.exact_height}px`);
      if (check.min_width) parts.push(`width ≥ ${check.min_width}px`);
      if (check.min_height) parts.push(`height ≥ ${check.min_height}px`);
      return parts.join(", ") || "image dimensions";
    }
    case "dpi":
      return `≥ ${check.min} dpi`;
    case "deadline":
      return `delivered before ${new Date(check.before).toUTCString().replace(":00 GMT", " UTC")}`;
    case "filename":
      return `file name matches /${check.pattern}/`;
    case "size":
      return [
        check.max_bytes ? `≤ ${formatBytes(check.max_bytes)}` : "",
        check.min_bytes ? `≥ ${formatBytes(check.min_bytes)}` : "",
      ]
        .filter(Boolean)
        .join(", ");
    case "tracking_shipped":
      return "carrier tracking number recorded";
    case "buyer_confirms":
      return "buyer confirms";
    case "judgement":
      return "examiner judgement";
  }
}

export function shortMime(m: string): string {
  return m
    .replace(/^image\//, "")
    .replace(/^application\//, "")
    .replace("svg+xml", "svg");
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
