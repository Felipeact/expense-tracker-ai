import { formatDisplayDate } from "../../dates";
import { formatCurrency, formatPercent } from "../../format";
import type { Category } from "../../types";
import { describeCategories, describeRange } from "../describe";
import { COLUMN_LABELS, orderColumns, type ExportColumn, type ExportContext, type ExportOptions, type ExportSummary } from "../types";
import { PdfDocument, type PdfPage, type Rgb } from "./document";
import { truncateText } from "./fonts";

const PAGE = { portrait: [612, 792], landscape: [792, 612] } as const; // US Letter, in points
const MARGIN = 48;
const FOOTER_SPACE = 44;

const HEADER_HEIGHT = 156; // brand, title, subtitle, summary tiles
const CONTINUATION_HEIGHT = 30;
const SECTION_TITLE = 24;
const BREAKDOWN_ROW = 20;
const SECTION_GAP = 20;
const TABLE_HEADER = 22;
const ROW = 18;
const TOTAL_ROW = 26;

const INK: Rgb = [11, 11, 11];
const INK_2: Rgb = [82, 81, 78];
const MUTED: Rgb = [110, 109, 104];
const LINE: Rgb = [225, 224, 217];
const SURFACE_2: Rgb = [240, 239, 236];
const STRIPE: Rgb = [248, 248, 246];
const ACCENT: Rgb = [37, 106, 191];

// Light-theme category colors from globals.css.
const CATEGORY_RGB: Record<Category, Rgb> = {
  Food: [235, 104, 52],
  Transportation: [27, 175, 122],
  Entertainment: [237, 161, 0],
  Shopping: [232, 123, 164],
  Bills: [0, 131, 0],
  Other: [137, 135, 129],
};

export interface ReportPlan {
  width: number;
  height: number;
  /** Row index ranges [start, end) for each page. */
  pages: { start: number; end: number }[];
}

function breakdownHeight(options: ExportOptions, summary: ExportSummary): number {
  if (!options.pdf.includeBreakdown || summary.byCategory.length === 0) return 0;
  return SECTION_TITLE + summary.byCategory.length * BREAKDOWN_ROW + SECTION_GAP;
}

/** Decides which rows land on which page. Cheap enough to run on every settings change. */
export function planReport(options: ExportOptions, summary: ExportSummary): ReportPlan {
  const [width, height] = PAGE[options.pdf.orientation];
  const bottom = height - FOOTER_SPACE;
  const firstTableTop = MARGIN + HEADER_HEIGHT + breakdownHeight(options, summary) + SECTION_TITLE;
  const capacity = (tableTop: number) => Math.max(1, Math.floor((bottom - tableTop - TABLE_HEADER) / ROW));

  const pages: ReportPlan["pages"] = [];
  let start = 0;
  let tableTop = firstTableTop;
  do {
    const end = Math.min(summary.count, start + capacity(tableTop));
    pages.push({ start, end });
    start = end;
    tableTop = MARGIN + CONTINUATION_HEIGHT;
  } while (start < summary.count);

  // Keep the total row with at least one transaction instead of stranding it on its own page.
  const last = pages[pages.length - 1];
  const lastTop = pages.length === 1 ? firstTableTop : MARGIN + CONTINUATION_HEIGHT;
  const used = lastTop + TABLE_HEADER + (last.end - last.start) * ROW;
  if (used + TOTAL_ROW > bottom && last.end - last.start > 1) {
    last.end -= 1;
    pages.push({ start: last.end, end: last.end + 1 });
  }
  return { width, height, pages };
}

interface Column {
  key: ExportColumn;
  x: number;
  width: number;
  align: "left" | "right";
}

