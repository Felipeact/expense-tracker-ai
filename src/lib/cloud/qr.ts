/**
 * Dependency-free QR Code encoder (byte mode, versions 1-40, ECC levels L-H).
 *
 * Share links are encoded entirely in the browser, so a phone can scan a code
 * for data that never left the device. Follows ISO/IEC 18004: Reed-Solomon
 * error correction over GF(2^8) and penalty-scored mask selection.
 */

export type Ecl = "L" | "M" | "Q" | "H";

/** Format-field value for each level (not the same order as capacity). */
const ECL_FORMAT_BITS: Record<Ecl, number> = { L: 1, M: 0, Q: 3, H: 2 };

// Index by version (1-40); slot 0 is unused.
const ECC_PER_BLOCK: Record<Ecl, number[]> = {
  L: [0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  M: [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  Q: [0, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  H: [0, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
};

const ECC_BLOCKS: Record<Ecl, number[]> = {
  L: [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  M: [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  Q: [0, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  H: [0, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
};

const MIN_VERSION = 1;
const MAX_VERSION = 40;

/** Total data + ECC modules available in the symbol, before the codeword split. */
function rawDataModules(version: number): number {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const numAlign = Math.floor(version / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (version >= 7) result -= 36;
  }
  return result;
}

function dataCodewords(version: number, ecl: Ecl): number {
  return (
    Math.floor(rawDataModules(version) / 8) - ECC_PER_BLOCK[ecl][version] * ECC_BLOCKS[ecl][version]
  );
}

/** Byte mode uses an 8-bit character count below version 10, 16-bit at or above. */
function charCountBits(version: number): number {
  return version < 10 ? 8 : 16;
}

export function qrCapacityBytes(version: number, ecl: Ecl): number {
  return dataCodewords(version, ecl) - 2 - (charCountBits(version) > 8 ? 1 : 0);
}

/** Largest payload any QR code can carry, used for "will this fit?" meters. */
export const QR_MAX_BYTES = qrCapacityBytes(MAX_VERSION, "L");

function alignmentPositions(version: number): number[] {
  if (version === 1) return [];
  const numAlign = Math.floor(version / 7) + 2;
  const step =
    version === 32 ? 26 : Math.ceil((version * 4 + 4) / (numAlign * 2 - 2)) * 2;
  const result = [6];
  for (let pos = version * 4 + 10; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
  return result;
}

// --- GF(2^8) arithmetic for Reed-Solomon -----------------------------------

function gfMultiply(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

function rsDivisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMultiply(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = gfMultiply(root, 0x02);
  }
  return result;
}

function rsRemainder(data: number[], divisor: number[]): number[] {
  const result = new Array<number>(divisor.length).fill(0);
  for (const byte of data) {
    const factor = byte ^ result.shift()!;
    result.push(0);
    divisor.forEach((coef, i) => {
      result[i] ^= gfMultiply(coef, factor);
    });
  }
  return result;
}

// --- Bit assembly ----------------------------------------------------------

function appendBits(bits: number[], value: number, length: number): void {
  for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
}

function buildCodewords(bytes: number[], version: number, ecl: Ecl): number[] {
  const capacityBits = dataCodewords(version, ecl) * 8;
  const bits: number[] = [];
  appendBits(bits, 0b0100, 4); // byte mode
  appendBits(bits, bytes.length, charCountBits(version));
  for (const b of bytes) appendBits(bits, b, 8);

  appendBits(bits, 0, Math.min(4, capacityBits - bits.length)); // terminator
  appendBits(bits, 0, (8 - (bits.length % 8)) % 8); // byte align
  for (let pad = 0xec; bits.length < capacityBits; pad ^= 0xec ^ 0x11) appendBits(bits, pad, 8);

  const codewords = new Array<number>(bits.length / 8).fill(0);
  bits.forEach((bit, i) => {
    codewords[i >>> 3] |= bit << (7 - (i & 7));
  });
  return codewords;
}

/** Splits data into blocks, appends per-block ECC, then interleaves both. */
function addEccAndInterleave(data: number[], version: number, ecl: Ecl): number[] {
  const numBlocks = ECC_BLOCKS[ecl][version];
  const eccLen = ECC_PER_BLOCK[ecl][version];
  const rawCodewords = Math.floor(rawDataModules(version) / 8);
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
  const shortBlockLen = Math.floor(rawCodewords / numBlocks);

  const divisor = rsDivisor(eccLen);
  const shortDataLen = shortBlockLen - eccLen;
  const dataLenOf = (blockIndex: number) => shortDataLen + (blockIndex < numShortBlocks ? 0 : 1);

  const blocks: number[][] = [];
  for (let i = 0, offset = 0; i < numBlocks; i++) {
    const len = dataLenOf(i);
    const dat = data.slice(offset, offset + len);
    offset += len;
    blocks.push(dat.concat(rsRemainder(dat, divisor)));
  }

  // Data codewords interleave first; long blocks contribute one extra round.
  const result: number[] = [];
  for (let i = 0; i <= shortDataLen; i++) {
    blocks.forEach((block, j) => {
      if (i < dataLenOf(j)) result.push(block[i]);
    });
  }
  // Every block carries the same number of ECC codewords, so these interleave evenly.
  for (let i = 0; i < eccLen; i++) {
    blocks.forEach((block, j) => result.push(block[dataLenOf(j) + i]));
  }
  return result;
}

// --- Symbol drawing --------------------------------------------------------

interface Canvas {
  size: number;
  modules: boolean[][];
  reserved: boolean[][];
}

function setModule(c: Canvas, x: number, y: number, dark: boolean): void {
  c.modules[y][x] = dark;
  c.reserved[y][x] = true;
}

function drawFinder(c: Canvas, cx: number, cy: number): void {
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const dist = Math.max(Math.abs(dx), Math.abs(dy));
      const x = cx + dx;
      const y = cy + dy;
      if (x >= 0 && x < c.size && y >= 0 && y < c.size) setModule(c, x, y, dist !== 2 && dist !== 4);
    }
  }
}

function drawAlignment(c: Canvas, cx: number, cy: number): void {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      setModule(c, cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }
}

function drawFormatBits(c: Canvas, ecl: Ecl, mask: number): void {
  const data = (ECL_FORMAT_BITS[ecl] << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;

  const bit = (i: number) => ((bits >>> i) & 1) !== 0;
  for (let i = 0; i <= 5; i++) setModule(c, 8, i, bit(i));
  setModule(c, 8, 7, bit(6));
  setModule(c, 8, 8, bit(7));
  setModule(c, 7, 8, bit(8));
  for (let i = 9; i < 15; i++) setModule(c, 14 - i, 8, bit(i));

  for (let i = 0; i < 8; i++) setModule(c, c.size - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) setModule(c, 8, c.size - 15 + i, bit(i));
  setModule(c, 8, c.size - 8, true); // always-dark module
}

function drawFunctionPatterns(c: Canvas, version: number, ecl: Ecl): void {
  for (let i = 0; i < c.size; i++) {
    setModule(c, 6, i, i % 2 === 0);
    setModule(c, i, 6, i % 2 === 0);
  }

  drawFinder(c, 3, 3);
  drawFinder(c, c.size - 4, 3);
  drawFinder(c, 3, c.size - 4);

  const positions = alignmentPositions(version);
  positions.forEach((cy, i) => {
    positions.forEach((cx, j) => {
      const corner =
        (i === 0 && j === 0) ||
        (i === 0 && j === positions.length - 1) ||
        (i === positions.length - 1 && j === 0);
      if (!corner) drawAlignment(c, cx, cy);
    });
  });

  drawFormatBits(c, ecl, 0); // replaced once the mask is chosen

  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const dark = ((bits >>> i) & 1) !== 0;
      const a = c.size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      setModule(c, a, b, dark);
      setModule(c, b, a, dark);
    }
  }
}

/** Zig-zag placement of the interleaved codewords into the unreserved modules. */
function drawCodewords(c: Canvas, codewords: number[]): void {
  let i = 0;
  for (let right = c.size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5; // the vertical timing pattern is skipped entirely
    for (let vert = 0; vert < c.size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? c.size - 1 - vert : vert;
        if (!c.reserved[y][x] && i < codewords.length * 8) {
          c.modules[y][x] = ((codewords[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0;
          i++;
        }
      }
    }
  }
}

const MASK_RULES: ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

function applyMask(c: Canvas, mask: number): void {
  const rule = MASK_RULES[mask];
  for (let y = 0; y < c.size; y++) {
    for (let x = 0; x < c.size; x++) {
      if (!c.reserved[y][x] && rule(x, y)) c.modules[y][x] = !c.modules[y][x];
    }
  }
}

/** Standard penalty score; the lowest-scoring mask is the one we keep. */
function penaltyScore(c: Canvas): number {
  const { size, modules } = c;
  let score = 0;

  const runScore = (runLength: number) => (runLength >= 5 ? runLength - 2 : 0);

  for (let y = 0; y < size; y++) {
    let run = 0;
    let color = false;
    for (let x = 0; x < size; x++) {
      if (x > 0 && modules[y][x] === color) run++;
      else {
        score += runScore(run);
        run = 1;
        color = modules[y][x];
      }
    }
    score += runScore(run);
  }
  for (let x = 0; x < size; x++) {
    let run = 0;
    let color = false;
    for (let y = 0; y < size; y++) {
      if (y > 0 && modules[y][x] === color) run++;
      else {
        score += runScore(run);
        run = 1;
        color = modules[y][x];
      }
    }
    score += runScore(run);
  }

  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const v = modules[y][x];
      if (v === modules[y][x + 1] && v === modules[y + 1][x] && v === modules[y + 1][x + 1]) {
        score += 3;
      }
    }
  }

  // Finder-like 1:1:3:1:1 patterns anywhere in the symbol.
  const pattern = [true, false, true, true, true, false, true];
  const matchesAt = (get: (i: number) => boolean, start: number) => {
    for (let i = 0; i < 7; i++) if (get(start + i) !== pattern[i]) return false;
    const quiet = (from: number) => {
      for (let i = from; i < from + 4; i++) {
        if (i >= 0 && i < size && get(i)) return false;
      }
      return true;
    };
    return quiet(start - 4) || quiet(start + 7);
  };
  for (let i = 0; i < size; i++) {
    for (let j = 0; j <= size - 7; j++) {
      if (matchesAt((k) => (k >= 0 && k < size ? modules[i][k] : false), j)) score += 40;
      if (matchesAt((k) => (k >= 0 && k < size ? modules[k][i] : false), j)) score += 40;
    }
  }

  // Rule 4: penalize drift away from a 50% dark ratio, in 5% steps.
  let dark = 0;
  for (const row of modules) for (const v of row) if (v) dark++;
  const total = size * size;
  score += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;

  return score;
}

export interface QrResult {
  /** Row-major grid of dark/light modules, excluding the quiet zone. */
  matrix: boolean[][];
  size: number;
  version: number;
  ecl: Ecl;
  bytes: number;
}

function toUtf8Bytes(text: string): number[] {
  return Array.from(new TextEncoder().encode(text));
}

/**
 * Encodes `text` at the strongest error-correction level that still fits.
 * Returns null when the payload is too large for any QR version.
 */
export function encodeQr(text: string, preferred: Ecl[] = ["M", "L"]): QrResult | null {
  const bytes = toUtf8Bytes(text);

  for (const ecl of preferred) {
    for (let version = MIN_VERSION; version <= MAX_VERSION; version++) {
      const capacity = dataCodewords(version, ecl) * 8;
      const needed = 4 + charCountBits(version) + bytes.length * 8;
      if (needed > capacity) continue;

      const size = version * 4 + 17;
      const canvas: Canvas = {
        size,
        modules: Array.from({ length: size }, () => new Array<boolean>(size).fill(false)),
        reserved: Array.from({ length: size }, () => new Array<boolean>(size).fill(false)),
      };

      drawFunctionPatterns(canvas, version, ecl);
      drawCodewords(canvas, addEccAndInterleave(buildCodewords(bytes, version, ecl), version, ecl));

      let bestMask = 0;
      let bestScore = Infinity;
      for (let mask = 0; mask < 8; mask++) {
        applyMask(canvas, mask);
        drawFormatBits(canvas, ecl, mask);
        const score = penaltyScore(canvas);
        if (score < bestScore) {
          bestScore = score;
          bestMask = mask;
        }
        applyMask(canvas, mask); // XOR again to undo
      }
      applyMask(canvas, bestMask);
      drawFormatBits(canvas, ecl, bestMask);

      return { matrix: canvas.modules, size, version, ecl, bytes: bytes.length };
    }
  }
  return null;
}

/** Renders a matrix as an SVG string, suitable for download or an <img> src. */
export function qrToSvg(result: QrResult, options: { quiet?: number; scale?: number } = {}): string {
  const quiet = options.quiet ?? 4;
  const scale = options.scale ?? 8;
  const dim = (result.size + quiet * 2) * scale;

  let path = "";
  result.matrix.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) path += `M${(x + quiet) * scale} ${(y + quiet) * scale}h${scale}v${scale}h-${scale}z`;
    });
  });

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" width="${dim}" height="${dim}" shape-rendering="crispEdges">`,
    `<rect width="${dim}" height="${dim}" fill="#ffffff"/>`,
    `<path d="${path}" fill="#000000"/>`,
    `</svg>`,
  ].join("");
}
