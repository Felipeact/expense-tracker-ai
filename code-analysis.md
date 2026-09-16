# Data Export: Code Analysis of v1, v2 and v3

A technical comparison of the three data-export branches of the Spendwise expense tracker.

| Branch | Commit(s) | Theme |
|---|---|---|
| `feature-data-export-v1` | `d2d0fa2` | One-button CSV export |
| `feature-data-export-v2` | `92669bc`, `ae29745` | Export center: CSV / JSON / PDF with filtering and preview |
| `feature-data-export-v3` | `4ab0fb0` | "Export & Sync" hub: connectors, templates, jobs, schedules, share links, QR |

All three branch from `main` (`c9a6f28`).

---

## 0. How this analysis was done

For each branch I did the following:

1. Checked out the branch and read every file it adds or changes against `main` (`git diff main...<branch>`).
2. Ran `tsc --noEmit` and `next lint`.
3. Compiled the branch's pure export modules with `tsc` into a scratch folder and ran them in Node with made-up data, so behaviour claims below were **observed**, not guessed from reading.

| Check | v1 | v2 | v3 |
|---|---|---|---|
| `tsc --noEmit` (source) | ✅ clean | ✅ clean | ✅ clean |
| `next lint` | ✅ clean | ✅ clean | ✅ clean |
| New npm dependencies | none | none | none |
| Test files committed | none | none | none (the commit message mentions "90+ assertions", but no test files or test script are in the repo) |
| Runtime smoke test | n/a (trivial) | CSV/JSON/PDF with 5,000 rows, cancellation, CSV injection, file-name cleanup | 5 templates × 5 formats with 3,000 rows, share-link round trip and tampering, QR encoder, schedule maths |

**Important baseline fact:** `main` *already* has a CSV export. `src/app/expenses/page.tsx` has an "Export CSV" button that exports the currently filtered list through `src/lib/csv.ts`, with formula-injection escaping, a UTF-8 BOM and success/error toasts. Each branch should be judged as a change to that baseline.

---

## 1. Version 1: One-button CSV export

### 1.1 Files created or changed

| File | Change |
|---|---|
| `src/app/page.tsx` | Adds an "Export Data" button next to the period selector on the Dashboard (+13 / −6) |
| `src/lib/csv.ts` | Reorders the CSV columns from `Date, Description, Category, Amount` to `Date, Category, Amount, Description` (+2 / −2) |

Total: **2 files, +16 / −9 lines.** No new files.

### 1.2 Architecture overview

v1 has no new architecture. It adds a second entry point to the existing `downloadCsv()` helper from `main`:

```
Dashboard (page.tsx) ──onClick──> downloadCsv(expenses)   [src/lib/csv.ts]
                                    ├─ expensesToCsv()  → string
                                    └─ Blob + <a download> click
```

### 1.3 Key components and responsibilities

- **`DashboardPage`**: renders the button only when `expenses.length > 0`, and passes the **whole, unfiltered** `expenses` array from `useExpenses()`.
- **`expensesToCsv`**: header plus rows, each cell passed through `escapeCell`, joined with CRLF.
- **`downloadCsv`**: wraps the text in a `Blob` with a BOM, creates an object URL, clicks a temporary `<a download>`, then revokes the URL.

### 1.4 Libraries and dependencies

Only what the app already uses: `lucide-react` for the `Download` icon and browser APIs (`Blob`, `URL.createObjectURL`).

### 1.5 Patterns and approach

- Direct call from the event handler. No state, hooks or abstraction.
- Reuses the existing pure serializer.

### 1.6 Code complexity

Minimal. Cyclomatic complexity is essentially 1, and a reviewer can understand the change in under a minute.

### 1.7 Error handling

- **None at the new call site.** The handler is `onClick={() => downloadCsv(expenses)}` (`src/app/page.tsx:56`). The Expenses page on `main` wraps the same call in `try/catch` with success and error toasts, but the Dashboard button does neither. A failure is silent, and so is a success.
- Empty data is handled by hiding the button.

### 1.8 Security

