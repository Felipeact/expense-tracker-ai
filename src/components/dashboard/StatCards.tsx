import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { ReactNode } from "react";
import type { PeriodSummary } from "@/lib/analytics";
import { CATEGORY_META } from "@/lib/categories";
import { formatCurrency, formatPercent } from "@/lib/format";

interface StatCardsProps {
  summary: PeriodSummary;
  comparison?: string;
}

export function StatCards({ summary, comparison }: StatCardsProps) {
  const top = summary.byCategory[0];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Total spent" value={formatCurrency(summary.total)}>
        {summary.previousTotal !== null && comparison ? (
          <Delta current={summary.total} previous={summary.previousTotal} comparison={comparison} />
        ) : (
          <span className="text-muted">Across all recorded expenses</span>
        )}
      </StatCard>

      <StatCard label="Daily average" value={formatCurrency(summary.dailyAverage)}>
        <span className="text-muted">Per calendar day in this period</span>
      </StatCard>

      <StatCard label="Transactions" value={summary.count.toLocaleString("en-US")}>
        <span className="text-muted">
          {summary.count > 0 ? `${formatCurrency(summary.averageExpense)} on average` : "No expenses yet"}
        </span>
      </StatCard>

      <StatCard
        label="Top category"
        value={
          top ? (
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: CATEGORY_META[top.category].color }} aria-hidden />
              {top.category}
            </span>
          ) : (
            "—"
          )
        }
      >
        <span className="text-muted">
          {top ? `${formatCurrency(top.total)} · ${formatPercent(top.share)} of spending` : "No spending in this period"}
        </span>
      </StatCard>
    </div>
  );
}

function StatCard({ label, value, children }: { label: string; value: ReactNode; children: ReactNode }) {
  return (
    <div className="card p-5">
      <p className="text-sm font-medium text-ink-2">{label}</p>
      <p className="mt-2 truncate text-2xl font-semibold tracking-tight text-ink">{value}</p>
      <p className="mt-1.5 text-xs">{children}</p>
    </div>
  );
}

function Delta({ current, previous, comparison }: { current: number; previous: number; comparison: string }) {
  if (previous === 0) {
    return <span className="text-muted">No earlier spending to compare with</span>;
  }
  const change = (current - previous) / previous;
  const flat = Math.abs(change) < 0.005;
  // For spending, going up is the unfavorable direction.
  const Icon = flat ? Minus : change > 0 ? ArrowUpRight : ArrowDownRight;
  const tone = flat ? "text-ink-2" : change > 0 ? "text-bad" : "text-good";
  const word = flat ? "No change" : change > 0 ? "Up" : "Down";

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className={`inline-flex items-center gap-0.5 font-semibold ${tone}`}>
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {word}
        {!flat && ` ${formatPercent(Math.abs(change))}`}
      </span>
      <span className="text-muted">{comparison}</span>
    </span>
  );
}
