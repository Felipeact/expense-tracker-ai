"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createId, isStorageEvent, loadExpenses, saveExpenses, StorageError } from "@/lib/storage";
import type { Expense, ExpenseInput } from "@/lib/types";

interface ExpensesContextValue {
  expenses: Expense[];
  isLoaded: boolean;
  /** Set when reading or writing localStorage fails. */
  error: string | null;
  dismissError: () => void;
  addExpense: (input: ExpenseInput) => Expense;
  addMany: (inputs: ExpenseInput[]) => void;
  updateExpense: (id: string, input: ExpenseInput) => void;
  deleteExpense: (id: string) => Expense | undefined;
  restoreExpense: (expense: Expense) => void;
  clearAll: () => void;
}

const ExpensesContext = createContext<ExpensesContextValue | null>(null);

export function ExpensesProvider({ children }: { children: ReactNode }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Mirror of state so mutations can compute the next list synchronously.
  const expensesRef = useRef<Expense[]>([]);

  const readFromStorage = useCallback(() => {
    try {
      const { expenses: loaded, skipped } = loadExpenses();
      expensesRef.current = loaded;
      setExpenses(loaded);
      setError(
        skipped > 0 ? `${skipped} saved expense${skipped === 1 ? " was" : "s were"} unreadable and skipped.` : null,
      );
    } catch (err) {
      setError(err instanceof StorageError ? err.message : "Could not access browser storage.");
    } finally {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    readFromStorage();
    // Keep multiple open tabs in sync.
    const onStorage = (event: StorageEvent) => {
      if (isStorageEvent(event)) readFromStorage();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [readFromStorage]);

  const commit = useCallback((next: Expense[]) => {
    expensesRef.current = next;
    setExpenses(next);
    try {
      saveExpenses(next);
    } catch (err) {
      setError(err instanceof StorageError ? err.message : "Could not save your changes.");
    }
  }, []);

  const addExpense = useCallback(
    (input: ExpenseInput) => {
      const now = new Date().toISOString();
      const expense: Expense = { ...input, id: createId(), createdAt: now, updatedAt: now };
      commit([expense, ...expensesRef.current]);
      return expense;
    },
    [commit],
  );

  const addMany = useCallback(
    (inputs: ExpenseInput[]) => {
      const now = new Date().toISOString();
      const created = inputs.map((input) => ({ ...input, id: createId(), createdAt: now, updatedAt: now }));
      commit([...created, ...expensesRef.current]);
    },
    [commit],
  );

  const updateExpense = useCallback(
    (id: string, input: ExpenseInput) => {
      commit(
        expensesRef.current.map((e) =>
          e.id === id ? { ...e, ...input, updatedAt: new Date().toISOString() } : e,
        ),
      );
    },
    [commit],
  );

  const deleteExpense = useCallback(
    (id: string) => {
      const target = expensesRef.current.find((e) => e.id === id);
      if (target) commit(expensesRef.current.filter((e) => e.id !== id));
      return target;
    },
    [commit],
  );

  const restoreExpense = useCallback(
    (expense: Expense) => {
      if (expensesRef.current.some((e) => e.id === expense.id)) return;
      commit([expense, ...expensesRef.current]);
    },
    [commit],
  );

  const clearAll = useCallback(() => commit([]), [commit]);

  const value = useMemo<ExpensesContextValue>(
    () => ({
      expenses,
      isLoaded,
      error,
      dismissError: () => setError(null),
      addExpense,
      addMany,
      updateExpense,
      deleteExpense,
      restoreExpense,
      clearAll,
    }),
    [expenses, isLoaded, error, addExpense, addMany, updateExpense, deleteExpense, restoreExpense, clearAll],
  );

  return <ExpensesContext.Provider value={value}>{children}</ExpensesContext.Provider>;
}

export function useExpenses() {
  const context = useContext(ExpensesContext);
  if (!context) throw new Error("useExpenses must be used within ExpensesProvider");
  return context;
}