- Inherits `escapeCell`'s formula-injection guard: text cells starting with `= + - @ \t \r` get a `'` prefix. Amounts are formatted strings, so a negative amount such as `-5.00` would also get the prefix. That's cosmetic, and today amounts are always positive.
- Everything happens in the browser. No data leaves the device.

### 1.9 Performance

- Synchronous string build on the main thread. That's fine for thousands of rows, and at hundreds of thousands the page would stutter briefly.
- `URL.revokeObjectURL` runs right after `click()` (`src/lib/csv.ts:27`). Most browsers handle this, but revoking on a later tick is safer, and v2 does that.

### 1.10 Extensibility and maintainability

- Easy to maintain because there's so little code, and there's nothing to extend.
- **Side effect:** the column reorder in `expensesToCsv` also changes the file produced by the existing Expenses-page export. Anyone who relies on the old column order (spreadsheets, scripts) is affected without warning.
- Two export buttons now behave differently: the Dashboard exports **all** expenses, while the Expenses page exports the **filtered** view. Neither label says which.

### 1.11 Technical deep dive

| Question | Answer |
|---|---|
| How does export work? | Array → CSV string → `Blob` → object URL → hidden `<a download>` click |
| File generation | String concatenation. `﻿` BOM so Excel reads UTF-8. `text/csv;charset=utf-8` |
| User interaction | One click, no options, no feedback |
| State management | None. Reads `useExpenses()` context |
| Row order | Storage order (newest *added* first), **not** date-sorted, and ignores the Dashboard's selected period |
| Edge cases | Empty list hides the button. Commas, quotes and newlines are quoted. Formula prefixes escaped. File name is `expenses-YYYY-MM-DD.csv` |

---

## 2. Version 2: Advanced export center (CSV / JSON / PDF)

### 2.1 Files created or changed

**New: `src/lib/export/` (pure logic, no React)**

| File | LOC | Responsibility |
|---|---|---|
| `types.ts` | 78 | `ExportOptions`, `ExportSelection`, `ExportContext`, `ExportFormatDefinition` contracts |
| `formats.ts` | 10 | Registry mapping `csv/json/pdf` to builders |
| `select.ts` | 82 | Filter and sort records, summary stats, validation (`findExportIssue`), date presets |
| `csv.ts` | 42 | CSV builder with configurable delimiter and header, plus injection guard |
| `json.ts` | 44 | JSON builder: bare array, or envelope with `schemaVersion`, filters and summary |
| `pdf/document.ts` | 125 | Minimal PDF 1.4 writer (objects, xref table, content streams) |
| `pdf/fonts.ts` | 85 | Helvetica AFM widths, WinAnsi encoding, text measuring and truncation |
| `pdf/report.ts` | 259 | Report layout: pagination plan, summary tiles, category bars, table, totals, footers |
| `filename.ts` | 41 | Cross-OS file-name cleanup and suggested names |
| `describe.ts` | 24 | Human-readable range and category labels |
| `preferences.ts` | 60 | Defaults, plus localStorage preferences validated field by field |
| `run.ts` | 80 | Orchestrator: stages, progress, cancellation, minimum duration, download |

**New: `src/components/export/` (UI)**

| File | LOC | Responsibility |
|---|---|---|
| `ExportProvider.tsx` | 33 | Context with `openExport(seed?)`. Mounts the dialog once, app-wide |
| `useExportOptions.ts` | 74 | `useReducer` state machine for options, with automatic file naming |
| `ExportDialog.tsx` | 218 | Workspace: settings and preview, progress footer, run and cancel |
| `ExportSettings.tsx` | 391 | Format cards, format options, date presets and range, categories with counts, columns, sort, file name |
| `ExportPreview.tsx` | 297 | Stats strip, category share bar, table / exact-file / PDF page-layout previews |

**Changed**

| File | Change |
|---|---|
| `src/components/AppShell.tsx` | Wraps the app in `ExportProvider`. Adds a header "Export" button |
| `src/app/expenses/page.tsx` | Replaces the direct CSV download with "Export view…", which opens the dialog pre-filled with the list's filters |
| `src/components/ui/Modal.tsx` | Adds `size="xl"` and `flush` props (backward-compatible) |
| `src/lib/filters.ts` | Pulls `sortExpenses()` out of `applyFilters()` so both can reuse it |
| `src/lib/csv.ts` | **Deleted**, replaced by `src/lib/export/csv.ts` |
| `README.md` | Documents the feature and the new folders |

Total: **23 files, +2,020 / −64 lines.**

### 2.2 Architecture overview

v2 has a clean **two-layer split**: pure, framework-free export logic in `lib/export`, and a React UI in `components/export` that only calls into it.

```
AppShell
 └─ ExportProvider  (context: openExport(seed))
     └─ ExportDialog (Modal xl)
         └─ ExportWorkspace
             ├─ useExportOptions(seed)  ← useReducer; init merges DEFAULTS ← saved prefs ← seed
             ├─ selectForExport(expenses, options)            → { rows, summary }
             ├─ useDeferredValue(options) → preview selection  (keeps typing responsive)
             ├─ ExportSettings  (dispatch actions)
             ├─ ExportPreview   (table | exact file text | PDF page plan)
             └─ startExport → runExport(options, selection, {signal, onProgress})
                                 └─ EXPORT_FORMATS[format].build(ctx) → Blob
                                        csv.ts | json.ts | pdf/report.ts → pdf/document.ts
                                 └─ downloadBlob(blob, resolveFilename(...))
