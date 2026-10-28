/**
 * Deterministic checks. No model is involved: every verdict here is a
 * function of the acceptance test and the evidence on file.
 *
 * Judgement predicates are left `pending` for the examiner. Buyer
 * confirmation predicates are `pending` until the buyer answers.
 */
import type { AcceptanceTest, Check, Predicate } from "../domain/test";
import type { Verdict } from "../domain/proofhold";
import type { ImageMeta } from "./images";

export interface EvidenceFileView {
  name: string;
  mime: string | null;
  size: number;
  meta: ImageMeta | null;
  createdAt: string;
}

export interface TrackingView {
  carrier: string;
  number: string;
  recordedAt: string;
}

export interface ValidationContext {
  files: EvidenceFileView[];
  tracking: TrackingView | null;
  /** null until the buyer answers. */
  buyerConfirmed: boolean | null;
  submittedAt: string;
}

export interface ValidatorResult {
  predicateId: string;
  verdict: Verdict;
  reasons: string[];
  detail: Record<string, unknown>;
}

export function runValidators(
  test: AcceptanceTest,
  ctx: ValidationContext,
): ValidatorResult[] {
  return test.predicates.map((p) => ({ predicateId: p.id, ...evaluate(p, ctx) }));
}

function evaluate(
  p: Predicate,
  ctx: ValidationContext,
): Omit<ValidatorResult, "predicateId"> {
  const c = p.check;
  switch (c.kind) {
    case "judgement":
      return { verdict: "pending", reasons: ["Awaiting examiner"], detail: {} };
    case "buyer_confirms":
      if (ctx.buyerConfirmed === null)
        return { verdict: "pending", reasons: ["Awaiting buyer"], detail: {} };
      return ctx.buyerConfirmed
        ? { verdict: "pass", reasons: ["Buyer confirmed"], detail: {} }
        : { verdict: "fail", reasons: ["Buyer did not confirm"], detail: {} };
    case "tracking_shipped":
      return tracking(ctx.tracking);
    case "count":
      return count(c, ctx.files);
    case "mime":
      return mime(c, ctx.files);
    case "dimensions":
      return dimensions(c, ctx.files);
    case "dpi":
      return dpi(c, ctx.files);
    case "deadline":
      return deadline(c, ctx);
    case "filename":
      return filename(c, ctx.files);
    case "size":
      return size(c, ctx.files);
  }
}

const noFiles = {
  verdict: "fail" as const,
  reasons: ["No files uploaded"],
  detail: { files: 0 },
};

function matchesMime(file: EvidenceFileView, allowed?: string[] | null): boolean {
  if (!allowed || allowed.length === 0) return true;
  if (!file.mime) return false;
  return allowed.some((m) =>
    m.endsWith("/*") ? file.mime!.startsWith(m.slice(0, -1)) : file.mime === m,
  );
}

function count(c: Extract<Check, { kind: "count" }>, files: EvidenceFileView[]) {
  const matching = files.filter((f) => matchesMime(f, c.mime));
  const n = matching.length;
  const detail = { files: n, names: matching.map((f) => f.name) };
  if (n < c.min)
    return {
      verdict: "fail" as const,
      reasons: [`${n} matching file${n === 1 ? "" : "s"}, need at least ${c.min}`],
      detail,
    };
  if (c.max !== undefined && n > c.max)
    return {
      verdict: "fail" as const,
      reasons: [`${n} files, maximum is ${c.max}`],
      detail,
    };
  return {
    verdict: "pass" as const,
    reasons: [`${n} matching file${n === 1 ? "" : "s"}`],
    detail,
  };
}

function mime(c: Extract<Check, { kind: "mime" }>, files: EvidenceFileView[]) {
  if (files.length === 0) return noFiles;
  const bad = files.filter((f) => !matchesMime(f, c.allowed));
  if (bad.length > 0)
    return {
      verdict: "fail" as const,
      reasons: bad.map((f) => `${f.name} is ${f.mime ?? "an unknown type"}`),
      detail: { rejected: bad.map((f) => f.name) },
    };
  return {
    verdict: "pass" as const,
    reasons: [`All ${files.length} files are an allowed type`],
    detail: {},
  };
}

function images(files: EvidenceFileView[]) {
  return files.filter((f) => f.meta);
}

function dimensions(
  c: Extract<Check, { kind: "dimensions" }>,
  files: EvidenceFileView[],
) {
  const imgs = images(files);
  if (imgs.length === 0)
    return {
      verdict: "fail" as const,
      reasons: ["No image files to measure"],
      detail: {},
    };
  const failures: string[] = [];
  const notes: string[] = [];
  for (const f of imgs) {
    const { width, height } = f.meta!;
    if (f.meta!.format === "svg") {
      notes.push(`${f.name}: vector, scales to any size`);
      continue;
    }
    if (width === null || height === null) {
      failures.push(`${f.name}: dimensions unreadable`);
      continue;
    }
    if (c.exact_width && width !== c.exact_width)
      failures.push(`${f.name}: width ${width}px, expected ${c.exact_width}px`);
    if (c.exact_height && height !== c.exact_height)
      failures.push(`${f.name}: height ${height}px, expected ${c.exact_height}px`);
    if (c.min_width && width < c.min_width)
      failures.push(`${f.name}: width ${width}px, need ≥ ${c.min_width}px`);
    if (c.min_height && height < c.min_height)
      failures.push(`${f.name}: height ${height}px, need ≥ ${c.min_height}px`);
  }
  const detail = {
    measured: imgs.map((f) => ({
      name: f.name,
      width: f.meta!.width,
      height: f.meta!.height,
    })),
  };
  if (failures.length > 0) return { verdict: "fail" as const, reasons: failures, detail };
  return {
    verdict: "pass" as const,
    reasons: [
      ...imgs
        .filter((f) => f.meta!.format !== "svg")
        .map((f) => `${f.name}: ${f.meta!.width}×${f.meta!.height}px`),
      ...notes,
    ],
    detail,
  };
}

