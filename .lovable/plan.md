## Export Properties to CSV

Add an "Export" button to the Properties view that downloads a CSV of the current filtered list using the active columns.

### Behavior

- Respects all active filters, search, dedupe, and sort (exports `displayProperties` in current order).
- Columns = currently visible columns (same set, same order as the table).
- Filename: `properties-YYYY-MM-DD.csv`.
- Each cell rendered as plain text (no badges/icons). Examples:
  - Address column → just the street address (bed/bath stays in its own column if visible).
  - Owner column → primary owner name, plus secondary owner if present, phones joined with `; `.
  - Mailing address → formatted single-line string.
  - Stage → stage name.
  - Est. Revenue → numeric (no `$`).
  - Tags → joined with `; ` (excluding internal `list-*` tags).
  - Custom fields and default fields → raw value or empty.
- Properly CSV-escapes commas, quotes, and newlines.
- Disabled while filtering is in progress or when result count is 0.

### Files

- **New** `src/lib/exportProperties.ts` — `exportPropertiesToCsv(properties, visibleColumns, fields, stages)` that builds the CSV and triggers a browser download via a Blob + anchor.
- **Edit** `src/components/crm/FilterBar.tsx` — add an `onExport` prop and an "Export" button (with download icon) next to the existing column/list controls. Show a small count hint like "Export 1,234".
- **Edit** `src/components/crm/MainApp.tsx` — pass an `onExport` handler that calls the lib with `displayProperties`, `visibleColumns`, `fields`, `stages`.

No backend changes, no schema changes.
