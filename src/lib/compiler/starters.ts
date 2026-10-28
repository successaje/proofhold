/**
 * Starter tests used when the AI compiler is unavailable. They are honest
 * defaults the seller edits, not a substitute for compilation, and the UI
 * says so.
 */
import { acceptanceTestSchema, type AcceptanceTest } from "../domain/test";
import type { CompileInput } from "./compile";

const extensionMime: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  svg: "image/svg+xml",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
  zip: "application/zip",
  mp4: "video/mp4",
  md: "text/markdown",
  txt: "text/plain",
  csv: "text/csv",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};
const numberWords: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

/** What the brief states plainly enough for a machine to check: counts, types, dpi, width. */
export function briefFacts(brief: string) {
  const b = brief.toLowerCase();
  const types = [
    ...new Set(
      [...b.matchAll(/\b(png|jpe?g|svg|webp|gif|pdf|zip|mp4|md|txt|csv|docx)s?\b/g)].map(
        (m) => extensionMime[m[1]!]!,
      ),
    ),
  ];
  const countMatch = b.match(
    /\b(one|two|three|four|five|six|seven|eight|nine|ten|\d{1,2})\s+(?:[a-z-]+\s+){0,2}?(concepts?|files?|photos?|images?|versions?|options?|pages?|designs?|variants?|logos?|drafts?|renders?|mock-?ups?)\b/,
  );
  const count = countMatch
    ? (numberWords[countMatch[1]!] ?? Number(countMatch[1]))
    : null;
  const dpi = b.match(/\b(\d{2,4})\s*dpi\b/);
  const width = b.match(/\b(\d{3,5})\s*px\s*(?:wide|width)|at least\s+(\d{3,5})\s*px/);
  return {
    types,
    count: count && count > 0 && count <= 50 ? count : null,
    dpi: dpi ? Number(dpi[1]) : null,
    minWidth: width ? Number(width[1] ?? width[2]) : null,
  };
}

export function starterTest(input: CompileInput): AcceptanceTest {
  const deadline = input.deadline ? endOfDayUtc(input.deadline) : null;
  const facts = briefFacts(input.brief);
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
        "Starter test, not compiled by the AI. Edit anything that is wrong or missing.",
        "Which carrier will be used, and who pays for shipping?",
      ],
    });
  }
  const typeNames = facts.types.map((t) => mimeName(t));
  const predicates: unknown[] = [
    {
      id: "p1",
      text: facts.count
        ? `${facts.count} deliverable file${facts.count === 1 ? "" : "s"}${
            typeNames.length ? ` as ${listNames(typeNames)}` : ""
          }`
        : `At least one deliverable file${typeNames.length ? ` as ${listNames(typeNames)}` : ""}`,
      evidence: "file",
      must_pass: true,
      check: {
        kind: "count",
        min: facts.count ?? 1,
        ...(facts.types.length ? { mime: facts.types } : {}),
      },
    },
  ];
  if (facts.dpi)
    predicates.push({
      id: `p${predicates.length + 1}`,
      text: `Raster images are at least ${facts.dpi} dpi`,
      evidence: "file",
      must_pass: true,
      check: { kind: "dpi", min: facts.dpi },
    });
  if (facts.minWidth)
    predicates.push({
      id: `p${predicates.length + 1}`,
      text: `Images are at least ${facts.minWidth}px wide`,
      evidence: "file",
      must_pass: true,
      check: { kind: "dimensions", min_width: facts.minWidth },
    });
  if (deadline)
    predicates.push({
      id: `p${predicates.length + 1}`,
      text: `Delivered by ${input.deadline}`,
      evidence: "file",
      must_pass: true,
      check: { kind: "deadline", before: deadline },
    });
  predicates.push({
    id: `p${predicates.length + 1}`,
    text: "Deliverables match the brief",
    evidence: "judgement",
    must_pass: true,
    check: {
      kind: "judgement",
      criteria: `The uploaded files are a complete, usable delivery of what the brief asks for: ${firstSentence(input.brief)}`,
    },
  });
  return acceptanceTestSchema.parse({
    version: 1,
    summary: firstSentence(input.brief) || "Deliverable files matching the brief",
    predicates,
    rules: { silence_window_hours: 72, partial_release: [] },
    unclear: [
      "Starter test, not compiled by the AI: the checks above were read from the brief's plain facts. Edit anything that is wrong or missing.",
      ...(facts.types.length === 0 && !facts.count
        ? [
            "The brief does not say how many files or which formats; the first line accepts any file.",
          ]
        : []),
    ],
  });
}

function mimeName(mime: string): string {
  const names: Record<string, string> = {
    "image/png": "PNG",
    "image/jpeg": "JPEG",
    "image/svg+xml": "SVG",
    "image/webp": "WebP",
    "image/gif": "GIF",
    "application/pdf": "PDF",
    "application/zip": "ZIP",
    "video/mp4": "MP4",
    "text/markdown": "Markdown",
    "text/plain": "text",
    "text/csv": "CSV",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
  };
  return names[mime] ?? mime;
}

function listNames(names: string[]): string {
  return names.length <= 1
    ? (names[0] ?? "")
    : `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`;
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
