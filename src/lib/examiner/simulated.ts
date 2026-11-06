/**
 * The simulated examiner. Deterministic and labelled on every page it touches.
 * It exists so the judgement path (manifest, reasons, what would resolve it)
 * can be seen end to end without a model key. It reads only what a careful
 * script could: file names, readable text, image metadata, and the words in
 * the criteria. It reports what it saw and then ABSTAINS on every line, so a
 * simulation can never release money: the buyer decides, exactly as when the
 * examiner is off.
 */
import type { ExaminerInput, ExaminerResult, ExaminerVerdict } from "./examine";
import { judgementPredicates } from "./examine";
import { imageMeta } from "../validators/images";

export const SIMULATED_MODEL = "simulated-examiner";

const STOP = new Set(
  "the a an and or of to for with that this these those are is be been as at by from in on into it its their there which what when where who whom will would could should must may might can each every all any some more most such than then into over under about above below between after before during within without again further once here only own same so too very just also not no nor but if while because until unless per via".split(
    " ",
  ),
);
const VISUAL =
  /\b(logo|image|photo|picture|design|concept|illustration|icon|render|mock-?up|colou?rs?|minimal|visual|layout|artwork|banner|poster|brand)\b/i;
const PLACEHOLDER = /\b(lorem ipsum|placeholder|todo|tbd|coming soon|sample text|xxx)\b/i;
const TEXT_MIMES = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/html",
  "application/json",
  "image/svg+xml",
]);
const IMAGE_MIMES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

function words(text: string): string[] {
  return [...new Set(text.toLowerCase().match(/[a-z][a-z-]{3,}/g) ?? [])].filter(
    (w) => !STOP.has(w),
  );
}

export function examineSimulated(input: ExaminerInput): ExaminerResult {
  const predicates = judgementPredicates(input.test);
  const manifest: ExaminerResult["inputManifest"] = [];
  const texts: string[] = [];
  const images: { name: string; width: number | null; height: number | null }[] = [];
  const names: string[] = [];
  for (const f of input.files) {
    names.push(f.name);
    if (f.bytes && f.mime && IMAGE_MIMES.has(f.mime)) {
      const meta = imageMeta(f.bytes, f.mime);
      images.push({
        name: f.name,
        width: meta?.width ?? null,
        height: meta?.height ?? null,
      });
      manifest.push({ name: f.name, mime: f.mime, size: f.size, sent: "image" });
    } else if (f.bytes && f.mime && TEXT_MIMES.has(f.mime)) {
      texts.push(
        new TextDecoder("utf-8", { fatal: false }).decode(f.bytes).slice(0, 20_000),
      );
      manifest.push({ name: f.name, mime: f.mime, size: f.size, sent: "text" });
    } else {
      manifest.push({ name: f.name, mime: f.mime, size: f.size, sent: "listed" });
    }
  }
  const corpus = [...names, ...texts].join("\n").toLowerCase();
  const NOT_A_JUDGEMENT =
    "Not a judgement: the examiner is simulated in this deployment, so the buyer decides this line.";
  const verdicts: ExaminerVerdict[] = predicates.map((p) => {
    const criteria = (p.check as { criteria: string }).criteria;
    const terms = words(`${p.text} ${criteria}`);
    const hits = terms.filter((t) => corpus.includes(t));
    const visual = VISUAL.test(`${p.text} ${criteria}`);
    const readable = images.length + texts.length;
    const placeholder =
      texts.some((t) => PLACEHOLDER.test(t)) || names.some((n) => PLACEHOLDER.test(n));
    const tiny =
      images.length > 0 &&
      images.every((i) => (i.width ?? 0) < 64 || (i.height ?? 0) < 64);
    const saw = (s: string) => `Simulated examiner saw: ${s}.`;
    const observations: string[] = [];
    if (readable === 0)
      observations.push(
        saw(input.files.length ? "no file it can read (images or text)" : "no files"),
      );
    else {
      if (images.length)
        observations.push(
          saw(
            `${images.length} readable image${images.length === 1 ? "" : "s"} (${images
              .map((i) => `${i.name} ${i.width ?? "?"}×${i.height ?? "?"}`)
              .join(", ")})${visual ? ", for a visual criterion" : ""}`,
          ),
        );
      if (texts.length)
        observations.push(
          saw(`${texts.length} readable text file${texts.length === 1 ? "" : "s"}`),
        );
      if (hits.length)
        observations.push(
          saw(`the criterion's terms in the evidence: ${hits.slice(0, 6).join(", ")}`),
        );
      if (placeholder)
        observations.push(saw("placeholder text or a placeholder file name"));
      if (tiny) observations.push(saw("only images under 64 px on a side"));
    }
    return {
      predicate_id: p.id,
      verdict: "abstain",
      confidence: 0,
      reasons: [...observations, NOT_A_JUDGEMENT],
      what_would_resolve:
        "The buyer's confirmation, or the real examiner with an API key configured.",
    };
  });
  return {
    verdicts,
    evidenceSummary: `Simulated examiner read ${images.length} image${images.length === 1 ? "" : "s"} and ${texts.length} text file${texts.length === 1 ? "" : "s"} of ${input.files.length} submitted, and abstained on every judgement line.`,
    inputManifest: manifest,
    usage: { inputTokens: 0, outputTokens: 0 },
    model: SIMULATED_MODEL,
  };
}
