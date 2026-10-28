/**
 * What the compiler prompt is allowed to return. Kept separate from the
 * domain schema so the model sees a flat, defaults-free JSON schema, and the
 * domain schema stays the single source of truth after mapping.
 */
import { z } from "zod";
import {
  acceptanceTestSchema,
  checkMatchesEvidence,
  type AcceptanceTest,
  type Predicate,
} from "../domain/test";

const checkOutput = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("count"),
    min: z.number().int(),
    max: z.number().int().nullable(),
    mime: z.array(z.string()).nullable(),
  }),
  z.object({ kind: z.literal("mime"), allowed: z.array(z.string()) }),
  z.object({
    kind: z.literal("dimensions"),
    min_width: z.number().int().nullable(),
    min_height: z.number().int().nullable(),
    exact_width: z.number().int().nullable(),
    exact_height: z.number().int().nullable(),
  }),
  z.object({ kind: z.literal("dpi"), min: z.number().int() }),
  z.object({ kind: z.literal("deadline"), before: z.string() }),
  z.object({ kind: z.literal("filename"), pattern: z.string() }),
  z.object({
    kind: z.literal("size"),
    max_bytes: z.number().int().nullable(),
    min_bytes: z.number().int().nullable(),
  }),
  z.object({ kind: z.literal("tracking_shipped") }),
  z.object({ kind: z.literal("buyer_confirms"), prompt: z.string() }),
  z.object({ kind: z.literal("judgement"), criteria: z.string() }),
]);

export const compilerOutputSchema = z.object({
  summary: z.string(),
  predicates: z.array(
    z.object({
      text: z.string(),
      evidence: z.enum(["file", "tracking", "buyer_confirmation", "judgement"]),
      must_pass: z.boolean(),
      check: checkOutput,
    }),
  ),
  silence_window_hours: z.number().int(),
  partial_release: z.array(
    z.object({
      when_passed_indexes: z.array(z.number().int()),
      fraction: z.number(),
    }),
  ),
  unclear: z.array(z.string()),
});
export type CompilerOutput = z.infer<typeof compilerOutputSchema>;

function stripNulls<T extends Record<string, unknown>>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null)) as T;
}

/** Map the model's flat output to a validated acceptance test. Drops lines that do not fit. */
export function toAcceptanceTest(out: CompilerOutput): {
  test: AcceptanceTest;
  dropped: string[];
} {
  const dropped: string[] = [];
  const predicates: Predicate[] = [];
  out.predicates.forEach((p) => {
    const check = stripNulls(p.check as Record<string, unknown>) as Predicate["check"];
    const candidate = { evidence: p.evidence, check };
    if (!checkMatchesEvidence(candidate)) {
      dropped.push(p.text);
      return;
    }
    predicates.push({
      id: `p${predicates.length + 1}`,
      text: p.text.trim().slice(0, 240),
      evidence: p.evidence,
      must_pass: p.must_pass,
      check,
    });
  });
  const indexToId = (i: number) =>
    out.predicates[i] &&
    predicates.find((p) => p.text === out.predicates[i]!.text.trim().slice(0, 240))?.id;
  const partial = out.partial_release
    .map((r) => ({
      when_passed: r.when_passed_indexes
        .map(indexToId)
        .filter((x): x is string => Boolean(x)),
      fraction: Math.min(0.95, Math.max(0.05, Math.round(r.fraction * 100) / 100)),
    }))
    .filter((r) => r.when_passed.length > 0);
  const test = acceptanceTestSchema.parse({
    version: 1,
    summary: out.summary.trim().slice(0, 300),
    predicates: predicates.slice(0, 12),
    rules: {
      silence_window_hours: Math.min(336, Math.max(1, out.silence_window_hours || 72)),
      partial_release: partial,
    },
    unclear: out.unclear.map((u) => u.trim().slice(0, 300)).filter(Boolean),
  });
  return { test, dropped };
}
