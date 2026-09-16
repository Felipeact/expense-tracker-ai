import {
  BarChart3,
  CalendarRange,
  Landmark,
  Receipt,
  Table2,
  type LucideIcon,
} from "lucide-react";
import { sum } from "@/lib/analytics";
import {
  addDays,
  addMonths,
  formatDisplayDate,
  parseISODate,
  startOfMonth,
  startOfYear,
  toISODate,
} from "@/lib/dates";
import { CATEGORIES, type Category, type Expense } from "@/lib/types";
import type { ExportFormat, TemplateId } from "./types";

export type TemplateScope = "fiscal-year" | "last-month" | "last-90" | "last-30" | "all";

export interface TemplateMeta {
  id: TemplateId;
  name: string;
  purpose: string;
  /** Who the output is actually for — drives the tone of each sheet. */
  audience: string;
  icon: LucideIcon;
  scope: TemplateScope;
  formats: ExportFormat[];
  defaultFormat: ExportFormat;
  /** Tab names, previewed before a run so the shape is obvious. */
  sheetNames: string[];
}

export const TEMPLATES: TemplateMeta[] = [
  {
    id: "tax-report",
    name: "Tax Report",
    purpose: "Year-to-date totals split by category and quarter, ready to hand over.",
    audience: "Your accountant",
    icon: Landmark,
    scope: "fiscal-year",
    formats: ["html", "csv", "json", "sheet"],
    defaultFormat: "html",
    sheetNames: ["Category summary", "Quarterly totals", "Transactions"],
  },
  {
    id: "monthly-summary",
    name: "Monthly Summary",
    purpose: "Last complete month at a glance: totals, category split, biggest line items.",
    audience: "You, on the first of the month",
    icon: CalendarRange,
    scope: "last-month",
    formats: ["html", "markdown", "csv", "json", "sheet"],
    defaultFormat: "markdown",
    sheetNames: ["Summary", "By category", "Daily totals", "Top expenses"],
  },
  {
    id: "category-analysis",
    name: "Category Analysis",
    purpose: "Ninety days of category trends with month-over-month movement.",
    audience: "Anyone asking where the money went",
    icon: BarChart3,
    scope: "last-90",
    formats: ["sheet", "csv", "html", "json"],
    defaultFormat: "sheet",
    sheetNames: ["Category totals", "Month over month", "Transactions"],
  },
  {
    id: "reimbursement",
    name: "Reimbursement Claim",
    purpose: "Last 30 days of claimable lines with a running total and a declaration block.",
    audience: "Whoever signs off expenses",
    icon: Receipt,
    scope: "last-30",
    formats: ["html", "csv", "markdown"],
    defaultFormat: "html",
    sheetNames: ["Claim lines", "Totals"],
  },
  {
    id: "raw-ledger",
    name: "Raw Ledger",
    purpose: "Every field of every expense, including ids and timestamps. Nothing summarised.",
    audience: "Migrations, backups and scripts",
    icon: Table2,
    scope: "all",
    formats: ["json", "ndjson", "csv"],
    defaultFormat: "json",
    sheetNames: ["Ledger"],
  },
];

const BY_ID = new Map(TEMPLATES.map((t) => [t.id, t]));

export function template(id: TemplateId): TemplateMeta {
  const meta = BY_ID.get(id);
  if (!meta) throw new Error(`Unknown template: ${id}`);
  return meta;
}

/** Categories a claim form would normally accept without extra paperwork. */
const CLAIMABLE: Category[] = ["Transportation", "Food", "Other"];

/** Placeholder classification; every template that uses it says so in a note. */
const DEDUCTIBLE_HINT: Record<Category, string> = {
  Food: "Partial",
  Transportation: "Likely",
  Entertainment: "Review",
  Shopping: "Review",
  Bills: "Likely",
  Other: "Review",
};

export interface CompiledSheet {
  name: string;
  columns: string[];
  rows: (string | number)[][];
  /** Indices of columns holding money, so renderers can align and format them. */
  currencyColumns: number[];
  note?: string;
}

export interface CompiledExport {
  templateId: TemplateId;
  title: string;
  subtitle: string;
  generatedAt: string;
  rangeLabel: string;
  range: { from: string; to: string };
  sheets: CompiledSheet[];
  summary: {
    total: number;
    count: number;
    average: number;
    categories: { category: Category; total: number; count: number; share: number }[];
  };
}

