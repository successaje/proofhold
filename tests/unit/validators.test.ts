import { test } from "node:test";
import assert from "node:assert/strict";
import { deflateSync } from "node:zlib";
import { imageMeta, sniffMime } from "../../src/lib/validators/images";
import { runValidators } from "../../src/lib/validators/run";
import type { AcceptanceTest } from "../../src/lib/domain/test";

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

/** A valid 1-bit PNG of the given size with an optional dpi declaration. */
export function makePng(width: number, height: number, dpi?: number): Uint8Array {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // greyscale
  const parts = [
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
  ];
  if (dpi) {
    const phys = Buffer.alloc(9);
    const ppm = Math.round(dpi / 0.0254);
    phys.writeUInt32BE(ppm, 0);
    phys.writeUInt32BE(ppm, 4);
    phys[8] = 1;
    parts.push(chunk("pHYs", phys));
  }
  const raw = Buffer.alloc((width + 1) * height);
  parts.push(chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0)));
  return new Uint8Array(Buffer.concat(parts));
}

function makeJpeg(width: number, height: number, dpi?: number): Uint8Array {
  const soi = Buffer.from([0xff, 0xd8]);
  const app0 = Buffer.from([
    0xff,
    0xe0,
    0x00,
    0x10,
    0x4a,
    0x46,
    0x49,
    0x46,
    0x00,
    0x01,
    0x01,
    dpi ? 1 : 0,
    (dpi ?? 0) >> 8,
    (dpi ?? 0) & 0xff,
    (dpi ?? 0) >> 8,
    (dpi ?? 0) & 0xff,
    0x00,
    0x00,
  ]);
  const sof = Buffer.from([
    0xff,
    0xc0,
    0x00,
    0x0b,
    0x08,
    height >> 8,
    height & 0xff,
    width >> 8,
    width & 0xff,
    0x01,
    0x01,
    0x11,
    0x00,
  ]);
  return new Uint8Array(Buffer.concat([soi, app0, sof, Buffer.from([0xff, 0xd9])]));
}

test("sniffs formats and reads dimensions and dpi", () => {
  const png = makePng(1200, 800, 300);
  assert.equal(sniffMime(png), "image/png");
  assert.deepEqual(imageMeta(png, "image/png"), {
    format: "png",
    width: 1200,
    height: 800,
    dpi: 300,
  });
  const jpg = makeJpeg(640, 480, 72);
  assert.equal(sniffMime(jpg), "image/jpeg");
  assert.deepEqual(imageMeta(jpg, "image/jpeg"), {
    format: "jpeg",
    width: 640,
    height: 480,
    dpi: 72,
  });
  const svg = new TextEncoder().encode(
    '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"></svg>',
  );
  assert.equal(sniffMime(svg, "logo.svg"), "image/svg+xml");
  assert.deepEqual(imageMeta(svg, "image/svg+xml"), {
    format: "svg",
    width: 400,
    height: 300,
    dpi: "vector",
  });
  assert.equal(
    sniffMime(new TextEncoder().encode("# Notes\nhello"), "notes.md"),
    "text/markdown",
  );
  assert.equal(
    sniffMime(new TextEncoder().encode("%PDF-1.7 ..."), "a.pdf"),
    "application/pdf",
  );
});

const logoTest: AcceptanceTest = {
  version: 1,
  summary: "Logo set",
  predicates: [
    {
      id: "p1",
      text: "Three PNG or SVG concepts",
      evidence: "file",
      must_pass: true,
      check: { kind: "count", min: 3, mime: ["image/png", "image/svg+xml"] },
    },
    {
      id: "p2",
      text: "PNGs at least 1000px wide",
      evidence: "file",
      must_pass: true,
      check: { kind: "dimensions", min_width: 1000 },
    },
    {
      id: "p3",
      text: "300 dpi",
      evidence: "file",
      must_pass: true,
      check: { kind: "dpi", min: 300 },
    },
    {
      id: "p4",
      text: "By deadline",
      evidence: "file",
      must_pass: true,
      check: { kind: "deadline", before: "2026-11-05T23:59:59.000Z" },
    },
    {
      id: "p5",
      text: "Looks coastal",
      evidence: "judgement",
      must_pass: true,
      check: { kind: "judgement", criteria: "coastal" },
    },
    {
      id: "p6",
      text: "Buyer confirms",
      evidence: "buyer_confirmation",
      must_pass: false,
      check: { kind: "buyer_confirms", prompt: "Happy?" },
    },
  ],
  rules: { silence_window_hours: 72, partial_release: [] },
  unclear: [],
};

