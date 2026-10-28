/**
 * Labelled evaluation cases for the examiner.
 *
 * Each case is a brief, one judgement predicate, the files a seller would
 * submit, and the verdict a careful human would give. `abstain` is expected
 * where the files cannot establish the criterion. Run with `npm run eval`.
 *
 * Text deliverables are inline. Image cases are generated: flat-colour
 * compositions whose colour count and shapes are known, so "at most two
 * colours" and "contains a circle" have ground truth.
 */
import { deflateSync } from "node:zlib";

export type Expected = "pass" | "fail" | "abstain";

export interface EvalFile {
  name: string;
  mime: string;
  bytes: Uint8Array;
}

export interface EvalCase {
  id: string;
  category: "copy" | "data" | "code" | "image";
  brief: string;
  predicate: string;
  criteria: string;
  files: EvalFile[];
  expected: Expected;
  note?: string;
}

const text = (name: string, body: string, mime = "text/markdown"): EvalFile => ({
  name,
  mime,
  bytes: new TextEncoder().encode(body),
});

// ---------- image generation ----------

function crc(buf: Buffer): number {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const sum = Buffer.alloc(4);
  sum.writeUInt32BE(crc(body));
  return Buffer.concat([len, body, sum]);
}
type Shape = {
  kind: "circle" | "rect" | "stripe";
  color: [number, number, number];
  x: number;
  y: number;
  w: number;
  h: number;
};
function image(
  name: string,
  bg: [number, number, number],
  shapes: Shape[],
  size = 320,
): EvalFile {
  const w = size;
  const h = size;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let c = bg;
      for (const s of shapes) {
        const inside =
          s.kind === "circle"
            ? (x - s.x) ** 2 + (y - s.y) ** 2 < (s.w / 2) ** 2
            : s.kind === "rect"
              ? x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h
              : Math.floor((x + y) / s.w) % 2 === 0 && y >= s.y && y < s.y + s.h;
        if (inside) c = s.color;
      }
      const i = y * (w * 3 + 1) + 1 + x * 3;
      raw[i] = c[0];
      raw[i + 1] = c[1];
      raw[i + 2] = c[2];
    }
  }
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  return { name, mime: "image/png", bytes: new Uint8Array(png) };
}

const paper: [number, number, number] = [246, 244, 239];
const teal: [number, number, number] = [13, 92, 78];
const sand: [number, number, number] = [214, 180, 120];
const red: [number, number, number] = [200, 40, 30];
const blue: [number, number, number] = [40, 80, 200];
const black: [number, number, number] = [20, 20, 20];

// ---------- cases ----------

const copyBrief =
  "Five sections of website copy for Fernleaf Landscaping, British English, friendly but not jokey, each section under 120 words, delivered as one Markdown file with headings.";

const goodCopy = `# Fernleaf Landscaping

## Gardens that look after themselves
We design planting that suits your soil and your weekends. Less watering, fewer weekends lost to weeding, more time outside.

## Design
Every garden starts with a site visit and a conversation. You get a scaled plan, a planting list and a cost before anything is dug.

## Build
Our own team builds what we draw: patios, decking, lawns, borders and lighting. No subcontractors you have not met.

## Care
Monthly visits keep things tidy and catch problems early. Choose a plan or call us when you need us.

## Get in touch
Send a photo of your garden and a line about what you want from it. We reply within two working days.
`;

const americanCopy = goodCopy
  .replace("colour", "color")
  .replace(
    "Our own team builds what we draw",
    "Our own team builds what we draw, no sweat",
  )
  .replace(
    "We reply within two working days.",
    "We'll reply within two business days, you bet.",
  );

const fourSections = goodCopy.split("## Get in touch")[0]!;

const longSection = goodCopy.replace(
  "## Design\nEvery garden starts with a site visit and a conversation. You get a scaled plan, a planting list and a cost before anything is dug.",
  "## Design\n" +
    "Every garden starts with a site visit and a long conversation about what you want, what you have, and what the soil will allow. ".repeat(
      6,
    ),
);

