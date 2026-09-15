"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useExpenses } from "@/hooks/useExpenses";
import { formatCurrency } from "@/lib/format";
import type { Expense, ExpenseInput } from "@/lib/types";
import { ExpenseForm } from "./ExpenseForm";
import { Modal } from "./ui/Modal";
import { useToast } from "./ui/Toast";

interface ExpenseDialogContextValue {
  openAdd: () => void;
  openEdit: (expense: Expense) => void;
  requestDelete: (expense: Expense) => void;
}

const ExpenseDialogContext = createContext<ExpenseDialogContextValue | null>(null);

type DialogState = { mode: "closed" } | { mode: "add" } | { mode: "edit"; expense: Expense };

/** Owns the add/edit dialog and delete-with-undo, so any page can trigger them. */
export function ExpenseDialogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DialogState>({ mode: "closed" });
  const { addExpense, updateExpense, deleteExpense, restoreExpense } = useExpenses();
  const toast = useToast();

  const close = useCallback(() => setState({ mode: "closed" }), []);

  const handleSubmit = (data: ExpenseInput) => {
    if (state.mode === "edit") {
      updateExpense(state.expense.id, data);
      toast("Expense updated.");
    } else {
      addExpense(data);
      toast(`Added ${formatCurrency(data.amount)} for “${data.description}”.`);
    }
    close();
  };

  const requestDelete = useCallback(
    (expense: Expense) => {
      const removed = deleteExpense(expense.id);
      if (!removed) return;
      toast(`Deleted “${removed.description}”.`, {
        action: { label: "Undo", onClick: () => restoreExpense(removed) },
      });
    },
    [deleteExpense, restoreExpense, toast],
  );

  const value = useMemo(
    () => ({
      openAdd: () => setState({ mode: "add" }),
      openEdit: (expense: Expense) => setState({ mode: "edit", expense }),
      requestDelete,
    }),
    [requestDelete],
  );

  return (
    <ExpenseDialogContext.Provider value={value}>
      {children}
      <Modal
        open={state.mode !== "closed"}
        onClose={close}
        title={state.mode === "edit" ? "Edit expense" : "Add expense"}
        description={state.mode === "edit" ? "Update the details of this expense." : "Record a new expense."}
      >
        {state.mode !== "closed" && (
          <ExpenseForm
            key={state.mode === "edit" ? state.expense.id : "new"}
            initial={state.mode === "edit" ? state.expense : undefined}
            onSubmit={handleSubmit}
            onCancel={close}
          />
        )}
      </Modal>
    </ExpenseDialogContext.Provider>
  );
}

export function useExpenseDialog() {
  const context = useContext(ExpenseDialogContext);
  if (!context) throw new Error("useExpenseDialog must be used within ExpenseDialogProvider");
  return context;
}
