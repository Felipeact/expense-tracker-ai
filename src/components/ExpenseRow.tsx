"use client";

import { Pencil, Trash2 } from "lucide-react";
import { formatDisplayDate } from "@/lib/dates";
import { formatCurrency } from "@/lib/format";
import type { Expense } from "@/lib/types";
import { CategoryBadge, CategoryIcon } from "./CategoryBadge";
import { useExpenseDialog } from "./ExpenseDialogProvider";

/** One expense as a list row with edit/delete actions; works at every width. */
export function ExpenseRow({ expense }: { expense: Expense }) {
  const { openEdit, requestDelete } = useExpenseDialog();

  return (
    <li className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2/50 sm:gap-4 sm:px-5">
      <CategoryIcon category={expense.category} />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{expense.description}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-2">
          <time dateTime={expense.date}>{formatDisplayDate(expense.date)}</time>
          <CategoryBadge category={expense.category} />
        </div>
      </div>

      <p className="shrink-0 text-right text-sm font-semibold tabular-nums text-ink">
        {formatCurrency(expense.amount)}
      </p>

      <div className="flex shrink-0 items-center gap-0.5 sm:opacity-60 sm:transition-opacity sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
        <button
          type="button"
          className="icon-btn"
          onClick={() => openEdit(expense)}
          aria-label={`Edit ${expense.description}`}
          title="Edit"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="icon-btn hover:bg-bad-soft hover:text-bad"
          onClick={() => requestDelete(expense)}
          aria-label={`Delete ${expense.description}`}
          title="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}
