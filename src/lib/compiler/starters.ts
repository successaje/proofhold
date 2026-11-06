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

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

/**
 * A deadline written in words, resolved against `today` (UTC): "by Friday",
 * "within 5 days", "in two weeks", "tomorrow", "end of the month", or an ISO
 * date. Returns the end of that day, or null when nothing readable is there.
 */
export function relativeDeadline(brief: string, today = new Date()): string | null {
  const b = brief.toLowerCase();
  const iso = b.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso) return endOfDayUtc(iso[1]!);
  const base = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  const plus = (days: number) =>
    endOfDayUtc(new Date(base.getTime() + days * 86_400_000).toISOString().slice(0, 10));
  if (/\btomorrow\b/.test(b)) return plus(1);
  const n = b.match(
    /\b(?:within|in)\s+(\d{1,2}|one|two|three|four|five|six|seven|ten)\s+(day|week)s?\b/,
  );
  if (n) {
    const count = numberWords[n[1]!] ?? Number(n[1]);
    return plus(count * (n[2] === "week" ? 7 : 1));
  }
  const day = b.match(
    /\b(?:by|before|due|on)\s+(?:next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/,
  );
  if (day) {
    const target = WEEKDAYS.indexOf(day[1]!);
    let ahead = (target - base.getUTCDay() + 7) % 7;
    if (ahead === 0 || /next/.test(day[0])) ahead += 7;
    return plus(ahead);
  }
  if (/\bend of (?:the )?month\b/.test(b)) {
    const last = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0));
    return endOfDayUtc(last.toISOString().slice(0, 10));
  }
  if (/\bnext week\b/.test(b)) return plus(7);
  return null;
}

/** Whether the brief mentions a deadline at all, readable or not. */
export function mentionsDeadline(brief: string): boolean {
  return /\b(due|deadline|by (monday|tuesday|wednesday|thursday|friday|saturday|sunday|the|end|tomorrow|\d)|within \d|in \d+ (days?|weeks?)|tomorrow|next week)\b/i.test(
    brief,
  );
}

/** Types joined by "plus", "and" or "&" are each required, not alternatives. */
export function requiredTogether(brief: string, types: string[]): boolean {
  if (types.length < 2) return false;
  const exts = Object.entries(extensionMime)
    .filter(([, m]) => types.includes(m))
    .map(([e]) => e);
  const alt = exts.join("|");
  return new RegExp(
    `\\b(${alt})s?\\b[^.]{0,60}?\\b(plus|and|&)\\b[^.]{0,40}?\\b(${alt})s?\\b`,
    "i",
  ).test(brief);
}

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
  const today = input.today ? new Date(input.today) : new Date();
  const readDeadline = input.deadline ? null : relativeDeadline(input.brief, today);
  const deadline = input.deadline ? endOfDayUtc(input.deadline) : readDeadline;
  const deadlineLabel =
    input.deadline ?? (readDeadline ? readDeadline.slice(0, 10) : null);
  const facts = briefFacts(input.brief);
  const together = requiredTogether(input.brief, facts.types);
  if (input.kind === "goods") {
    const shipBy = deadlineLabel;
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
                text: `Shipped by ${shipBy}`,
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
  if (together)
    for (const t of facts.types)
      predicates.push({
        id: `p${predicates.length + 1}`,
        text: `At least one ${mimeName(t)} file`,
        evidence: "file",
        must_pass: true,
        check: { kind: "count", min: 1, mime: [t] },
      });
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
      text: `Delivered by ${deadlineLabel}`,
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
      ...(readDeadline && !input.deadline
        ? [`The deadline "${deadlineLabel}" was read from the brief's wording; check it.`]
        : []),
      ...(!deadline && mentionsDeadline(input.brief)
        ? [
            "The brief mentions a deadline that could not be read. Set it in the Deadline field or edit the test.",
          ]
        : []),
      ...(facts.types.length >= 2 && !together
        ? [
            `The brief names ${facts.types.map(mimeName).join(" and ")}; line 1 accepts either. If both are required, add a line per format.`,
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
