# Spendwise — CSV Export Branch

This branch focuses on the first export iteration for Spendwise. The app keeps its core expense tracking features, while adding a clearer export flow so users can send their current filtered data out of the app.

## Highlights

- Add, edit, and delete expenses
- Dashboard summaries and category insights
- Search, filter, and sort the expense list
- Export the current list to CSV
- Responsive layout and local storage persistence

## Feature focus

The main value of this branch is the export workflow:

- users can export the list they are currently viewing
- export respects the current filters and selected view
- CSV output is designed for quick spreadsheet analysis or sharing

## Getting started

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Typical workflow

1. Open the dashboard or expense list
2. Apply filters or sorting
3. Use the export action to generate CSV output
4. Open the file in Excel, Google Sheets, or another spreadsheet tool

## Branch purpose

This is the earliest export-focused branch in the repo and serves as a baseline for later export enhancements.