function fileView(
  name: string,
  bytes: Uint8Array,
  createdAt = "2026-11-03T10:00:00.000Z",
) {
  const mime = sniffMime(bytes, name);
  return { name, mime, size: bytes.byteLength, meta: imageMeta(bytes, mime), createdAt };
}

test("validators pass a complete logo delivery and leave judgement pending", () => {
  const files = [
    fileView("a.png", makePng(1200, 900, 300)),
    fileView("b.png", makePng(1500, 900, 300)),
    fileView(
      "c.svg",
      new TextEncoder().encode(
        '<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500"/>',
      ),
    ),
  ];
  const results = runValidators(logoTest, {
    files,
    tracking: null,
    buyerConfirmed: null,
    submittedAt: "2026-11-03T10:00:00.000Z",
  });
  const byId = Object.fromEntries(results.map((r) => [r.predicateId, r]));
  assert.equal(byId.p1!.verdict, "pass");
  assert.equal(byId.p2!.verdict, "pass");
  assert.equal(byId.p3!.verdict, "pass");
  assert.equal(byId.p4!.verdict, "pass");
  assert.equal(byId.p5!.verdict, "pending");
  assert.equal(byId.p6!.verdict, "pending");
});

test("validators fail with specific reasons", () => {
  const files = [
    fileView("a.png", makePng(640, 480), "2026-11-06T10:00:00.000Z"),
    fileView("b.jpg", makeJpeg(2000, 2000, 72)),
  ];
  const results = runValidators(logoTest, {
    files,
    tracking: null,
    buyerConfirmed: false,
    submittedAt: "2026-11-06T10:00:00.000Z",
  });
  const byId = Object.fromEntries(results.map((r) => [r.predicateId, r]));
  assert.equal(byId.p1!.verdict, "fail");
  assert.match(byId.p1!.reasons[0]!, /1 matching file, need at least 3/);
  assert.equal(byId.p2!.verdict, "fail");
  assert.match(byId.p2!.reasons.join(" "), /a\.png: width 640px/);
  assert.equal(byId.p3!.verdict, "fail");
  assert.match(byId.p3!.reasons.join(" "), /no resolution declared/);
  assert.equal(byId.p4!.verdict, "fail");
  assert.equal(byId.p6!.verdict, "fail");
});

test("tracking numbers are checked against carrier patterns", () => {
  const t: AcceptanceTest = {
    version: 1,
    summary: "Phone",
    predicates: [
      {
        id: "p1",
        text: "Shipped",
        evidence: "tracking",
        must_pass: true,
        check: { kind: "tracking_shipped" },
      },
    ],
    rules: { silence_window_hours: 48, partial_release: [] },
    unclear: [],
  };
  const base = {
    files: [],
    buyerConfirmed: null,
    submittedAt: "2026-11-03T10:00:00.000Z",
  };
  assert.equal(runValidators(t, { ...base, tracking: null })[0]!.verdict, "pending");
  assert.equal(
    runValidators(t, {
      ...base,
      tracking: {
        carrier: "UPS",
        number: "1Z999AA10123456784",
        recordedAt: base.submittedAt,
      },
    })[0]!.verdict,
    "pass",
  );
  assert.equal(
    runValidators(t, {
      ...base,
      tracking: { carrier: "UPS", number: "12345", recordedAt: base.submittedAt },
    })[0]!.verdict,
    "fail",
  );
});
