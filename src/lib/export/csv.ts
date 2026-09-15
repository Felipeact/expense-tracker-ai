import type { Expense } from "../types";
import { COLUMN_LABELS, orderColumns, type CsvDelimiter, type ExportColumn, type ExportContext } from "./types";

export function columnValue(expense: Expense, column: ExportColumn): string | number {
  switch (column) {
    case "amount":
      return expense.amount.toFixed(2);
    default:
      return expense[column];
  }
}

function escapeCell(value: string | number, delimiter: CsvDelimiter): string {
  let text = String(value);
  // Neutralize spreadsheet formula injection (=, +, -, @ at the start of a text cell).
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text)) text = `'${text}`;
  const needsQuotes = text.includes(delimiter) || /["\r\n]/.test(text);
  return needsQuotes ? `"${text.replace(/"/g, '""')}"` : text;
}

export function csvLine(cells: (string | number)[], delimiter: CsvDelimiter): string {
  return cells.map((cell) => escapeCell(cell, delimiter)).join(delimiter);
}

export async function buildCsv({ options, selection, onProgress, checkpoint }: ExportContext): Promise<Blob> {
  const columns = orderColumns(options.columns);
  const { delimiter, includeHeader } = options.csv;
  const lines: string[] = [];
  if (includeHeader) lines.push(csvLine(columns.map((c) => COLUMN_LABELS[c]), delimiter));

  const { rows } = selection;
  for (let i = 0; i < rows.length; i++) {
    lines.push(csvLine(columns.map((c) => columnValue(rows[i], c)), delimiter));
    if (i % 500 === 499) {
      onProgress(i / rows.length);
      await checkpoint();
    }
  }
  onProgress(1);
  // BOM so Excel opens the file as UTF-8.
  return new Blob(["﻿", lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
}