```

It uses a **strategy / registry pattern**. Every format implements `ExportFormatDefinition.build(ctx): Promise<Blob>` and receives the same `ExportContext` (`options`, `selection`, `generatedAt`, `onProgress`, `checkpoint`). Adding a format means adding a builder and one registry entry.

### 2.3 Key components and responsibilities

- **`runExport`** (`run.ts`): the only place with side effects. It reports stages (`preparing → generating → saving`), runs `checkpoint()` (yield with `setTimeout(0)`, then throw `ExportCancelledError` if aborted), waits for a **600 ms minimum duration** so progress doesn't just flash, and accepts an injectable `save` function, which makes it testable.
- **`selectForExport` / `summarizeRows`**: filter by category set and inclusive ISO date bounds, sort, then compute count, total (in integer cents through the existing `sum`), average, first and last date, and totals by category.
- **`findExportIssue`**: returns the first blocking problem (`invalid-range`, `no-categories`, `no-columns`, `no-records`). The UI uses it both for the disabled button and for inline messages.
- **PDF writer** (`pdf/document.ts`): writes PDF objects by hand. It uses the built-in Type 1 fonts (Helvetica and Helvetica-Bold), so no fonts are embedded, and records exact byte offsets for the xref table. It relies on every character being one byte, which it guarantees by escaping bytes above 126 as octal.
- **`planReport`**: works out pagination up front (row capacity per page for portrait or landscape, with or without the breakdown), and moves one row to a new page if the "Total" row would otherwise be stranded. The preview reuses it to show page thumbnails.
- **`useExportOptions`**: a reducer with typed actions (`patch`, `format-option`, `toggle-category`, `toggle-column`, `filename`, `reset-filename`…). Once the user types a file name, the automatic name stops tracking the filters.

### 2.4 Libraries and dependencies

- **No new dependencies.** The PDF generator, font metrics and WinAnsi encoder are written in-house (about 470 LOC).
- React 18 features: `useReducer`, `useDeferredValue`, `useId`, context.
- Browser: `AbortController`, `Blob`, `Intl.DateTimeFormat`, `localStorage`.

### 2.5 Patterns and approach

- Pure-core / thin-shell layering, with the format registry as a strategy pattern.
- Cooperative multitasking: builders yield every 500 CSV rows or 200 PDF rows through `checkpoint()`, which also makes cancellation possible.
- The file preview renders the **real output** by calling the same builder on the first 25 rows, so the preview can't drift from the download.
- Defensive loading of preferences: each field is checked against an allow-list.
- Accessibility: radio group for formats, `aria-pressed` toggles, `role="progressbar"` with values, `aria-live` status, `aria-invalid` and `aria-describedby` on invalid dates, and a focus trap inherited from `Modal`.

### 2.6 Code complexity

**Moderate.** About 1,900 new LOC across 17 new files. The largest files are UI (`ExportSettings.tsx` at 391 lines and `ExportPreview.tsx` at 297). The hardest part is the PDF writer and layout (about 470 LOC), which needs PDF-spec knowledge to change safely. Everything else is ordinary React and data code, and modules are small and focused.

### 2.7 Error handling

| Case | Handling |
|---|---|
| Invalid date range, no categories, no columns, no matches | Detected before export. Button disabled, inline message, preview explains why |
| Build or download throws | Caught in `startExport`. Logged with `console.error`. Footer shows "Export failed. Please try again." (`role="alert"`) and the dialog stays open |
| User cancels | `AbortController` → `ExportCancelledError` → "Export cancelled. Nothing was downloaded." |
| Dialog closed mid-export | Unmount effect aborts, so no download appears later |
| Corrupt or old saved preferences | Validated field by field, falling back to defaults. `try/catch` around storage |
| Bad file names | `sanitizeFilename` strips `<>:"/\|?*` and control characters, collapses whitespace, trims trailing dots and spaces (Windows), limits length to 80, strips a duplicate extension, and falls back to the suggested name |
| Characters that can't be encoded in the PDF | Accents are removed where possible (`ő → o`), otherwise replaced with `?` |
| Gaps | The `FileOutput` preview promise has no `.catch` (`ExportPreview.tsx:217`), so a builder error during preview would be an unhandled rejection. Success is reported by toast after the dialog closes |

### 2.8 Security