function dpi(c: Extract<Check, { kind: "dpi" }>, files: EvidenceFileView[]) {
  const imgs = images(files);
  if (imgs.length === 0)
    return {
      verdict: "fail" as const,
      reasons: ["No image files to measure"],
      detail: {},
    };
  const failures: string[] = [];
  const notes: string[] = [];
  for (const f of imgs) {
    const d = f.meta!.dpi;
    if (d === "vector") notes.push(`${f.name}: vector, resolution independent`);
    else if (d === null) failures.push(`${f.name}: no resolution declared in the file`);
    else if (d < c.min) failures.push(`${f.name}: ${d} dpi, need ≥ ${c.min}`);
    else notes.push(`${f.name}: ${d} dpi`);
  }
  const detail = { measured: imgs.map((f) => ({ name: f.name, dpi: f.meta!.dpi })) };
  if (failures.length > 0) return { verdict: "fail" as const, reasons: failures, detail };
  return { verdict: "pass" as const, reasons: notes, detail };
}

function deadline(c: Extract<Check, { kind: "deadline" }>, ctx: ValidationContext) {
  const when =
    ctx.files.length > 0
      ? ctx.files
          .map((f) => f.createdAt)
          .sort()
          .pop()!
      : ctx.submittedAt;
  const late = Date.parse(when) > Date.parse(c.before);
  const detail = { submittedAt: when, before: c.before };
  return late
    ? {
        verdict: "fail" as const,
        reasons: [`Submitted ${fmt(when)}, after ${fmt(c.before)}`],
        detail,
      }
    : {
        verdict: "pass" as const,
        reasons: [`Submitted ${fmt(when)}, before ${fmt(c.before)}`],
        detail,
      };
}

function filename(c: Extract<Check, { kind: "filename" }>, files: EvidenceFileView[]) {
  if (files.length === 0) return noFiles;
  let re: RegExp;
  try {
    re = new RegExp(c.pattern, "i");
  } catch {
    return {
      verdict: "fail" as const,
      reasons: [`Invalid file name pattern /${c.pattern}/`],
      detail: {},
    };
  }
  const hits = files.filter((f) => re.test(f.name));
  return hits.length > 0
    ? {
        verdict: "pass" as const,
        reasons: hits.map((f) => f.name),
        detail: { matched: hits.map((f) => f.name) },
      }
    : {
        verdict: "fail" as const,
        reasons: [`No file name matches /${c.pattern}/`],
        detail: {},
      };
}

function size(c: Extract<Check, { kind: "size" }>, files: EvidenceFileView[]) {
  if (files.length === 0) return noFiles;
  const failures: string[] = [];
  for (const f of files) {
    if (c.max_bytes && f.size > c.max_bytes)
      failures.push(`${f.name} is ${kb(f.size)}, limit ${kb(c.max_bytes)}`);
    if (c.min_bytes && f.size < c.min_bytes)
      failures.push(`${f.name} is ${kb(f.size)}, need ≥ ${kb(c.min_bytes)}`);
  }
  if (failures.length > 0)
    return { verdict: "fail" as const, reasons: failures, detail: {} };
  return {
    verdict: "pass" as const,
    reasons: [`All ${files.length} files within size limits`],
    detail: {},
  };
}

const carriers: Record<string, RegExp> = {
  UPS: /^1Z[0-9A-Z]{16}$/i,
  USPS: /^(\d{20,22}|[A-Z]{2}\d{9}US)$/i,
  FEDEX: /^(\d{12}|\d{15}|\d{20})$/,
  DHL: /^(\d{10}|\d{11}|[A-Z]{3}\d{7})$/i,
  DHL_GLOBAL_MAIL: /^[A-Z0-9]{10,30}$/i,
  ROYAL_MAIL: /^[A-Z]{2}\d{9}GB$/i,
  CANADA_POST: /^\d{16}$/,
  AUSTRALIA_POST: /^[A-Z0-9]{10,25}$/i,
  OTHER: /^[A-Z0-9-]{6,40}$/i,
};

export const carrierOptions = Object.keys(carriers);

function tracking(t: TrackingView | null) {
  if (!t)
    return {
      verdict: "pending" as const,
      reasons: ["No tracking number recorded yet"],
      detail: {},
    };
  const re = carriers[t.carrier] ?? carriers.OTHER!;
  const number = t.number.replace(/\s+/g, "");
  if (!re.test(number))
    return {
      verdict: "fail" as const,
      reasons: [`"${t.number}" does not look like a ${t.carrier} tracking number`],
      detail: { carrier: t.carrier, number: t.number },
    };
  return {
    verdict: "pass" as const,
    reasons: [`${t.carrier} ${number} recorded ${fmt(t.recordedAt)}`],
    detail: { carrier: t.carrier, number, recordedAt: t.recordedAt },
  };
}

function fmt(iso: string): string {
  return new Date(iso).toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

function kb(n: number): string {
  return n < 1024 * 1024
    ? `${Math.round(n / 1024)} KB`
    : `${(n / 1024 / 1024).toFixed(1)} MB`;
}
