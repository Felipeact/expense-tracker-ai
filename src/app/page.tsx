"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { CategoryBreakdown } from "@/components/charts/CategoryBreakdown";
import { TrendChart } from "@/components/charts/TrendChart";
import { StatCards } from "@/components/dashboard/StatCards";
import { EmptyState } from "@/components/EmptyState";
import { ExpenseRow } from "@/components/ExpenseRow";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { DashboardSkeleton } from "@/components/ui/Skeleton";
import { useExpenses } from "@/hooks/useExpenses";
import { PERIODS, summarize, trend, type Period } from "@/lib/analytics";

const TREND_COPY: Record<Period, { subtitle: string; labelWidth: number }> = {
  "this-month": { subtitle: "Daily totals this month", labelWidth: 22 },
  "last-90": { subtitle: "Weekly totals, last 13 weeks", labelWidth: 48 },
  "this-year": { subtitle: "Monthly totals this year", labelWidth: 30 },
  all: { subtitle: "Totals across your full history", labelWidth: 44 },
};

export default function DashboardPage() {
  const { expenses, isLoaded } = useExpenses();
  const [period, setPeriod] = useState<Period>("this-month");

  const periodMeta = PERIODS.find((p) => p.value === period)!;
  const summary = useMemo(() => summarize(expenses, period), [expenses, period]);
  const buckets = useMemo(() => trend(expenses, period), [expenses, period]);
  const recent = useMemo(
    () =>
      [...expenses]
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
        .slice(0, 5),
    [expenses],
  );

  if (!isLoaded) return <DashboardSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Dashboard</h1>
          <p className="mt-1 text-sm text-ink-2">An overview of where your money is going.</p>
        </div>
        {expenses.length > 0 && (
          <SegmentedControl
            label="Time period"
            value={period}
            onChange={setPeriod}
            options={PERIODS.map(({ value, label }) => ({ value, label }))}
          />
        )}
      </div>

      {expenses.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <StatCards summary={summary} comparison={periodMeta.comparison} />

          <div className="grid gap-4 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <TrendChart
                key={period}
                buckets={buckets}
                title="Spending over time"
                subtitle={TREND_COPY[period].subtitle}
                labelWidth={TREND_COPY[period].labelWidth}
              />
            </div>
            <div className="lg:col-span-2">
              <CategoryBreakdown data={summary.byCategory} subtitle={periodMeta.label} />
            </div>
          </div>

          <section className="card">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-ink">Recent expenses</h2>
                <p className="mt-0.5 text-sm text-ink-2">Your latest 5 entries</p>
              </div>
              <Link href="/expenses" className="btn-ghost -mr-2">
                View all
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
            <ul className="divide-y divide-line">
              {recent.map((expense) => (
                <ExpenseRow key={expense.id} expense={expense} />
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