function layoutColumns(columns: ExportColumn[], contentWidth: number): Column[] {
  const fixed: Partial<Record<ExportColumn, number>> = { date: 88, category: 110, amount: 90 };
  const ordered = orderColumns(columns);
  const fixedTotal = ordered.reduce((w, c) => w + (fixed[c] ?? 0), 0);
  const flexible = ordered.includes("description") ? contentWidth - fixedTotal : 0;
  // Without a description column, spread the spare width evenly.
  const spare = ordered.includes("description") ? 0 : (contentWidth - fixedTotal) / ordered.length;

  let x = MARGIN;
  return ordered.map((key) => {
    const width = key === "description" ? flexible : fixed[key]! + spare;
    const column: Column = { key, x, width, align: key === "amount" ? "right" : "left" };
    x += width;
    return column;
  });
}

const CELL_PAD = 8;

function cellX(column: Column): number {
  return column.align === "right" ? column.x + column.width - CELL_PAD : column.x + CELL_PAD;
}

function drawTableHeader(page: PdfPage, columns: Column[], y: number, contentWidth: number) {
  page.rect(MARGIN, y, contentWidth, TABLE_HEADER, SURFACE_2);
  for (const column of columns) {
    page.text(cellX(column), y + 14.5, COLUMN_LABELS[column.key].toUpperCase(), {
      font: "bold",
      size: 7.5,
      color: INK_2,
      align: column.align,
    });
  }
}

function drawSummary(page: PdfPage, summary: ExportSummary, y: number, contentWidth: number) {
  const tiles = [
    { label: "Records", value: summary.count.toLocaleString("en-US") },
    { label: "Total", value: formatCurrency(summary.total) },
    { label: "Average", value: formatCurrency(summary.average) },
    {
      label: "Date span",
      value: summary.firstDate && summary.lastDate ? describeRange(summary.firstDate, summary.lastDate) : "—",
    },
  ];
  const gap = 10;
  // The date span needs more room than the numeric tiles.
  const weights = [1, 1.2, 1.2, 2.2];
  const unit = (contentWidth - gap * (tiles.length - 1)) / weights.reduce((a, b) => a + b, 0);
  let x = MARGIN;
  tiles.forEach((tile, i) => {
    const width = unit * weights[i];
    page.rect(x, y, width, 52, SURFACE_2);
    page.text(x + 12, y + 18, tile.label.toUpperCase(), { font: "bold", size: 7.5, color: MUTED });
    page.text(x + 12, y + 39, truncateText(tile.value, "bold", 13, width - 24), { font: "bold", size: 13, color: INK });
    x += width + gap;
  });
}

function drawBreakdown(page: PdfPage, summary: ExportSummary, y: number, contentWidth: number): number {
  page.text(MARGIN, y + 14, "Spending by category", { font: "bold", size: 11, color: INK });
  y += SECTION_TITLE;
  const max = Math.max(...summary.byCategory.map((c) => c.total), 0.01);
  const barX = MARGIN + 170;
  const barWidth = contentWidth - 170 - 150;

  for (const { category, count, total } of summary.byCategory) {
    const baseline = y + 13;
    page.rect(MARGIN, y + 5, 8, 8, CATEGORY_RGB[category]);
    page.text(MARGIN + 16, baseline, category, { size: 9, color: INK });
    page.text(MARGIN + 160, baseline, `${count}`, { size: 9, color: MUTED, align: "right" });
    page.rect(barX, y + 6, barWidth, 6, SURFACE_2);
    page.rect(barX, y + 6, Math.max(1, (barWidth * total) / max), 6, CATEGORY_RGB[category]);
    page.text(MARGIN + contentWidth - 50, baseline, formatCurrency(total), { size: 9, color: INK, align: "right" });
    page.text(MARGIN + contentWidth, baseline, formatPercent(summary.total ? total / summary.total : 0), {
      size: 9,
      color: MUTED,
      align: "right",
    });
    y += BREAKDOWN_ROW;
  }
  return y + SECTION_GAP;
}

