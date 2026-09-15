"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="card mx-auto mt-10 flex max-w-md flex-col items-center px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-bad-soft text-bad">
        <AlertTriangle className="h-6 w-6" aria-hidden />
      </span>
      <h1 className="mt-4 text-lg font-semibold text-ink">Something went wrong</h1>
      <p className="mt-1 text-sm text-ink-2">An unexpected error occurred. Your saved expenses are not affected.</p>
      <button type="button" className="btn-primary mt-6" onClick={reset}>
        <RotateCcw className="h-4 w-4" aria-hidden />
        Try again
      </button>
    </div>
  );
}
