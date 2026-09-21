# Spendwise — Export Center Branch

This branch improves the export experience by making it feel like a dedicated export center rather than a one-off button. The app still includes the full expense tracker, but the export flow is more polished and more aware of the current view.

## Highlights

- Expense tracking with validation and undo support
- Dashboard trends, totals, and category breakdowns
- Search, date filtering, category filtering, and sorting
- Export center that starts from the current expense view
- Cleaner, more focused export behavior for the active dataset

## Feature focus

This version adds more deliberate export UX:

- the export action is accessible from the main expense flow
- the export is based on the current list state
- filters such as date range, category, and sort context are respected
- the branch reflects a refinement of the original export concept

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000 to begin interacting with the app.

## Notes

This branch is useful for comparing how export flow evolves from a basic CSV button into a more feature-rich center.
