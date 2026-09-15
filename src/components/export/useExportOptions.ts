"use client";

import { useReducer } from "react";
import { suggestFilename } from "@/lib/export/filename";
import { DEFAULT_EXPORT_OPTIONS, loadPreferences } from "@/lib/export/preferences";
import { orderColumns, type ExportColumn, type ExportOptions } from "@/lib/export/types";
import { CATEGORIES, type Category } from "@/lib/types";

export type ExportSeed = Partial<Pick<ExportOptions, "from" | "to" | "categories" | "sort" | "format">>;

interface State {
  options: ExportOptions;
  /** Once the user types a filename we stop regenerating it from the filters. */
  filenameEdited: boolean;
}

type Action =
  | { type: "patch"; patch: Partial<Omit<ExportOptions, "filename" | "csv" | "json" | "pdf">> }
  | { type: "format-option"; format: "csv"; patch: Partial<ExportOptions["csv"]> }
  | { type: "format-option"; format: "json"; patch: Partial<ExportOptions["json"]> }
  | { type: "format-option"; format: "pdf"; patch: Partial<ExportOptions["pdf"]> }
  | { type: "toggle-category"; category: Category }
  | { type: "set-categories"; categories: Category[] }
  | { type: "toggle-column"; column: ExportColumn }
  | { type: "filename"; value: string }
  | { type: "reset-filename" };

function withSuggestedName(state: State): State {
  if (state.filenameEdited) return state;
  return { ...state, options: { ...state.options, filename: suggestFilename(state.options) } };
}

function reducer(state: State, action: Action): State {
  const { options } = state;
  switch (action.type) {
    case "patch":
      return withSuggestedName({ ...state, options: { ...options, ...action.patch } });
    case "format-option":
      return {
        ...state,
        options: { ...options, [action.format]: { ...options[action.format], ...action.patch } },
      };
    case "toggle-category": {
      const has = options.categories.includes(action.category);
      const categories = CATEGORIES.filter((c) => (c === action.category ? !has : options.categories.includes(c)));
      return withSuggestedName({ ...state, options: { ...options, categories } });
    }
    case "set-categories":
      return withSuggestedName({ ...state, options: { ...options, categories: action.categories } });
    case "toggle-column": {
      const has = options.columns.includes(action.column);
      const columns = has
        ? options.columns.filter((c) => c !== action.column)
        : orderColumns([...options.columns, action.column]);
      return { ...state, options: { ...options, columns } };
    }
    case "filename":
      return { filenameEdited: action.value.trim() !== "", options: { ...options, filename: action.value } };
    case "reset-filename":
      return withSuggestedName({ ...state, filenameEdited: false });
  }
}

function init(seed: ExportSeed): State {
  const options: ExportOptions = { ...DEFAULT_EXPORT_OPTIONS, ...loadPreferences(), ...seed };
  return withSuggestedName({ options, filenameEdited: false });
}

export function useExportOptions(seed: ExportSeed) {
  const [state, dispatch] = useReducer(reducer, seed, init);
  return { ...state, dispatch };
}

export type ExportDispatch = ReturnType<typeof useExportOptions>["dispatch"];
