# Spendwise — Expense Tracker

A personal expense tracker built with Next.js 14 (App Router), TypeScript, and Tailwind CSS. Data is stored in your browser's `localStorage`.

## Features

- **Add, edit, and delete expenses.** Each expense has a date, amount, category, and description. The form is validated, and a deleted expense can be restored with **Undo**.
- **Dashboard.** Pick a period (this month, last 90 days, this year, or all time) to see:
  - Total spent, compared with the previous period
  - Daily average, number of transactions, and top category
  - A chart of spending over time (daily, weekly, or monthly bars depending on the period), with hover and keyboard tooltips and a table view
  - A breakdown by category showing amounts and each category's share
  - Your 5 most recent expenses
- **Expense list.** Search it, filter by category or date (with presets or a custom range), and sort by date or amount.
- **CSV export** of the expenses currently shown in the list.
- **Themes and layout.** Light and dark mode follow your system setting. On mobile, navigation moves to a bottom bar.
- **Loading and errors.** Skeletons show while data loads. If storage is corrupted or full, a banner explains what happened, and each field shows its own validation error.
- **Multi-tab sync.** Changes made in one browser tab show up in your other open tabs.

## Getting started

Requires Node.js 18.17 or later.

```bash
npm install
npm run dev        # http://localhost:3000
```

For a production build:

```bash
npm run build
npm start
```

Other scripts: `npm run lint` and `npm run typecheck`.

## Project structure

```
src/
  app/                  Routes: dashboard (/), expenses (/expenses), error and 404 pages
  components/           UI: AppShell, ExpenseForm, ExpenseRow, filters, dialogs
    charts/             TrendChart, CategoryBreakdown (plain HTML/CSS, no chart library)
    dashboard/          Stat cards
    ui/                 Modal, Toast, SegmentedControl, Skeleton
  hooks/                useExpenses (state + persistence), useElementWidth
  lib/                  Pure logic: types, validation, filters, analytics, dates, CSV, storage
```

Dates are stored as local `YYYY-MM-DD` strings, and totals are summed in integer cents. This avoids time-zone shifts and floating-point rounding errors.
