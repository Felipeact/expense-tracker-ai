import { parseISODate, todayISO } from "./dates";
import { isCategory, type Category, type ExpenseInput } from "./types";

export const MAX_AMOUNT = 1_000_000;
export const MAX_DESCRIPTION = 120;

/** Raw form state: everything is a string until validated. */
export interface ExpenseFormValues {
  date: string;
  amount: string;
  category: Category | "";
  description: string;
}

export type ExpenseFormErrors = Partial<Record<keyof ExpenseFormValues, string>>;

const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;

export function validateField<K extends keyof ExpenseFormValues>(
  field: K,
  values: ExpenseFormValues,
): string | undefined {
  switch (field) {
    case "date": {
      if (!values.date) return "Date is required.";
      if (!parseISODate(values.date)) return "Enter a valid date.";
      if (values.date > todayISO()) return "Date can't be in the future.";
      if (values.date < "2000-01-01") return "Date must be in the year 2000 or later.";
      return undefined;
    }
    case "amount": {
      const raw = values.amount.trim().replace(/,/g, "");
      if (!raw) return "Amount is required.";
      if (!AMOUNT_PATTERN.test(raw)) return "Enter a number with up to 2 decimal places.";
      const amount = Number(raw);
      if (amount <= 0) return "Amount must be greater than $0.";
      if (amount > MAX_AMOUNT) return "Amount must be $1,000,000 or less.";
      return undefined;
    }
    case "category":
      return isCategory(values.category) ? undefined : "Choose a category.";
    case "description": {
      const text = values.description.trim();
      if (!text) return "Description is required.";
      if (text.length > MAX_DESCRIPTION) return `Keep it under ${MAX_DESCRIPTION} characters.`;
      return undefined;
    }
    default:
      return undefined;
  }
}

export function validateExpenseForm(
  values: ExpenseFormValues,
): { ok: true; data: ExpenseInput } | { ok: false; errors: ExpenseFormErrors } {
  const errors: ExpenseFormErrors = {};
  for (const field of ["date", "amount", "category", "description"] as const) {
    const message = validateField(field, values);
    if (message) errors[field] = message;
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    data: {
      date: values.date,
      amount: Math.round(Number(values.amount.trim().replace(/,/g, "")) * 100) / 100,
      category: values.category as Category,
      description: values.description.trim(),
    },
  };
}