export async function buildPdf({ options, selection, generatedAt, onProgress, checkpoint }: ExportContext): Promise<Blob> {
  const { rows, summary } = selection;
  const plan = planReport(options, summary);
  const { width, height } = plan;
  const contentWidth = width - MARGIN * 2;
  const columns = layoutColumns(options.columns, contentWidth);
  const doc = new PdfDocument({ title: "Expense Report", createdAt: generatedAt });
  const generatedLabel = `Generated ${generatedAt.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  })}`;
  const scope = `${describeRange(options.from, options.to)}  ·  ${describeCategories(options.categories)}`;

  for (let p = 0; p < plan.pages.length; p++) {
    const page = doc.addPage(width, height);
    let y = MARGIN;

    if (p === 0) {
      page.rect(MARGIN, y, 18, 18, ACCENT);
      page.text(MARGIN + 26, y + 13, "Spendwise", { font: "bold", size: 11, color: INK });
      page.text(width - MARGIN, y + 13, generatedLabel, { size: 8.5, color: MUTED, align: "right" });
      page.text(MARGIN, y + 52, "Expense Report", { font: "bold", size: 22, color: INK });
      page.text(MARGIN, y + 72, truncateText(scope, "regular", 10, contentWidth), { size: 10, color: INK_2 });
      drawSummary(page, summary, y + 90, contentWidth);
      y += HEADER_HEIGHT;
      if (breakdownHeight(options, summary) > 0) y = drawBreakdown(page, summary, y, contentWidth);
      page.text(MARGIN, y + 14, "Transactions", { font: "bold", size: 11, color: INK });
      y += SECTION_TITLE;
    } else {
      page.text(MARGIN, y + 12, "Expense Report", { font: "bold", size: 10, color: INK });
      page.text(width - MARGIN, y + 12, "Transactions (continued)", { size: 8.5, color: MUTED, align: "right" });
      y += CONTINUATION_HEIGHT;
    }

    drawTableHeader(page, columns, y, contentWidth);
    y += TABLE_HEADER;

    const { start, end } = plan.pages[p];
    for (let i = start; i < end; i++) {
      const row = rows[i];
      if ((i - start) % 2 === 1) page.rect(MARGIN, y, contentWidth, ROW, STRIPE);
      for (const column of columns) {
        const baseline = y + 12.5;
        if (column.key === "category") {
          page.rect(column.x + CELL_PAD, y + 6, 6, 6, CATEGORY_RGB[row.category]);
          page.text(column.x + CELL_PAD + 11, baseline, row.category, { size: 8.5, color: INK });
          continue;
        }
        const value =
          column.key === "date"
            ? formatDisplayDate(row.date)
            : column.key === "amount"
              ? formatCurrency(row.amount)
              : truncateText(row.description, "regular", 8.5, column.width - CELL_PAD * 2);
        page.text(cellX(column), baseline, value, { size: 8.5, color: INK, align: column.align });
      }
      y += ROW;
      if (i % 200 === 199) {
        onProgress(i / rows.length);
        await checkpoint();
      }
    }

    if (p === plan.pages.length - 1) {
      page.line(MARGIN, y, MARGIN + contentWidth, y, INK_2, 0.75);
      const amount = columns.find((c) => c.key === "amount");
      page.text(MARGIN + CELL_PAD, y + 17, `Total  ·  ${summary.count.toLocaleString("en-US")} records`, {
        font: "bold",
        size: 9,
        color: INK,
      });
      if (amount) {
        page.text(cellX(amount), y + 17, formatCurrency(summary.total), { font: "bold", size: 9, color: INK, align: "right" });
      }
    }

    page.line(MARGIN, height - 34, width - MARGIN, height - 34, LINE);
    page.text(MARGIN, height - 22, "Spendwise · Expense Report", { size: 7.5, color: MUTED });
    page.text(width - MARGIN, height - 22, `Page ${p + 1} of ${plan.pages.length}`, {
      size: 7.5,
      color: MUTED,
      align: "right",
    });
  }

  onProgress(1);
  await checkpoint();
  return new Blob([doc.toBytes()], { type: "application/pdf" });
}
