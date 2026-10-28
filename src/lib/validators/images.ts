/**
 * Image metadata from file headers, with no decoding and no dependencies.
 * Enough for the deterministic checks: format, dimensions, and dpi.
 */
export interface ImageMeta {
  format: "png" | "jpeg" | "gif" | "webp" | "svg";
  width: number | null;
  height: number | null;
  /** Dots per inch when the file declares it; null when absent; "vector" for SVG. */
  dpi: number | "vector" | null;
}

export function sniffMime(bytes: Uint8Array, name = ""): string | null {
  const b = bytes;
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47)
    return "image/png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)
    return "image/jpeg";
  if (b.length >= 6 && ascii(b, 0, 4) === "GIF8") return "image/gif";
  if (b.length >= 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP")
    return "image/webp";
  if (b.length >= 4 && ascii(b, 0, 4) === "%PDF") return "application/pdf";
  if (b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04) {
    const ext = name.toLowerCase().split(".").pop();
    if (ext === "docx")
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (ext === "xlsx")
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    if (ext === "pptx")
      return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    return "application/zip";
  }
  const head = new TextDecoder("utf-8", { fatal: false })
    .decode(b.subarray(0, 512))
    .trimStart();
  if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(head))
    return "image/svg+xml";
  if (isProbablyText(b)) {
    const ext = name.toLowerCase().split(".").pop();
    if (ext === "md") return "text/markdown";
    if (ext === "csv") return "text/csv";
    if (ext === "json") return "application/json";
    if (ext === "html" || ext === "htm") return "text/html";
    return "text/plain";
  }
  return null;
}

export function imageMeta(bytes: Uint8Array, mime: string | null): ImageMeta | null {
  switch (mime) {
    case "image/png":
      return png(bytes);
    case "image/jpeg":
      return jpeg(bytes);
    case "image/gif":
      return gif(bytes);
    case "image/webp":
      return webp(bytes);
    case "image/svg+xml":
      return svg(bytes);
    default:
      return null;
  }
}

function ascii(b: Uint8Array, from: number, to: number): string {
  return String.fromCharCode(...b.subarray(from, to));
}

function isProbablyText(b: Uint8Array): boolean {
  const sample = b.subarray(0, 1024);
  if (sample.length === 0) return true;
  let control = 0;
  for (const c of sample)
    if (c === 0 || (c < 7 && c !== 0) || (c > 13 && c < 32)) control++;
  return control / sample.length < 0.02;
}

function u32be(b: Uint8Array, i: number): number {
  return ((b[i]! << 24) >>> 0) + (b[i + 1]! << 16) + (b[i + 2]! << 8) + b[i + 3]!;
}

function u16be(b: Uint8Array, i: number): number {
  return (b[i]! << 8) + b[i + 1]!;
}

function u16le(b: Uint8Array, i: number): number {
  return b[i]! + (b[i + 1]! << 8);
}

function png(b: Uint8Array): ImageMeta | null {
  if (b.length < 24) return null;
  const width = u32be(b, 16);
  const height = u32be(b, 20);
  let dpi: number | null = null;
  let offset = 8;
  while (offset + 8 <= b.length) {
    const length = u32be(b, offset);
    const type = ascii(b, offset + 4, offset + 8);
    if (type === "pHYs" && offset + 8 + 9 <= b.length) {
      const ppuX = u32be(b, offset + 8);
      const unit = b[offset + 16];
      if (unit === 1) dpi = Math.round(ppuX * 0.0254);
      break;
    }
    if (type === "IDAT" || type === "IEND") break;
    offset += 12 + length;
  }
  return { format: "png", width, height, dpi };
}

function jpeg(b: Uint8Array): ImageMeta | null {
  let i = 2;
  let width: number | null = null;
  let height: number | null = null;
  let dpi: number | null = null;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = b[i + 1]!;
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) break;
    const length = u16be(b, i + 2);
    if (marker === 0xe0 && ascii(b, i + 4, i + 8) === "JFIF") {
      const units = b[i + 11];
      const xDensity = u16be(b, i + 12);
      if (units === 1) dpi = xDensity;
      else if (units === 2) dpi = Math.round(xDensity * 2.54);
    }
    if (
      [
        0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
      ].includes(marker)
    ) {
      height = u16be(b, i + 5);
      width = u16be(b, i + 7);
      if (dpi !== null) break;
    }
    i += 2 + length;
  }
  return { format: "jpeg", width, height, dpi };
}

function gif(b: Uint8Array): ImageMeta | null {
  if (b.length < 10) return null;
  return { format: "gif", width: u16le(b, 6), height: u16le(b, 8), dpi: null };
}

function webp(b: Uint8Array): ImageMeta | null {
  if (b.length < 30) return null;
  const chunk = ascii(b, 12, 16);
  if (chunk === "VP8X") {
    const width = 1 + (b[24]! | (b[25]! << 8) | (b[26]! << 16));
    const height = 1 + (b[27]! | (b[28]! << 8) | (b[29]! << 16));
    return { format: "webp", width, height, dpi: null };
  }
  if (chunk === "VP8 ") {
    return {
      format: "webp",
      width: u16le(b, 26) & 0x3fff,
      height: u16le(b, 28) & 0x3fff,
      dpi: null,
    };
  }
  if (chunk === "VP8L") {
    const bits = b[21]! | (b[22]! << 8) | (b[23]! << 16) | (b[24]! << 24);
    return {
      format: "webp",
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
      dpi: null,
    };
  }
  return { format: "webp", width: null, height: null, dpi: null };
}

function svg(b: Uint8Array): ImageMeta | null {
  const text = new TextDecoder().decode(b.subarray(0, 4096));
  const tag = /<svg\b[^>]*>/i.exec(text)?.[0] ?? "";
  const attr = (name: string) =>
    new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "i").exec(tag)?.[1];
  const num = (v?: string) => (v ? Number.parseFloat(v) || null : null);
  let width = num(attr("width"));
  let height = num(attr("height"));
  const viewBox = attr("viewBox")
    ?.split(/[\s,]+/)
    .map(Number);
  if ((!width || !height) && viewBox && viewBox.length === 4) {
    width ??= viewBox[2] ?? null;
    height ??= viewBox[3] ?? null;
  }
  return { format: "svg", width, height, dpi: "vector" };
}
