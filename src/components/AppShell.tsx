"use client";

import {
  AlertTriangle,
  CloudOff,
  CloudUpload,
  LayoutDashboard,
  ListOrdered,
  Plus,
  Wallet,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { CloudProvider, useCloud } from "@/hooks/useCloud";
import { ExpensesProvider, useExpenses } from "@/hooks/useExpenses";
import { ActivityTray } from "./cloud/ActivityTray";
import { StatusDot } from "./cloud/primitives";
import { ExpenseDialogProvider, useExpenseDialog } from "./ExpenseDialogProvider";
import { ToastProvider } from "./ui/Toast";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/expenses", label: "Expenses", icon: ListOrdered },
  { href: "/export", label: "Export", icon: CloudUpload },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // A shared report is a public page: no nav, no dialogs, none of the app chrome.
  if (pathname.startsWith("/share")) return <>{children}</>;

  return (
    <ToastProvider>
      <ExpensesProvider>
        <CloudProvider>
          <ExpenseDialogProvider>
            <div className="flex min-h-screen flex-col">
              <Header />
              <StorageErrorBanner />
              <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 sm:px-6 sm:pb-12 lg:pt-8">
                {children}
              </main>
              <ActivityTray />
              <MobileNav />
            </div>
          </ExpenseDialogProvider>
        </CloudProvider>
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

        <div className="ml-auto flex items-center gap-2">
          <SyncIndicator />
          <button type="button" onClick={openAdd} className="btn-primary">
            <Plus className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Add expense</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
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
      <div className="grid grid-cols-3">
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

/** Live sync state in the header, the way a desktop cloud client shows it. */
function SyncIndicator() {
  const { activeJobs, online, connections, ready } = useCloud();
  const pathname = usePathname();

  if (!ready || connections.length === 0 || pathname === "/export") return null;

  const busy = activeJobs.length > 0;
  return (
    <Link
      href="/export"
      title={busy ? `${activeJobs.length} export(s) running` : "Export & Sync"}
      className="hidden items-center gap-2 rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink sm:inline-flex"
    >
      {online ? (
        <>
          <StatusDot tone={busy ? "syncing" : "live"} />
          {busy ? `Syncing ${activeJobs.length}` : "Synced"}
        </>
      ) : (
        <>
          <CloudOff className="h-3.5 w-3.5 text-bad" aria-hidden />
          Offline
        </>
      )}
    </Link>
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
