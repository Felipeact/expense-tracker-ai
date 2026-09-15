import {
  addDays,
  addMonths,
  daysBetweenInclusive,
  daysInMonth,
  parseISODate,
  startOfMonth,
  startOfYear,
  toISODate,
} from "./dates";
import { CATEGORIES, type Category, type Expense } from "./types";

export type Period = "this-month" | "last-90" | "this-year" | "all";

export const PERIODS: { value: Period; label: string; comparison?: string }[] = [
  { value: "this-month", label: "This month", comparison: "vs. same point last month" },
  { value: "last-90", label: "Last 90 days", comparison: "vs. previous 90 days" },
  { value: "this-year", label: "This year", comparison: "vs. same point last year" },
  { value: "all", label: "All time" },
];

interface Range {
  start: string;
  end: string;
}

/** Sums in integer cents to avoid floating-point drift. */
export function sum(expenses: Expense[]): number {
  return expenses.reduce((cents, e) => cents + Math.round(e.amount * 100), 0) / 100;
}

function inRange(expenses: Expense[], range: Range): Expense[] {
  return expenses.filter((e) => e.date >= range.start && e.date <= range.end);
}

function earliestDate(expenses: Expense[], fallback: Date): Date {
  let min: string | null = null;
  for (const e of expenses) if (min === null || e.date < min) min = e.date;
  return (min && parseISODate(min)) || fallback;
}

export function periodRanges(
  period: Period,
  expenses: Expense[],
  today: Date,
): { current: Range; previous: Range | null } {
  const end = toISODate(today);
  switch (period) {
    case "this-month":
      return {
        current: { start: toISODate(startOfMonth(today)), end },
        previous: {
          start: toISODate(startOfMonth(addMonths(today, -1))),
          end: toISODate(addMonths(today, -1)),
        },
      };
    case "last-90":
      return {
        current: { start: toISODate(addDays(today, -89)), end },
        previous: { start: toISODate(addDays(today, -179)), end: toISODate(addDays(today, -90)) },
      };
    case "this-year":
      return {
        current: { start: toISODate(startOfYear(today)), end },
        previous: {
          start: toISODate(startOfYear(addMonths(today, -12))),
          end: toISODate(addMonths(today, -12)),
        },
      };
    default:
      return { current: { start: toISODate(earliestDate(expenses, today)), end }, previous: null };
  }
}

export interface CategoryTotal {
  category: Category;
  total: number;
  count: number;
  share: number;
}

export interface PeriodSummary {
  total: number;
  previousTotal: number | null;
  count: number;
  averageExpense: number;
  dailyAverage: number;
  byCategory: CategoryTotal[];
}

export function summarize(expenses: Expense[], period: Period, today = new Date()): PeriodSummary {
  const { current, previous } = periodRanges(period, expenses, today);
  const scoped = inRange(expenses, current);
  const total = sum(scoped);
  const days = daysBetweenInclusive(parseISODate(current.start)!, parseISODate(current.end)!);

  const byCategory = CATEGORIES.map((category) => {
    const items = scoped.filter((e) => e.category === category);
    const categoryTotal = sum(items);
    return {
      category,
      total: categoryTotal,
      count: items.length,
      share: total > 0 ? categoryTotal / total : 0,
    };
  })
    .filter((c) => c.count > 0)
    .sort((a, b) => b.total - a.total);

  return {
    total,
    previousTotal: previous ? sum(inRange(expenses, previous)) : null,
    count: scoped.length,
    averageExpense: scoped.length ? total / scoped.length : 0,
    dailyAverage: days > 0 ? total / days : 0,
    byCategory,
  };
}

export interface TrendBucket {
  key: string;
  /** Axis label. */
  label: string;
  /** Full label for tooltips and the table view. */
  fullLabel: string;
  total: number;
  count: number;
  /** Bucket lies entirely after today, so it has no data yet. */
  isFuture: boolean;
}

const monthShort = new Intl.DateTimeFormat("en-US", { month: "short" });
const monthYear = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });
const dayMonth = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const fullDay = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});

function bucketize(
  expenses: Expense[],
  ranges: { start: Date; end: Date; label: string; fullLabel: string }[],
  today: Date,
): TrendBucket[] {
  const todayIso = toISODate(today);
  return ranges.map(({ start, end, label, fullLabel }) => {
    const range = { start: toISODate(start), end: toISODate(end) };
    const items = inRange(expenses, range);
    return {
      key: range.start,
      label,
      fullLabel,
      total: sum(items),
      count: items.length,
      isFuture: range.start > todayIso,
    };
  });
}

function monthRanges(first: Date, count: number, withYear: boolean) {
  return Array.from({ length: count }, (_, i) => {
    const start = new Date(first.getFullYear(), first.getMonth() + i, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    const short = monthShort.format(start);
    return {
      start,
      end,
      label: withYear && start.getMonth() === 0 ? `${short} '${String(start.getFullYear()).slice(2)}` : short,
      fullLabel: monthYear.format(start),
    };
  });
}

/** Spending over time for the selected period, at a granularity that suits its length. */
export function trend(expenses: Expense[], period: Period, today = new Date()): TrendBucket[] {
  switch (period) {
    case "this-month": {
      const first = startOfMonth(today);
      const ranges = Array.from({ length: daysInMonth(today) }, (_, i) => {
        const day = addDays(first, i);
        return { start: day, end: day, label: String(i + 1), fullLabel: fullDay.format(day) };
      });
      return bucketize(expenses, ranges, today);
    }
    case "last-90": {
      // 13 weeks = 91 days, ending today.
      const first = addDays(today, -90);
      const ranges = Array.from({ length: 13 }, (_, i) => {
        const start = addDays(first, i * 7);
        const end = addDays(start, 6);
        return {
          start,
          end,
          label: dayMonth.format(start),
          fullLabel: `${dayMonth.format(start)} – ${dayMonth.format(end)}`,
        };
      });
      return bucketize(expenses, ranges, today);
    }
    case "this-year":
      return bucketize(expenses, monthRanges(startOfYear(today), 12, false), today);
    default: {
      const first = startOfMonth(earliestDate(expenses, today));
      const months =
        (today.getFullYear() - first.getFullYear()) * 12 + today.getMonth() - first.getMonth() + 1;
      if (months <= 24) {
        // Always show at least 6 months so a new account's chart isn't a single bar.
        const count = Math.max(months, 6);
        const start = startOfMonth(addMonths(startOfMonth(today), -(count - 1)));
        return bucketize(expenses, monthRanges(start, count, true), today);
      }
      const years = today.getFullYear() - first.getFullYear() + 1;
      const ranges = Array.from({ length: years }, (_, i) => {
        const year = first.getFullYear() + i;
        return {
          start: new Date(year, 0, 1),
          end: new Date(year, 11, 31),
          label: String(year),
          fullLabel: String(year),
        };
      });
      return bucketize(expenses, ranges, today);
    }
  }
}