function resolveRange(scope: TemplateScope, expenses: Expense[], today: Date) {
  const end = toISODate(today);
  switch (scope) {
    case "fiscal-year":
      return { from: toISODate(startOfYear(today)), to: end, label: `${today.getFullYear()} to date` };
    case "last-month": {
      const start = startOfMonth(addMonths(today, -1));
      const finish = new Date(start.getFullYear(), start.getMonth() + 1, 0);
      return {
        from: toISODate(start),
        to: toISODate(finish),
        label: new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(start),
      };
    }
    case "last-90":
      return { from: toISODate(addDays(today, -89)), to: end, label: "Last 90 days" };
    case "last-30":
      return { from: toISODate(addDays(today, -29)), to: end, label: "Last 30 days" };
    default: {
      const earliest = expenses.reduce<string | null>(
        (min, e) => (min === null || e.date < min ? e.date : min),
        null,
      );
      return { from: earliest ?? end, to: end, label: "Full history" };
    }
  }
}

function money(value: number): number {
  return Math.round(value * 100) / 100;
}

function categoryTotals(expenses: Expense[]) {
  const total = sum(expenses);
  return CATEGORIES.map((category) => {
    const items = expenses.filter((e) => e.category === category);
    const catTotal = sum(items);
    return {
      category,
      total: catTotal,
      count: items.length,
      share: total > 0 ? catTotal / total : 0,
    };
  })
    .filter((c) => c.count > 0)
    .sort((a, b) => b.total - a.total);
}

function monthKey(date: string): string {
  return date.slice(0, 7);
}

const monthLabel = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" });

function formatMonthKey(key: string): string {
  const date = parseISODate(`${key}-01`);
  return date ? monthLabel.format(date) : key;
}

/**
 * Turns a template into concrete sheets. Every export format is rendered from
 * this one structure, so a CSV and a live sheet always carry the same numbers.
 */
