import { PieChart } from "lucide-react";
import type { CategoryTotal } from "@/lib/analytics";
import { CATEGORY_META } from "@/lib/categories";
import { formatCurrency, formatPercent } from "@/lib/format";

interface CategoryBreakdownProps {
  data: CategoryTotal[];
  subtitle: string;
}

/**
 * Horizontal bars, one per category. Every bar carries its name, amount and share
 * as visible text, so no value depends on color or hover.
 */
export function CategoryBreakdown({ data, subtitle }: CategoryBreakdownProps) {
  const max = data[0]?.total ?? 0;

  return (
    <section className="card flex h-full flex-col p-5">
      <div className="mb-5">
        <h2 className="text-base font-semibold text-ink">Spending by category</h2>
        <p className="mt-0.5 text-sm text-ink-2">{subtitle}</p>
      </div>

      {data.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
          <PieChart className="h-8 w-8 text-muted" aria-hidden />
          <p className="text-sm text-ink-2">No spending in this period.</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {data.map(({ category, total, count, share }) => {
            const { color, icon: Icon } = CATEGORY_META[category];
            return (
              <li key={category} className="group">
                <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <Icon className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                    <span className="truncate font-medium text-ink">{category}</span>
                    <span className="hidden text-xs text-muted sm:inline">
                      {count} expense{count === 1 ? "" : "s"}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
                    <span className="font-semibold text-ink">{formatCurrency(total)}</span>
                    <span className="w-9 text-right text-xs text-ink-2">{formatPercent(share)}</span>
                  </span>
                </div>
                <div className="h-2 w-full" role="presentation">
                  <div
                    className="h-full rounded-r-[4px] transition-[width] duration-500 group-hover:brightness-110"
                    style={{ width: `${Math.max(1, (total / max) * 100)}%`, background: color }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
