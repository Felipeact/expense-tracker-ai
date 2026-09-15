import { todayISO } from "./dates";
import type { Expense } from "./types";

function escapeCell(value: string | number): string {
  let text = String(value);
  // Neutralize spreadsheet formula injection (=, +, -, @ at the start of a text cell).
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function expensesToCsv(expenses: Expense[]): string {
  const header = ["Date", "Description", "Category", "Amount"];
  const rows = expenses.map((e) => [e.date, e.description, e.category, e.amount.toFixed(2)]);
  return [header, ...rows].map((row) => row.map(escapeCell).join(",")).join("\r\n");
}

export function downloadCsv(expenses: Expense[], filename = `expenses-${todayISO()}.csv`): void {
  // BOM so Excel opens the file as UTF-8.
  const blob = new Blob(["﻿", expensesToCsv(expenses)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