- **CSV injection:** the guard is improved. It respects the chosen delimiter when quoting, and doesn't add a `'` to plain numeric strings like `-12.5`. Verified: `=HYPERLINK("x")` → `'=HYPERLINK(""x"")`, `+1+cmd` → `'+1+cmd`, `a;b` gets quoted when `;` is the delimiter.
- **PDF injection:** text goes through `pdfString()`, which escapes `(`, `)` and `\`, and writes bytes above 126 as octal, so user text can't break out of a string object. No JavaScript or actions are written into the PDF.
- **File names:** cleaned up for every OS (see above).
- **Privacy:** fully local. Nothing is sent over the network, and only formatting preferences go to localStorage (no data).

### 2.9 Performance

Observed in Node with 5,000 records:

| Format | Size | Wall time |
|---|---|---|
| CSV | 259 KB | 601 ms (at the 600 ms minimum) |
| JSON | 699 KB | 601 ms (at the 600 ms minimum) |
| PDF | 1.71 MB, **140 pages**, valid xref offsets | 601 ms (at the 600 ms minimum) |

Notes:

- Real generation time is well under the artificial 600 ms minimum (`run.ts:26`) for realistic datasets, so **every export takes at least 0.6 s on purpose**. Drop or lower the minimum if speed matters more than polish.
- Selection runs up to three times per settings change (live options, deferred preview, category counts), each O(n log n). Fine at personal-finance scale.
- The PDF is assembled by string concatenation, so memory grows linearly (about 340 bytes per row).
- The preview caps its table at 100 rows and file text at 25 rows. The PDF page-layout view renders one thumbnail per page with up to 40 divs each, so very large exports produce a heavy DOM there (140 thumbnails at 5,000 rows).
- All work runs on the main thread, with yields for responsiveness. There's no Web Worker.

### 2.10 Extensibility and maintainability

**Strengths**
- Pure modules with explicit types are easy to unit-test (`runExport` already accepts an injectable `save`).
- A new format means a new builder and one registry entry, and it automatically gets progress, cancellation, naming and preview.
- The JSON envelope has a `schemaVersion` for future compatibility.
- The Modal extension is backward-compatible.

**Risks**
- The custom PDF engine is a long-term maintenance cost. It only supports **WinAnsi (Latin-1 plus some punctuation)**, so Cyrillic, Greek, CJK and emoji become `?` (`fonts.ts:50`). Supporting them means embedding TrueType fonts, a big step up in complexity, or adopting a library.
- PDF category colours are copied from `globals.css` as RGB constants and can drift from the stylesheet.
- No tests are committed for any of the pure modules, even though they're ideal candidates.
- `src/lib/csv.ts` is deleted. Harmless inside this branch, but it conflicts with v3, which imports `escapeCell` from it.

### 2.11 Technical deep dive

| Question | Answer |
|---|---|
| How does export work? | `ExportWorkspace` builds the `selection` from options and calls `runExport`, which picks the format strategy. `build(ctx)` yields and reports progress, returns a `Blob`, and `downloadBlob` saves it with a cleaned file name. Object URL revoked after 1 s |
| File generation | **CSV:** array of lines, delimiter-aware escaping, BOM. **JSON:** records trimmed to the chosen columns, optional metadata envelope, optional pretty-printing. **PDF:** hand-written PDF 1.4, a layout plan computed first, vector rectangles and lines, Helvetica text measured with AFM widths for right alignment and ellipsis truncation, "Page X of Y" footers |
| User interaction | Opened from the header (all data) or the Expenses page ("Export view…", pre-filled with date range, category and sort). Two panes: settings on the left, live preview on the right (Table / exact CSV·JSON output / PDF page layout). Footer shows count, total and the final file name, or a progress bar with Cancel |
| State management | Global context for open/close plus seed. Local `useReducer` for options. `useDeferredValue` for the preview. `useRef<AbortController>` for cancellation. Preferences (format, columns, sort, format options) saved to localStorage **only after a successful export**. Scope and file name are fresh each time |
| Edge cases | Inverted range (native `min`/`max` plus validation). Empty selection. All columns off. Very long descriptions truncated in the PDF. Total row never alone on a page. Tab delimiter shown as `→` in the preview. Relative presets become concrete dates. **Gap:** the Expenses page search text is **not** carried into the dialog (`expenses/page.tsx:43`, noted in a code comment), so "Export view…" can export more rows than the list shows while a search is active |

---

## 3. Version 3: Cloud "Export & Sync" hub

### 3.1 Files created or changed

**New routes**

| File | LOC | Responsibility |
|---|---|---|
| `src/app/export/page.tsx` | 120 | Hub page with 6 tabs (Overview, Destinations, Templates, Schedules, Share, History). Active tab kept in the URL hash |
| `src/app/export/layout.tsx` | 10 | Route metadata |
| `src/app/share/page.tsx` | 212 | Public viewer that decodes a report from the URL fragment, with no app chrome |

**New logic: `src/lib/cloud/`**

| File | LOC | Responsibility |
|---|---|---|
| `types.ts` | 176 | Connection, ExportJob, HistoryEntry, ScheduleRule, ShareLink, SharePayload, CloudState |
| `destinations.ts` | 226 | 9 connector definitions (scopes, formats, simulated latency and failure rate), format MIME table |
| `templates.ts` | 459 | 5 report templates compiled into a shared multi-sheet structure |
| `serialize.ts` | 249 | CSV (multi-sheet), JSON, NDJSON, Markdown, standalone HTML report, download helper |
| `schedule.ts` | 93 | Next-run calculation (daily, weekly, monthly), relative-time formatting |
| `share.ts` | 120 | Base64url payload in the URL fragment, token, expiry |
| `qr.ts` | 439 | QR encoder written in-house (byte mode, versions 1–40, Reed–Solomon, mask scoring) |
| `store.ts` | 65 | localStorage persistence, FNV-1a data fingerprint, change detection |

**New state: `src/hooks/useCloud.tsx` (803 LOC)**. A `CloudProvider` context holding connections, the job queue engine, the scheduler, sharing and demo seeding.

**New UI: `src/components/cloud/`**

| File | LOC | Responsibility |
|---|---|---|
| `OverviewPanel.tsx` | 298 | Health headline, drift, expired grants, overdue rules, vault meter, demo seeding |
| `DestinationsPanel.tsx` | 174 | Connector cards: connect, export now, reauthorize, disconnect |
| `ConnectDialog.tsx` | 137 | Simulated OAuth consent screen (clearly labelled as simulated) |
| `RunDialog.tsx` | 367 | Pick template and format, email recipients, preview of what each destination receives |
| `TemplatesPanel.tsx` | 219 | Template gallery, sheet-grid and raw-output preview, print through an iframe |
| `SchedulesPanel.tsx` | 331 | Rule list and editor (frequency, weekday or day, hour, retention) |
| `SharePanel.tsx` | 305 | Link generator, QR code, capacity meter, link list with "revoke" |
| `HistoryPanel.tsx` | 173 | Delivery log grouped by day, download again, run again |
| `ActivityTray.tsx` | 144 | Floating job tray on every page (progress, retry, cancel, download) |
| `QRCode.tsx` | 60 | Renders a QR matrix as SVG `<rect>`s |
| `primitives.tsx` | 233 | Pills, status dots, progress bar, copy button, sheet grid, fields |
| `tabs.ts` | 16 | Tab definitions |

**Changed**

| File | Change |
|---|---|
| `src/components/AppShell.tsx` | Adds `CloudProvider`, an "Export" nav item, a header `SyncIndicator` and `ActivityTray`. **Skips all providers and chrome on `/share`** |
| `src/lib/csv.ts` | Exports `escapeCell` for reuse (the original Expenses-page CSV export is kept) |
| `README.md` | Documents the hub, with an explicit "every connector is a simulation" statement |

Total: **27 files, +5,538 / −19 lines** (about 5,070 LOC in the cloud modules alone).

### 3.2 Architecture overview

v3 is a **product area**, not just an export feature. At its centre is one large context provider that runs a timer-driven job engine:

```
AppShell
 ├─ (pathname starts with /share) → bare page, no providers
 └─ ToastProvider > ExpensesProvider > CloudProvider > ExpenseDialogProvider
       │
       ├─ CloudProvider (useCloud.tsx)
       │    state: { connections, jobs, history, schedules, shares }  ⇄ localStorage "expense-tracker:cloud:v3"
       │    ├─ Job engine: setInterval 250 ms
       │    │    queued → authorizing → packaging → uploading → verifying → done | failed
       │    │    (progress = elapsed / simulated duration; 3 concurrent; offline ⇒ pause)
       │    │    finishJob: random failure by destination.flakiness, history + retention, toast
       │    ├─ Scheduler: setInterval 15 s → nextRunFor(rule) <= now → enqueue (schedule | catch-up)
       │    ├─ enqueue: compileTemplate → serialize → payloadCache (in memory) → job
       │    └─ createShare: compileTemplate → buildSharePayload → base64url → /share#t=…&p=…
       │
       ├─ Header SyncIndicator, ActivityTray   (visible on every page)
       └─ /export page → 6 panels (all read useCloud())

