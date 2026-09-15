// Metrics and encoding for the PDF standard 14 fonts Helvetica and Helvetica-Bold.
// Standard fonts are built into every PDF reader, so nothing has to be embedded.

export type PdfFont = "regular" | "bold";

// Advance widths (1/1000 em) for character codes 32-126, from the Adobe AFM files.
const HELVETICA = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];
const HELVETICA_BOLD = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
  333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
  611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];

// Unicode code points for WinAnsiEncoding bytes 0x80-0x9F; 0xA0-0xFF match Latin-1.
const WIN_ANSI_HIGH: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87,
  0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91,
  0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98,
  0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
};

// Widths of the punctuation above that differ noticeably from the fallback.
const WIDE_PUNCTUATION: Record<number, [regular: number, bold: number]> = {
  0x85: [1000, 1000], 0x97: [1000, 1000], 0x89: [1000, 1000], 0x99: [1000, 1000], 0x95: [350, 350],
  0x91: [222, 278], 0x92: [222, 278], 0x93: [333, 500], 0x94: [333, 500], 0x82: [222, 278], 0x84: [333, 500],
};

/** Maps text to WinAnsi byte values. Characters the encoding lacks become their base letter or "?". */
export function encodeWinAnsi(text: string): number[] {
  const bytes: number[] = [];
  for (const char of text.normalize("NFC")) {
    const code = char.codePointAt(0)!;
    if (code === 0x09 || code === 0x0a || code === 0x0d) bytes.push(32);
    else if (code >= 32 && code <= 126) bytes.push(code);
    else if (code >= 0xa0 && code <= 0xff) bytes.push(code);
    else if (WIN_ANSI_HIGH[code] !== undefined) bytes.push(WIN_ANSI_HIGH[code]);
    else {
      // Strip diacritics the encoding can't represent (e.g. "ő" -> "o").
      const base = char.normalize("NFD").charCodeAt(0);
      bytes.push(base >= 32 && base <= 126 && base !== code ? base : 63);
    }
  }
  return bytes;
}

function byteWidth(byte: number, font: PdfFont): number {
  const table = font === "bold" ? HELVETICA_BOLD : HELVETICA;
  if (byte >= 32 && byte <= 126) return table[byte - 32];
  if (WIDE_PUNCTUATION[byte]) return WIDE_PUNCTUATION[byte][font === "bold" ? 1 : 0];
  if (byte >= 0xc0) {
    // Accented Latin-1 letters share their base letter's width.
    const base = String.fromCharCode(byte).normalize("NFD").charCodeAt(0);
    if (base >= 32 && base <= 126) return table[base - 32];
  }
  return 556;
}

export function measureText(text: string, font: PdfFont, size: number): number {
  return (encodeWinAnsi(text).reduce((width, byte) => width + byteWidth(byte, font), 0) * size) / 1000;
}

/** Shortens text with a trailing ellipsis so it fits within maxWidth points. */
export function truncateText(text: string, font: PdfFont, size: number, maxWidth: number): string {
  if (measureText(text, font, size) <= maxWidth) return text;
  const ellipsis = "…";
  const chars = Array.from(text);
  let low = 0;
  let high = chars.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (measureText(chars.slice(0, mid).join("").trimEnd() + ellipsis, font, size) <= maxWidth) low = mid;
    else high = mid - 1;
  }
  return low === 0 ? ellipsis : chars.slice(0, low).join("").trimEnd() + ellipsis;
}
