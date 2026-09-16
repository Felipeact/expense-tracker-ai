import { escapeCell } from "@/lib/csv";
import { formatDisplayDate } from "@/lib/dates";
import { FORMAT_META } from "./destinations";
import type { CompiledExport, CompiledSheet } from "./templates";
import type { ExportFormat } from "./types";

function toCsv(compiled: CompiledExport): string {
  const sheetToLines = (sheet: CompiledSheet) =>
    [sheet.columns, ...sheet.rows].map((row) => row.map(escapeCell).join(",")).join("\r\n");

  if (compiled.sheets.length === 1) return sheetToLines(compiled.sheets[0]);

  // Multi-sheet CSV keeps every tab in one file, each behind a labelled marker.
  return compiled.sheets
    .map((sheet) => `${escapeCell(`# ${sheet.name}`)}\r\n${sheetToLines(sheet)}`)
    .join("\r\n\r\n");
}

function toJson(compiled: CompiledExport): string {
  return JSON.stringify(
    {
      spendwise: { version: 3, kind: "export", template: compiled.templateId },
      title: compiled.title,
      generatedAt: compiled.generatedAt,
      range: compiled.range,
      rangeLabel: compiled.rangeLabel,
      summary: compiled.summary,
      sheets: compiled.sheets.map((sheet) => ({
        name: sheet.name,
        columns: sheet.columns,
        // Objects rather than tuples, so consumers do not depend on column order.
        rows: sheet.rows.map((row) =>
          Object.fromEntries(sheet.columns.map((column, i) => [column, row[i]])),
        ),
      })),
    },
    null,
    2,
  );
}

function toNdjson(compiled: CompiledExport): string {
  return compiled.sheets
    .flatMap((sheet) =>
      sheet.rows.map((row) =>
        JSON.stringify({
          _sheet: sheet.name,
          ...Object.fromEntries(sheet.columns.map((column, i) => [column, row[i]])),
        }),
      ),
    )
    .join("\n");
}

function toMarkdown(compiled: CompiledExport): string {
  const parts: string[] = [
    `# ${compiled.title}`,
    "",
    `_${compiled.subtitle} · generated ${new Date(compiled.generatedAt).toLocaleString()}_`,
    "",
  ];

  for (const sheet of compiled.sheets) {
    parts.push(`## ${sheet.name}`, "");
    if (sheet.note) parts.push(`> ${sheet.note}`, "");
    parts.push(`| ${sheet.columns.join(" | ")} |`);
    parts.push(`| ${sheet.columns.map(() => "---").join(" | ")} |`);
    for (const row of sheet.rows) {
      // Pipes inside a cell would break the table.
      parts.push(`| ${row.map((cell) => String(cell).replace(/\|/g, "\\|")).join(" | ")} |`);
    }
    parts.push("");
  }

  return parts.join("\n");
}

function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toHtml(compiled: CompiledExport): string {
  const { summary } = compiled;
  const money = (value: number) =>
    value.toLocaleString("en-US", { style: "currency", currency: "USD" });

  const stats = [
    ["Total", money(summary.total)],
    ["Transactions", String(summary.count)],
    ["Average", money(summary.average)],
    ["Categories", String(summary.categories.length)],
  ]
    .map(
      ([label, value]) =>
        `<div class="stat"><div class="stat-label">${escapeHtml(label)}</div><div class="stat-value">${escapeHtml(value)}</div></div>`,
    )
    .join("");

  const bars = summary.categories
    .map(
      (c) => `<div class="bar-row">
      <span class="bar-name">${escapeHtml(c.category)}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${(c.share * 100).toFixed(1)}%"></span></span>
      <span class="bar-value">${escapeHtml(money(c.total))}</span>
    </div>`,
    )
    .join("");

  const tables = compiled.sheets
    .map(
      (sheet) => `<section class="sheet">
      <h2>${escapeHtml(sheet.name)}</h2>
      ${sheet.note ? `<p class="note">${escapeHtml(sheet.note)}</p>` : ""}
      <table>
        <thead><tr>${sheet.columns
          .map(
            (column, i) =>
              `<th${sheet.currencyColumns.includes(i) ? ' class="num"' : ""}>${escapeHtml(column)}</th>`,
          )
          .join("")}</tr></thead>
        <tbody>${sheet.rows
          .map(
            (row) =>
              `<tr>${row
                .map(
                  (cell, i) =>
                    `<td${sheet.currencyColumns.includes(i) ? ' class="num"' : ""}>${escapeHtml(
                      sheet.currencyColumns.includes(i) && typeof cell === "number" ? money(cell) : cell,
                    )}</td>`,
                )
                .join("")}</tr>`,
          )
          .join("")}</tbody>
      </table>
    </section>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(compiled.title)}</title>
<style>
  :root { --ink:#0b0b0b; --ink-2:#52514e; --line:#e1e0d9; --accent:#256abf; --surface:#fcfcfb; }
  * { box-sizing:border-box; }
  body { margin:0; padding:40px 24px; background:#f5f5f2; color:var(--ink);
    font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; -webkit-font-smoothing:antialiased; }
  .page { max-width:920px; margin:0 auto; background:var(--surface); border:1px solid var(--line);
    border-radius:14px; padding:40px; }
  header { border-bottom:1px solid var(--line); padding-bottom:24px; margin-bottom:28px; }
  .brand { display:flex; align-items:center; gap:10px; font-weight:600; color:var(--accent); font-size:14px; }
  .brand span.dot { width:22px; height:22px; border-radius:6px; background:var(--accent); display:inline-block; }
  h1 { font-size:26px; margin:14px 0 6px; letter-spacing:-0.02em; }
  .meta { color:var(--ink-2); font-size:14px; margin:0; }
  .stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:12px; margin:24px 0 32px; }
  .stat { border:1px solid var(--line); border-radius:10px; padding:14px 16px; background:#fff; }
  .stat-label { font-size:12px; text-transform:uppercase; letter-spacing:.06em; color:var(--ink-2); }
  .stat-value { font-size:22px; font-weight:600; margin-top:4px; font-variant-numeric:tabular-nums; }
  .bars { margin-bottom:34px; }
  .bar-row { display:grid; grid-template-columns:130px 1fr 110px; align-items:center; gap:12px; margin-bottom:8px; font-size:14px; }
  .bar-track { height:9px; border-radius:99px; background:#eceae4; overflow:hidden; }
  .bar-fill { display:block; height:100%; background:var(--accent); border-radius:99px; }
  .bar-value { text-align:right; font-variant-numeric:tabular-nums; color:var(--ink-2); }
  .sheet { margin-bottom:34px; page-break-inside:auto; }
  h2 { font-size:17px; margin:0 0 4px; }
  .note { color:var(--ink-2); font-size:13px; margin:0 0 12px; }
  table { width:100%; border-collapse:collapse; font-size:13.5px; }
  th,td { text-align:left; padding:8px 10px; border-bottom:1px solid var(--line); }
  th { font-size:12px; text-transform:uppercase; letter-spacing:.05em; color:var(--ink-2); background:#f7f6f3; }
  td.num, th.num { text-align:right; font-variant-numeric:tabular-nums; }
  tbody tr:nth-child(even) td { background:#fafaf8; }
  footer { border-top:1px solid var(--line); padding-top:18px; color:var(--ink-2); font-size:12.5px; }
  @media print {
    body { background:#fff; padding:0; }
    .page { border:0; border-radius:0; padding:0; max-width:none; }
    thead { display:table-header-group; }
  }
</style>
</head>
<body>
<div class="page">
  <header>
    <div class="brand"><span class="dot"></span> Spendwise</div>
    <h1>${escapeHtml(compiled.title)}</h1>
    <p class="meta">${escapeHtml(compiled.subtitle)} · ${escapeHtml(
      formatDisplayDate(compiled.range.from),
    )} – ${escapeHtml(formatDisplayDate(compiled.range.to))}</p>
  </header>
  <div class="stats">${stats}</div>
  ${bars ? `<div class="bars">${bars}</div>` : ""}
  ${tables}
  <footer>Generated ${escapeHtml(new Date(compiled.generatedAt).toLocaleString())} by Spendwise. Figures come from the transactions in range at the time of export.</footer>
</div>
</body>
</html>`;
}

/** Renders a compiled export into the bytes a destination would receive. */
export function serialize(compiled: CompiledExport, format: ExportFormat): string {
  switch (format) {
    case "json":
      return toJson(compiled);
    case "ndjson":
      return toNdjson(compiled);
    case "markdown":
      return toMarkdown(compiled);
    case "html":
      return toHtml(compiled);
    // A live sheet is delivered as CSV per tab; the UI previews the grid itself.
    case "sheet":
    case "csv":
    default:
      return toCsv(compiled);
  }
}

export function filenameFor(compiled: CompiledExport, format: ExportFormat): string {
  const stamp = compiled.generatedAt.slice(0, 10);
  return `spendwise-${compiled.templateId}-${stamp}.${FORMAT_META[format].extension}`;
}

export function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function downloadText(text: string, filename: string, mime: string): void {
  const needsBom = mime.startsWith("text/csv");
  const blob = new Blob(needsBom ? ["﻿", text] : [text], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
