/**
 * The simulated examiner. Deterministic, labelled on every page it touches,
 * and never presented as a real judgement: it exists so the judgement path can
 * be run end to end without a model key. It reads only what a careful script
 * could: file names, readable text, image metadata, and the words in the
 * criteria. It passes only on clear signals, fails only on obvious placeholders,
 * and abstains otherwise, exactly as the real examiner is told to.
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
    const why = (s: string) => `Simulated examiner: ${s}`;
    if (readable === 0)
      return {
        predicate_id: p.id,
        verdict: "abstain",
        confidence: 0.3,
        reasons: [
          why(
            input.files.length
              ? "none of the files is an image or text it can read"
              : "no files were submitted",
          ),
        ],
        what_would_resolve: "A readable image or text file, or the buyer's confirmation.",
      };
    if (placeholder)
      return {
        predicate_id: p.id,
        verdict: "fail",
        confidence: 0.8,
        reasons: [
          why("the evidence contains placeholder text or a placeholder file name"),
        ],
        what_would_resolve: "A delivery without placeholder content.",
      };
    if (tiny)
      return {
        predicate_id: p.id,
        verdict: "abstain",
        confidence: 0.45,
        reasons: [
          why(
            `every image is smaller than 64 px on a side (${images.map((i) => `${i.name} ${i.width ?? "?"}×${i.height ?? "?"}`).join(", ")})`,
          ),
        ],
        what_would_resolve: "Images at a size a reviewer could judge.",
      };
    if (visual && images.length > 0)
      return {
        predicate_id: p.id,
        verdict: "pass",
        confidence: 0.84,
        reasons: [
          why(
            `${images.length} readable image${images.length === 1 ? "" : "s"} submitted for a visual criterion (${images.map((i) => i.name).join(", ")})`,
          ),
          ...(hits.length
            ? [why(`file names or text mention: ${hits.slice(0, 5).join(", ")}`)]
            : []),
        ],
        what_would_resolve:
          "Nothing further; the buyer may still object within the window.",
      };
    if (hits.length >= 2)
      return {
        predicate_id: p.id,
        verdict: "pass",
        confidence: 0.82,
        reasons: [
          why(
            `the evidence mentions ${hits.length} of the criterion's terms: ${hits.slice(0, 6).join(", ")}`,
          ),
        ],
        what_would_resolve:
          "Nothing further; the buyer may still object within the window.",
      };
    return {
      predicate_id: p.id,
      verdict: "abstain",
      confidence: hits.length === 1 ? 0.55 : 0.4,
      reasons: [
        why(
          hits.length === 1
            ? `only one of the criterion's terms (${hits[0]}) appears in the evidence`
            : "nothing in the file names or readable text matches the criterion",
        ),
      ],
      what_would_resolve:
        "The buyer's confirmation, or evidence that names what the criterion asks for.",
    };
  });
  return {
    verdicts,
    evidenceSummary: `Simulated examiner read ${images.length} image${images.length === 1 ? "" : "s"} and ${texts.length} text file${texts.length === 1 ? "" : "s"} of ${input.files.length} submitted.`,
    inputManifest: manifest,
    usage: { inputTokens: 0, outputTokens: 0 },
    model: SIMULATED_MODEL,
  };
}
