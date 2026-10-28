/**
 * Starter tests used when the AI compiler is unavailable. They are honest
 * defaults the seller edits, not a substitute for compilation, and the UI
 * says so.
 */
import { acceptanceTestSchema, type AcceptanceTest } from "../domain/test";
import type { CompileInput } from "./compile";

export function starterTest(input: CompileInput): AcceptanceTest {
  const deadline = input.deadline ? endOfDayUtc(input.deadline) : null;
  if (input.kind === "goods") {
    return acceptanceTestSchema.parse({
      version: 1,
      summary: firstSentence(input.brief) || "Item as described, shipped with tracking",
      predicates: [
        {
          id: "p1",
          text: "Seller ships the item and records a carrier tracking number",
          evidence: "tracking",
          must_pass: true,
          check: { kind: "tracking_shipped" },
        },
        {
          id: "p2",
          text: "At least one photo of the packed item before shipping",
          evidence: "file",
          must_pass: false,
          check: {
            kind: "count",
            min: 1,
            mime: ["image/jpeg", "image/png", "image/webp"],
          },
        },
        {
          id: "p3",
          text: "Buyer confirms the item arrived as described",
          evidence: "buyer_confirmation",
          must_pass: true,
          check: {
            kind: "buyer_confirms",
            prompt: "Did the item arrive as described in the brief?",
          },
        },
        ...(deadline
          ? [
              {
                id: "p4",
                text: `Shipped by ${input.deadline}`,
                evidence: "file",
                must_pass: true,
                check: { kind: "deadline", before: deadline },
              },
            ]
          : []),
      ],
      rules: { silence_window_hours: 48, partial_release: [] },
      unclear: [
        "AI compiler unavailable: this is a starter test. Edit it to match the brief.",
        "Which carrier will be used, and who pays for shipping?",
      ],
    });
  }
  return acceptanceTestSchema.parse({
    version: 1,
    summary: firstSentence(input.brief) || "Deliverable files matching the brief",
    predicates: [
      {
        id: "p1",
        text: "At least one deliverable file is uploaded",
        evidence: "file",
        must_pass: true,
        check: { kind: "count", min: 1 },
      },
      {
        id: "p2",
        text: "Deliverables match the brief",
        evidence: "judgement",
        must_pass: true,
        check: {
          kind: "judgement",
          criteria: `The uploaded files are a complete, usable delivery of what the brief asks for: ${firstSentence(input.brief)}`,
        },
      },
      ...(deadline
        ? [
            {
              id: "p3",
              text: `Delivered by ${input.deadline}`,
              evidence: "file",
              must_pass: true,
              check: { kind: "deadline", before: deadline },
            },
          ]
        : []),
    ],
    rules: { silence_window_hours: 72, partial_release: [] },
    unclear: [
      "AI compiler unavailable: this is a starter test. Edit it to match the brief.",
    ],
  });
}

function firstSentence(text: string): string {
  const s = text.trim().split(/(?<=[.!?])\s+/)[0] ?? "";
  return s.slice(0, 200);
}

export function endOfDayUtc(date: string): string {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59),
  ).toISOString();
}