compileTemplate(templateId, expenses) → CompiledExport { title, range, summary, sheets[] }
      └─ serialize(compiled, format) → csv | json | ndjson | markdown | html  ("sheet" = csv)

/share page → parseShareHash(location.hash) → decodeShare → render report (+ "Save as CSV")
```

### 3.3 Key components and responsibilities

- **Templates** (`templates.ts`): each template fixes its own **date scope** (Tax = year to date, Monthly = last complete month, Category = last 90 days, Reimbursement = last 30 days, Raw Ledger = all). It produces named sheets with columns, rows, currency column indices and notes. Every format renders from this one structure, which is a good design choice because it keeps all formats consistent.
- **Serializers** (`serialize.ts`): multi-sheet CSV uses `# Sheet name` marker rows. JSON uses row objects keyed by column. NDJSON puts one line per row with `_sheet`. Markdown builds pipe tables. HTML is a full standalone document with print CSS and escaped content.
- **Job engine** (`useCloud.tsx:276-332`): a real queue with limited concurrency, but the "work" is **simulated**. Progress grows with elapsed time against a random duration. Success or failure is `Math.random() < flakiness` (`useCloud.tsx:203`).
- **Scheduler** (`schedule.ts`, `useCloud.tsx:542-564`): the next run is anchored to `lastRunAt`, so a rule missed while the tab was closed fires on the next visit and is labelled "catch-up" when more than 2 h late. Runs only while a tab is open.
- **Sharing** (`share.ts`, `/share`): the whole report (title, totals, categories, optionally up to 200 rows) is JSON → base64url inside the URL **fragment**, so it's never sent to a server.
- **QR encoder** (`qr.ts`): follows ISO/IEC 18004 (Reed–Solomon over GF(2⁸), block interleaving, 8 masks scored by penalty). It chose version 40-L for a 2,900-byte URL in 42 ms in Node, and the capacity constant matches the spec (2,953 bytes).

### 3.4 Libraries and dependencies

- **No new dependencies.** QR, base64url, FNV-1a hashing, the HTML report and scheduling are all written in-house.
- Browser: `localStorage`, `navigator.onLine` with `online`/`offline` events, `navigator.clipboard`, `TextEncoder`/`TextDecoder`, `btoa`/`atob`, `crypto.getRandomValues`, iframe `srcdoc` printing.

### 3.5 Patterns and approach

- **A single large provider** (803 lines) that owns every piece of state and every action, exposing more than 30 members through one memoized context value.
- A `useRef` mirror of state (`stateRef`) so timer callbacks and actions read the latest state synchronously. This matches `useExpenses`.
- A timer-driven state machine for jobs, and polling for schedules.
- Separate compile and serialize steps (intermediate representation → renderers).
- Simulation-first design: latency, token expiry, flaky failures, OAuth consent and "what the destination receives" previews are all made up. **Nothing is sent over the network.** I grepped for `fetch`, `XMLHttpRequest` and `sendBeacon` and found none.

### 3.6 Code complexity

**High.** About 5,000 LOC, which is 2.6× v2 and roughly 300× v1. The core complexity is in:

- `useCloud.tsx` (803 LOC): concurrency, persistence, retention, the scheduler, drift tracking and toasts in one file. It's the hardest file to change safely.
- `qr.ts` (439 LOC): tables and algorithms that need spec knowledge to verify.
- `templates.ts` (459 LOC): five hand-built reports.
- Many UI states per screen (connected, expired, syncing, drift, offline, paused, overdue, revoked…).

### 3.7 Error handling

