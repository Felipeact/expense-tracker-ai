"use client";

import { AlertTriangle, LayoutDashboard, ListOrdered, Plus, Wallet, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ExpensesProvider, useExpenses } from "@/hooks/useExpenses";
import { ExpenseDialogProvider, useExpenseDialog } from "./ExpenseDialogProvider";
import { ToastProvider } from "./ui/Toast";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/expenses", label: "Expenses", icon: ListOrdered },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <ExpensesProvider>
        <ExpenseDialogProvider>
          <div className="flex min-h-screen flex-col">
            <Header />
            <StorageErrorBanner />
            <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 sm:px-6 sm:pb-12 lg:pt-8">
              {children}
            </main>
            <MobileNav />
          </div>
        </ExpenseDialogProvider>
      </ExpensesProvider>
    </ToastProvider>
  );
}

function Header() {
  const pathname = usePathname();
  const { openAdd } = useExpenseDialog();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 font-semibold text-ink">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white">
            <Wallet className="h-4 w-4" aria-hidden />
          </span>
          <span className="text-base">Spendwise</span>
        </Link>

        <nav className="hidden items-center gap-1 sm:flex" aria-label="Main">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active ? "bg-surface-2 text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>

        <button type="button" onClick={openAdd} className="btn-primary ml-auto">
          <Plus className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">Add expense</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>
    </header>
  );
}

function MobileNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
    >
      <div className="grid grid-cols-2">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-1 py-2.5 text-xs font-medium ${
                active ? "text-accent-ink" : "text-ink-2"
              }`}
            >
              <Icon className="h-5 w-5" aria-hidden />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function StorageErrorBanner() {
  const { error, dismissError } = useExpenses();
  if (!error) return null;
  return (
    <div role="alert" className="border-b border-bad/30 bg-bad-soft">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 text-sm text-ink sm:px-6">
        <AlertTriangle className="h-4 w-4 shrink-0 text-bad" aria-hidden />
        <p className="flex-1">{error}</p>
        <button type="button" onClick={dismissError} className="icon-btn h-7 w-7" aria-label="Dismiss">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
