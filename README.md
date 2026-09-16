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
- **Export & Sync hub** (`/export`) — see below.
- **Themes and layout.** Light and dark mode follow your system setting. On mobile, navigation moves to a bottom bar.
- **Loading and errors.** Skeletons show while data loads. If storage is corrupted or full, a banner explains what happened, and each field shows its own validation error.
- **Multi-tab sync.** Changes made in one browser tab show up in your other open tabs.

## Export & Sync

`/export` treats getting data *out* of Spendwise as its own product surface, modelled on how a
cloud service handles connectivity rather than on a download button.

- **Destinations.** Nine connectors — a local Vault, Email, Google Sheets, Google Drive, Dropbox,
  OneDrive, Slack, Notion, and a generic Webhook — each with an OAuth-style consent screen listing
  its scopes, a simulated token lifetime, its own latency profile, and its own failure rate.
  **Every connector is a simulation.** No network request is made and no credentials are collected;
  the grant is recorded in `localStorage` so the whole flow is visible end to end.
- **Templates.** Five reports, each shaped for a specific reader: Tax Report, Monthly Summary,
  Category Analysis, Reimbursement Claim, and Raw Ledger. Every template compiles to the same
  sheet structure, and each format — CSV, JSON, NDJSON, Markdown, a print-ready HTML report, or a
  live spreadsheet — is rendered from that one structure, so the numbers cannot drift between them.
- **Background jobs.** Deliveries run through a real queue: three at a time, with `queued →
  authorizing → packaging → uploading → verifying` stages and live progress in a sync tray that
  follows you across pages. Jobs survive a reload, pause when the browser goes offline, resume when
  it comes back, and can be retried or cancelled.
- **Schedules.** Daily, weekly, or monthly rules with per-rule retention. Next-run time is anchored
  to the last run, so a rule that was due while the tab was closed is detected and runs as a
  labelled catch-up.
- **Drift tracking.** Each destination reports how many expenses have changed since it last received
  a copy, computed from expense timestamps rather than guessed.
- **Share links.** A report is encoded into the URL fragment itself and rendered by `/share`.
  Nothing is uploaded and no server is involved — the trade-off, stated in the UI, is that a link
  cannot be un-sent once shared. Links carry an expiry the viewer enforces.
- **QR codes.** `src/lib/cloud/qr.ts` is a dependency-free QR encoder (byte mode, versions 1–40,
  Reed–Solomon error correction, penalty-scored mask selection). A capacity meter shows the payload
  against the 2,953-byte QR ceiling, so you can see exactly when dropping transaction rows brings a
  link back within scanning range.

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
    cloud/              Export & Sync panels, connector cards, activity tray, QR rendering
    dashboard/          Stat cards
    ui/                 Modal, Toast, SegmentedControl, Skeleton
  hooks/                useExpenses (state + persistence), useCloud (connectors, jobs, schedules)
  lib/                  Pure logic: types, validation, filters, analytics, dates, CSV, storage
    cloud/              Destination catalog, templates, serializers, schedules, share links, QR
```

Routes: `/` dashboard, `/expenses` list, `/export` the sync hub, `/share` the public report viewer
(rendered without the app chrome, since it is a page strangers open).

Dates are stored as local `YYYY-MM-DD` strings, and totals are summed in integer cents. This avoids time-zone shifts and floating-point rounding errors.
