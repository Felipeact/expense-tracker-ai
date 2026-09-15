"use client";

import { Download, SearchX, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { ExpenseFiltersBar } from "@/components/ExpenseFiltersBar";
import { ExpenseRow } from "@/components/ExpenseRow";
import { Modal } from "@/components/ui/Modal";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { useExpenses } from "@/hooks/useExpenses";
import { sum } from "@/lib/analytics";
import { downloadCsv } from "@/lib/csv";
import { applyFilters, countActiveFilters, DEFAULT_FILTERS, type ExpenseFilters } from "@/lib/filters";
import { formatCurrency } from "@/lib/format";

const PAGE_SIZE = 50;

export default function ExpensesPage() {
  const { expenses, isLoaded, clearAll } = useExpenses();
  const toast = useToast();
  const [filters, setFilters] = useState<ExpenseFilters>(DEFAULT_FILTERS);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [confirmClear, setConfirmClear] = useState(false);

  const filtered = useMemo(() => applyFilters(expenses, filters), [expenses, filters]);
  const total = useMemo(() => sum(filtered), [filtered]);
  const isFiltered = countActiveFilters(filters) > 0;

  const updateFilters = (next: ExpenseFilters) => {
    setFilters(next);
    setVisible(PAGE_SIZE);
  };

  const exportCsv = () => {
    try {
      downloadCsv(filtered);
      toast(`Exported ${filtered.length} expense${filtered.length === 1 ? "" : "s"} to CSV.`);
    } catch {
      toast("Export failed. Please try again.", { variant: "error" });
    }
  };

  const handleClearAll = () => {
    const count = expenses.length;
    clearAll();
    setConfirmClear(false);
    toast(`Deleted ${count} expense${count === 1 ? "" : "s"}.`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Expenses</h1>
          <p className="mt-1 text-sm text-ink-2">Search, filter, edit, and export your spending history.</p>
        </div>
        {isLoaded && expenses.length > 0 && (
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={exportCsv} disabled={filtered.length === 0}>
              <Download className="h-4 w-4" aria-hidden />
              Export CSV
            </button>
            <button
              type="button"
              className="btn-secondary text-bad hover:bg-bad-soft"
              onClick={() => setConfirmClear(true)}
              aria-label="Delete all expenses"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Delete all</span>
            </button>
          </div>
        )}
      </div>

      {!isLoaded ? (
        <ListSkeleton />
      ) : expenses.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <ExpenseFiltersBar filters={filters} onChange={updateFilters} />

          <section className="card overflow-hidden">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line bg-surface-2/40 px-5 py-3 text-sm">
              <p className="text-ink-2" aria-live="polite">
                {isFiltered ? (
                  <>
                    Showing <span className="font-medium text-ink">{filtered.length}</span> of {expenses.length}{" "}
                    expenses
                  </>
                ) : (
                  <>
                    <span className="font-medium text-ink">{expenses.length}</span> expenses
                  </>
                )}
              </p>
              <p className="text-ink-2">
                Total <span className="ml-1 font-semibold tabular-nums text-ink">{formatCurrency(total)}</span>
              </p>
            </div>

            {filtered.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-14 text-center">
                <SearchX className="h-8 w-8 text-muted" aria-hidden />
                <p className="mt-3 font-medium text-ink">No matching expenses</p>
                <p className="mt-1 text-sm text-ink-2">Try a different search term or widen your filters.</p>
                <button
                  type="button"
                  className="btn-secondary mt-4"
                  onClick={() => updateFilters({ ...DEFAULT_FILTERS, sort: filters.sort })}
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <>
                <ul className="divide-y divide-line">
                  {filtered.slice(0, visible).map((expense) => (
                    <ExpenseRow key={expense.id} expense={expense} />
                  ))}
                </ul>
                {filtered.length > visible && (
                  <div className="border-t border-line p-3 text-center">
                    <button type="button" className="btn-ghost" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                      Show {Math.min(PAGE_SIZE, filtered.length - visible)} more
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </>
      )}

      <Modal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Delete all expenses?"
        description="This permanently removes every expense stored in this browser."
      >
        <p className="text-sm text-ink-2">
          Consider exporting a CSV backup first. This action can&apos;t be undone.
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn-secondary" onClick={() => setConfirmClear(false)} data-autofocus>
            Cancel
          </button>
          <button type="button" className="btn-danger" onClick={handleClearAll}>
            Delete {expenses.length} expense{expenses.length === 1 ? "" : "s"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
