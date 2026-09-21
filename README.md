# Spendwise — Personal Expense Tracker

Spendwise is a personal finance dashboard for tracking spending habits, reviewing category trends, and exporting filtered data when needed. The app is built with Next.js, TypeScript, and Tailwind CSS, and it keeps everything in the browser using `localStorage` so there is no backend setup required.

## Why this project exists

This project is designed to answer a few practical questions quickly:

- How much did I spend this month?
- Which category is taking the biggest share of my budget?
- What are my most recent transactions?
- Can I export my current filtered view for analysis elsewhere?

## Features

- Add, edit, and delete expenses with validation
- Dashboard summaries for this month, last 90 days, this year, and all time
- Spending trends with category breakdowns
- Search, filtering, and sorting on the expense list
- CSV export for the current filtered data view
- Light and dark mode support
- Mobile-friendly navigation and responsive layout
- Undo support for deleted expenses
- Multi-tab storage sync through browser storage events
- Error states and loading skeletons for smoother UX

## Tech stack

- Next.js 14 (App Router)
- React 18
- TypeScript
- Tailwind CSS
- Lucide icons

## Git branch overview

This repository contains multiple branch variants for the same app:

- `main` — the default production-ready branch
- `feature-data-export-v1` — first export-focused iteration
- `feature-data-export-v2` — export center improvements and refinement
- `feature-data-export-v3` — full export and sync experience with connectors and automation

## Getting started

Requires Node.js 18.17 or later.

```bash
npm install
npm run dev
```

Open http://localhost:3000 to view the app.

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
  app/                  Routes for dashboard and expenses
  components/           UI and feature-specific components
  hooks/                Data hooks and app logic
  lib/                  Analytics, validation, storage, and export helpers
```

## Data notes

- Dates are stored as local `YYYY-MM-DD` strings
- Monetary values are tracked in integer cents to avoid floating-point errors
- The app is intentionally browser-based for simplicity and portability

## Contributing

1. Start from `main`
2. Create a feature branch for your work
3. Run the validation scripts
4. Open a pull request when ready