export const cases: EvalCase[] = [
  // copy
  {
    id: "copy-01",
    category: "copy",
    brief: copyBrief,
    predicate: "Copy is British English, friendly but not jokey",
    criteria:
      "Spelling and idiom are British; tone is warm without jokes or exclamation-heavy hype.",
    files: [text("fernleaf.md", goodCopy)],
    expected: "pass",
  },
  {
    id: "copy-02",
    category: "copy",
    brief: copyBrief,
    predicate: "Copy is British English, friendly but not jokey",
    criteria:
      "Spelling and idiom are British; tone is warm without jokes or exclamation-heavy hype.",
    files: [text("fernleaf.md", americanCopy)],
    expected: "fail",
    note: "American idiom and jokey asides",
  },
  {
    id: "copy-03",
    category: "copy",
    brief: copyBrief,
    predicate: "Five sections with headings are present",
    criteria:
      "The Markdown has exactly five second-level sections, each with a heading and body copy.",
    files: [text("fernleaf.md", goodCopy)],
    expected: "pass",
  },
  {
    id: "copy-04",
    category: "copy",
    brief: copyBrief,
    predicate: "Five sections with headings are present",
    criteria:
      "The Markdown has exactly five second-level sections, each with a heading and body copy.",
    files: [text("fernleaf.md", fourSections)],
    expected: "fail",
  },
  {
    id: "copy-05",
    category: "copy",
    brief: copyBrief,
    predicate: "Each section is under 120 words",
    criteria: "No section body exceeds 120 words.",
    files: [text("fernleaf.md", goodCopy)],
    expected: "pass",
  },
  {
    id: "copy-06",
    category: "copy",
    brief: copyBrief,
    predicate: "Each section is under 120 words",
    criteria: "No section body exceeds 120 words.",
    files: [text("fernleaf.md", longSection)],
    expected: "fail",
  },
  {
    id: "copy-07",
    category: "copy",
    brief: copyBrief,
    predicate: "Copy reflects the client's approved brand voice document",
    criteria: "The copy follows the client's brand voice guide.",
    files: [text("fernleaf.md", goodCopy)],
    expected: "abstain",
    note: "The voice guide was never provided",
  },
  {
    id: "copy-08",
    category: "copy",
    brief: copyBrief,
    predicate: "Copy is accurate about the company's services",
    criteria: "Every service mentioned is one the company actually offers.",
    files: [text("fernleaf.md", goodCopy)],
    expected: "abstain",
    note: "No source of truth for the service list",
  },
  {
    id: "copy-09",
    category: "copy",
    brief:
      "A 200-word product description for a hand-thrown stoneware mug, no superlatives, mention capacity (350 ml) and dishwasher safety.",
    predicate: "Mentions capacity and dishwasher safety without superlatives",
    criteria:
      "States 350 ml and dishwasher safety; contains no superlatives such as best, perfect, ultimate.",
    files: [
      text(
        "mug.md",
        "# Stoneware mug\n\nThrown on the wheel in small batches, this mug holds 350 ml and sits comfortably in the hand. The glaze is a speckled oatmeal over a dark clay body, so each one varies a little. It is dishwasher safe and fine for daily use. The handle takes three fingers. Ships in recycled card.",
      ),
    ],
    expected: "pass",
  },
  {
    id: "copy-10",
    category: "copy",
    brief:
      "A 200-word product description for a hand-thrown stoneware mug, no superlatives, mention capacity (350 ml) and dishwasher safety.",
    predicate: "Mentions capacity and dishwasher safety without superlatives",
    criteria:
      "States 350 ml and dishwasher safety; contains no superlatives such as best, perfect, ultimate.",
    files: [
      text(
        "mug.md",
        "# The perfect mug\n\nThe best mug you will ever own. Hand thrown, ultimate comfort, a glaze like no other. Hand wash only to keep it flawless.",
      ),
    ],
    expected: "fail",
  },
  {
    id: "copy-11",
    category: "copy",
    brief:
      "Translate the attached 300-word safety notice from English to Spanish for a Mexican audience.",
    predicate: "Translation is complete and uses Mexican Spanish",
    criteria: "Every paragraph of the source is translated; vocabulary suits Mexico.",
    files: [
      text(
        "aviso.md",
        "# Aviso de seguridad\n\nAntes de usar el equipo, revise que el cable no esté dañado. No lo opere con las manos mojadas. Mantenga a los niños alejados.",
      ),
    ],
    expected: "abstain",
    note: "Source text not supplied, completeness cannot be judged",
  },
  {
    id: "copy-12",
    category: "copy",
    brief:
      "Write a three-paragraph bio for a jazz pianist, third person, under 150 words, must mention the 2024 album 'Low Tide'.",
    predicate: "Bio mentions the album Low Tide and is in the third person",
    criteria: "Third person throughout; names the album Low Tide; under 150 words.",
    files: [
      text(
        "bio.md",
        "Mara Quist is a pianist based in Bristol. She trained at Leeds and spent five years in the house band at Ronnie Scott's before leading her own trio.\n\nHer 2024 album Low Tide collects nine originals written on the Somerset coast, recorded live in two days.\n\nShe teaches at the conservatoire and plays most Thursdays at the Canteen.",
      ),
    ],
    expected: "pass",
  },
  {
    id: "copy-13",
    category: "copy",
    brief:
      "Write a three-paragraph bio for a jazz pianist, third person, under 150 words, must mention the 2024 album 'Low Tide'.",
    predicate: "Bio mentions the album Low Tide and is in the third person",
    criteria: "Third person throughout; names the album Low Tide; under 150 words.",
    files: [
      text(
        "bio.md",
        "I am a pianist based in Bristol. I trained at Leeds and spent five years at Ronnie Scott's.\n\nMy new record collects nine originals written on the coast.\n\nI teach and play most Thursdays.",
      ),
    ],
    expected: "fail",
  },
  // data
  {
    id: "data-01",
    category: "data",
    brief:
      "Clean the attached customer list: one row per customer, columns email, first_name, last_name, country (ISO-2), no duplicate emails, delivered as CSV.",
    predicate: "CSV has the agreed columns and no duplicate emails",
    criteria:
      "Header is exactly email,first_name,last_name,country; every country is an ISO-2 code; no email appears twice.",
    files: [
      text(
        "customers.csv",
        "email,first_name,last_name,country\nada@example.com,Ada,Mensah,GH\nbea@example.com,Bea,Okafor,NG\nsam@example.com,Sam,Lee,KR\n",
        "text/csv",
      ),
    ],
    expected: "pass",
  },
  {
    id: "data-02",
    category: "data",
    brief:
      "Clean the attached customer list: one row per customer, columns email, first_name, last_name, country (ISO-2), no duplicate emails, delivered as CSV.",
    predicate: "CSV has the agreed columns and no duplicate emails",
    criteria:
      "Header is exactly email,first_name,last_name,country; every country is an ISO-2 code; no email appears twice.",
    files: [
      text(
        "customers.csv",
        "email,first_name,last_name,country\nada@example.com,Ada,Mensah,Ghana\nbea@example.com,Bea,Okafor,NG\nada@example.com,Ada,Mensah,GH\n",
        "text/csv",
      ),
    ],
    expected: "fail",
  },
  {
    id: "data-03",
    category: "data",
    brief:
      "Clean the attached customer list: one row per customer, columns email, first_name, last_name, country (ISO-2), no duplicate emails, delivered as CSV.",
    predicate: "No customers from the original list were dropped",
    criteria: "Every customer in the source list appears in the cleaned file.",
    files: [
      text(
        "customers.csv",
        "email,first_name,last_name,country\nada@example.com,Ada,Mensah,GH\n",
        "text/csv",
      ),
    ],
    expected: "abstain",
    note: "Source list not supplied",
  },
  {
    id: "data-04",
    category: "data",
    brief:
      "Export the 2025 event schedule as JSON: an array of objects with name, date (ISO), venue, capacity (integer).",
    predicate: "JSON matches the agreed shape",
    criteria:
      "Valid JSON array; each object has name, date in ISO 8601, venue, integer capacity; nothing else.",
    files: [
      text(
        "events.json",
        JSON.stringify(
          [
            {
              name: "Spring Fair",
              date: "2025-04-12",
              venue: "Town Hall",
              capacity: 300,
            },
            { name: "Harvest", date: "2025-09-20", venue: "Green", capacity: 1200 },
          ],
          null,
          2,
        ),
        "application/json",
      ),
    ],
    expected: "pass",
  },
  {
    id: "data-05",
    category: "data",
    brief:
      "Export the 2025 event schedule as JSON: an array of objects with name, date (ISO), venue, capacity (integer).",
    predicate: "JSON matches the agreed shape",
    criteria:
      "Valid JSON array; each object has name, date in ISO 8601, venue, integer capacity; nothing else.",
    files: [
      text(
        "events.json",
        JSON.stringify(
          [
            {
              name: "Spring Fair",
              date: "12/04/2025",
              venue: "Town Hall",
              capacity: "300",
            },
          ],
          null,
          2,
        ),
        "application/json",
      ),
    ],
    expected: "fail",
  },
  {
    id: "data-06",
    category: "data",
    brief: "Export the 2025 event schedule as JSON.",
    predicate: "The capacities are correct",
    criteria: "Each capacity matches the venue's licensed capacity.",
    files: [
      text(
        "events.json",
        JSON.stringify([
          { name: "Spring Fair", date: "2025-04-12", venue: "Town Hall", capacity: 300 },
        ]),
        "application/json",
      ),
    ],
    expected: "abstain",
  },
  // code
  {
    id: "code-01",
    category: "code",
    brief:
      "A JavaScript function slugify(title) that lowercases, replaces runs of non-alphanumerics with single hyphens, trims hyphens, with three unit tests.",
    predicate: "Function and tests match the brief",
    criteria:
      "slugify lowercases, collapses non-alphanumeric runs to one hyphen, trims leading and trailing hyphens; at least three tests exercise it.",
    files: [
      text(
        "slugify.js",
        "export function slugify(title) {\n  return String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');\n}\n",
        "text/plain",
      ),
      text(
        "slugify.test.js",
        "import { slugify } from './slugify.js';\nimport assert from 'node:assert';\nassert.equal(slugify('Hello, World!'), 'hello-world');\nassert.equal(slugify('  --Trim me--  '), 'trim-me');\nassert.equal(slugify('A  B   C'), 'a-b-c');\n",
        "text/plain",
      ),
    ],
    expected: "pass",
  },
  {
    id: "code-02",
    category: "code",
    brief:
      "A JavaScript function slugify(title) that lowercases, replaces runs of non-alphanumerics with single hyphens, trims hyphens, with three unit tests.",
    predicate: "Function and tests match the brief",
    criteria:
      "slugify lowercases, collapses non-alphanumeric runs to one hyphen, trims leading and trailing hyphens; at least three tests exercise it.",
    files: [
      text(
        "slugify.js",
        "export function slugify(title) {\n  return title.replace(/ /g, '-');\n}\n",
        "text/plain",
      ),
    ],
    expected: "fail",
  },
  {
    id: "code-03",
    category: "code",
    brief:
      "A SQL migration adding an index on orders(customer_id, created_at) for Postgres, reversible.",
    predicate: "Migration is reversible and targets the right columns",
    criteria:
      "Has an up step creating an index on orders(customer_id, created_at) and a down step dropping it; valid Postgres.",
    files: [
      text(
        "003_orders_index.sql",
        "-- up\nCREATE INDEX CONCURRENTLY IF NOT EXISTS orders_customer_created ON orders (customer_id, created_at);\n-- down\nDROP INDEX IF EXISTS orders_customer_created;\n",
        "text/plain",
      ),
    ],
    expected: "pass",
  },
  {
    id: "code-04",
    category: "code",
    brief:
      "A SQL migration adding an index on orders(customer_id, created_at) for Postgres, reversible.",
    predicate: "Migration is reversible and targets the right columns",
    criteria:
      "Has an up step creating an index on orders(customer_id, created_at) and a down step dropping it; valid Postgres.",
    files: [
      text(
        "003_orders_index.sql",
        "CREATE INDEX orders_idx ON orders (created_at);\n",
        "text/plain",
      ),
    ],
    expected: "fail",
  },
  {
    id: "code-05",
    category: "code",
    brief: "Fix the flaky checkout test in our repo.",
    predicate: "The checkout test no longer flakes in CI",
    criteria: "The test passes reliably on the project's CI.",
    files: [
      text(
        "patch.diff",
        "--- a/tests/checkout.test.ts\n+++ b/tests/checkout.test.ts\n@@\n-  await sleep(100);\n+  await page.waitForSelector('[data-ready]');\n",
        "text/plain",
      ),
    ],
    expected: "abstain",
    note: "CI behaviour is not observable from the diff",
  },
  // image
  {
    id: "image-01",
    category: "image",
    brief:
      "A logo mark for a coastal café: at most two colours plus background, minimal.",
    predicate: "Uses at most two colours and is minimal",
    criteria:
      "No more than two colours besides the background; simple geometry without ornament.",
    files: [
      image("mark-a.png", paper, [
        { kind: "circle", color: teal, x: 160, y: 160, w: 180, h: 180 },
        { kind: "rect", color: sand, x: 60, y: 230, w: 200, h: 24 },
      ]),
    ],
    expected: "pass",
  },
  {
    id: "image-02",
    category: "image",
    brief:
      "A logo mark for a coastal café: at most two colours plus background, minimal.",
    predicate: "Uses at most two colours and is minimal",
    criteria:
      "No more than two colours besides the background; simple geometry without ornament.",
    files: [
      image("mark-b.png", paper, [
        { kind: "circle", color: teal, x: 160, y: 140, w: 160, h: 160 },
        { kind: "rect", color: sand, x: 40, y: 220, w: 240, h: 20 },
        { kind: "rect", color: red, x: 40, y: 250, w: 240, h: 20 },
        { kind: "rect", color: blue, x: 40, y: 280, w: 240, h: 20 },
        { kind: "stripe", color: black, x: 0, y: 0, w: 12, h: 100 },
      ]),
    ],
    expected: "fail",
    note: "Five colours and a busy stripe pattern",
  },
  {
    id: "image-03",
    category: "image",
    brief: "A simple icon: a single filled circle on a plain background.",
    predicate: "Contains exactly one circle and nothing else",
    criteria: "One filled circle; no other shapes, text or texture.",
    files: [
      image("icon.png", paper, [
        { kind: "circle", color: teal, x: 160, y: 160, w: 200, h: 200 },
      ]),
    ],
    expected: "pass",
  },
  {
    id: "image-04",
    category: "image",
    brief: "A simple icon: a single filled circle on a plain background.",
    predicate: "Contains exactly one circle and nothing else",
    criteria: "One filled circle; no other shapes, text or texture.",
    files: [
      image("icon.png", paper, [
        { kind: "rect", color: teal, x: 80, y: 80, w: 160, h: 160 },
      ]),
    ],
    expected: "fail",
  },
  {
    id: "image-05",
    category: "image",
    brief: "Photograph the used phone showing the screen on and the back, no cracks.",
    predicate: "Photos show the actual phone with no visible cracks",
    criteria:
      "Images are photographs of a phone, front and back, with no cracks visible.",
    files: [
      image("phone.png", paper, [
        { kind: "rect", color: black, x: 110, y: 40, w: 100, h: 240 },
      ]),
    ],
    expected: "abstain",
    note: "A flat rectangle is not a photograph of a phone; the examiner cannot confirm condition",
  },
  {
    id: "image-06",
    category: "image",
    brief:
      "A logo mark for a coastal café: at most two colours plus background, minimal.",
    predicate: "The mark matches the client's existing signage",
    criteria: "The mark is consistent with the signage photographed at the café.",
    files: [
      image("mark-a.png", paper, [
        { kind: "circle", color: teal, x: 160, y: 160, w: 180, h: 180 },
      ]),
    ],
    expected: "abstain",
    note: "No signage reference supplied",
  },
];
