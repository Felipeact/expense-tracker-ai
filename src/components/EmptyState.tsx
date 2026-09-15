"use client";

import { Plus, Sparkles, Wallet } from "lucide-react";
import { useExpenses } from "@/hooks/useExpenses";
import { generateSampleExpenses } from "@/lib/sampleData";
import { useExpenseDialog } from "./ExpenseDialogProvider";
import { useToast } from "./ui/Toast";

export function EmptyState() {
  const { openAdd } = useExpenseDialog();
  const { addMany } = useExpenses();
  const toast = useToast();

  const loadSample = () => {
    const sample = generateSampleExpenses();
    addMany(sample);
    toast(`Loaded ${sample.length} sample expenses.`);
  };

  return (
    <div className="card flex flex-col items-center px-6 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent-ink">
        <Wallet className="h-7 w-7" aria-hidden />
      </span>
      <h2 className="mt-5 text-xl font-semibold text-ink">No expenses yet</h2>
      <p className="mt-2 max-w-sm text-sm text-ink-2">
        Add your first expense to start seeing where your money goes, or load sample data to explore the app.
      </p>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <button type="button" className="btn-primary" onClick={openAdd}>
          <Plus className="h-4 w-4" aria-hidden />
          Add your first expense
        </button>
        <button type="button" className="btn-secondary" onClick={loadSample}>
          <Sparkles className="h-4 w-4" aria-hidden />
          Load sample data
        </button>
      </div>
    </div>
  );
}