| Case | Handling |
|---|---|
| Corrupt cloud state in storage | `loadCloudState` falls back to empty state. **Only checks that each collection is an array**, not the shape of its elements. An entry with an unknown `destinationId` would make `destination()` throw during render. `ActivityTray` is inside `AppShell`, so that would break **every page**, not just `/export` |
| Storage quota or private mode | Save errors are ignored ("session keeps working") |
| Simulated delivery failure | Job marked `failed` with a random fake error message such as "Upstream returned 503", error toast, retry button |
| Offline | Active jobs move to `offline` and resume from their paused stage when back online. There's no real network work, so this is cosmetic |
| Share link invalid or expired | `/share` shows "nothing to show" or "expired" notices |
| Share payload malformed but valid JSON | **Not handled.** `decodeShare` only checks `v`, `t` and `c`. A payload without `s` makes `const [total, count, average] = payload.s` (`share/page.tsx:97`) throw. Verified: `{v:1,t:"x",c:[]}` passes the check. Non-number amounts crash `row[3].toFixed` (`:102`) |
| Clipboard denied | Caught and ignored. The field stays selectable |
| Connector not connected | `enqueue` returns `null` (`useCloud.tsx:340`). **Callers ignore the `null`**: `RunDialog.submit` closes as if it worked, and the scheduler retries silently every 15 s |
| **Expired access grant** | **Not enforced.** `enqueue` checks only that a connection exists, not `expiresAt`. The "Export now" button is disabled when expired, but "Run again" in History (`HistoryPanel.tsx:154`, checks `connected` only) and scheduled runs still go through and succeed. The UI says the opposite: "Scheduled runs to this destination will keep failing until it is renewed" (`DestinationsPanel.tsx:125`) |

### 3.8 Security and privacy

1. **Share-link expiry can be edited by whoever holds the link.** Expiry is a field (`x`) inside an unsigned payload, checked by the viewer. Verified: decoding, setting `x: 0` and re-encoding gives a link that never expires.
2. **"Revoke" doesn't revoke.** It only flags the link in the creator's localStorage. The UI does admit this ("revoking only removes it from your list"), but the word "Revoke" and the "Revoked" pill still imply more than that.
3. **Anyone can forge a branded report.** `/share` renders any well-formed payload under the Spendwise header and a "never uploaded… nothing recorded" footer. Verified: a tampered link showing the title "URGENT: verify your bank account at evil.example" decodes and renders. React escaping prevents XSS, but this is a content-spoofing and phishing risk if the app is hosted on a trusted domain.
4. **Financial data in URLs.** With rows included, up to 200 transactions (descriptions, amounts, dates) sit in the URL. Fragments aren't sent to servers, but URLs end up in browser history, synced history, chat logs, screenshots and QR-scanner apps. The full URLs are also stored in localStorage (`shares[].url`).
5. **Misleading security claims in the UI:**
   - Vault tagline: "**Encrypted-at-rest** backups in your own browser storage". There is no encryption, and the vault **stores no data at all**: payloads live only in an in-memory `Map` (`payloadCache`), and history keeps just byte counts.
   - Vault scope: "Restore from a snapshot". **No restore feature exists** (grep finds no restore code).
   - Overview headline "**Everything is backed up**" (`OverviewPanel.tsx:53`) can appear when nothing is stored anywhere. A user who trusts it and then clears browser data loses everything.
   - Webhook: "Signed POST with an idempotency key; non-2xx responses are retried". Nothing is signed or sent.
6. **Consent screens look like real providers.** Labels like "Continue with Google" and "Sign in with Microsoft" with scope lists. They're clearly marked "Simulated connection", and no credentials are collected, but they train users to accept consent screens without reading them.
7. **Print iframe has no sandbox.** `frame.srcdoc = html` (`TemplatesPanel.tsx:47`) loads same-origin HTML without a `sandbox` attribute. Content is escaped, so it's safe today, but this is a missing extra layer of protection.
8. CSV injection guard reused (`escapeCell`). HTML report escapes `& < > "`, and Markdown escapes `|`.

### 3.9 Performance

Observed in Node with 3,000 records:

| Template | Compile | Rows | Largest output |
|---|---|---|---|
| Tax Report | 3 ms | 3,010 | HTML 322 KB / 77 ms |
| Category Analysis | 3 ms | 2,712 | HTML 250 KB / 66 ms |
| Raw Ledger | 1 ms | 3,000 | JSON 828 KB / 3 ms |

Main-thread and rendering concerns:

- **The context re-renders four times a second while any job runs.** Each tick replaces `state`, so the memoized context value is rebuilt, and that rebuild runs `fingerprint(expenses)` (`useCloud.tsx:740`): map, **sort** and join all expense IDs, O(n log n), every 250 ms. Every `useCloud()` consumer re-renders, including the header, the tray and whichever `/export` panel is open.
- **QR rendering:** a version-40 code has about 15,800 dark modules, each rendered as its own React `<rect>` (`QRCode.tsx:55`). On the Share tab, the QR is re-encoded (8 mask passes with penalty scoring) and re-rendered whenever a setting changes. A single-`<path>` renderer already exists (`qrToSvg`) but isn't used for display.
- `enqueue`, `RunDialog`, `TemplatesPanel` and `SharePanel` each compile and serialize synchronously on the main thread, often more than once for the same data.
- Two always-running intervals (250 ms and 15 s) for the whole app lifetime, on every page.
- Job progress is only saved on stage changes, a sensible choice that avoids 4 writes per second.