export function compileTemplate(
  templateId: TemplateId,
  expenses: Expense[],
  today = new Date(),
): CompiledExport {
  const meta = template(templateId);
  const range = resolveRange(meta.scope, expenses, today);
  const scoped = expenses
    .filter((e) => e.date >= range.from && e.date <= range.to)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));

  const total = sum(scoped);
  const categories = categoryTotals(scoped);
  const summary = {
    total,
    count: scoped.length,
    average: scoped.length ? money(total / scoped.length) : 0,
    categories,
  };

  const base = {
    templateId,
    generatedAt: new Date().toISOString(),
    rangeLabel: range.label,
    range: { from: range.from, to: range.to },
    summary,
  };

  switch (templateId) {
    case "tax-report": {
      const quarters = [0, 1, 2, 3].map((q) => {
        const items = scoped.filter((e) => {
          const month = Number(e.date.slice(5, 7)) - 1;
          return Math.floor(month / 3) === q;
        });
        return { label: `Q${q + 1}`, total: sum(items), count: items.length };
      });
      return {
        ...base,
        title: `Tax Report — ${range.label}`,
        subtitle: `${scoped.length} transactions across ${categories.length} categories`,
        sheets: [
          {
            name: "Category summary",
            columns: ["Category", "Transactions", "Total", "Share", "Deductible"],
            currencyColumns: [2],
            note: "Deductibility is a starting point, not advice — confirm each line before filing.",
            rows: categories.map((c) => [
              c.category,
              c.count,
              money(c.total),
              `${(c.share * 100).toFixed(1)}%`,
              DEDUCTIBLE_HINT[c.category],
            ]),
          },
          {
            name: "Quarterly totals",
            columns: ["Quarter", "Transactions", "Total", "Running total"],
            currencyColumns: [2, 3],
            rows: quarters.map((q, i) => [
              q.label,
              q.count,
              money(q.total),
              money(quarters.slice(0, i + 1).reduce((acc, x) => acc + x.total, 0)),
            ]),
          },
          {
            name: "Transactions",
            columns: ["Date", "Description", "Category", "Amount", "Deductible"],
            currencyColumns: [3],
            rows: scoped.map((e) => [
              e.date,
              e.description,
              e.category,
              money(e.amount),
              DEDUCTIBLE_HINT[e.category],
            ]),
          },
        ],
      };
    }

    case "monthly-summary": {
      const byDay = new Map<string, { total: number; count: number }>();
      for (const e of scoped) {
        const entry = byDay.get(e.date) ?? { total: 0, count: 0 };
        entry.total += e.amount;
        entry.count += 1;
        byDay.set(e.date, entry);
      }
      const busiest = [...byDay.entries()].sort((a, b) => b[1].total - a[1].total)[0];
      const top = [...scoped].sort((a, b) => b.amount - a.amount).slice(0, 10);

      return {
        ...base,
        title: `Monthly Summary — ${range.label}`,
        subtitle: `${scoped.length} transactions totalling ${money(total).toFixed(2)}`,
        sheets: [
          {
            name: "Summary",
            columns: ["Metric", "Value"],
            currencyColumns: [],
            rows: [
              ["Period", range.label],
              ["Transactions", scoped.length],
              ["Total spent", money(total).toFixed(2)],
              ["Average expense", summary.average.toFixed(2)],
              ["Days with spending", byDay.size],
              ["Biggest day", busiest ? `${formatDisplayDate(busiest[0])} (${money(busiest[1].total).toFixed(2)})` : "—"],
              ["Top category", categories[0]?.category ?? "—"],
            ],
          },
          {
            name: "By category",
            columns: ["Category", "Transactions", "Total", "Share"],
            currencyColumns: [2],
            rows: categories.map((c) => [
              c.category,
              c.count,
              money(c.total),
              `${(c.share * 100).toFixed(1)}%`,
            ]),
          },
          {
            name: "Daily totals",
            columns: ["Date", "Transactions", "Total"],
            currencyColumns: [2],
            rows: [...byDay.entries()]
              .sort((a, b) => a[0].localeCompare(b[0]))
              .map(([date, v]) => [date, v.count, money(v.total)]),
          },
          {
            name: "Top expenses",
            columns: ["Date", "Description", "Category", "Amount"],
            currencyColumns: [3],
            rows: top.map((e) => [e.date, e.description, e.category, money(e.amount)]),
          },
        ],
      };
    }

    case "category-analysis": {
      const months = [...new Set(scoped.map((e) => monthKey(e.date)))].sort();
      return {
        ...base,
        title: `Category Analysis — ${range.label}`,
        subtitle: `${categories.length} active categories over ${months.length} months`,
        sheets: [
          {
            name: "Category totals",
            columns: ["Category", "Transactions", "Total", "Average", "Share"],
            currencyColumns: [2, 3],
            rows: categories.map((c) => [
              c.category,
              c.count,
              money(c.total),
              money(c.total / c.count),
              `${(c.share * 100).toFixed(1)}%`,
            ]),
          },
          {
            name: "Month over month",
            columns: ["Category", ...months.map(formatMonthKey), "Change"],
            currencyColumns: months.map((_, i) => i + 1),
            note: "Change compares the first and last month in range.",
            rows: categories.map((c) => {
              const cells = months.map((m) =>
                money(sum(scoped.filter((e) => e.category === c.category && monthKey(e.date) === m))),
              );
              const first = cells[0] ?? 0;
              const last = cells[cells.length - 1] ?? 0;
              const change =
                first === 0 ? (last === 0 ? "—" : "new") : `${(((last - first) / first) * 100).toFixed(0)}%`;
              return [c.category, ...cells, change];
            }),
          },
          {
            name: "Transactions",
            columns: ["Date", "Description", "Category", "Amount"],
            currencyColumns: [3],
            rows: [...scoped]
              .sort((a, b) => a.category.localeCompare(b.category) || a.date.localeCompare(b.date))
              .map((e) => [e.date, e.description, e.category, money(e.amount)]),
          },
        ],
      };
    }

    case "reimbursement": {
      const claimable = scoped.filter((e) => CLAIMABLE.includes(e.category));
      const claimTotal = sum(claimable);
      let running = 0;
      return {
        ...base,
        title: `Reimbursement Claim — ${range.label}`,
        subtitle: `${claimable.length} claimable lines totalling ${money(claimTotal).toFixed(2)}`,
        sheets: [
          {
            name: "Claim lines",
            columns: ["#", "Date", "Description", "Category", "Amount", "Running total"],
            currencyColumns: [4, 5],
            note: `Only ${CLAIMABLE.join(", ")} are included. Everything else stays out of the claim.`,
            rows: claimable.map((e, i) => {
              running = money(running + e.amount);
              return [i + 1, e.date, e.description, e.category, money(e.amount), running];
            }),
          },
          {
            name: "Totals",
            columns: ["Field", "Value"],
            currencyColumns: [],
            rows: [
              ["Claim period", `${formatDisplayDate(range.from)} – ${formatDisplayDate(range.to)}`],
              ["Lines claimed", claimable.length],
              ["Claim total", money(claimTotal).toFixed(2)],
              ["Excluded lines", scoped.length - claimable.length],
              ["Excluded value", money(total - claimTotal).toFixed(2)],
              ["Prepared", new Date().toISOString().slice(0, 10)],
              ["Declaration", "I confirm these expenses were incurred for business purposes."],
              ["Signature", ""],
            ],
          },
        ],
      };
    }

    default:
      return {
        ...base,
        title: "Raw Ledger",
        subtitle: `${scoped.length} records, every field included`,
        sheets: [
          {
            name: "Ledger",
            columns: ["id", "date", "description", "category", "amount", "createdAt", "updatedAt"],
            currencyColumns: [4],
            rows: scoped.map((e) => [
              e.id,
              e.date,
              e.description,
              e.category,
              money(e.amount),
              e.createdAt,
              e.updatedAt,
            ]),
          },
        ],
      };
  }
}

/** Total data rows across every sheet — what history reports as "rows". */
export function countRows(compiled: CompiledExport): number {
  return compiled.sheets.reduce((n, sheet) => n + sheet.rows.length, 0);
}
