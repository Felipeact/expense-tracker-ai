# Spendwise — Personal Expense Tracker

Spendwise is a lightweight personal finance app for tracking spending habits, understanding category trends, and exporting filtered expense data. The app is built with Next.js, TypeScript, and Tailwind CSS, and it stores data in the browser using `localStorage` so it works without a backend.

## Why this project exists

This app helps you quickly answer questions like:

- How much did I spend this month?
- Which category is taking the biggest share of my budget?
- What were my latest transactions?
- Can I export the filtered list to CSV for analysis elsewhere?

## Features

- Add, edit, and delete expenses with validation
- Dashboard summaries for this month, last 90 days, this year, and all time
- Spending trends with category breakdowns
- Search, filtering, and sorting on the expense list
- CSV export for the current filtered data view
- Light and dark theme support
- Mobile-friendly navigation and responsive layout
- Undo support for recently deleted expenses
- Multi-tab storage sync through browser storage events
- Error states and loading skeletons for a better UX

## Tech stack

- Next.js 14 (App Router)
- React 18
- TypeScript
- Tailwind CSS
- Lucide icons

## Git branches

This repository includes multiple Git branches beyond the default branch:

- `main` — the main stable branch
- `feature-data-export-v1` — early export feature iteration
- `feature-data-export-v2` — second export feature iteration
- `feature-data-export-v3` — latest export-focused branch

You can compare them locally with commands like:

```bash
git checkout main
git checkout feature-data-export-v1
git checkout feature-data-export-v2
git checkout feature-data-export-v3
```

The default branch is `main`, but the feature branches are useful for reviewing alternative implementations and export-related work.

## Getting started

Requires Node.js 18.17 or later.

```bash
npm install
npm run dev
```

Then open http://localhost:3000 in your browser.

### Production build

```bash
npm run build
npm start
```

### Other scripts

```bash
npm run lint
npm run typecheck
```

## Project structure

```text
src/
  app/                  Routes for dashboard and expense pages
  components/           UI and app-specific components
    charts/             Trend and category visualizations
    dashboard/          Summary cards and dashboard widgets
    ui/                 Reusable UI primitives
  hooks/                Expense data hooks and client-side logic
  lib/                  Domain logic: analytics, filtering, dates, types, CSV, storage
```

## Data handling notes

- Dates are stored as local `YYYY-MM-DD` strings
- Monetary values are tracked in integer cents to avoid floating-point issues
- The app is intentionally client-side and browser-based, which keeps setup simple and fast

## Contributing

1. Create a feature branch from `main`
2. Make your changes
3. Run validation checks
4. Open a pull request for review

This project is simple to run locally and is a good fit for experimenting with UI behavior, analytics, and export flows without a backend.