### 3.10 Extensibility and maintainability

**Strengths**
- The compile-once, render-many template design is a good base for any multi-format export.
- Adding a destination or template is mostly data (catalog entries).
- Types are thorough, and there are plenty of comments explaining *why*.
- The README is honest that connectors are simulated.

**Risks**
- **Every connector is a stub.** Making any of them real needs a backend (OAuth client secrets, token refresh, server-side upload, webhook signing), and none of that exists. Keeping the simulation is also a burden: fake failures (`flakiness`), fake latency and fake error messages are **product behaviour users would see in production**.
- `useCloud.tsx` is a god-object. It should be split into connections, jobs, scheduler and sharing, each testable on its own.
- **No multi-tab coordination.** `useExpenses` syncs through `storage` events, but `CloudProvider` only listens for `online`/`offline` (`useCloud.tsx:190-191`). Two open tabs each run the scheduler and job engine on their own copy of the state, so **a due rule fires once per tab**, and each tab overwrites the other's saved state (last write wins).
- **Change tracking is taken at the wrong moment.** `lastSyncAt` and `lastSyncFingerprint` are captured when a job *finishes* (`useCloud.tsx:241`), but the payload was built when the job was *queued*. Edits made during the "upload" are marked as synced even though they weren't in the payload.
- **Retention is too broad.** `keepLast` removes all history entries with the same destination and template, including manual runs, not just runs of that rule.
- `enqueue` keeps only the newest 40 jobs (`useCloud.tsx:364`). With more than 40 queued, the oldest *active* jobs are silently dropped.
- "Download again" after a reload rebuilds from *current* data. The API comment promises "the exact bytes a job delivered", which is only true until the page reloads.
- "Live sheet" format is just CSV. Share "Include transaction rows" does nothing for Raw Ledger (its column names are lowercase, so no `Amount` sheet matches), and for Monthly Summary it shares only the top 10 expenses.
- Minor correctness issues: the CSV guard turns `-12%` in "Month over month → Change" into `'-12%`. Markdown tables break on a newline in a description (only `|` is escaped). File-name dates come from UTC (`generatedAt.slice(0,10)`), so they can be a day off from local time. `downloadText` revokes the object URL straight away.
- **No user-controlled filtering.** Templates fix their own date scope. There's no custom range, category selection or column selection (compare v2).
- If merged after v2, v2's deletion of `src/lib/csv.ts` conflicts with v3's import of `escapeCell` from it.

### 3.11 Technical deep dive

| Question | Answer |
|---|---|
| How does export work? | **Local download:** Templates / History / Tray → `compileTemplate` → `serialize` → `downloadText` (Blob + `<a download>`). **"Cloud delivery":** RunDialog or schedule → `enqueue` compiles and serializes, stores the text in the in-memory cache, and adds a job. A 250 ms engine advances simulated progress, and `finishJob` rolls for failure, writes history, updates sync markers and shows a toast. **No bytes leave the browser.** **Share:** compile → compact payload → base64url → `/share#t=TOKEN&p=PAYLOAD` → viewer decodes and renders |
| File generation | String-based serializers from one sheet structure: multi-sheet CSV (BOM added at download), JSON (row objects), NDJSON, Markdown tables, standalone HTML with inline CSS and print styles. Printing through a hidden iframe. QR exported as SVG |
| User interaction | Dedicated `/export` route with 6 tabs (hash-linked). Modal consent and run dialogs. Destination-specific delivery previews (email, sheet tabs, Slack message, Notion rows, webhook request). Floating activity tray on every page. Header sync pill. Demo-workspace seeding. Public `/share` page |
| State management | One context (`CloudProvider`) plus a `stateRef` mirror, persisted whole to a single localStorage key on each committed change. Module-level `payloadCache` Map (not persisted). Two `setInterval` loops. Tab kept in `location.hash`. Local `useState` inside panels and dialogs |
| Edge cases | Handled: offline pause and resume, jobs resumed after reload, catch-up detection, monthly day capped at 28, retention cap (60 history entries), QR capacity meter and a message when the payload is too large, clipboard denial, expired links. **Not handled:** expired grants still deliver, malformed share payloads crash the viewer, multi-tab duplicate schedules, tampered expiry, active jobs dropped past 40, change tracking during a job, unknown destination IDs in storage crash every page |

---

## 4. Side-by-side comparison

### 4.1 Scale and structure

| Dimension | v1 | v2 | v3 |
|---|---|---|---|
| Files changed | 2 | 23 | 27 |
| Net LOC added | ~7 | ~1,950 | ~5,500 |
| Largest file | — | 391 (`ExportSettings.tsx`) | 803 (`useCloud.tsx`) |
| New routes | 0 | 0 (dialog) | 2 (`/export`, `/share`) |
| Global providers added | 0 | 1 (small) | 1 (large, timer-driven) |
| New dependencies | 0 | 0 | 0 |
| In-house "hard" subsystems | — | PDF writer | QR encoder, job engine, scheduler |
| Separation of logic and UI | n/a | **Strong** (pure `lib/export`) | Good in `lib/cloud`, but the hook mixes engine, state and side effects |

### 4.2 Capability matrix

