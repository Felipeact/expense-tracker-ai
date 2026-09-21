# Spendwise — Export & Sync Branch

This branch turns Spendwise into a full export-and-sync experience. Beyond standard expense tracking, it adds an export hub with destinations, schedules, share links, and background processing flows that simulate a more advanced data distribution system.

## Highlights

- Expense tracking, dashboard analytics, and category summaries
- Expense list filtering, search, and sorting
- CSV export for the active data view
- Export & Sync hub at `/export`
- Simulated connectors for destinations like Vault, Email, Google Sheets, Drive, Dropbox, OneDrive, Slack, Notion, and Webhook
- Report templates, scheduling, delivery jobs, share links, and QR code generation

## Feature focus

This branch expands the app from a simple tracker into an export platform simulation:

- destinations with simulated auth and scopes
- report templates for tax, summary, reimbursement, and ledger exports
- async delivery jobs with queue states and retry logic
- recurring schedules and drift tracking
- shareable URLs and QR-based report links

## Getting started

```bash
npm install
npm run dev
```

Then visit:

- http://localhost:3000 for the dashboard
- http://localhost:3000/export for the Export & Sync hub
- http://localhost:3000/share for report sharing demo output

## Branch purpose

`feature-data-export-v3` is the most advanced export branch in the repo and is intended to show the full product vision for exporting and distributing spend data.
