"use client";

import { Search, X } from "lucide-react";
import { todayISO } from "@/lib/dates";
import {
  countActiveFilters,
  DATE_PRESETS,
  DEFAULT_FILTERS,
  isCustomRangeInverted,
  SORT_OPTIONS,
  type DatePreset,
  type ExpenseFilters,
  type SortOrder,
} from "@/lib/filters";
import { CATEGORIES, type Category } from "@/lib/types";

interface ExpenseFiltersBarProps {
  filters: ExpenseFilters;
  onChange: (filters: ExpenseFilters) => void;
}

export function ExpenseFiltersBar({ filters, onChange }: ExpenseFiltersBarProps) {
  const set = <K extends keyof ExpenseFilters>(key: K, value: ExpenseFilters[K]) =>
    onChange({ ...filters, [key]: value });

  const active = countActiveFilters(filters);
  const inverted = isCustomRangeInverted(filters);

  return (
    <div className="card space-y-3 p-4">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            placeholder="Search description, category, or amount"
            aria-label="Search expenses"
            className="input pl-9"
            value={filters.search}
            onChange={(e) => set("search", e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 md:contents">
          <select
            aria-label="Filter by date"
            className="input md:w-40"
            value={filters.preset}
            onChange={(e) => set("preset", e.target.value as DatePreset)}
          >
            {DATE_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by category"
            className="input md:w-44"
            value={filters.category}
            onChange={(e) => set("category", e.target.value as Category | "all")}
          >
            <option value="all">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            aria-label="Sort by"
            className="input col-span-2 md:col-span-1 md:w-40"
            value={filters.sort}
            onChange={(e) => set("sort", e.target.value as SortOrder)}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filters.preset === "custom" && (
        <div className="flex flex-col gap-3 border-t border-line pt-3 sm:flex-row sm:items-end">
          <div className="sm:w-44">
            <label htmlFor="filter-from" className="mb-1 block text-xs font-medium text-ink-2">
              From
            </label>
            <input
              id="filter-from"
              type="date"
              className={`input ${inverted ? "input-error" : ""}`}
              value={filters.from}
              max={filters.to || todayISO()}
              onChange={(e) => set("from", e.target.value)}
            />
          </div>
          <div className="sm:w-44">
            <label htmlFor="filter-to" className="mb-1 block text-xs font-medium text-ink-2">
              To
            </label>
            <input
              id="filter-to"
              type="date"
              className={`input ${inverted ? "input-error" : ""}`}
              value={filters.to}
              min={filters.from || undefined}
              onChange={(e) => set("to", e.target.value)}
            />
          </div>
          {inverted && (
            <p className="text-xs font-medium text-bad sm:pb-2.5" role="alert">
              “From” must be on or before “To”.
            </p>
          )}
        </div>
      )}

      {active > 0 && (
        <div className="flex items-center justify-between border-t border-line pt-3 text-sm">
          <span className="text-ink-2">
            {active} filter{active === 1 ? "" : "s"} applied
          </span>
          <button
            type="button"
            className="btn-ghost -my-1 -mr-2 px-2 py-1"
            onClick={() => onChange({ ...DEFAULT_FILTERS, sort: filters.sort })}
          >
            <X className="h-4 w-4" aria-hidden />
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