| Capability | v1 | v2 | v3 |
|---|---|---|---|
| CSV | ✅ | ✅ (delimiter, header toggle) | ✅ (multi-sheet) |
| JSON | ❌ | ✅ (versioned envelope) | ✅ + NDJSON |
| PDF | ❌ | ✅ (native, paginated) | ❌ (HTML report printed through the browser instead) |
| Markdown / HTML | ❌ | ❌ | ✅ |
| Custom date range | ❌ | ✅ | ❌ (fixed per template) |
| Category filter | ❌ | ✅ (multi-select with counts) | ❌ |
| Column selection | ❌ | ✅ | ❌ |
| Sort order | ❌ | ✅ | fixed per template |
| Live preview of the real output | ❌ | ✅ | ✅ |
| Progress and cancel | ❌ | ✅ (real) | ✅ (simulated) |
| Report templates (tax, reimbursement…) | ❌ | ❌ | ✅ |
| Real cloud delivery | ❌ | ❌ | ❌ (**simulated only**) |
| Scheduling | ❌ | ❌ | ✅ (tab must be open; duplicates across tabs) |
| Sharing | ❌ | ❌ | ✅ URL-fragment links + QR (not revocable, expiry can be bypassed) |
| Remembered preferences | ❌ | ✅ | state persisted |

### 4.3 Quality attributes (1 = poor, 5 = excellent)

| Attribute | v1 | v2 | v3 | Notes |
|---|---|---|---|---|
| Correctness | 4 | 5 | 2 | v3: expiry not enforced, drift timing, multi-tab duplicates, viewer crash |
| Error handling | 2 | 5 | 3 | v1 silent. v2 thorough. v3 broad but has gaps and ignores `null` returns |
| Security / privacy | 5 | 5 | 2 | v3: forgeable branded pages, editable expiry, data in URLs, false "encrypted"/"backed up" claims |
| Performance | 5 | 4 | 3 | v2 has a fixed 600 ms minimum. v3 re-renders at 4 Hz with an O(n log n) fingerprint and a ~16k-node QR |
| Maintainability | 5 | 4 | 2 | v2 is layered and small per module. v3 is a large simulation and a god-hook |
| Extensibility | 1 | 4 | 3 | v2 format registry. v3 catalog-driven, but real connectors need a backend that doesn't exist |
| UX depth | 1 | 4 | 5 | v3 is the most ambitious. v2 is the most complete for *getting a file out* |
| Accessibility | 3 | 5 | 4 | v2 has careful ARIA throughout |
| Honesty of UI claims | 5 | 5 | 2 | v3 simulates success, failure and security properties users can't tell apart from real ones |
| Testability | 3 | 5 | 3 | v2 pure and injectable. v3 relies on timers, `Math.random` and module-level cache |

---

## 5. Recommendations for adopting or combining

1. **Use v2 as the foundation.** It has the best engineering: a pure, typed export core; a format registry; real progress and cancellation; thorough validation; secure escaping; and good accessibility. It fully covers "get my data out in a useful format".
2. **Keep v1's idea as a one-click shortcut on top of v2**, not its code: a "Quick CSV" action that calls `runExport` with default options skipping the dialog. Don't adopt v1's column reorder, which silently changes an existing file format.
3. **Take v3's template idea and move it into v2's architecture.** Its compile-then-serialize design (`CompiledExport` → renderers) is good. Templates could become presets that seed v2's `ExportOptions`, or v2's builders could accept a `CompiledExport`. Worth keeping: Markdown, NDJSON, the standalone HTML report, and the Tax and Reimbursement layouts. **Don't** adopt v3's fixed-scope-only approach, because v2's filters are strictly more flexible.
4. **Don't ship v3's cloud layer as it is.** Before any of it reaches users:
   - Remove or clearly gate simulated behaviour (random failures, fake latency, fake error messages, the "Encrypted-at-rest", "Restore" and "Everything is backed up" claims).
   - Real connectors need a backend for OAuth, tokens, uploads and signing. Make that decision explicitly and scope it separately.
   - If share links stay: sign or MAC payloads if a server secret becomes available (otherwise say plainly that links can be forged and their expiry changed), validate the payload schema fully in `decodeShare`, default to summary-only, add `noindex`, and rename "Revoke" to "Remove from list".
   - Fix: enforce `expiresAt` in `enqueue`, handle `null` from `runExport`, coordinate across tabs (`storage` events or `BroadcastChannel` plus a leader lock) before enabling schedules, capture the fingerprint when a job is queued, limit retention to the rule's own runs, and avoid dropping active jobs.
   - Performance: take the fingerprint out of the per-tick memo, render QR with a single `<path>`, and split `useCloud` into smaller providers or a store with selectors so the 250 ms tick doesn't re-render the header on every page.
5. **Merge conflict to plan for:** v2 deletes `src/lib/csv.ts`, and v3 imports `escapeCell` from it. If combining, import v2's delimiter-aware `escapeCell` from `lib/export/csv.ts` everywhere.
6. **Add tests before merging any of v2 or v3.** The pure modules (`select`, `csv`, `json`, `filename`, `pdf/report#planReport`, `templates`, `schedule`, `share`, `qr`) are easy to cover, and none of their tests are in the repo.
7. **Consider replacing the in-house engines** if requirements grow: a PDF library for non-Latin text (v2 currently turns it into `?`), and a maintained QR library (v3's encoder appears correct, but it's 439 lines of spec code to own).
