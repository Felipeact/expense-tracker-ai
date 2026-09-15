"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { ExportDialog } from "./ExportDialog";
import type { ExportSeed } from "./useExportOptions";

interface ExportContextValue {
  /** Opens the export dialog, optionally pre-filled with a scope such as the current list filters. */
  openExport: (seed?: ExportSeed) => void;
}

const ExportContext = createContext<ExportContextValue | null>(null);

export function ExportProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ open: boolean; seed: ExportSeed }>({ open: false, seed: {} });

  const openExport = useCallback((seed: ExportSeed = {}) => setState({ open: true, seed }), []);
  const close = useCallback(() => setState((s) => ({ ...s, open: false })), []);
  const value = useMemo(() => ({ openExport }), [openExport]);

  return (
    <ExportContext.Provider value={value}>
      {children}
      <ExportDialog open={state.open} seed={state.seed} onClose={close} />
    </ExportContext.Provider>
  );
}

export function useExportDialog() {
  const context = useContext(ExportContext);
  if (!context) throw new Error("useExportDialog must be used within ExportProvider");
  return context;
}
