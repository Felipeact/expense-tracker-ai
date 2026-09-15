import type { Expense } from "../types";
import { orderColumns, type ExportColumn, type ExportContext, type ExportOptions, type ExportSelection } from "./types";

export const JSON_SCHEMA_VERSION = 1;

function pick(expense: Expense, columns: ExportColumn[]): Partial<Pick<Expense, ExportColumn>> {
  return Object.fromEntries(columns.map((column) => [column, expense[column]]));
}

export function buildJsonDocument(options: ExportOptions, selection: ExportSelection, generatedAt: Date) {
  const columns = orderColumns(options.columns);
  const records = selection.rows.map((row) => pick(row, columns));
  if (!options.json.includeMetadata) return records;

  const { summary } = selection;
  return {
    schemaVersion: JSON_SCHEMA_VERSION,
    generatedAt: generatedAt.toISOString(),
    filters: {
      from: options.from || null,
      to: options.to || null,
      categories: options.categories,
      sort: options.sort,
    },
    summary: {
      count: summary.count,
      total: summary.total,
      average: summary.average,
      firstDate: summary.firstDate,
      lastDate: summary.lastDate,
      byCategory: summary.byCategory,
    },
    records,
  };
}

export async function buildJson({ options, selection, generatedAt, onProgress, checkpoint }: ExportContext): Promise<Blob> {
  const document = buildJsonDocument(options, selection, generatedAt);
  onProgress(0.5);
  await checkpoint();
  const text = JSON.stringify(document, null, options.json.pretty ? 2 : undefined);
  onProgress(1);
  return new Blob([text], { type: "application/json;charset=utf-8" });
}
