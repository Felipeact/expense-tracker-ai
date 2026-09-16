import type { Frequency, ScheduleRule } from "./types";

export const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: "daily", label: "Every day" },
  { value: "weekly", label: "Every week" },
  { value: "monthly", label: "Every month" },
];

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function at(date: Date, hour: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, 0, 0, 0);
}

/**
 * First firing strictly after `from`. Monthly rules cap the day at 28 so the
 * rule never skips February.
 */
export function nextRun(rule: Pick<ScheduleRule, "frequency" | "weekday" | "dayOfMonth" | "hour">, from: Date): Date {
  const hour = Math.min(23, Math.max(0, rule.hour));

  if (rule.frequency === "daily") {
    const candidate = at(from, hour);
    return candidate > from ? candidate : at(new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1), hour);
  }

  if (rule.frequency === "weekly") {
    const target = ((rule.weekday % 7) + 7) % 7;
    let delta = (target - from.getDay() + 7) % 7;
    let candidate = at(new Date(from.getFullYear(), from.getMonth(), from.getDate() + delta), hour);
    if (candidate <= from) {
      delta += 7;
      candidate = at(new Date(from.getFullYear(), from.getMonth(), from.getDate() + delta), hour);
    }
    return candidate;
  }

  const day = Math.min(28, Math.max(1, rule.dayOfMonth));
  let candidate = at(new Date(from.getFullYear(), from.getMonth(), day), hour);
  if (candidate <= from) candidate = at(new Date(from.getFullYear(), from.getMonth() + 1, day), hour);
  return candidate;
}

/**
 * When this rule should fire next, anchored to its last run. Anchoring to the
 * last run (rather than to now) is what makes a rule look overdue after the tab
 * has been closed for a while, which is how catch-up runs get detected.
 */
export function nextRunFor(rule: ScheduleRule): Date {
  return nextRun(rule, new Date(rule.lastRunAt ?? rule.createdAt));
}

export function isDue(rule: ScheduleRule, now = new Date()): boolean {
  return !rule.paused && nextRunFor(rule) <= now;
}

const timeFormat = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

export function formatHour(hour: number): string {
  return timeFormat.format(new Date(2000, 0, 1, hour, 0));
}

export function describeSchedule(rule: ScheduleRule): string {
  const time = formatHour(rule.hour);
  switch (rule.frequency) {
    case "daily":
      return `Every day at ${time}`;
    case "weekly":
      return `Every ${WEEKDAYS[rule.weekday]} at ${time}`;
    default: {
      const day = Math.min(28, Math.max(1, rule.dayOfMonth));
      return `Day ${day} of each month at ${time}`;
    }
  }
}

const relative = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });

/** "in 3 hours" / "2 days ago", for next-run and last-run labels. */
export function formatRelative(target: Date | string, now = new Date()): string {
  const ms = new Date(target).getTime() - now.getTime();
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000_000],
    ["month", 2_592_000_000],
    ["day", 86_400_000],
    ["hour", 3_600_000],
    ["minute", 60_000],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(ms) >= size) return relative.format(Math.round(ms / size), unit);
  }
  return Math.abs(ms) < 15_000 ? "just now" : relative.format(Math.round(ms / 1000), "second");
}
