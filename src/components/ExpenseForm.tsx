"use client";

import { Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { CATEGORY_META } from "@/lib/categories";
import { todayISO } from "@/lib/dates";
import { CATEGORIES, type Expense, type ExpenseInput } from "@/lib/types";
import {
  MAX_DESCRIPTION,
  validateExpenseForm,
  validateField,
  type ExpenseFormErrors,
  type ExpenseFormValues,
} from "@/lib/validation";

interface ExpenseFormProps {
  initial?: Expense;
  onSubmit: (data: ExpenseInput) => void | Promise<void>;
  onCancel: () => void;
}

function initialValues(expense?: Expense): ExpenseFormValues {
  return expense
    ? {
        date: expense.date,
        amount: expense.amount.toFixed(2),
        category: expense.category,
        description: expense.description,
      }
    : { date: todayISO(), amount: "", category: "", description: "" };
}

export function ExpenseForm({ initial, onSubmit, onCancel }: ExpenseFormProps) {
  const [values, setValues] = useState<ExpenseFormValues>(() => initialValues(initial));
  const [errors, setErrors] = useState<ExpenseFormErrors>({});
  const [touched, setTouched] = useState<Partial<Record<keyof ExpenseFormValues, boolean>>>({});
  const [submitting, setSubmitting] = useState(false);

  const setField = <K extends keyof ExpenseFormValues>(field: K, value: ExpenseFormValues[K]) => {
    const next = { ...values, [field]: value };
    setValues(next);
    // Re-validate live only once the user has left the field, so errors don't nag while typing.
    if (touched[field]) setErrors((prev) => ({ ...prev, [field]: validateField(field, next) }));
  };

  const blur = (field: keyof ExpenseFormValues) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    setErrors((prev) => ({ ...prev, [field]: validateField(field, values) }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const result = validateExpenseForm(values);
    if (!result.ok) {
      setErrors(result.errors);
      setTouched({ date: true, amount: true, category: true, description: true });
      const firstInvalid = (["amount", "description", "category", "date"] as const).find((f) => result.errors[f]);
      if (firstInvalid) document.getElementById(`expense-${firstInvalid}`)?.focus();
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(result.data);
    } finally {
      setSubmitting(false);
    }
  };

  const describedBy = (field: keyof ExpenseFormValues) => (errors[field] ? `expense-${field}-error` : undefined);
  const inputClass = (field: keyof ExpenseFormValues) => `input ${errors[field] ? "input-error" : ""}`;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="expense-amount" className="label">
            Amount
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted">$</span>
            <input
              id="expense-amount"
              data-autofocus
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              className={`${inputClass("amount")} pl-7 tabular-nums`}
              value={values.amount}
              onChange={(e) => setField("amount", e.target.value)}
              onBlur={() => blur("amount")}
              aria-invalid={!!errors.amount}
              aria-describedby={describedBy("amount")}
            />
          </div>
          <FieldError id="expense-amount-error" message={errors.amount} />
        </div>

        <div>
          <label htmlFor="expense-date" className="label">
            Date
          </label>
          <input
            id="expense-date"
            type="date"
            max={todayISO()}
            min="2000-01-01"
            className={inputClass("date")}
            value={values.date}
            onChange={(e) => setField("date", e.target.value)}
            onBlur={() => blur("date")}
            aria-invalid={!!errors.date}
            aria-describedby={describedBy("date")}
          />
          <FieldError id="expense-date-error" message={errors.date} />
        </div>
      </div>

      <fieldset>
        <legend className="label">Category</legend>
        <div
          className="grid grid-cols-2 gap-2"
          aria-describedby={describedBy("category")}
        >
          {CATEGORIES.map((category) => {
            const { icon: Icon, color } = CATEGORY_META[category];
            const selected = values.category === category;
            return (
              <label
                key={category}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent/40 ${
                  selected
                    ? "border-accent bg-accent-soft text-ink"
                    : errors.category
                      ? "border-bad/60 text-ink-2 hover:bg-surface-2"
                      : "border-line text-ink-2 hover:bg-surface-2"
                }`}
              >
                <input
                  id={category === CATEGORIES[0] ? "expense-category" : undefined}
                  type="radio"
                  name="category"
                  value={category}
                  checked={selected}
                  onChange={() => {
                    setTouched((prev) => ({ ...prev, category: true }));
                    setValues((prev) => ({ ...prev, category }));
                    setErrors((prev) => ({ ...prev, category: undefined }));
                  }}
                  className="sr-only"
                />
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                <span className="truncate font-medium">{category}</span>
              </label>
            );
          })}
        </div>
        <FieldError id="expense-category-error" message={errors.category} />
      </fieldset>

      <div>
        <div className="flex items-baseline justify-between">
          <label htmlFor="expense-description" className="label">
            Description
          </label>
          <span
            className={`text-xs tabular-nums ${values.description.length > MAX_DESCRIPTION ? "text-bad" : "text-muted"}`}
          >
            {values.description.length}/{MAX_DESCRIPTION}
          </span>
        </div>
        <input
          id="expense-description"
          autoComplete="off"
          placeholder="e.g. Weekly groceries"
          className={inputClass("description")}
          value={values.description}
          onChange={(e) => setField("description", e.target.value)}
          onBlur={() => blur("description")}
          aria-invalid={!!errors.description}
          aria-describedby={describedBy("description")}
        />
        <FieldError id="expense-description-error" message={errors.description} />
      </div>

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {initial ? "Save changes" : "Add expense"}
        </button>
      </div>
    </form>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1.5 text-xs font-medium text-bad" role="alert">
      {message}
    </p>
  );
}
