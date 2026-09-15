import { encodeWinAnsi, measureText, type PdfFont } from "./fonts";

// A minimal PDF 1.4 writer: vector shapes and standard-font text, which is all a
// tabular report needs. Page coordinates use a top-left origin, in points.

export type Rgb = readonly [number, number, number];

export interface TextStyle {
  font?: PdfFont;
  size?: number;
  color?: Rgb;
  align?: "left" | "right" | "center";
}

const FONT_RESOURCE: Record<PdfFont, string> = { regular: "F1", bold: "F2" };

const num = (value: number) => String(Math.round(value * 100) / 100);
const color = ([r, g, b]: Rgb) => `${num(r / 255)} ${num(g / 255)} ${num(b / 255)}`;

function pdfString(text: string): string {
  let out = "(";
  for (const byte of encodeWinAnsi(text)) {
    if (byte === 0x28 || byte === 0x29 || byte === 0x5c) out += `\\${String.fromCharCode(byte)}`;
    else if (byte > 126) out += `\\${byte.toString(8).padStart(3, "0")}`;
    else out += String.fromCharCode(byte);
  }
  return `${out})`;
}

export class PdfPage {
  private readonly ops: string[] = [];

  constructor(
    readonly width: number,
    readonly height: number,
  ) {}

  rect(x: number, y: number, w: number, h: number, fill: Rgb): this {
    this.ops.push(`${color(fill)} rg ${num(x)} ${num(this.height - y - h)} ${num(w)} ${num(h)} re f`);
    return this;
  }

  line(x1: number, y1: number, x2: number, y2: number, stroke: Rgb, lineWidth = 0.5): this {
    this.ops.push(
      `${color(stroke)} RG ${num(lineWidth)} w ${num(x1)} ${num(this.height - y1)} m ${num(x2)} ${num(this.height - y2)} l S`,
    );
    return this;
  }

  /** Draws a single line of text; y is the baseline. */
  text(x: number, y: number, value: string, style: TextStyle = {}): this {
    const { font = "regular", size = 10, color: fill = [0, 0, 0], align = "left" } = style;
    const width = align === "left" ? 0 : measureText(value, font, size);
    const left = align === "right" ? x - width : align === "center" ? x - width / 2 : x;
    this.ops.push(
      `BT /${FONT_RESOURCE[font]} ${num(size)} Tf ${color(fill)} rg ${num(left)} ${num(this.height - y)} Td ${pdfString(value)} Tj ET`,
    );
    return this;
  }

  get content(): string {
    return this.ops.join("\n");
  }
}

function pdfDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `D:${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(
    date.getMinutes(),
  )}${pad(date.getSeconds())}`;
}

export class PdfDocument {
  readonly pages: PdfPage[] = [];

  constructor(private readonly meta: { title: string; createdAt: Date }) {}

  addPage(width: number, height: number): PdfPage {
    const page = new PdfPage(width, height);
    this.pages.push(page);
    return page;
  }

  /** Serializes to bytes. Every character in the output is a single byte, so string length equals byte offset. */
  toBytes(): Uint8Array<ArrayBuffer> {
    const objects: string[] = [];
    const add = (body: string) => objects.push(body) as number; // returns the new object number

    const catalog = add("");
    const pageTree = add("");
    const regular = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
    const bold = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
    const info = add(
      `<< /Title ${pdfString(this.meta.title)} /Producer (Spendwise) /CreationDate (${pdfDate(this.meta.createdAt)}) >>`,
    );

    const pageRefs = this.pages.map((page) => {
      const stream = page.content;
      const contents = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
      return add(
        `<< /Type /Page /Parent ${pageTree} 0 R /MediaBox [0 0 ${num(page.width)} ${num(page.height)}] ` +
          `/Resources << /Font << /F1 ${regular} 0 R /F2 ${bold} 0 R >> >> /Contents ${contents} 0 R >>`,
      );
    });

    objects[catalog - 1] = `<< /Type /Catalog /Pages ${pageTree} 0 R >>`;
    objects[pageTree - 1] = `<< /Type /Pages /Kids [${pageRefs.map((n) => `${n} 0 R`).join(" ")}] /Count ${pageRefs.length} >>`;

    let out = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n";
    const offsets = objects.map((body, i) => {
      const offset = out.length;
      out += `${i + 1} 0 obj\n${body}\nendobj\n`;
      return offset;
    });

    const xref = out.length;
    out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    out += offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
    out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

    const bytes = new Uint8Array(out.length);
    for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i);
    return bytes;
  }
}
